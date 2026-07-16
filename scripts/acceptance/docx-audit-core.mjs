// scripts/acceptance/docx-audit-core.mjs
//
// Pure, reusable DOCX structural auditor. Does NOT require Microsoft Word.
// Parses the OOXML ZIP package directly using jszip (already a project dependency).
//
// The module exports `auditDocx(buffer, options)` returning a structured manifest.
// It never mutates the input buffer or the source file.

import { createRequire } from "module";
import crypto from "crypto";
import path from "path";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);
let JSZip;
try {
  JSZip = require("jszip");
} catch {
  const nodepath = process.env.NODE_PATH;
  if (nodepath) {
    const candidates = nodepath.split(path.delimiter).map((p) => path.join(p, "jszip"));
    let loaded = false;
    for (const c of candidates) {
      try {
        JSZip = require(pathToFileURL(c).href);
        loaded = true;
        break;
      } catch {}
    }
    if (!loaded) {
      throw new Error(
        "jszip nao encontrado via NODE_PATH. Instale as dependencias do projeto (npm ci)."
      );
    }
  } else {
    throw new Error(
      "jszip nao encontrado. Defina NODE_PATH para um node_modules com jszip ou instale as dependencias do projeto."
    );
  }
}

export const DEFAULT_MARKER = "Elemento visual não inserido neste rascunho textual";

export const DEFAULT_LIMITS = {
  maxEntries: 10000,
  maxUncompressedBytes: 500 * 1024 * 1024,
  maxSingleEntryBytes: 100 * 1024 * 1024,
  maxXmlEntryBytes: 50 * 1024 * 1024,
  maxMediaEntryBytes: 250 * 1024 * 1024,
};

export const VALID_PROFILES = ["general", "pdf-text-draft"];

export const QUANTITATIVE_METRICS = [
  "images",
  "markers",
  "wordTables",
  "bookmarks",
  "bookmarkEnds",
  "pageref",
  "tocFields",
  "hyperlinks",
  "drawings",
  "inlineDrawings",
  "anchoredDrawings",
  "mediaFiles",
  "externalImageRelationships",
  "brokenRelationships",
  "orphanMedia",
  "duplicateMedia",
  "smallImages",
  "sections",
  "explicitPageBreaks",
  "sectionBreaks",
];

const REQUIRED_PARTS = [
  "[Content_Types].xml",
  "word/document.xml",
  "word/_rels/document.xml.rels",
  "word/settings.xml",
  "word/styles.xml",
  "word/numbering.xml",
];

const MOJIBAKE_MARKERS = ["â€“", "Ã§", "Ã£", "Ã©", "Â"];

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function count(re, str) {
  if (typeof str !== "string") return 0;
  const m = str.match(re);
  return m ? m.length : 0;
}

function paragraphText(pXml) {
  if (!pXml) return "";
  const runs = [...pXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
  return runs.map((r) => r[1]).join("");
}

function extractParagraphs(docXml) {
  if (!docXml) return [];
  return [...docXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => m[0]);
}

// Reconstruct Word fields from fldChar/instrText state machine + fldSimple.
function reconstructFields(docXml) {
  const result = {
    fieldCommands: [],
    fldCharBeginCount: 0,
    fldCharSeparateCount: 0,
    fldCharEndCount: 0,
    malformedFields: 0,
    incompleteCommands: 0,
  };
  if (!docXml) return result;

  const begin = count(/<w:fldChar\b[^>]*?w:fldCharType="begin"[^>]*>/g, docXml);
  const sep = count(/<w:fldChar\b[^>]*?w:fldCharType="separate"[^>]*>/g, docXml);
  const end = count(/<w:fldChar\b[^>]*?w:fldCharType="end"[^>]*>/g, docXml);
  result.fldCharBeginCount = begin;
  result.fldCharSeparateCount = sep;
  result.fldCharEndCount = end;

  // State machine across the document (preserving order).
  // Non-greedy [^>]*? so the fldCharType is captured even when other
  // attributes (e.g. w:dirty) appear after it.
  const tokens = [...docXml.matchAll(
    /<w:fldChar\b[^>]*?w:fldCharType="(begin|separate|end)"[^>]*?\/?>|<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g
  )];
  let building = false;
  let acc = "";
  let ended = false;
  const pushCmd = () => {
    const cmd = acc.replace(/\s+/g, " ").trim();
    if (cmd) {
      if (ended) result.fieldCommands.push(cmd);
      else {
        result.incompleteCommands++;
        result.fieldCommands.push(cmd);
      }
    }
    acc = "";
    building = false;
    ended = false;
  };
  for (const t of tokens) {
    if (t[1]) {
      const type = t[1];
      if (type === "begin") {
        if (building) result.malformedFields++;
        building = true;
        acc = "";
        ended = false;
      } else if (type === "separate") {
        if (building) ended = true;
      } else if (type === "end") {
        if (building) {
          ended = true;
          pushCmd();
        } else {
          result.malformedFields++;
        }
      }
    } else {
      // instrText
      if (building) acc += t[2];
    }
  }
  if (building) {
    // never closed
    const cmd = acc.replace(/\s+/g, " ").trim();
    if (cmd) {
      result.incompleteCommands++;
      result.fieldCommands.push(cmd);
    }
  }

  // fldSimple (self contained)
  for (const m of docXml.matchAll(/<w:fldSimple[^>]*\bw:instr="([^"]+)"/g)) {
    result.fieldCommands.push(m[1].replace(/\s+/g, " ").trim());
  }
  return result;
}

