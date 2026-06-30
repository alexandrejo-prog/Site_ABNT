import JSZip from "jszip";

export type ImportedSectionKind = "pre-textual" | "textual" | "post-textual";

export interface ImportedTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  style?: string;
  inheritedStyle?: string;
}

export type ImportedBlock =
  | {
      type: "paragraph";
      text: string;
      rawText: string;
      runs: ImportedTextRun[];
      style?: string;
      styleName?: string;
      section?: ImportedSectionKind;
    }
  | {
      type: "heading";
      level: number;
      text: string;
      rawText: string;
      runs: ImportedTextRun[];
      style?: string;
      styleName?: string;
      section?: ImportedSectionKind;
    }
  | {
      type: "longQuote";
      text: string;
      rawText: string;
      runs: ImportedTextRun[];
      style?: string;
      styleName?: string;
      section?: ImportedSectionKind;
    }
  | {
      type: "table";
      rows: string[][];
      caption?: string;
      source?: string;
      section?: ImportedSectionKind;
    }
  | {
      type: "image";
      relationshipId?: string;
      target?: string;
      fileName?: string;
      extension?: string;
      mimeType?: string;
      caption?: string;
      source?: string;
      section?: ImportedSectionKind;
    }
  | { type: "pageBreak" };

export interface ImportedParagraph {
  index: number;
  text: string;
  rawText: string;
  styleId?: string;
  styleName?: string;
  headingLevel?: number;
  isHeading: boolean;
  isNormalParagraph: boolean;
  isLongQuote: boolean;
  containsPageBreak: boolean;
  appearsPreTextual: boolean;
  appearsTextual: boolean;
  appearsPostTextual: boolean;
  imageRelationshipIds: string[];
  runs: ImportedTextRun[];
  section: ImportedSectionKind;
}

export interface ImportedImageAsset {
  relationshipId?: string;
  target: string;
  fileName: string;
  extension: string;
  mimeType: string;
  data?: Uint8Array;
}

export interface DocxStructure {
  blocks: ImportedBlock[];
  paragraphs: ImportedParagraph[];
  images: ImportedImageAsset[];
  relationships: Record<string, string>;
  styleNames: Record<string, string>;
  text: string;
  hasNumbering: boolean;
}

export interface DocxStructureOptions {
  includeMediaData?: boolean;
}

const TEXT_TOKEN_PATTERN =
  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;

const PRE_TEXTUAL_HEADINGS = new Set([
  "RESUMO",
  "ABSTRACT",
  "AGRADECIMENTOS",
  "DEDICATORIA",
  "EPIGRAFE",
  "SUMARIO",
  "LISTA DE ILUSTRACOES",
  "LISTA DE TABELAS",
  "LISTA DE QUADROS",
  "LISTA DE SIGLAS",
  "INDICADORES DE IMPACTO",
  "IMPACT INDICATORS",
]);

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function normalizeForDetection(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractTextFromXml(xml: string): { rawText: string; text: string } {
  const parts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = TEXT_TOKEN_PATTERN.exec(xml)) !== null) {
    if (match[0].startsWith("<w:tab")) {
      parts.push(" ");
    } else if (match[0].startsWith("<w:br")) {
      parts.push("\n");
    } else {
      parts.push(decodeXml(match[1] ?? ""));
    }
  }

  const rawText = parts.join("");
  return { rawText, text: cleanText(rawText) };
}

function hasEnabledRunProperty(runXml: string, property: "b" | "i"): boolean {
  const match = runXml.match(new RegExp(`<w:${property}\\b([^>]*)`));
  if (!match) return false;
  return !/\bw:val="(?:false|0)"/i.test(match[1]);
}

function hasUnderline(runXml: string): boolean {
  const match = runXml.match(/<w:u\b([^>]*)/);
  if (!match) return false;
  return !/\bw:val="(?:none|false|0)"/i.test(match[1]);
}

