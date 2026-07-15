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

  const begin = count(/<w:fldChar\b[^>]*\bw:fldCharType="begin"/g, docXml);
  const sep = count(/<w:fldChar\b[^>]*\bw:fldCharType="separate"/g, docXml);
  const end = count(/<w:fldChar\b[^>]*\bw:fldCharType="end"/g, docXml);
  result.fldCharBeginCount = begin;
  result.fldCharSeparateCount = sep;
  result.fldCharEndCount = end;

  // State machine across the document (preserving order).
  const tokens = [...docXml.matchAll(
    /<w:fldChar\b[^>]*\bw:fldCharType="(begin|separate|end)"\s*\/?>|<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g
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
      if (building) acc += " " + t[2];
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
  const relAnalyses = await analyzeRelationships(zip, names, docXml, "body", null, null, minImageBytes);

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

  // Aggregate media from body + headers + footers
  const allMedia = new Map(); // relName -> media info
  const registerMedia = (m) => allMedia.set(m.name, m);
  relAnalyses.media.forEach(registerMedia);
  headerRels.forEach((h) => h.media.forEach(registerMedia));
  footerRels.forEach((f) => f.media.forEach(registerMedia));

  // Merge relationship analytics
  const embeddedImageRels = [
    ...relAnalyses.embeddedImageRelationships,
    ...headerRels.flatMap((h) => h.embeddedImageRels),
    ...footerRels.flatMap((f) => f.embeddedImageRels),
  ];
  const externalImageRels = [
    ...relAnalyses.externalImageRelationships,
    ...headerRels.flatMap((h) => h.externalImageRels),
    ...footerRels.flatMap((f) => f.externalImageRels),
  ];
  const brokenEmbeddedRels = [
    ...relAnalyses.brokenEmbeddedRelationships,
    ...headerRels.flatMap((h) => h.brokenEmbeddedRels),
    ...footerRels.flatMap((f) => f.brokenEmbeddedRels),
  ];
  const unresolvedBlipRefs = [
    ...relAnalyses.unresolvedBlipReferences,
    ...headerRels.flatMap((h) => h.unresolvedBlipRefs),
    ...footerRels.flatMap((f) => f.unresolvedBlipRefs),
  ];
  const usedRids = new Set([
    ...relAnalyses.usedRids,
    ...headerRels.flatMap((h) => h.usedRids),
    ...footerRels.flatMap((f) => f.usedRids),
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
  manifest.brokenEmbeddedRelationships = brokenEmbeddedRels.length;
  manifest.brokenRelationships = brokenEmbeddedRels.length;
  manifest.unresolvedBlipReferences = unresolvedBlipRefs;

  // Orphan media across body + headers + footers
  const referencedTargets = new Set();
  for (const r of embeddedImageRels) {
    let t = r.target.replace(/\\/g, "/");
    if (!t.startsWith("/")) t = "word/" + t.replace(/^\.\//, "");
    referencedTargets.add(t);
  }
  manifest.orphanMedia = [...allMedia.values()]
    .filter((m) => !referencedTargets.has("word/" + m.name))
    .map((m) => m.name);
  manifest.orphanMediaCount = manifest.orphanMedia.length;

  // Duplicate media by sha256
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

async function analyzeRelationships(zip, names, xml, origin, partName, relPath, minImageBytes = 0) {
  if (!xml) {
    return {
      embeddedImageRelationships: [],
      externalImageRelationships: [],
      brokenEmbeddedRelationships: [],
      unresolvedBlipReferences: [],
      usedRids: [],
      media: [],
      summary: { drawings: 0, inlineDrawings: 0, anchoredDrawings: 0, imageRelationships: 0, embeddedImageRelationships: 0, externalImageRelationships: 0, mediaCount: 0 },
    };
  }
  const relsXml = relPath && names.includes(relPath) ? await zip.file(relPath).async("string") : null;
  const embeddedImageRels = [];
  const externalImageRels = [];
  const usedRids = new Set();
  const brokenEmbeddedRels = [];
  const unresolvedBlipRefs = [];

  // Collect r:embed referenced in the XML
  const embeds = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
  const links = [...xml.matchAll(/r:link="([^"]+)"/g)].map((m) => m[1]);
  embeds.forEach((r) => usedRids.add(r));

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
      // External when TargetMode=External, or target is an absolute external URI
      // (http/https, scheme:, or absolute path). Otherwise treat as embedded.
      const isExternal =
        targetMode === "External" ||
        /^(https?:|mailto:|file:)/i.test(target) ||
        /^[a-z][a-z0-9+.-]*:/i.test(target) ||
        target.startsWith("/");
      if (isExternal) {
        externalImageRels.push({ id, type, target, targetMode, used: usedRids.has(id) });
      } else {
        embeddedImageRels.push({ id, type, target, targetMode, used: usedRids.has(id) });
      }
    }
  }

  // Resolve embedded media files (load only those actually referenced to limit memory)
  const media = [];
  const mediaFolder = zip.folder("word/media");
  for (const r of embeddedImageRels) {
    let target = r.target.replace(/\\/g, "/");
    if (!target.startsWith("/")) target = "word/" + target.replace(/^\.\//, "");
    // mediaFolder.files keys are full paths (e.g. "word/media/img1.png")
    const entry = mediaFolder && mediaFolder.files[target];
    const exists = !!entry && entry.dir === false;
    if (!exists) {
      brokenEmbeddedRels.push({ id: r.id, target: r.target, reason: "midia_referenciada_inexistente" });
      continue;
    }
    const buf = await entry.async("nodebuffer");
    const relName = target.replace(/^word\//, "");
    const dims = parseImageSize(buf, relName.toLowerCase());
    media.push({
      name: relName,
      sizeBytes: buf.length,
      sha256: sha256(buf),
      format: imageFormat(relName.toLowerCase()),
      dimensions: dims && dims.error ? { error: dims.error } : dims,
      small: minImageBytes > 0 && buf.length < minImageBytes,
    });
  }

  // unresolved blip references (r:embed without relationship)
  for (const r of embeds) {
    const found = embeddedImageRels.some((x) => x.id === r) || externalImageRels.some((x) => x.id === r);
    if (!found) unresolvedBlipRefs.push(r);
  }

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
    unresolvedBlipReferences: unresolvedBlipRefs,
    usedRids: [...usedRids],
    media,
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
      brokenRelationships: manifest.brokenEmbeddedRelationships,
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