function classifyFields(cmds) {
  const toc = [];
  const pageref = [];
  const hyperlink = [];
  const other = [];
  for (const c of cmds) {
    // Avoid false positives from the word "toc" in ordinary text: only treat as
    // TOC field when the command starts with TOC (case-insensitive), not e.g.
    // "...toc...". Also require it is not a PAGEREF/HYPERLINK.
    if (/^PAGEREF\b/i.test(c)) pageref.push(c);
    else if (/^HYPERLINK\b/i.test(c)) hyperlink.push(c);
    else if (/^TOC\b/i.test(c)) toc.push(c);
    else other.push(c);
  }
  return { toc, pageref, hyperlink, other };
}

function parsePngHeader(buf) {
  // Returns { width, height } or throws with a code.
  if (!buf || buf.length < 24) {
    const e = new Error("PNG muito curto");
    e.code = "INVALID_PNG_HEADER";
    throw e;
  }
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    const e = new Error("Assinatura PNG invalida");
    e.code = "INVALID_PNG_HEADER";
    throw e;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
    const e = new Error("Dimensoes PNG invalidas");
    e.code = "INVALID_PNG_HEADER";
    throw e;
  }
  return { width, height };
}

function imageFormat(lowerName) {
  if (lowerName.endsWith(".png")) return "png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "jpeg";
  if (lowerName.endsWith(".gif")) return "gif";
  if (lowerName.endsWith(".bmp")) return "bmp";
  if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) return "tiff";
  if (lowerName.endsWith(".emf")) return "emf";
  if (lowerName.endsWith(".wmf")) return "wmf";
  if (lowerName.endsWith(".svg")) return "svg";
  return "unknown";
}

function parseImageSize(buf, lowerName) {
  const fmt = imageFormat(lowerName);
  if (fmt === "png") {
    try {
      return parsePngHeader(buf);
    } catch (e) {
      return { error: e.code || "INVALID_PNG_HEADER" };
    }
  }
  // No parser available for other formats; never invent dimensions.
  return null;
}

function normalizeExpectValue(v) {
  // A plain number means exact.
  if (typeof v === "number") return { exact: v };
  if (v && typeof v === "object") {
    const out = {};
    if ("exact" in v) out.exact = v.exact;
    if ("min" in v) out.min = v.min;
    if ("max" in v) out.max = v.max;
    return out;
  }
  return v;
}

export function validateExpectSpec(metric, spec) {
  // Returns null if valid, or an error string.
  if (!QUANTITATIVE_METRICS.includes(metric)) {
    return `Metrica desconhecida: ${metric}`;
  }
  if (spec === undefined || spec === null) return null;
  let s;
  if (typeof spec === "number") s = { exact: spec };
  else if (typeof spec === "object") s = spec;
  else return `Expectativa de tipo incorreto para ${metric}`;

  const keys = Object.keys(s);
  if (keys.length === 0) return `Expectativa vazia para ${metric}`;
  for (const k of keys) {
    if (!["exact", "min", "max"].includes(k)) return `Chave invalida ${k} em ${metric}`;
    if (!Number.isInteger(s[k]) || s[k] < 0) return `Valor invalido para ${metric}.${k}`;
  }
  if ("exact" in s && (keys.length > 1)) {
    return `exact nao pode coexistir com min/max em ${metric}`;
  }
  if ("min" in s && "max" in s && s.min > s.max) {
    return `min maior que max em ${metric}`;
  }
  return null;
}

export function evaluateMetric(value, spec) {
  // spec already normalized; returns true/false.
  if (spec === undefined || spec === null) return true;
  const s = normalizeExpectValue(spec);
  if (typeof s === "number" || typeof s === "string") return value === s; // not used post-normalize
  if ("exact" in s && s.exact !== undefined) return value === s.exact;
  if ("min" in s && s.min !== undefined && value < s.min) return false;
  if ("max" in s && s.max !== undefined && value > s.max) return false;
  return true;
}

function detectMojibake(text) {
  return MOJIBAKE_MARKERS.some((m) => text.includes(m));
}

/**
 * Audit a DOCX from its raw bytes.
 */