function extractRunsFromParagraphXml(
  paragraphXml: string,
  inheritedStyle?: string,
): ImportedTextRun[] {
  const runs = [...paragraphXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)]
    .map((match): ImportedTextRun | undefined => {
      const runXml = match[0];
      const { rawText, text } = extractTextFromXml(runXml);
      const style = runXml.match(/<w:rStyle\b[^>]*w:val="([^"]+)"/)?.[1];
      const runText = rawText || text;

      if (!runText) {
        return undefined;
      }

      return {
        text: runText,
        bold: hasEnabledRunProperty(runXml, "b") || undefined,
        italic: hasEnabledRunProperty(runXml, "i") || undefined,
        underline: hasUnderline(runXml) || undefined,
        style,
        inheritedStyle,
      };
    })
    .filter((run): run is ImportedTextRun => Boolean(run));

  if (runs.length) return runs;

  const { text } = extractTextFromXml(paragraphXml);
  return text ? [{ text, inheritedStyle }] : [];
}

function extractRelationships(relsXml: string): Record<string, string> {
  const relationships: Record<string, string> = {};
  const relationshipPattern = /<Relationship\b[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = relationshipPattern.exec(relsXml)) !== null) {
    const tag = match[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) {
      relationships[id] = decodeXml(target);
    }
  }

  return relationships;
}

function mimeTypeFromExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function extractStyleNames(stylesXml: string): Record<string, string> {
  const styleNames: Record<string, string> = {};
  const stylePattern = /<w:style\b[\s\S]*?<\/w:style>/g;
  let match: RegExpExecArray | null;

  while ((match = stylePattern.exec(stylesXml)) !== null) {
    const styleXml = match[0];
    const styleId = styleXml.match(/\bw:styleId="([^"]+)"/)?.[1];
    const name = styleXml.match(/<w:name\b[^>]*w:val="([^"]+)"/)?.[1];
    if (styleId && name) {
      styleNames[styleId] = decodeXml(name);
    }
  }

  return styleNames;
}

