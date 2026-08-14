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
      footnoteRefs?: string[];
      hasMath?: boolean;
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
      footnoteRefs?: string[];
      hasMath?: boolean;
    }
  | {
      type: "longQuote";
      text: string;
      rawText: string;
      runs: ImportedTextRun[];
      style?: string;
      styleName?: string;
      section?: ImportedSectionKind;
      footnoteRefs?: string[];
      hasMath?: boolean;
    }
  | {
      type: "table";
      rows: string[][];
      caption?: string;
      source?: string;
      section?: ImportedSectionKind;
      gridWidths?: number[];
      tableWidthTwips?: number;
      hasGridSpan?: boolean;
      hasVerticalMerge?: boolean;
      cellWidths?: number[][];
      cellMerges?: Array<{ row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" }>;
      headerRowIndices?: number[];
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
      isDecorative?: boolean;
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
  footnoteRefs: string[];
  runs: ImportedTextRun[];
  section: ImportedSectionKind;
  hasMath?: boolean;
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
  footnotes: Record<string, string>;
  text: string;
  hasNumbering: boolean;
}

export interface DocxStructureOptions {
  includeMediaData?: boolean;
}

const TEXT_TOKEN_PATTERN =
  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<m:t(?:\s[^>]*)?>([\s\S]*?)<\/m:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:lastRenderedPageBreak\b[^>]*\/>/g;
const PAGE_BREAK_PATTERN = /<w:br\b[^>]*w:type="page"[^>]*\/>|<w:lastRenderedPageBreak\b[^>]*\/>/g;

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
    .replace(/[\u2013\u2014â€“â€”]/g, "-")
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

function isPageBreakToken(token: string): boolean {
  return /<w:lastRenderedPageBreak\b/.test(token) || /<w:br\b[^>]*w:type="page"/.test(token);
}

function extractTextFromXml(xml: string): { rawText: string; text: string } {
  const parts: string[] = [];
  let match: RegExpExecArray | null;

  TEXT_TOKEN_PATTERN.lastIndex = 0;
  while ((match = TEXT_TOKEN_PATTERN.exec(xml)) !== null) {
    if (match[0].startsWith("<w:tab")) {
      parts.push(" ");
    } else if (isPageBreakToken(match[0])) {
      continue;
    } else if (match[0].startsWith("<w:br")) {
      parts.push("\n");
    } else {
      // w:t e m:t têm o conteúdo no mesmo grupo de captura alternado.
      parts.push(decodeXml(match[1] ?? match[2] ?? ""));
    }
  }

  const rawText = parts.join("");
  return { rawText, text: cleanText(rawText) };
}

function splitParagraphXmlByPageBreak(xml: string): Array<{ xml: string; pageBreakAfter: boolean }> {
  const segments: Array<{ xml: string; pageBreakAfter: boolean }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  PAGE_BREAK_PATTERN.lastIndex = 0;
  while ((match = PAGE_BREAK_PATTERN.exec(xml)) !== null) {
    const before = xml.slice(cursor, match.index);
    if (before || !segments.length) {
      segments.push({ xml: before, pageBreakAfter: true });
    } else {
      segments[segments.length - 1].pageBreakAfter = true;
    }
    cursor = match.index + match[0].length;
  }

  if (!segments.length) {
    return [{ xml, pageBreakAfter: false }];
  }

  const after = xml.slice(cursor);
  if (after) {
    segments.push({ xml: after, pageBreakAfter: false });
  }

  return segments;
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
    // Estilos nomeados UFLA-044 (§28.1 do Manual consolidado UFLA). Usa
    // includes(): o identificador vem acompanhado do nome legível do estilo.
    // normalizeForDetection preserva underscores do id (ex.: UFLA_TITULO_*).
    if (normalized.includes("UFLA_TITULO_PRIMARIO") || normalized.includes("UFLA_TITULO_SEM_INDICATIVO")) return 1;
    if (normalized.includes("UFLA_TITULO_SECUNDARIO")) return 2;
    if (normalized.includes("UFLA_TITULO_TERCIARIO")) return 3;
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

  const mathProp = paragraph.hasMath ? { hasMath: true } : {};

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
      ...mathProp,
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
      ...mathProp,
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
    ...mathProp,
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

function keptTableRowIndices(tableXml: string): number[] {
  const indices: number[] = [];
  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const cells = [...rows[rowIndex][0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cellMatch) =>
      extractTextFromXml(cellMatch[0]).text,
    );
    if (cells.some((cell) => cell.trim())) indices.push(rowIndex);
  }
  return indices;
}

function twipValue(attrXml: string): number | undefined {
  const match = attrXml.match(/w:w="(\d+)"/i);
  if (!match) return undefined;
  return Number(match[1]);
}

function extractTableGridWidths(tableXml: string): number[] {
  const gridMatch = tableXml.match(/<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/);
  if (!gridMatch) return [];
  const widths: number[] = [];
  const regex = /<w:gridCol\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(gridMatch[1])) !== null) {
    const w = twipValue(match[0]);
    if (w !== undefined) widths.push(w);
  }
  return widths;
}