export async function auditDocx(buffer, options = {}) {
  const sourcePath = options.sourcePath || "<buffer>";
  const marker = options.marker || DEFAULT_MARKER;
  const minImageBytes = options.minImageBytes ?? 0;
  const termOccurrences = Array.isArray(options.termOccurrences) ? options.termOccurrences : [];
  const captureParagraphText = options.captureParagraphText !== false;
  const captureSequence = options.captureSequence !== false;
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };

  const manifest = {
    schema: "docx-structural-audit/v2",
    file: sourcePath,
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
    auditedAt: new Date().toISOString(),
    issues: { failures: [], warnings: [] },
    limits,
  };

  // ---- ZIP load with limits ----
  let zip;
  try {
    const loadOpts = { createFolders: false };
    zip = await JSZip.loadAsync(buffer, loadOpts);
  } catch (err) {
    manifest.issues.failures.push({
      code: "INVALID_ZIP",
      message: `Falha ao abrir o pacote ZIP/OOXML: ${err.message}`,
    });
    return manifest;
  }

  const entries = Object.entries(zip.files);
  const names = entries.map(([n]) => n);

  // ZIP limits (estimated by compressed+declared sizes; full uncompressed estimate)
  if (names.length > limits.maxEntries) {
    manifest.issues.failures.push({
      code: "ZIP_ENTRY_LIMIT",
      message: `Entradas ${names.length} excedem limite ${limits.maxEntries}`,
    });
    return manifest;
  }
  let compressedTotal = 0;
  let uncompressedTotal = 0;
  let singleTooBig = false;
  let xmlTooBig = false;
  let mediaTooBig = false;
  for (const [name, f] of entries) {
    const c = f._data ? f._data.compressedSize : 0;
    const u = f._data ? f._data.uncompressedSize : 0;
    compressedTotal += c || 0;
    uncompressedTotal += u || 0;
    const lower = name.toLowerCase();
    if ((u || 0) > limits.maxSingleEntryBytes) singleTooBig = true;
    if (lower.endsWith(".xml") && (u || 0) > limits.maxXmlEntryBytes) xmlTooBig = true;
    if (/\.(png|jpe?g|gif|bmp|tiff?|emf|wmf|svg)$/.test(lower) && (u || 0) > limits.maxMediaEntryBytes)
      mediaTooBig = true;
  }
  if (uncompressedTotal > limits.maxUncompressedBytes) {
    manifest.issues.failures.push({
      code: "ZIP_UNCOMPRESSED_SIZE_LIMIT",
      message: `Tamanho descompactado estimado ${uncompressedTotal} excede ${limits.maxUncompressedBytes}`,
    });
  }
  if (singleTooBig) {
    manifest.issues.failures.push({
      code: "ZIP_SINGLE_ENTRY_LIMIT",
      message: `Uma entrada excede ${limits.maxSingleEntryBytes} bytes`,
    });
  }
  if (xmlTooBig) {
    manifest.issues.failures.push({
      code: "ZIP_XML_ENTRY_LIMIT",
      message: `Uma entrada XML excede ${limits.maxXmlEntryBytes} bytes`,
    });
  }
  if (mediaTooBig) {
    manifest.issues.failures.push({
      code: "ZIP_MEDIA_ENTRY_LIMIT",
      message: `Uma mídia excede ${limits.maxMediaEntryBytes} bytes`,
    });
  }
  if (manifest.issues.failures.length) return manifest;

  const has = (n) => names.includes(n);

  manifest.requiredParts = {};
  for (const part of REQUIRED_PARTS) {
    manifest.requiredParts[part] = has(part);
    if (!has(part) && part === "word/document.xml") {
      manifest.issues.failures.push({
        code: "MISSING_DOCUMENT_XML",
        message: "word/document.xml ausente: documento invalido.",
      });
    }
  }

  const docXml = has("word/document.xml") ? await zip.file("word/document.xml").async("string") : null;
  const relsXml = has("word/_rels/document.xml.rels")
    ? await zip.file("word/_rels/document.xml.rels").async("string")
    : null;

  if (!docXml) {
    // Already recorded MISSING_DOCUMENT_XML failure above.
    return manifest;
  }

  const paras = docXml ? extractParagraphs(docXml) : [];
  manifest.paragraphs = paras.length;
  manifest.paragraphText = captureParagraphText ? paras.map((p) => paragraphText(p)) : undefined;

  manifest.drawing = count(/<w:drawing>/g, docXml);
  manifest.wpInline = count(/<wp:inline/g, docXml);
  manifest.wpAnchor = count(/<wp:anchor/g, docXml);
  manifest.blip = count(/<a:blip/g, docXml);

  // ---- Field reconstruction ----
  const fields = reconstructFields(docXml);
  manifest.fieldCommands = fields.fieldCommands;
  manifest.fldCharBeginCount = fields.fldCharBeginCount;
  manifest.fldCharSeparateCount = fields.fldCharSeparateCount;
  manifest.fldCharEndCount = fields.fldCharEndCount;
  manifest.malformedFields = fields.malformedFields;
  manifest.incompleteCommands = fields.incompleteCommands;
  const classified = classifyFields(fields.fieldCommands);
  manifest.tocFields = classified.toc.length;
  manifest.pagerefFields = classified.pageref.length;
  manifest.hyperlinkFields = classified.hyperlink.length;
  manifest.otherFields = classified.other.length;

  // Tables / breaks / sections
  manifest.tables = count(/<w:tbl>/g, docXml);
  manifest.pageBreaks = count(/<w:br\s+w:type="page"/g, docXml);
  manifest.sectionBreaks = count(/<w:br\s+w:type="section"/g, docXml);
  manifest.sectionPr = count(/<w:sectPr/g, docXml);
  manifest.sections = manifest.sectionPr;

  // ---- Bookmarks ----
  const startIds = [];
  const endIds = [];
  const startNames = [];
  const startMatches = [...docXml.matchAll(/<w:bookmarkStart\b([^>]*)\/?>/g)];
  const endMatches = [...docXml.matchAll(/<w:bookmarkEnd\b([^>]*)\/?>/g)];
  for (const m of startMatches) {
    const id = (m[1].match(/w:id="([^"]+)"/) || [])[1];
    const name = (m[1].match(/w:name="([^"]+)"/) || [])[1];
    if (id) startIds.push(id);
    if (name) startNames.push(name);
  }
  for (const m of endMatches) {
    const id = (m[1].match(/w:id="([^"]+)"/) || [])[1];
    if (id) endIds.push(id);
  }
  const startSet = new Set(startIds);
  const endSet = new Set(endIds);
  manifest.bookmarkStart = startIds.length;
  manifest.bookmarkEnd = endIds.length;
  manifest.bookmarkNames = startNames;
  manifest.bookmarkStartIds = startIds;
  manifest.bookmarkEndIds = endIds;
  manifest.bookmarkStartsWithoutEnd = startIds.filter((id) => !endSet.has(id));
  manifest.bookmarkEndsWithoutStart = endIds.filter((id) => !startSet.has(id));
  manifest.bookmarkDuplicateNames = startNames.filter((n, i) => startNames.indexOf(n) !== i);
  manifest.bookmarkDuplicateIds = startIds.filter((n, i) => startIds.indexOf(n) !== i);
  manifest.bookmarkUniqueNames = [...new Set(startNames)];

  // Visual markers
  manifest.markers = [];
  paras.forEach((p, i) => {
    const t = paragraphText(p);
    if (t.includes(marker)) {
      manifest.markers.push({
        index: i,
        type: t.includes("colunas") ? "colunas" : "outro",
        text: t,
      });
    }
  });
  manifest.markerCount = manifest.markers.length;

  // Term occurrences
  const joinedText = paras.map((p) => paragraphText(p)).join("\n");
  manifest.termOccurrences = {};
  for (const term of termOccurrences) {
    manifest.termOccurrences[term] = count(
      new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      joinedText
    );
  }
  manifest.hasSection43 =
    joinedText.includes("4.3") || fields.fieldCommands.some((c) => /4\.3/.test(c));

  // ---- Sequence (improved) ----
  if (captureSequence) {
    manifest.sequence = buildSequence(paras, paragraphText, "body", manifest.markers);
  }

  // ---- Relationships (body + headers + footers) ----
  const relAnalyses = await analyzeRelationships(
    zip,
    names,
    docXml,
    "body",
    "word/document.xml",
    "word/_rels/document.xml.rels",
    minImageBytes
  );

  // headers / footers
  const headerRels = [];
  const footerRels = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    if (/^word\/header\d*\.xml$/.test(lower)) {
      const hXml = await zip.file(name).async("string");
      const relName = name.replace(/^word\//, "").replace(/\.xml$/, "") + ".xml.rels";
      const relPath = `word/_rels/${relName}`;
      const h = await analyzeRelationships(zip, names, hXml, "header", name, relPath, minImageBytes);
      headerRels.push({ part: name, ...h });
    } else if (/^word\/footer\d*\.xml$/.test(lower)) {
      const fXml = await zip.file(name).async("string");
      const relName = name.replace(/^word\//, "").replace(/\.xml$/, "") + ".xml.rels";
      const relPath = `word/_rels/${relName}`;
      const f = await analyzeRelationships(zip, names, fXml, "footer", name, relPath, minImageBytes);
      footerRels.push({ part: name, ...f });
    }
  }

  // Aggregate ALL physical media from body + headers + footers, keyed by
  // zipPath, so orphan files (referenced by no relationship) are still listed.
  // The same physical file referenced by multiple relationships counts once.
  const allMedia = new Map(); // zipPath -> media info
  const registerMedia = (info) => {
    if (info && info.zipPath && !allMedia.has(info.zipPath)) {
      allMedia.set(info.zipPath, {
        name: info.name,
        zipPath: info.zipPath,
        sizeBytes: info.sizeBytes,
        sha256: info.sha256,
        format: info.format,
        dimensions: info.dimensions,
        pngHeaderError: info.pngHeaderError || null,
        small: info.small,
      });
    }
  };
  [relAnalyses, ...headerRels, ...footerRels].forEach((part) => {
    const pm = part.physicalMedia;
    if (pm) for (const info of pm.values()) registerMedia(info);
    // Also register media referenced by relationships that live outside word/media.
    if (part && Array.isArray(part.media)) {
      for (const info of part.media) registerMedia(info);
    }
  });

  // Merge relationship analytics (uniform contract across body/headers/footers)
  const embeddedImageRels = [
    ...relAnalyses.embeddedImageRelationships,
    ...headerRels.flatMap((h) => h.embeddedImageRelationships || []),
    ...footerRels.flatMap((f) => f.embeddedImageRelationships || []),
  ];
  const externalImageRels = [
    ...relAnalyses.externalImageRelationships,
    ...headerRels.flatMap((h) => h.externalImageRelationships || []),
    ...footerRels.flatMap((f) => f.externalImageRelationships || []),
  ];
  const brokenEmbeddedRels = [
    ...relAnalyses.brokenEmbeddedRelationships,
    ...headerRels.flatMap((h) => h.brokenEmbeddedRelationships || []),
    ...footerRels.flatMap((f) => f.brokenEmbeddedRelationships || []),
  ];
  const unresolvedBlipRefs = [
    ...relAnalyses.unresolvedBlipReferences,
    ...headerRels.flatMap((h) => h.unresolvedBlipReferences || []),
    ...footerRels.flatMap((f) => f.unresolvedBlipReferences || []),
  ];
  const usedRids = new Set([
    ...(Array.isArray(relAnalyses.usedRids) ? relAnalyses.usedRids : []),
    ...headerRels.flatMap((h) => (Array.isArray(h.usedRids) ? h.usedRids : [])),
    ...footerRels.flatMap((f) => (Array.isArray(f.usedRids) ? f.usedRids : [])),
  ]);

  manifest.body = relAnalyses.summary;
  manifest.headers = headerRels.map((h) => ({ part: h.part, ...h.summary }));
  manifest.footers = footerRels.map((f) => ({ part: f.part, ...f.summary }));

  manifest.media = [...allMedia.values()];
  manifest.mediaCount = allMedia.size;
  manifest.mediaFiles = allMedia.size;

  manifest.embeddedImageRelationships = embeddedImageRels.length;
  manifest.externalImageRelationships = externalImageRels.length;
  manifest.usedImageRelationships = usedRids.size;
  manifest.unusedImageRelationships = embeddedImageRels
    .filter((r) => !usedRids.has(r.id))
    .map((r) => r.id);
  // Broken relationships: keep the list AND the count as separate fields.
  manifest.brokenEmbeddedRelationships = brokenEmbeddedRels;
  manifest.brokenEmbeddedRelationshipCount = brokenEmbeddedRels.length;
  manifest.brokenRelationships = manifest.brokenEmbeddedRelationshipCount;
  manifest.unresolvedBlipReferences = unresolvedBlipRefs;

  // Orphan media: physical media not referenced by any embedded relationship.
  const referencedEmbeddedMediaPaths = new Set(
    embeddedImageRels.map((r) => r.resolvedTarget).filter(Boolean)
  );
  manifest.orphanMedia = [...allMedia.values()]
    .filter((m) => !referencedEmbeddedMediaPaths.has(m.zipPath))
    .map((m) => m.name);
  manifest.orphanMediaCount = manifest.orphanMedia.length;

  // Duplicate media by sha256 (two different physical files, same hash)
  const byHash = {};
  for (const m of allMedia.values()) {
    (byHash[m.sha256] ||= []).push(m.name);
  }
  manifest.duplicateMedia = Object.entries(byHash)
    .filter(([, v]) => v.length > 1)
    .map(([hash, names]) => ({ hash, names }));
  manifest.duplicateMediaCount = manifest.duplicateMedia.length;

  manifest.smallImages = [...allMedia.values()].filter((m) => m.small).map((m) => m.name);
  manifest.smallImagesCount = manifest.smallImages.length;

  // raw relationship arrays for debugging
  manifest.embeddedImageRelationshipList = embeddedImageRels;
  manifest.externalImageRelationshipList = externalImageRels;

  // PNG warnings
  for (const m of allMedia.values()) {
    if (m.dimensions && m.dimensions.error) {
      manifest.issues.warnings.push({
        code: m.dimensions.error,
        message: `Imagem ${m.name}: ${m.dimensions.error}`,
      });
    }
  }

  // Relationship-level warnings (e.g. internal image outside word/media).
  const relWarningSources = [relAnalyses, ...headerRels, ...footerRels];
  for (const part of relWarningSources) {
    if (part && Array.isArray(part.relationshipWarnings)) {
      for (const w of part.relationshipWarnings) manifest.issues.warnings.push(w);
    }
  }

  return manifest;
}