function headingLevelFromStyle(styleId = "", styleName = ""): number | undefined {
  const normalized = normalizeForDetection(`${styleId} ${styleName}`);
  const match =
    normalized.match(/\bHEADING\s*([1-9])\b/) ??
    normalized.match(/\bTITULO\s*([1-9])\b/) ??
    normalized.match(/\bTTULO\s*([1-9])\b/);

  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function headingLevelFromText(text: string): number | undefined {
  const normalized = normalizeForDetection(text);
  const numeric = normalized.match(/^(\d+(?:\.\d+)*)\s+\S+/);
  if (numeric) {
    return numeric[1].split(".").length;
  }

  const withoutNumber = normalized.replace(/^\d+(?:\.\d+)*\s*/, "");
  if (
    PRE_TEXTUAL_HEADINGS.has(withoutNumber) ||
    withoutNumber === "REFERENCIAS" ||
    withoutNumber === "ANEXOS" ||
    withoutNumber === "APENDICES" ||
    withoutNumber === "CONCLUSAO" ||
    withoutNumber === "CONSIDERACOES FINAIS"
  ) {
    return 1;
  }

  return undefined;
}

function detectHeadingLevel(text: string, styleId = "", styleName = ""): number | undefined {
  return headingLevelFromStyle(styleId, styleName) ?? headingLevelFromText(text);
}

function isLongQuoteParagraph(xml: string, styleId = "", styleName = ""): boolean {
  const normalizedStyle = normalizeForDetection(`${styleId} ${styleName}`);
  const leftIndent = Number(xml.match(/<w:ind\b[^>]*w:left="(\d+)"/)?.[1] ?? 0);
  return (
    normalizedStyle.includes("CITACAO") ||
    normalizedStyle.includes("QUOTE") ||
    leftIndent >= 2200
  );
}

function sectionForHeading(text: string, current: ImportedSectionKind): ImportedSectionKind {
  const normalized = normalizeForDetection(text).replace(/^\d+(?:\.\d+)*\s*/, "");

  if (
    normalized === "REFERENCIAS" ||
    normalized === "ANEXOS" ||
    normalized === "ANEXO" ||
    normalized === "APENDICES" ||
    normalized === "APENDICE" ||
    /^ANEXO\s+[A-Z0-9]/.test(normalized) ||
    /^APENDICE\s+[A-Z0-9]/.test(normalized)
  ) {
    return "post-textual";
  }

  if (
    normalized === "INTRODUCAO" ||
    normalized === "CONCLUSAO" ||
    normalized === "CONSIDERACOES FINAIS" ||
    /^\d+(?:\.\d+)*\s+\S+/.test(normalizeForDetection(text))
  ) {
    return "textual";
  }

  if (PRE_TEXTUAL_HEADINGS.has(normalized)) {
    return "pre-textual";
  }

  return current;
}

function extractImageRelationshipIds(
  xml: string,
  relationships: Record<string, string>,
): string[] {
  const relationshipIds = [...xml.matchAll(/\b(?:r:id|r:embed|r:link)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((id) => relationships[id]?.startsWith("media/"));

  return [...new Set(relationshipIds)];
}

function paragraphBlockFromMetadata(paragraph: ImportedParagraph): ImportedBlock | undefined {
  if (!paragraph.text) {
    return undefined;
  }

  if (paragraph.isHeading) {
    return {
      type: "heading",
      level: paragraph.headingLevel ?? 1,
      text: paragraph.text,
      rawText: paragraph.rawText,
      runs: paragraph.runs,
      style: paragraph.styleId,
      styleName: paragraph.styleName,
      section: paragraph.section,
    };
  }

  if (paragraph.isLongQuote) {
    return {
      type: "longQuote",
      text: paragraph.text,
      rawText: paragraph.rawText,
      runs: paragraph.runs,
      style: paragraph.styleId,
      styleName: paragraph.styleName,
      section: paragraph.section,
    };
  }

  return {
    type: "paragraph",
    text: paragraph.text,
    rawText: paragraph.rawText,
    runs: paragraph.runs,
    style: paragraph.styleId,
    styleName: paragraph.styleName,
    section: paragraph.section,
  };
}

function extractTableRows(tableXml: string): string[][] {
  return [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
    .map((rowMatch) =>
      [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cellMatch) =>
        extractTextFromXml(cellMatch[0]).text,
      ),
    )
    .filter((row) => row.some((cell) => cell.trim()));
}

async function extractImages(
  zip: JSZip,
  relationships: Record<string, string>,
  includeMediaData: boolean,
): Promise<ImportedImageAsset[]> {
  const relationshipImages = Object.entries(relationships)
    .filter(([, target]) => target.startsWith("media/"))
    .map(([relationshipId, target]) => ({ relationshipId, target }));

  const mediaFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith("word/media/") && !zip.files[name].dir)
    .map((name) => ({ relationshipId: undefined, target: name.replace(/^word\//, "") }));

  const imagesByTarget = new Map<string, ImportedImageAsset>();

  for (const image of [...relationshipImages, ...mediaFiles]) {
    if (imagesByTarget.has(image.target)) {
      const existing = imagesByTarget.get(image.target);
      if (existing && image.relationshipId) {
        existing.relationshipId = existing.relationshipId ?? image.relationshipId;
      }
      continue;
    }

    const zipPath = image.target.startsWith("word/") ? image.target : `word/${image.target}`;
    const file = zip.file(zipPath);
    const fileName = image.target.split("/").at(-1) ?? image.target;
    const extension = fileName.includes(".") ? fileName.split(".").at(-1) ?? "" : "";
    imagesByTarget.set(image.target, {
      relationshipId: image.relationshipId,
      target: image.target,
      fileName,
      extension: extension.toLowerCase(),
      mimeType: mimeTypeFromExtension(extension),
      data: includeMediaData && file ? await file.async("uint8array") : undefined,
    });
  }

  return [...imagesByTarget.values()];
}

export async function extractDocxStructure(
  input: ArrayBuffer | Uint8Array,
  options: DocxStructureOptions = {},
): Promise<DocxStructure> {
  const zip = await JSZip.loadAsync(input);
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("DOCX sem word/document.xml.");
  }

  const stylesXml = (await zip.file("word/styles.xml")?.async("string")) ?? "";
  const relsXml =
    (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const relationships = extractRelationships(relsXml);
  const styleNames = extractStyleNames(stylesXml);
  const images = await extractImages(zip, relationships, Boolean(options.includeMediaData));
  const bodyXml =
    documentXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/)?.[1] ?? documentXml;

  const blocks: ImportedBlock[] = [];
  const paragraphs: ImportedParagraph[] = [];
  let currentSection: ImportedSectionKind = "pre-textual";
  let paragraphIndex = 0;

  const bodyElementPattern = /<w:p\b[\s\S]*?<\/w:p>|<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let elementMatch: RegExpExecArray | null;

  while ((elementMatch = bodyElementPattern.exec(bodyXml)) !== null) {
    const xml = elementMatch[0];

    if (xml.startsWith("<w:tbl")) {
      const rows = extractTableRows(xml);
      if (rows.length) {
        blocks.push({ type: "table", rows, section: currentSection });
      }
      continue;
    }

    const { rawText, text } = extractTextFromXml(xml);
    const styleId = xml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
    const styleName = styleId ? styleNames[styleId] : undefined;
    const headingLevel = detectHeadingLevel(text, styleId, styleName);
    const isHeading = Boolean(text && headingLevel);

    if (isHeading) {
      currentSection = sectionForHeading(text, currentSection);
    }

    const containsPageBreak =
      /<w:br\b[^>]*w:type="page"/.test(xml) ||
      /<w:lastRenderedPageBreak\b/.test(xml);
    const imageRelationshipIds = extractImageRelationshipIds(xml, relationships);
    const isLongQuote = !isHeading && isLongQuoteParagraph(xml, styleId, styleName);

    const paragraph: ImportedParagraph = {
      index: paragraphIndex,
      text,
      rawText,
      runs: [{ text }],
      styleId,
      styleName,
      headingLevel,
      isHeading,
      isNormalParagraph: Boolean(text && !isHeading && !isLongQuote),
      isLongQuote,
      containsPageBreak,
      appearsPreTextual: currentSection === "pre-textual",
      appearsTextual: currentSection === "textual",
      appearsPostTextual: currentSection === "post-textual",
      imageRelationshipIds,
      section: currentSection,
    };

    paragraphs.push(paragraph);

    const textBlock = paragraphBlockFromMetadata(paragraph);
    if (textBlock) {
      blocks.push(textBlock);
    }

    for (const relationshipId of imageRelationshipIds) {
      blocks.push({
        type: "image",
        relationshipId,
        target: relationships[relationshipId],
        section: currentSection,
      });
    }

    if (containsPageBreak) {
      blocks.push({ type: "pageBreak" });
    }

    paragraphIndex += 1;
  }

  const text = blocks
    .flatMap((block) => {
      if (block.type === "pageBreak") return [];
      if (block.type === "image") return [`[Imagem detectada: ${block.relationshipId ?? "sem relacao"}]`];
      if (block.type === "table") return block.rows.map((row) => row.join("\t"));
      return [block.text];
    })
    .join("\n")
    .trim();

  return {
    blocks,
    paragraphs,
    images,
    relationships,
    styleNames,
    text,
    hasNumbering: Boolean(zip.file("word/numbering.xml")),
  };
}

export async function extractFirstImageAssetFromDocx(
  input: ArrayBuffer | Uint8Array,
): Promise<ImportedImageAsset | undefined> {
  const structure = await extractDocxStructure(input, { includeMediaData: true });
  const firstReferencedImage = structure.paragraphs
    .flatMap((paragraph) => paragraph.imageRelationshipIds)
    .map((relationshipId) =>
      structure.images.find((image) => image.relationshipId === relationshipId),
    )
    .find((image): image is ImportedImageAsset => Boolean(image));

  return firstReferencedImage ?? structure.images[0];
}