function extractTableWidthTwips(tableXml: string): number | undefined {
  const tblPrMatch = tableXml.match(/<w:tblPr\b[^>]*>([\s\S]*?)<\/w:tblPr>/);
  if (!tblPrMatch) return undefined;
  const tblWMatch = tblPrMatch[1].match(/<w:tblW\b[^>]*>/i);
  if (!tblWMatch) return undefined;
  return twipValue(tblWMatch[0]);
}

function extractTableHeaderRows(tableXml: string): number[] {
  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
  const kept = keptTableRowIndices(tableXml);
  const keptSet = new Set(kept);
  const headerRows: number[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    if (!keptSet.has(rowIndex)) continue;
    const trPrMatch = rows[rowIndex][0].match(/<w:trPr\b[^>]*>([\s\S]*?)<\/w:trPr>/);
    if (!trPrMatch) continue;
    const tblHeaderMatch = trPrMatch[1].match(/<w:tblHeader\b[^>]*>/i);
    if (!tblHeaderMatch) continue;
    const val = tblHeaderMatch[0].match(/w:val="([^"]+)"/i)?.[1];
    if (val !== undefined && val.toLowerCase() === "false") continue;
    headerRows.push(kept.indexOf(rowIndex));
  }
  return headerRows;
}

function extractCellProperties(tableXml: string): { hasGridSpan: boolean; hasVerticalMerge: boolean; cellWidths: number[][]; cellMerges: Array<{ row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" }> } {
  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
  let hasGridSpan = false;
  let hasVerticalMerge = false;
  const cellWidths: number[][] = [];
  const cellMerges: Array<{ row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" }> = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const rowMatch = rows[rowIndex];
    const rowWidths: number[] = [];
    const cells = [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
    for (let colIndex = 0; colIndex < cells.length; colIndex++) {
      const cellXml = cells[colIndex][0];
      const gridSpanMatch = cellXml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"[^>]*>/i);
      if (gridSpanMatch) {
        hasGridSpan = true;
        cellMerges.push({ row: rowIndex, col: colIndex, type: "gridSpan" });
      }
      if (/<w:vMerge\b[^>]*>/i.test(cellXml)) {
        hasVerticalMerge = true;
        const vMergeVal = cellXml.match(/<w:vMerge\b[^>]*w:val="([^"]+)"[^>]*>/i)?.[1] ?? "restart";
        const type = vMergeVal === "continue" ? "vMerge-continue" : "vMerge-restart";
        cellMerges.push({ row: rowIndex, col: colIndex, type });
      }
      const tcPrMatch = cellXml.match(/<w:tcPr\b[^>]*>([\s\S]*?)<\/w:tcPr>/);
      let w: number | undefined;
      if (tcPrMatch) {
        const tcWMatch = tcPrMatch[1].match(/<w:tcW\b[^>]*>/i);
        if (tcWMatch) w = twipValue(tcWMatch[0]);
      }
      rowWidths.push(w ?? 0);
    }
    cellWidths.push(rowWidths);
  }

  return { hasGridSpan, hasVerticalMerge, cellWidths, cellMerges };
}

function parseTableBlock(tableXml: string): {
  rows: string[][];
  gridWidths: number[];
  tableWidthTwips: number | undefined;
  hasGridSpan: boolean;
  hasVerticalMerge: boolean;
  cellWidths: number[][];
  cellMerges: Array<{ row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" }>;
  headerRowIndices: number[];
} {
  const rows = extractTableRows(tableXml);
  const gridWidths = extractTableGridWidths(tableXml);
  const tableWidthTwips = extractTableWidthTwips(tableXml);
  const { hasGridSpan, hasVerticalMerge, cellWidths, cellMerges } = extractCellProperties(tableXml);
  const headerRowIndices = extractTableHeaderRows(tableXml);
  return { rows, gridWidths, tableWidthTwips, hasGridSpan, hasVerticalMerge, cellWidths, cellMerges, headerRowIndices };
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

const FOOTNOTE_REFERENCE_PATTERN = /<w:footnoteReference\b[^>]*w:id="(\d+)"/g;

/**
 * Extrai as notas de rodapé reais de word/footnotes.xml (id → texto), ignorando
 * os separadores (w:type="separator" / "continuationSeparator"). O texto de
 * cada nota é a concatenação dos parágrafos, preservando quebras de linha
 * internas. Mecanismo distinto de "Fonte:" de tabelas/ilustrações, que vive em
 * document.xml abaixo do elemento.
 */
export function extractFootnotesFromXml(footnotesXml: string): Record<string, string> {
  const footnotes: Record<string, string> = {};
  const footnotePattern = /<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g;
  let match: RegExpExecArray | null;
  while ((match = footnotePattern.exec(footnotesXml)) !== null) {
    const attributes = match[1] ?? "";
    if (/w:type="(?:separator|continuationSeparator)"/.test(attributes)) continue;
    const idMatch = attributes.match(/w:id="(\d+)"/);
    if (!idMatch) continue;
    const body = match[2] ?? "";
    const paragraphTexts = [...body.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((paragraphMatch) =>
      [...paragraphMatch[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((textMatch) => textMatch[1])
        .join(""),
    );
    const text = paragraphTexts.filter(Boolean).join("\n").trim();
    if (text) footnotes[idMatch[1]] = text;
  }
  return footnotes;
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
  const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
  const footnotes = extractFootnotesFromXml(footnotesXml);
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
      const { rows, gridWidths, tableWidthTwips, hasGridSpan, hasVerticalMerge, cellWidths, cellMerges, headerRowIndices } = parseTableBlock(xml);
      blocks.push({
        type: "table",
        rows,
        section: currentSection,
        gridWidths,
        tableWidthTwips,
        hasGridSpan,
        hasVerticalMerge,
        cellWidths,
        cellMerges,
        headerRowIndices,
      });
      continue;
    }

    const styleId = xml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
    const styleName = styleId ? styleNames[styleId] : undefined;

    for (const segment of splitParagraphXmlByPageBreak(xml)) {
      const { rawText, text } = extractTextFromXml(segment.xml);
      const headingLevel = detectHeadingLevel(text, styleId, styleName);
      const isHeading = Boolean(text && headingLevel);

      if (isHeading) {
        currentSection = sectionForHeading(text, currentSection);
      }

      const imageRelationshipIds = extractImageRelationshipIds(segment.xml, relationships);
      const isLongQuote = !isHeading && isLongQuoteParagraph(xml, styleId, styleName);
      const runs = extractRunsFromParagraphXml(segment.xml, styleId);
      const footnoteRefs: string[] = [];
      let footnoteRefMatch: RegExpExecArray | null;
      FOOTNOTE_REFERENCE_PATTERN.lastIndex = 0;
      while ((footnoteRefMatch = FOOTNOTE_REFERENCE_PATTERN.exec(segment.xml)) !== null) {
        footnoteRefs.push(footnoteRefMatch[1]);
      }

      if (text || imageRelationshipIds.length) {
        const hasMath = /<m:oMath(?:\s[^>]*)?>[\s\S]*<\/m:oMath>|<m:oMathPara\b/.test(segment.xml);
        const paragraph: ImportedParagraph = {
          index: paragraphIndex,
          text,
          rawText,
          runs,
          styleId,
          styleName,
          headingLevel,
          isHeading,
          isNormalParagraph: Boolean(text && !isHeading && !isLongQuote),
          isLongQuote,
          containsPageBreak: segment.pageBreakAfter,
          appearsPreTextual: currentSection === "pre-textual",
          appearsTextual: currentSection === "textual",
          appearsPostTextual: currentSection === "post-textual",
          imageRelationshipIds,
          footnoteRefs,
          section: currentSection,
          ...(hasMath ? { hasMath: true } : {}),
        };

        paragraphs.push(paragraph);

        const textBlock = paragraphBlockFromMetadata(paragraph);
        if (textBlock) {
          blocks.push({
            ...textBlock,
            ...(footnoteRefs.length ? { footnoteRefs } : {}),
          });
        }

      for (const relationshipId of imageRelationshipIds) {
        const target = relationships[relationshipId];
        const fileName = (target || "").split("/").at(-1) ?? "";
        const isHeaderFooterImage =
          Boolean(relationships[relationshipId]?.startsWith("media/")) &&
          (target || "").startsWith("header") ||
          (target || "").startsWith("footer") ||
          /logo|ufla|fundo|moldura|capa/i.test(fileName);

        if (isHeaderFooterImage) {
          blocks.push({
            type: "image",
            relationshipId,
            target,
            section: currentSection,
            isDecorative: true,
          });
          continue;
        }

        blocks.push({
          type: "image",
          relationshipId,
          target,
          section: currentSection,
        });
      }

        paragraphIndex += 1;
      }

      if (segment.pageBreakAfter) {
        blocks.push({ type: "pageBreak" });
      }
    }
  }

  const text = blocks
    .flatMap((block) => {
      if (block.type === "pageBreak") return [];
      if (block.type === "image") return [];
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
    footnotes,
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