function buildSequence(paras, getText, origin, markers) {
  const out = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const text = getText(p);
    const rIds = [...p.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
    const drawingCount = count(/<w:drawing>/g, p);
    out.push({
      type: drawingCount > 0 ? "drawing" : "paragraph",
      index: i,
      text: text.slice(0, 120),
      rIds,
      drawingCount,
      origin,
      prevType: i > 0 ? (count(/<w:drawing>/g, paras[i - 1]) > 0 ? "drawing" : "paragraph") : null,
      nextType:
        i < paras.length - 1
          ? count(/<w:drawing>/g, paras[i + 1]) > 0
            ? "drawing"
            : "paragraph"
          : null,
    });
  }
  return out;
}

/**
 * Resolve an internal OOXML relationship target relative to the source part.
 * source: e.g. "word/document.xml", "word/header1.xml"
 * target: e.g. "media/image1.png", "./media/image1.png", "../media/image1.png",
 *              "media\\image2.png" (backslashes)
 * Returns a normalized package-relative path (always with forward slashes),
 * e.g. "word/media/image1.png". Returns null for external/absolute targets.
 */
export function resolveTarget(source, target) {
  if (!target) return null;
  let t = String(target).replace(/\\/g, "/").trim();
  if (!t) return null;
  // External indicators: absolute URI with scheme, or explicit External mode
  // handled by caller; here we just attempt to normalize internal paths.
  const isAbsoluteExternal =
    /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith("/");
  if (/^(https?:|mailto:|file:)/i.test(t) || isAbsoluteExternal) {
    // Do not normalize absolute/external targets as package paths.
    return null;
  }
  const sourceDir = path.posix.dirname(source); // e.g. "word"
  const joined = path.posix.normalize(path.posix.join(sourceDir, t)); // "word/media/image1.png"
  // Reject paths that escape the package root.
  if (!joined || joined.startsWith("..") || joined.startsWith("/")) {
    return null;
  }
  return joined;
}

