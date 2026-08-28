import {
  cleanMojibakeText,
  detectCaption,
  detectTabbedTableBlock,
} from "./docx-render-core";
import { escapeHtml, inlineMarkupToHtml } from "./editor-markup";
import katex from "katex";
import { ommlToLatex } from "./omml-to-latex";
import {
  calculateTextualStartPage,
  extractReferencesSection,
  parseEditorContent,
  type DocxGenerationInput,
  type EditorBlock,
} from "./export-docx";
import { buildFlowingImpactText } from "./impact-indicators";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import {
  normalizeReferences,
  type ReferenceRun,
} from "./references-normalizer";
import {
  CPG_RULES,
  UFLA_RULES,
  isCpgWork,
  isResearchProject,
  type WorkTypeValue,
} from "./ufla-rules";
import { normalizeWorkType } from "./work-type-resolver";
import { getWorkTypeRequirements } from "./work-type-requirements";
import { normalizeForDetection } from "./word-structure-extractor";
import { dedupeCpgAffiliations, splitCpgReferences, stripCpgForbiddenSections } from "./cpg-content-filter";

const BODY_SIZE_PT = UFLA_RULES.typography.bodyFontSizePt;
const COVER_AUTHOR_SIZE_PT = UFLA_RULES.typography.coverAuthorFontSizePt;
const COVER_TITLE_SIZE_PT = UFLA_RULES.typography.coverTitleFontSizePt;
const LONG_QUOTE_SIZE_PT = UFLA_RULES.typography.longQuoteFontSizePt;
const SOURCE_SIZE_PT = UFLA_RULES.typography.sourceFontSizePt;
const FIRST_LINE_CM = UFLA_RULES.typography.paragraphFirstLineCm;
const LONG_QUOTE_INDENT_CM = UFLA_RULES.typography.longQuoteLeftIndentCm;

// ===== Paginação real simulada (baseada em altura de conteúdo) =====
// A4: 29,7 cm x 21 cm. Margens UFLA: sup 3, esq 3, inf 2, dir 2.
const PAGE_HEIGHT_CM = 29.7;
const PAGE_WIDTH_CM = 21;
const MARGIN_TOP_CM = 3;
const MARGIN_BOTTOM_CM = 2;
const MARGIN_LEFT_CM = 3;
const MARGIN_RIGHT_CM = 2;
const PX_PER_CM = 96 / 2.54;
const USABLE_HEIGHT_PX = (PAGE_HEIGHT_CM - MARGIN_TOP_CM - MARGIN_BOTTOM_CM) * PX_PER_CM;
const USABLE_WIDTH_PX = (PAGE_WIDTH_CM - MARGIN_LEFT_CM - MARGIN_RIGHT_CM) * PX_PER_CM;
const CHAR_SPACING_FACTOR = 0.5;

function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

function charsPerLine(fontSizePt: number, widthPx = USABLE_WIDTH_PX): number {
  const averageGlyphPx = ptToPx(fontSizePt) * CHAR_SPACING_FACTOR;
  return Math.max(10, Math.floor(widthPx / averageGlyphPx));
}

function estimateLineCount(text: string, fontSizePt: number, widthPx = USABLE_WIDTH_PX): number {
  const cleaned = cleanMojibakeText(text);
  if (!cleaned.trim()) return 1;
  const perLine = charsPerLine(fontSizePt, widthPx);
  const words = cleaned.split(/\s+/);
  let lines = 0;
  let current = 0;
  for (const word of words) {
    const wordLen = word.length;
    if (wordLen >= perLine) {
      lines += 1;
      current = wordLen;
      continue;
    }
    if (current === 0) {
      lines += 1;
      current = wordLen;
    } else if (current + 1 + wordLen <= perLine) {
      current += 1 + wordLen;
    } else {
      lines += 1;
      current = wordLen;
    }
  }
  return Math.max(1, lines);
}

function estimateBlockHeight(
  block: EditorBlock,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
): number {
  const bodyLinePx = ptToPx(BODY_SIZE_PT) * 1.5;
  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3": {
      const sizePt = BODY_SIZE_PT;
      const lines = estimateLineCount(block.text, sizePt);
      const marginsPx = ptToPx(sizePt) * 2; // 1,5em antes + 0,5em depois
      return bodyLinePx * lines + marginsPx;
    }
    case "longQuote": {
      const sizePt = LONG_QUOTE_SIZE_PT;
      const widthPx = USABLE_WIDTH_PX - LONG_QUOTE_INDENT_CM * PX_PER_CM;
      const lines = estimateLineCount(block.text, sizePt, widthPx);
      return ptToPx(sizePt) * lines + ptToPx(BODY_SIZE_PT);
    }
    case "source": {
      const sizePt = SOURCE_SIZE_PT;
      const lines = estimateLineCount(block.text, sizePt);
      return ptToPx(sizePt) * lines + ptToPx(BODY_SIZE_PT);
    }
    case "paragraph": {
      const lines = estimateLineCount(block.text, BODY_SIZE_PT);
      return bodyLinePx * lines + 8;
    }
    case "reference":
      return 0;
    case "scheduleTable":
    case "plainScheduleTable":
    case "markdownTable":
    case "tabbedTable": {
      const rows = block.text.split("\n").filter((line) => line.trim()).length;
      return Math.max(rows, 1) * 24 + 20;
    }
    case "importedImage": {
      const image = importedImages.find((img) => img.id === block.text);
      if (image?.width && image?.height) {
        const scale = Math.min(1, USABLE_WIDTH_PX / image.width);
        return image.height * scale + ptToPx(BODY_SIZE_PT) * 2;
      }
      return 260;
    }
    case "importedTable":
      return importedTables.find((table) => table.id === block.text) ? 200 : 0;
    default: {
      const lines = estimateLineCount(block.text, BODY_SIZE_PT);
      return bodyLinePx * lines + 8;
    }
  }
}