/**
 * Build a physical inventory of all files under word/media (independent of relationships).
 * Returns a Map: zipPath -> media info. Also exposes names for fast lookup.
 */
async function inventoryPhysicalMedia(zip, minImageBytes = 0) {
  const inventory = new Map();
  const mediaFolder = zip.folder("word/media");
  if (!mediaFolder) return inventory;
  for (const [key, entry] of Object.entries(mediaFolder.files)) {
    if (entry.dir) continue;
    if (!/^word\/media\//i.test(key)) continue;
    const relName = key.replace(/^word\//, ""); // e.g. "media/image1.png"
    let buf;
    try {
      buf = await entry.async("nodebuffer");
    } catch {
      continue;
    }
    if (!Buffer.isBuffer(buf)) continue;
    const lower = relName.toLowerCase();
    const dims = parseImageSize(buf, lower);
    const isPng = /\.png$/i.test(lower);
    const headerError = isPng ? dims && dims.error ? dims.error : null : null;
    inventory.set(key, {
      name: relName,
      zipPath: key, // full zip path, e.g. "word/media/image1.png"
      sizeBytes: buf.length,
      sha256: sha256(buf),
      format: imageFormat(lower),
      dimensions: dims && dims.error ? { error: dims.error } : dims,
      pngHeaderError: headerError,
      small: minImageBytes > 0 && buf.length < minImageBytes,
      _buf: buf,
    });
  }
  return inventory;
}

/**
 * Load media info for a referenced internal zip entry (any location).
 * Returns the media info object, or null if the entry does not exist.
 * Emits a NONSTANDARD_IMAGE_PART_LOCATION warning via the optional
 * warningsBucket when the part is outside the canonical word/media folder.
 */
async function loadMediaInfoFromZip(zip, zipPath, names, minImageBytes, warningsBucket) {
  if (!zipPath || !names.includes(zipPath)) return null;
  const entry = zip.file(zipPath);
  if (!entry || entry.dir) return null;
  let buf;
  try {
    buf = await entry.async("nodebuffer");
  } catch {
    return null;
  }
  if (!Buffer.isBuffer(buf)) return null;
  const relName = zipPath.replace(/^word\//, "");
  const lower = relName.toLowerCase();
  const dims = parseImageSize(buf, lower);
  const isPng = /\.png$/i.test(lower);
  const pngHeaderError = isPng ? (dims && dims.error ? dims.error : null) : null;
  const isStandardLocation = /^word\/media\//i.test(zipPath);
  if (!isStandardLocation && warningsBucket) {
    warningsBucket.push({
      code: "NONSTANDARD_IMAGE_PART_LOCATION",
      message: `Imagem interna fora de word/media: ${zipPath}`,
    });
  }
  return {
    name: relName,
    zipPath,
    sizeBytes: buf.length,
    sha256: sha256(buf),
    format: imageFormat(lower),
    dimensions: dims && dims.error ? { error: dims.error } : dims,
    pngHeaderError,
    small: minImageBytes > 0 && buf.length < minImageBytes,
  };
}

async function analyzeRelationships(zip, names, xml, origin, partName, relPath, minImageBytes = 0) {
  const emptySummary = {
    drawings: 0,
    inlineDrawings: 0,
    anchoredDrawings: 0,
    imageRelationships: 0,
    embeddedImageRelationships: 0,
    externalImageRelationships: 0,
    mediaCount: 0,
  };
  if (!xml) {
    return {
      embeddedImageRelationships: [],
      externalImageRelationships: [],
      brokenEmbeddedRelationships: [],
      unresolvedBlipReferences: [],
      usedRids: [],
      media: [],
      summary: emptySummary,
    };
  }

  // Physical inventory of word/media (independent of relationships).
  const physicalMedia = await inventoryPhysicalMedia(zip, minImageBytes);
  const physicalMediaPaths = new Set(physicalMedia.keys());

  const relsXml =
    partName && relPath && names.includes(relPath)
      ? await zip.file(relPath).async("string")
      : null;

  const embeddedImageRels = [];
  const externalImageRels = [];
  const usedRids = new Set();
  const brokenEmbeddedRels = [];
  const unresolvedEmbeddedReferences = [];
  const unresolvedLinkedReferences = [];
  const unresolvedBlipRefs = [];

  // Collect r:embed and r:link referenced in the XML.
  const embeds = [...xml.matchAll(/r:embed="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !!v);
  const links = [...xml.matchAll(/r:link="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !!v);
  embeds.forEach((r) => usedRids.add(r));
  links.forEach((r) => usedRids.add(r));

  const embeddedRids = new Set(embeds);
  const linkedRids = new Set(links);

  if (relsXml) {
    const relMatches = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)];
    for (const m of relMatches) {
      const attrs = m[1];
      const id = (attrs.match(/Id="([^"]+)"/) || [])[1] || "";
      const type = (attrs.match(/Type="([^"]+)"/) || [])[1] || "";
      const target = (attrs.match(/Target="([^"]+)"/) || [])[1] || "";
      const targetMode = (attrs.match(/TargetMode="([^"]+)"/) || [])[1] || "Internal";
      const isImage = /image$/i.test(type);
      if (!isImage) continue;

      const isExternal =
        targetMode === "External" ||
        /^(https?:|mailto:|file:)/i.test(target) ||
        /^[a-z][a-z0-9+.-]*:/i.test(target) ||
        target.startsWith("/");

      if (isExternal) {
        externalImageRels.push({
          id,
          type,
          target,
          targetMode,
          used: usedRids.has(id),
          resolvedTarget: null,
        });
      } else {
        const resolved = partName ? resolveTarget(partName, target) : null;
        // Existence considers any internal ZIP entry (incl. outside word/media).
        const exists = !!resolved && names.includes(resolved);
        if (!exists) {
          brokenEmbeddedRels.push({
            id,
            target,
            resolvedTarget: resolved,
            reason: resolved ? "midia_referenciada_inexistente" : "target_invalido_ou_externo",
          });
        }
        embeddedImageRels.push({
          id,
          type,
          target,
          targetMode,
          used: usedRids.has(id),
          resolvedTarget: resolved,
        });
      }
    }
  }

  // Load media info only for referenced embedded relationships (single load per physical file).
  const media = [];
  const loadedZipPaths = new Set();
  const relationshipWarnings = [];
  for (const r of embeddedImageRels) {
    const zipPath = r.resolvedTarget;
    if (!zipPath) continue;
    if (loadedZipPaths.has(zipPath)) continue; // don't double-load the same physical file
    let info = physicalMedia.get(zipPath);
    if (!info) {
      // Internal image located outside the canonical word/media folder.
      info = await loadMediaInfoFromZip(zip, zipPath, names, minImageBytes, relationshipWarnings);
    }
    if (!info) continue;
    loadedZipPaths.add(zipPath);
    media.push({
      name: info.name,
      zipPath: info.zipPath,
      sizeBytes: info.sizeBytes,
      sha256: info.sha256,
      format: info.format,
      dimensions: info.dimensions,
      pngHeaderError: info.pngHeaderError || null,
      small: info.small,
    });
  }

  // Unresolved references: referenced id has no matching relationship.
  const relIds = new Set([
    ...embeddedImageRels.map((r) => r.id),
    ...externalImageRels.map((r) => r.id),
  ]);
  for (const r of embeds) {
    if (!relIds.has(r)) unresolvedEmbeddedReferences.push(r);
  }
  for (const r of links) {
    if (!relIds.has(r)) unresolvedLinkedReferences.push(r);
  }
  unresolvedBlipRefs.push(...unresolvedEmbeddedReferences, ...unresolvedLinkedReferences);

  const summary = {
    drawings: count(/<w:drawing>/g, xml),
    inlineDrawings: count(/<wp:inline/g, xml),
    anchoredDrawings: count(/<wp:anchor/g, xml),
    imageRelationships: embeddedImageRels.length + externalImageRels.length,
    embeddedImageRelationships: embeddedImageRels.length,
    externalImageRelationships: externalImageRels.length,
    mediaCount: media.length,
  };

  return {
    embeddedImageRelationships: embeddedImageRels,
    externalImageRelationships: externalImageRels,
    brokenEmbeddedRelationships: brokenEmbeddedRels,
    unresolvedEmbeddedReferences,
    unresolvedLinkedReferences,
    unresolvedBlipReferences: unresolvedBlipRefs,
    usedRids: [...usedRids],
    media,
    physicalMedia,
    physicalMediaPaths,
    relationshipWarnings,
    summary,
  };
}

/**
 * Evaluate a manifest against a profile + expectations (uniform API).
 * Returns { approved, failures, warnings, configErrors }.
 */
export function evaluateManifest(manifest, profile = "general", expectRaw = {}) {
  const failures = [];
  const warnings = [];

  for (const f of manifest.issues.failures) failures.push(f);

  if (expectRaw && expectRaw.profile && expectRaw.profile !== profile) {
    // not a hard failure but note
  }

  const expect = expectRaw && expectRaw.expect ? expectRaw.expect : expectRaw || {};

  // Broken embedded relationships and unresolved blip refs always fail,
  // regardless of profile.
  for (const b of manifest.brokenEmbeddedRelationships || []) {
    failures.push({
      code: "BROKEN_RELATIONSHIP",
      message: `Relacionamento quebrado ${b.id} -> ${b.target} (${b.reason})`,
    });
  }
  for (const u of manifest.unresolvedBlipReferences || []) {
    failures.push({
      code: "UNRESOLVED_BLIP",
      message: `Referencia r:embed sem relacao: ${u}`,
    });
  }

  // Validate expectation specs
  for (const [metric, spec] of Object.entries(expect)) {
    if (metric === "requiredText" || metric === "forbiddenText" || metric === "requiredTextNegate") continue;
    if (metric === "noDuplicateMedia" || metric === "noOrphanMedia" || metric === "allowExternalImages") continue;
    const err = validateExpectSpec(metric, spec);
    if (err) failures.push({ code: "INVALID_EXPECTATION", message: err });
  }

  if (profile === "pdf-text-draft") {
    const map = {
      images: manifest.mediaCount,
      markers: manifest.markerCount,
      wordTables: manifest.tables,
      bookmarks: manifest.bookmarkStart,
      bookmarkEnds: manifest.bookmarkEnd,
      pageref: manifest.pagerefFields,
      tocFields: manifest.tocFields,
      hyperlinks: manifest.hyperlinkFields,
      drawings: manifest.drawing,
      inlineDrawings: manifest.wpInline,
      anchoredDrawings: manifest.wpAnchor,
      mediaFiles: manifest.mediaCount,
      brokenRelationships: manifest.brokenEmbeddedRelationshipCount,
      orphanMedia: manifest.orphanMediaCount,
      duplicateMedia: manifest.duplicateMediaCount,
      smallImages: manifest.smallImagesCount,
      sections: manifest.sections,
      explicitPageBreaks: manifest.pageBreaks,
      sectionBreaks: manifest.sectionBreaks,
    };
    for (const [metric, spec] of Object.entries(expect)) {
      if (metric === "requiredText" || metric === "forbiddenText" || metric === "noDuplicateMedia" || metric === "noOrphanMedia" || metric === "allowExternalImages") continue;
      if (!(metric in map)) continue; // already validated above
      if (!evaluateMetric(map[metric], spec)) {
        failures.push({
          code: "EXPECT_" + metric.toUpperCase(),
          message: `Metrica ${metric}: valor=${map[metric]} expectativa=${JSON.stringify(normalizeExpectValue(spec))}`,
        });
      }
    }

    for (const t of expect.requiredText || []) {
      const present =
        (manifest.paragraphText || []).some((p) => p.includes(t)) ||
        manifest.fieldCommands.some((c) => c.includes(t));
      if (!present) failures.push({ code: "REQUIRED_TEXT_MISSING", message: `Texto obrigatorio ausente: ${t}` });
    }
    for (const t of expect.forbiddenText || []) {
      const present =
        (manifest.paragraphText || []).some((p) => p.includes(t)) ||
        manifest.fieldCommands.some((c) => c.includes(t));
      if (present) failures.push({ code: "FORBIDDEN_TEXT_PRESENT", message: `Texto proibido presente: ${t}` });
    }
    if (expect.noDuplicateMedia && manifest.duplicateMediaCount > 0) {
      failures.push({ code: "DUPLICATE_MEDIA", message: `Midia duplicada: ${manifest.duplicateMediaCount}` });
    }
    if (expect.noOrphanMedia && manifest.orphanMediaCount > 0) {
      failures.push({ code: "ORPHAN_MEDIA", message: `Midia orfa: ${manifest.orphanMediaCount}` });
    }
    if (!expect.allowExternalImages && manifest.externalImageRelationships > 0) {
      failures.push({
        code: "EXTERNAL_IMAGE_RELATIONSHIP",
        message: `Relacoes de imagem externas nao permitidas: ${manifest.externalImageRelationships}`,
      });
    }
  } else {
    // general profile: default reject external images too (self-contained requirement)
    if (manifest.externalImageRelationships > 0) {
      failures.push({
        code: "EXTERNAL_IMAGE_RELATIONSHIP",
        message: `Relacoes de imagem externas nao permitidas: ${manifest.externalImageRelationships}`,
      });
    }
  }

  return { approved: failures.length === 0, failures, warnings };
}

/**
 * Parse and validate an expectations file (bytes) as strict UTF-8.
 * Returns { profile, expect, errors }.
 */
export function parseExpectationsBytes(bytes) {
  const errors = [];
  let text;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    text = decoder.decode(bytes);
  } catch {
    errors.push("Arquivo de expectativas nao e UTF-8 valido.");
    return { errors };
  }
  // strip BOM if present (TextDecoder with fatal still decodes BOM as char U+FEFF)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // mojibake detection in text/forbidden
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    errors.push("JSON de expectativas invalido: " + e.message);
    return { errors };
  }
  const texts = [
    ...(parsed.expect?.requiredText || []),
    ...(parsed.expect?.forbiddenText || []),
  ];
  for (const t of texts) {
    if (detectMojibake(t)) {
      errors.push("Arquivo de expectativas parece estar com codificacao incorreta. Salve-o como UTF-8.");
      break;
    }
  }
  return { profile: parsed.profile, expect: parsed.expect || {}, errors };
}