function calculateRealPages(
  bodyBlocks: EditorBlock[],
  references: string[],
  apendices: string,
  anexos: string,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
  bodyStartPage: number,
  indice = "",
): Map<string, number> {
  const pageMap = new Map<string, number>();
  const record = (text: string, page: number): void => {
    const key = normalizeForDetection(cleanMojibakeText(text));
    if (!pageMap.has(key)) pageMap.set(key, page);
  };

  let currentHeight = 0;
  let currentPage = bodyStartPage;
  const minRemainingPx = ptToPx(BODY_SIZE_PT) * 1.5 * 2;

  for (const block of bodyBlocks) {
    const isHeading =
      block.type === "heading1" || block.type === "heading2" || block.type === "heading3";
    const height = estimateBlockHeight(block, importedImages, importedTables);
    const remaining = USABLE_HEIGHT_PX - currentHeight;
    if (isHeading && remaining < height + minRemainingPx) {
      currentPage += 1;
      currentHeight = height;
    } else if (currentHeight + height > USABLE_HEIGHT_PX) {
      currentPage += 1;
      currentHeight = height;
    } else {
      currentHeight += height;
    }
    if (isHeading) record(block.text, currentPage);
  }

  if (references.length > 0) {
    currentPage += 1;
    record("REFERÊNCIAS", currentPage);
  }
  if (hasText(apendices)) {
    currentPage += 1;
    record("APÊNDICE A", currentPage);
  }
  if (hasText(anexos)) {
    currentPage += 1;
    record("ANEXOS", currentPage);
  }
  if (hasText(indice)) {
    currentPage += 1;
    record("ÍNDICE", currentPage);
  }
  return pageMap;
}

export type PreviewTemplateId = "general" | "article" | "cpg" | "research-project";

function previewTemplateFor(workType: WorkTypeValue): PreviewTemplateId {
  const normalizedWorkType = normalizeWorkType(workType);
  if (isResearchProject(normalizedWorkType)) return "research-project";
  if (isCpgWork(normalizedWorkType)) return "cpg";
  if (normalizedWorkType === "artigo" || normalizedWorkType === "artigo_cientifico_ufla") {
    return "article";
  }
  return "general";
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => cleanMojibakeText(line).trim())
    .filter(Boolean);
}

function page(children: string, className = ""): string {
  const cls = ["preview-page", className].filter(Boolean).join(" ");
  return `<section class="${cls}">${children}</section>`;
}

/**
 * Header simulado (número de página no canto superior direito, 10 pt).
 * Fiel ao DOCX (DECISION-010): pré-textuais NÃO exibem número; a numeração
 * visível inicia na primeira página textual com o valor contado.
 */
function pageNumberHeader(pageNumber: number): string {
  return `<div class="preview-page-number" data-font-size="10pt" aria-label="Página ${pageNumber}">${pageNumber}</div>`;
}

function unnumberedTitle(text: string): string {
  return `<h2 class="preview-unnumbered-title">${escapeHtml(cleanMojibakeText(text).toUpperCase())}</h2>`;
}

function centeredLine(text: string, bold = false, sizePt: number = BODY_SIZE_PT, extraClass = ""): string {
  const cls = [bold ? "preview-centered preview-bold" : "preview-centered", extraClass].filter(Boolean).join(" ");
  return `<p class="${cls}" data-font-size="${sizePt}pt">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</p>`;
}

function bodyParagraph(text: string): string {
  return `<p class="preview-body">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</p>`;
}

function simpleParagraph(text: string): string {
  return `<p class="preview-simple">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</p>`;
}

function longQuoteHtml(text: string): string {
  return `<blockquote class="preview-long-quote" data-font-size="${LONG_QUOTE_SIZE_PT}pt">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</blockquote>`;
}

function equationHtml(text: string, ommlXml?: string): string {
  const cleaned = cleanMojibakeText(text || " ").trim();
  const numberMatch = cleaned.match(/\s*\((\d+(?:\.\d+)?)\)\s*$/);
  const body = numberMatch ? cleaned.slice(0, numberMatch.index).trim() : cleaned;
  const number = numberMatch ? `(${numberMatch[1]})` : "";
  // Renderiza o LaTeX do bloco [EQ] com KaTeX (o Word renderiza OMML; o KaTeX
  // é a aproximação web mais fiel — frações, raízes, ∑/∫/lim com índices).
  // Equações IMPORTADAS trazem o OMML cru (token \uF001OMML:...) — o OMML é
  // convertido para LaTeX (omml-to-latex.ts) e renderizado com a MESMA
  // fidelidade do Word. Fallback: texto com glifos quando o KaTeX falha.
  const latexSource = ommlXml ? ommlToLatex(ommlXml) : body;
  let bodyHtml: string;
  try {
    bodyHtml = katex.renderToString(latexSource || " ", {
      displayMode: false,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    bodyHtml = `<span class="preview-equation-body">${inlineMarkupToHtml(body || " ")}</span>`;
  }
  const numberHtml = number ? `<span class="preview-equation-number">${escapeHtml(number)}</span>` : "";
  return `<p class="preview-equation">${bodyHtml}${numberHtml}</p>`;
}

function sourceHtml(text: string): string {
  return `<p class="preview-source" data-font-size="${SOURCE_SIZE_PT}pt">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</p>`;
}

function captionHtml(text: string): string {
  return `<p class="preview-caption">${inlineMarkupToHtml(cleanMojibakeText(text || " "))}</p>`;
}

function headingHtml(level: 1 | 2 | 3, text: string): string {
  const cleaned = cleanMojibakeText(text);
  if (level === 1) {
    return `<h1 class="preview-heading1 preview-break-before">${escapeHtml(cleaned.toUpperCase())}</h1>`;
  }
  if (level === 2) {
    return `<h2 class="preview-heading2">${inlineMarkupToHtml(cleaned)}</h2>`;
  }
  return `<h3 class="preview-heading3">${inlineMarkupToHtml(cleaned)}</h3>`;
}

function labeledParagraph(label: string, value: string, separator: "." | ":" = "."): string {
  if (!hasText(value)) return "";
  return splitParagraphs(value)
    .map((line) => {
      const labelHtml = label ? `<strong>${escapeHtml(label)}${escapeHtml(separator)} </strong>` : "";
      return `<p class="preview-simple preview-indent-none">${labelHtml}${inlineMarkupToHtml(line)}</p>`;
    })
    .join("");
}

function referenceRunHtml(run: ReferenceRun, options: { noBold?: boolean } = {}): string {
  const text = escapeHtml(cleanMojibakeText(run.text));
  let html = text;
  if (run.italics) html = `<em>${html}</em>`;
  if (run.bold && !options.noBold) html = `<strong>${html}</strong>`;
  return html;
}

function referenceAuthorKey(text: string): string {
  const trimmed = text.trim();
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex > 0) return trimmed.substring(0, commaIndex).trim();
  const firstSpace = trimmed.search(/\s/);
  return firstSpace > 0 ? trimmed.substring(0, firstSpace) : trimmed;
}

function referencesHtml(references: string[], options: { noBold?: boolean } = {}): string {
  const normalized = normalizeReferences(references);
  const seen = new Set<string>();
  const deduped = normalized.filter((ref) => {
    const key = ref.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const sorted = deduped.sort((a, b) => {
    const aKey = referenceAuthorKey(a.text);
    const bKey = referenceAuthorKey(b.text);
    return aKey.localeCompare(bKey, "pt-BR", { sensitivity: "base" });
  });
  return sorted
    .map((ref) => {
      const runs = ref.runs.length
        ? ref.runs.map((run) => referenceRunHtml(run, options)).join("")
        : escapeHtml(cleanMojibakeText(ref.text || " "));
      return `<p class="preview-reference">${runs}</p>`;
    })
    .join("");
}

function paragraphOrCaption(text: string): string {
  const cleaned = cleanMojibakeText(text);
  if (detectCaption(cleaned)) return captionHtml(cleaned);
  if (/^Fonte\s*:/i.test(cleaned)) return sourceHtml(cleaned);
  return bodyParagraph(cleaned);
}

function tableHtmlFromText(text: string): string {
  const detected = detectTabbedTableBlock(text);
  if (!detected) {
    return `<pre class="preview-table-fallback">${escapeHtml(cleanMojibakeText(text))}</pre>`;
  }
  const columnCount = Math.max(...detected.rows.map((row) => row.length), 1);
  const rowsHtml = detected.rows
    .map((cells, rowIndex) => {
      const padded = Array.from({ length: columnCount }, (_, index) => cells[index] ?? "");
      const cellsHtml = padded
        .map((cell) =>
          rowIndex === 0
            ? `<th>${escapeHtml(cell)}</th>`
            : `<td>${escapeHtml(cell)}</td>`,
        )
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");
  const captionHtmlPart = detected.caption ? captionHtml(detected.caption) : "";
  const sourceHtmlPart = detected.sourceLine ? sourceHtml(detected.sourceLine) : "";
  return `${captionHtmlPart}<table class="preview-table"><tbody>${rowsHtml}</tbody></table>${sourceHtmlPart}`;
}

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    binary += String.fromCharCode(...data.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function importedImageHtml(image: ImportedDocumentImage | undefined, presentTexts?: Set<string>): string {
  if (!image) return simpleParagraph("[Imagem importada: dados originais indisponíveis — reinsira manualmente]");
  const captionAlreadyInBody = presentTexts?.has(normalizeForDetection(cleanMojibakeText(image.caption ?? ""))) ?? false;
  const sourceAlreadyInBody = presentTexts?.has(normalizeForDetection(cleanMojibakeText(image.source ?? ""))) ?? false;
  const caption = image.caption && !captionAlreadyInBody ? captionHtml(image.caption) : "";
  const source = image.source && !sourceAlreadyInBody ? sourceHtml(image.source) : "";
  const base64 = image.base64 || (image.data?.byteLength ? uint8ArrayToBase64(image.data) : "");
  let imageHtml: string;
  if (base64) {
    const mime = image.mimeType || "image/png";
    imageHtml = `<img class="preview-image" src="data:${mime};base64,${base64}" alt="${escapeHtml(image.caption || image.fileName || image.id)}" />`;
  } else {
    imageHtml = simpleParagraph(`[IMAGEM DETECTADA] ${image.caption ? image.caption + ". " : ""}Reinsira manualmente esta imagem no documento final.`);
  }
  return `${caption}${imageHtml}${source}`;
}

function importedTableHtml(table: ImportedTable | undefined, presentTexts?: Set<string>): string {
  if (!table || !table.rows.length) {
    return simpleParagraph("[Tabela importada: dados originais indisponíveis — reinsira manualmente]");
  }
  const captionAlreadyInBody = presentTexts?.has(normalizeForDetection(cleanMojibakeText(table.caption ?? ""))) ?? false;
  const sourceAlreadyInBody = presentTexts?.has(normalizeForDetection(cleanMojibakeText(table.source ?? ""))) ?? false;
  const caption = table.caption && !captionAlreadyInBody ? captionHtml(table.caption) : "";
  const source = table.source && !sourceAlreadyInBody ? sourceHtml(table.source) : "";
  const columnCount = table.columnCount || Math.max(...table.rows.map((row) => row.length), 1);
  const rowsHtml = table.rows
    .map((cells, rowIndex) => {
      const padded = Array.from({ length: columnCount }, (_, index) => cells[index]?.text ?? "");
      const cellsHtml = padded
        .map((cell) =>
          rowIndex === 0
            ? `<th>${escapeHtml(cell)}</th>`
            : `<td>${escapeHtml(cell)}</td>`,
        )
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");
  return `${caption}<table class="preview-table"><tbody>${rowsHtml}</tbody></table>${source}`;
}

function bodyTextsInBody(bodyBlocks: EditorBlock[]): Set<string> {
  const present = new Set<string>();
  for (const block of bodyBlocks) {
    if (block.type === "paragraph" || block.type === "source" || block.type === "heading1" || block.type === "heading2" || block.type === "heading3") {
      present.add(normalizeForDetection(cleanMojibakeText(block.text)));
    }
  }
  return present;
}

function bodyBlockHtml(
  block: EditorBlock,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
  presentTexts?: Set<string>,
): string {
  switch (block.type) {
    case "heading1":
      return headingHtml(1, block.text);
    case "heading2":
      return headingHtml(2, block.text);
    case "heading3":
      return headingHtml(3, block.text);
    case "longQuote":
      return longQuoteHtml(block.text);
    case "equation":
      return equationHtml(block.text, block.ommlXml);
    case "scheduleTable":
    case "plainScheduleTable":
    case "markdownTable":
    case "tabbedTable":
      return tableHtmlFromText(block.text);
    case "importedImage":
      return importedImageHtml(importedImages.find((image) => image.id === block.text), presentTexts);
    case "importedTable":
      return importedTableHtml(importedTables.find((table) => table.id === block.text), presentTexts);
    case "source":
      return sourceHtml(block.text);
    case "reference":
      return "";
    default:
      return paragraphOrCaption(block.text);
  }
}

interface SummaryEntry {
  text: string;
  level: 1 | 2 | 3;
}

function collectPreviewSummaryEntries(
  bodyBlocks: EditorBlock[],
  references: string[],
  apendices: string,
  anexos: string,
  indice = "",
): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  const seen = new Set<string>();
  const push = (text: string, level: 1 | 2 | 3): void => {
    const cleaned = cleanMojibakeText(text).trim();
    const key = normalizeForDetection(cleaned);
    if (!cleaned || key === "SUMARIO" || seen.has(key)) return;
    seen.add(key);
    entries.push({ text: cleaned, level });
  };
  for (const block of bodyBlocks) {
    if (block.type === "heading1") push(block.text.toUpperCase(), 1);
    else if (block.type === "heading2") push(block.text, 2);
    else if (block.type === "heading3") push(block.text, 3);
  }
  if (references.length > 0) push("REFERÊNCIAS", 1);
  if (hasText(anexos)) push("ANEXOS", 1);
  if (hasText(apendices)) push("APÊNDICE A", 1);
  if (hasText(indice)) push("ÍNDICE", 1);
  return entries;
}

function summaryHtml(
  bodyBlocks: EditorBlock[],
  references: string[],
  apendices: string,
  anexos: string,
  bodyStartPage = 1,
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
  preTextual: Array<{ title: string; page: number }> = [],
  indice = "",
): string {
  // Entradas pré-textuais (FICHA CATALOGRÁFICA, RESUMO, ABSTRACT, listas…): o
  // TOC do Word lista esses títulos (fidelidade ao baseline UFLA) antes do corpo.
  const entries: SummaryEntry[] = [
    ...preTextual.map((p) => ({ text: p.title, level: 1 as const })),
    ...collectPreviewSummaryEntries(bodyBlocks, references, apendices, anexos, indice),
  ];
  if (!entries.length) return "";
  const pageMap = calculateRealPages(bodyBlocks, references, apendices, anexos, importedImages, importedTables, bodyStartPage, indice);
  for (const p of preTextual) pageMap.set(normalizeForDetection(cleanMojibakeText(p.title)), p.page);
  const entriesHtml = entries
    .map((entry) => {
      const cls = entry.level === 1 ? "preview-summary-1" : entry.level === 2 ? "preview-summary-2" : "preview-summary-3";
      const bold = entry.level === 1;
      const pageNumber = pageMap.get(normalizeForDetection(cleanMojibakeText(entry.text)));
      return `<p class="preview-summary ${cls}${bold ? " preview-bold" : ""}"><span class="preview-summary-text">${escapeHtml(entry.text)}</span><span class="preview-summary-leader" aria-hidden="true"></span><span class="preview-summary-page">${pageNumber ?? "—"}</span></p>`;
    })
    .join("");
  return `<div class="preview-summary-block">${unnumberedTitle("Sumário")}${entriesHtml}</div>`;
}

function coverHtml(fields: DocxGenerationInput["fields"]): string {
  return [
    `<div class="preview-cover-logo"><img src="/assets/ufla-logo.jpeg" alt="Marca UFLA" class="preview-cover-logo-img" /></div>`,
    centeredLine((fields.author || "AUTOR").toUpperCase(), true, COVER_AUTHOR_SIZE_PT),
    centeredLine((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true, COVER_TITLE_SIZE_PT),
    fields.subtitle ? centeredLine(fields.subtitle.toUpperCase(), false, COVER_TITLE_SIZE_PT) : "",
    centeredLine((fields.location || "LAVRAS - MG").toUpperCase(), true, COVER_AUTHOR_SIZE_PT),
    centeredLine(fields.year || new Date().getFullYear().toString(), true, COVER_AUTHOR_SIZE_PT),
  ]
    .filter(Boolean)
    .join("");
}

function titlePageHtml(fields: DocxGenerationInput["fields"]): string {
  const nature = workNatureHtml(fields);
  const supplemental = titlePageSupplementalLinesHtml(fields);
  return [
    centeredLine((fields.author || "AUTOR").toUpperCase(), true, COVER_AUTHOR_SIZE_PT),
    centeredLine((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true, BODY_SIZE_PT),
    fields.subtitle ? centeredLine(fields.subtitle.toUpperCase(), false, BODY_SIZE_PT) : "",
    `<p class="preview-nature">${inlineMarkupToHtml(cleanMojibakeText(nature))}</p>`,
    ...supplemental.map((line) => centeredLine(line, false, BODY_SIZE_PT)),
    centeredLine((fields.location || "LAVRAS - MG").toUpperCase(), false, BODY_SIZE_PT),
    centeredLine(fields.year || new Date().getFullYear().toString(), true, BODY_SIZE_PT),
  ]
    .filter(Boolean)
    .join("");
}

function workNatureHtml(fields: DocxGenerationInput["fields"]): string {
  const providedNature = cleanMojibakeText(fields.workNature).trim();
  if (!providedNature || isInternalWorkNatureHtml(providedNature)) {
    return workTypeSpecificNatureHtml(fields);
  }
  return cleanMojibakeText(providedNature);
}

function isInternalWorkNatureHtml(value: string): boolean {
  const normalized = normalizeForDetection(cleanMojibakeText(value));
  return (
    normalized.includes("COLECAO PRODUCAO ACADEMICA") ||
    normalized.includes("SUPORTE INICIAL NO SISTEMA") ||
    normalized.includes("SOFTWARE E APLICATIVOS UFLA")
  );
}

function workTypeSpecificNatureHtml(fields: DocxGenerationInput["fields"]): string {
  const prog = fields.program || fields.course || "Programa de Pós-Graduação";
  switch (fields.workType) {
    case "tese":
      return `Tese apresentada ao ${prog} da Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Doutor.`;
    case "dissertacao":
      return `Dissertação apresentada ao ${prog} da Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Mestre.`;
    case "monografia":
      return `Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos para obtenção do título de ${fields.course || "graduação"}.`;
    case "projeto_pesquisa":
      return "Projeto de pesquisa apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
    default:
      return "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
  }
}

function titlePageSupplementalLinesHtml(fields: DocxGenerationInput["fields"]): string[] {
  const normalizedNature = normalizeForDetection(workNatureHtml(fields));
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";
  return [
    !isGraduateThesis && fields.course && !normalizedNature.includes("CURSO")
      ? cleanMojibakeText(`Curso: ${fields.course}`)
      : "",
    fields.program && !normalizedNature.includes("PROGRAMA") ? cleanMojibakeText(`Programa: ${fields.program}`) : "",
    fields.advisor && !normalizedNature.includes("ORIENTADOR") ? cleanMojibakeText(`Orientador(a): ${fields.advisor}`) : "",
    fields.coadvisor && !normalizedNature.includes("COORIENTADOR")
      ? cleanMojibakeText(`Coorientador(a): ${fields.coadvisor}`)
      : "",
  ].filter(Boolean);
}

function resumoAbstractHtml(fields: DocxGenerationInput["fields"], abstractPageClassName = ""): string {
  const resumo = [
    unnumberedTitle("Resumo"),
    simpleParagraph(fields.resumo || " "),
    fields.palavrasChave
      ? `<p class="preview-simple preview-indent-none"><strong>Palavras-chave: </strong>${inlineMarkupToHtml(cleanMojibakeText(ensureTrailingPeriod(fields.palavrasChave)))}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const abstract = [
    unnumberedTitle("Abstract"),
    simpleParagraph(fields.abstractText || " "),
    fields.keywords
      ? `<p class="preview-simple preview-indent-none"><strong>Keywords: </strong>${inlineMarkupToHtml(cleanMojibakeText(ensureTrailingPeriod(fields.keywords)))}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  return page(resumo) + page(abstract, abstractPageClassName);
}

function ensureTrailingPeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith(".")) return trimmed;
  return `${trimmed.replace(/[;\s]+$/, "")}.`;
}

function impactIndicatorsHtml(fields: DocxGenerationInput["fields"]): string {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  const indicadores = buildFlowingImpactText(fields);
  const impactIndicators = cleanMojibakeText(fields.impactIndicators?.trim() || "");
  const parts: string[] = [];
  if (impactRequired || hasText(indicadores)) {
    const body = hasText(indicadores)
      ? simpleParagraph(indicadores)
      : simpleParagraph(
          "Indicadores de impacto não preenchidos. Consulte o Manual UFLA 6ª ed. p. 51 para orientações sobre este elemento obrigatório.",
        );
    parts.push(page(unnumberedTitle("Indicadores de impacto") + body));
  }
  if (hasText(impactIndicators)) {
    parts.push(page(unnumberedTitle("Impact indicators") + simpleParagraph(impactIndicators)));
  }
  return parts.join("");
}

function autoListItems(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
): Array<{ kind: "illustration" | "table"; label: string }> {
  const items: Array<{ kind: "illustration" | "table"; label: string }> = [];
  const seen = new Set<string>();
  const push = (kind: "illustration" | "table", text: string): void => {
    const cleaned = cleanMojibakeText(text);
    const caption = detectCaption(cleaned);
    if (!caption) return;
    const key = normalizeForDetection(`${kind}:${cleaned}`);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ kind, label: `${cleaned}` });
  };
  for (const block of bodyBlocks) {
    if (block.type === "paragraph") {
      const cleaned = cleanMojibakeText(block.text);
      const caption = detectCaption(cleaned);
      if (caption) push(caption.kind === "table" ? "table" : "illustration", cleaned);
      continue;
    }
    if (block.type === "importedImage") {
      const image = importedImages.find((item) => item.id === block.text);
      if (image?.caption) push("illustration", image.caption);
      continue;
    }
    if (block.type === "importedTable") {
      const table = importedTables.find((item) => item.id === block.text);
      if (table?.caption) push("table", table.caption);
      continue;
    }
  }
  return items;
}

function autoListsHtml(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
): string {
  const items = autoListItems(bodyBlocks, importedImages, importedTables);
  const illustrations = items.filter((item) => item.kind === "illustration");
  const tables = items.filter((item) => item.kind === "table");
  const listHtml = (title: string, entries: Array<{ label: string }>): string => {
    if (!entries.length) return "";
    const entriesHtml = entries
      .map((entry) => `<p class="preview-list-entry">${inlineMarkupToHtml(entry.label)}</p>`)
      .join("");
    return page(unnumberedTitle(title) + entriesHtml);
  };
  return listHtml("Lista de ilustrações", illustrations) + listHtml("Lista de tabelas", tables);
}

function optionalFrontPage(title: string, content: string): string {
  if (!hasText(content)) return "";
  return page(unnumberedTitle(title) + simpleParagraph(content));
}

function generalPreview(input: DocxGenerationInput): string {
  const { fields } = input;
  const requirements = getWorkTypeRequirements(fields.workType);
  const parsedBlocks = parseEditorContent(input.editorText);
  const bodyBlocksAll = parsedBlocks.filter((block) => block.type !== "reference");
  const editorReferences = parsedBlocks
    .filter((block) => block.type === "reference")
    .map((block) => block.text);
  const extractedReferencesSection = extractReferencesSection(bodyBlocksAll);
  const bodyBlocks = extractedReferencesSection.bodyBlocks;
  const references = [
    ...splitParagraphs(fields.referencias),
    ...editorReferences,
    ...extractedReferencesSection.references,
  ];
  const hasSummary =
    bodyBlocks.some(
      (block) =>
        block.type === "heading1" || block.type === "heading2" || block.type === "heading3",
    ) ||
    references.length > 0 ||
    Boolean(fields.apendices || fields.anexos);

  const importedImages = input.importedImages ?? [];
  const importedTables = input.importedTables ?? [];

  const presentTexts = bodyTextsInBody(bodyBlocks);
  const bodyHtml = bodyBlocks.map((block) => bodyBlockHtml(block, importedImages, importedTables, presentTexts)).filter(Boolean).join("");

  // Montagem das páginas pré-textuais com contagem real (DECISION-010). O helper
  // pushPre conta a página física de cada bloco e registra os títulos que entram
  // no sumário (fidelidade ao TOC do Word/baseline UFLA). Títulos que a prática
  // ABNT/UFLA não lista no sumário ficam de fora (folha de aprovação, dedicatória,
  // epígrafe, errata).
  const TOC_EXCLUDED = new Set(["FOLHA DE APROVAÇÃO", "DEDICATÓRIA", "EPÍGRAFE", "ERRATA"]);
  const preTextual: string[] = [];
  const tocPre: Array<{ title: string; page: number }> = [];
  let prePageCount = 0;
  const pushPre = (html: string): void => {
    if (!html) return;
    const titles = [...html.matchAll(/class="preview-unnumbered-title">([^<]+)<\/h2>/g)].map((m) => m[1]);
    if (titles.length > 0) {
      for (const t of titles) {
        prePageCount += 1;
        if (!TOC_EXCLUDED.has(t)) tocPre.push({ title: t, page: prePageCount });
      }
    } else {
      prePageCount += 1; // capa/folha de rosto contam página sem entrada no sumário
    }
    preTextual.push(html);
  };
  pushPre(page(coverHtml(fields), "preview-cover"));
  pushPre(page(titlePageHtml(fields), "preview-title-page"));
  if (requirements.requiresCatalogCard) {
    const fichaText = cleanMojibakeText(fields.fichaCatalografica?.trim() || "");
    pushPre(
      page(
        unnumberedTitle("Ficha catalográfica") +
          (fichaText
            ? simpleParagraph(fichaText)
            : simpleParagraph(
                "Ficha catalográfica detectada no arquivo importado. Preserve ou substitua manualmente pela ficha oficial da Biblioteca Universitária da UFLA.",
              )),
      ),
    );
  }
  if (fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese") {
    // Fidelidade à folha de aprovação do DOCX (export-docx): aprovado em, banca e instituição.
    pushPre(
      page(
        unnumberedTitle("Folha de aprovação") +
          simpleParagraph("APROVADO EM: ____ de ____________________ de ______.") +
          simpleParagraph("Prof.(a) Dr.(a) ______________________________") +
          simpleParagraph("Instituição: ________________________________"),
      ),
    );
  }
  pushPre(optionalFrontPage("Dedicatória", fields.dedicatoria));
  pushPre(optionalFrontPage("Agradecimentos", fields.agradecimentos));
  pushPre(optionalFrontPage("Epígrafe", fields.epigrafe));
  pushPre(optionalFrontPage("Errata", fields.errata));
  const abstractBreakClass = ["monografia", "dissertacao", "tese"].includes(fields.workType) ? "preview-abstract-break" : "";
  pushPre(resumoAbstractHtml(fields, abstractBreakClass));
  pushPre(impactIndicatorsHtml(fields));
  pushPre(autoListsHtml(bodyBlocks, importedImages, importedTables));
  pushPre(optionalFrontPage("Lista de quadros", fields.listaQuadros));
  pushPre(optionalFrontPage("Lista de gráficos", fields.listaGraficos));
  pushPre(optionalFrontPage("Lista de tabelas", fields.listaTabelas));
  pushPre(optionalFrontPage("Lista de siglas", fields.listaSiglas));
  pushPre(optionalFrontPage("Lista de abreviaturas", fields.listaAbreviaturas));
  pushPre(optionalFrontPage("Lista de símbolos", fields.listaSimbolos));
  pushPre(optionalFrontPage("Glossário", fields.glossario));
  // As entradas do sumário listam a página do corpo: pré-textuais (já
  // incluindo a própria página do sumário) + 1. O Word/baseline UFLA lista
  // o próprio SUMÁRIO no TOC (estilo de título com outline level).
  if (hasSummary) {
    tocPre.push({ title: "SUMÁRIO", page: prePageCount + 1 });
    preTextual.push(page(summaryHtml(bodyBlocks, references, fields.apendices, fields.anexos, calculateTextualStartPage(fields, hasSummary, bodyBlocks, importedImages, importedTables), importedImages, importedTables, tocPre, fields.indice)));
  }

  // Numeração visível inicia na primeira página textual com o VALOR CONTADO
  // (DECISION-010 / calculateTextualStartPage: folha de rosto = 1; capa e ficha
  // no verso não contam). Antes o preview usava a contagem física (corpo em 8
  // para a monografia) enquanto o DOCX usava w:start=6 — alinhado agora.
  const bodyStartPage = calculateTextualStartPage(fields, hasSummary, bodyBlocks, importedImages, importedTables);
  // Referências/apêndices/anexos continuam a numeração após as páginas reais do
  // corpo (mesmo cálculo do sumário — calculateRealPages), como o Word faz.
  const postPages = calculateRealPages(bodyBlocks, references, fields.apendices, fields.anexos, importedImages, importedTables, bodyStartPage, fields.indice);
  const refsPage = postPages.get(normalizeForDetection("REFERÊNCIAS")) ?? bodyStartPage + 1;
  const appendixPage = postPages.get(normalizeForDetection("APÊNDICE A")) ?? refsPage + 1;
  const anexosPage = postPages.get(normalizeForDetection("ANEXOS")) ?? appendixPage + 1;
  const indicePage = postPages.get(normalizeForDetection("ÍNDICE")) ?? anexosPage + 1;
  const postTextual: string[] = [];
  postTextual.push(
    page(
      pageNumberHeader(refsPage) + unnumberedTitle("Referências") + referencesHtml(references),
      "preview-references",
    ),
  );
  if (hasText(fields.apendices)) {
    postTextual.push(page(pageNumberHeader(appendixPage) + unnumberedTitle("Apêndice A") + simpleParagraph(fields.apendices)));
  }
  if (hasText(fields.anexos)) {
    postTextual.push(page(pageNumberHeader(anexosPage) + unnumberedTitle("Anexos") + simpleParagraph(fields.anexos)));
  }
  if (hasText(fields.indice)) {
    postTextual.push(page(pageNumberHeader(indicePage) + unnumberedTitle("Índice") + simpleParagraph(fields.indice)));
  }

  return [
    `<div class="preview-document" data-template="general" data-work-type="${fields.workType}" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    ...preTextual,
    page(pageNumberHeader(bodyStartPage) + bodyHtml, "preview-body-flow"),
    ...postTextual,
    `</div>`,
  ].join("\n");
}

function articlePreview(input: DocxGenerationInput): string {
  const { fields } = input;
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = blocks.filter(
    (block) => block.type !== "reference" && normalizeForDetection(block.text) !== "REFERENCIAS",
  );
  const references = blocks
    .filter((block) => block.type === "reference")
    .map((block) => block.text);
  const effectiveReferences = references.length ? references : splitParagraphs(fields.referencias);

  const bodyHtml = bodyBlocks
    .map((block) => bodyBlockHtml(block, input.importedImages ?? [], input.importedTables ?? [], bodyTextsInBody(bodyBlocks)))
    .filter(Boolean)
    .join("");

  const header = [
    centeredLine((fields.title || "Título do artigo").toUpperCase(), true, COVER_TITLE_SIZE_PT),
    fields.subtitle ? centeredLine(fields.subtitle, false, 14) : "",
    centeredLine((fields.author || "Autor").toUpperCase(), false, 14),
    labeledParagraph("Resumo", fields.resumo),
    fields.palavrasChave
      ? `<p class="preview-simple preview-indent-none"><strong>Palavras-chave: </strong>${inlineMarkupToHtml(cleanMojibakeText(normalizeSemicolonKeywords(fields.palavrasChave) + "."))}</p>`
      : "",
    labeledParagraph("Abstract", fields.abstractText),
    fields.keywords
      ? `<p class="preview-simple preview-indent-none"><strong>Keywords: </strong>${inlineMarkupToHtml(cleanMojibakeText(normalizeSemicolonKeywords(fields.keywords) + "."))}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const referencesSection = referencesHtml(effectiveReferences);
  const referencesBlock = referencesSection
    ? `<section class="preview-page preview-references">${pageNumberHeader(2)}<h2 class="preview-unnumbered-title">REFERÊNCIAS</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="article" data-work-type="${fields.workType}" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    page(pageNumberHeader(1) + header + bodyHtml, "preview-article-flow"),
    referencesBlock,
    `</div>`,
  ].join("\n");
}

function normalizeSemicolonKeywords(value: string): string {
  return value.replace(/\s*;\s*/g, "; ").replace(/;\s*$/, "").trim();
}

function cpgPreview(input: DocxGenerationInput): string {
  const { fields } = input;
  const blocks = parseEditorContent(stripCpgForbiddenSections(input.editorText));
  const { bodyBlocks, referenceTitle, references: editorReferences } = splitCpgReferences(blocks);
  const references = [...splitParagraphs(fields.referencias), ...editorReferences];

  const bodyHtml = bodyBlocks
    .map((block) => bodyBlockHtml(block, input.importedImages ?? [], input.importedTables ?? [], bodyTextsInBody(bodyBlocks)))
    .filter(Boolean)
    .join("");

  const header = [
    centeredLine((fields.title || "Título do trabalho").toUpperCase(), true, COVER_TITLE_SIZE_PT),
    centeredLine((fields.author || "Autores").toUpperCase(), true, BODY_SIZE_PT),
    ...splitParagraphs(dedupeCpgAffiliations(fields.program)).map((line) =>
      centeredLine(line, false, BODY_SIZE_PT, fields.workType === "resumo_cpg" ? "preview-affiliation-1-5" : "preview-affiliation-single"),
    ),
    fields.course
      ? centeredLine(fields.course, false, CPG_RULES.typography.emailFontSizePt, "preview-monospace")
      : "",
    labeledParagraph("Resumo", fields.resumo),
    labeledParagraph("Palavras-chave", fields.palavrasChave, ":"),
    labeledParagraph("Abstract", fields.abstractText),
    labeledParagraph("Keywords", fields.keywords, ":"),
  ]
    .filter(Boolean)
    .join("");

  const referencesSection = referencesHtml(references, { noBold: true });
  const referencesBlock = referencesSection
    ? `<section class="preview-page preview-references">${pageNumberHeader(2)}<h2 class="preview-unnumbered-title">${escapeHtml(referenceTitle || "REFERÊNCIAS")}</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="cpg" data-work-type="${fields.workType}" data-first-line-cm="${CPG_RULES.typography.paragraphFirstLineCm}">`,
    page(pageNumberHeader(1) + header + bodyHtml, "preview-cpg-flow"),
    referencesBlock,
    `</div>`,
  ].join("\n");
}

function researchProjectPreview(input: DocxGenerationInput): string {
  const { fields } = input;
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = blocks.filter((block) => block.type !== "reference");
  const references = [
    ...splitParagraphs(fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  const importedImages = input.importedImages ?? [];
  const importedTables = input.importedTables ?? [];
  const bodyHtml = bodyBlocks
    .map((block) => bodyBlockHtml(block, importedImages, importedTables, bodyTextsInBody(bodyBlocks)))
    .filter(Boolean)
    .join("");

  const resumo = page(
    unnumberedTitle("Resumo") +
      splitParagraphs(fields.resumo).map(bodyParagraph).join("") +
      (fields.palavrasChave
        ? `<p class="preview-simple preview-indent-none"><strong>Palavras-chave: </strong>${inlineMarkupToHtml(cleanMojibakeText(normalizeKeywordSentence(fields.palavrasChave)))}</p>`
        : ""),
  );
  const abstract = page(
    unnumberedTitle("Abstract") +
      splitParagraphs(fields.abstractText).map(bodyParagraph).join("") +
      (fields.keywords
        ? `<p class="preview-simple preview-indent-none"><strong>Keywords: </strong>${inlineMarkupToHtml(cleanMojibakeText(normalizeKeywordSentence(fields.keywords)))}</p>`
        : ""),
  );

  // Contagem física das páginas pré-textuais (capa=1, folha=2, resumo=3, abstract=4)
  // para as entradas do sumário — fidelidade ao TOC do Word.
  const tocPre: Array<{ title: string; page: number }> = [];
  let prePageCount = 0;
  const pushPre = (html: string): void => {
    if (!html) return;
    const titles = [...html.matchAll(/class="preview-unnumbered-title">([^<]+)<\/h2>/g)].map((m) => m[1]);
    if (titles.length > 0) {
      for (const t of titles) {
        prePageCount += 1;
        tocPre.push({ title: t, page: prePageCount });
      }
    } else {
      prePageCount += 1;
    }
  };
  pushPre(page(coverHtml(fields), "preview-cover"));
  pushPre(page(titlePageHtml(fields), "preview-title-page"));
  pushPre(resumo);
  pushPre(abstract);

  // Sumário real (entradas pré-textuais + corpo) — o corpo do projeto reinicia em 1.
  tocPre.push({ title: "SUMÁRIO", page: prePageCount + 1 });
  const summaryHtmlOut = summaryHtml(bodyBlocks, references, "", "", 1, importedImages, importedTables, tocPre);
  const summary = summaryHtmlOut ? page(summaryHtmlOut) : "";

  // Página das referências: última página do corpo + 1 (o Word quebra por seção).
  const refsPage =
    calculateRealPages(bodyBlocks, references, "", "", importedImages, importedTables, 1).get(normalizeForDetection("REFERÊNCIAS")) ?? 2;
  const referencesSection = referencesHtml(references);
  const referencesBlock = referencesSection
    ? `<section class="preview-page preview-references">${pageNumberHeader(refsPage)}<h2 class="preview-unnumbered-title">REFERÊNCIAS</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="research-project" data-work-type="${fields.workType}" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    page(coverHtml(fields), "preview-cover"),
    page(titlePageHtml(fields), "preview-title-page"),
    resumo,
    abstract,
    summary,
    page(pageNumberHeader(1) + bodyHtml, "preview-body-flow"),
    referencesBlock,
    `</div>`,
  ].join("\n");
}

function normalizeKeywordSentence(value: string): string {
  const cleaned = cleanMojibakeText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return /[.;]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

export function buildPreviewHtml(input: DocxGenerationInput): string {
  const template = previewTemplateFor(input.fields.workType);
  switch (template) {
    case "article":
      return articlePreview(input);
    case "cpg":
      return cpgPreview(input);
    case "research-project":
      return researchProjectPreview(input);
    default:
      return generalPreview(input);
  }
}
