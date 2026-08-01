import {
  cleanMojibakeText,
  detectCaption,
  detectTabbedTableBlock,
} from "./docx-render-core";
import { escapeHtml, inlineMarkupToHtml } from "./editor-markup";
import {
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

const BODY_SIZE_PT = UFLA_RULES.typography.bodyFontSizePt;
const COVER_AUTHOR_SIZE_PT = UFLA_RULES.typography.coverAuthorFontSizePt;
const COVER_TITLE_SIZE_PT = UFLA_RULES.typography.coverTitleFontSizePt;
const LONG_QUOTE_SIZE_PT = UFLA_RULES.typography.longQuoteFontSizePt;
const SOURCE_SIZE_PT = UFLA_RULES.typography.sourceFontSizePt;
const FIRST_LINE_CM = UFLA_RULES.typography.paragraphFirstLineCm;
const LONG_QUOTE_INDENT_CM = UFLA_RULES.typography.longQuoteLeftIndentCm;

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

function unnumberedTitle(text: string): string {
  return `<h2 class="preview-unnumbered-title">${escapeHtml(cleanMojibakeText(text).toUpperCase())}</h2>`;
}

function centeredLine(text: string, bold = false, sizePt: number = BODY_SIZE_PT): string {
  const cls = bold ? "preview-centered preview-bold" : "preview-centered";
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

function referenceRunHtml(run: ReferenceRun): string {
  const text = escapeHtml(cleanMojibakeText(run.text));
  let html = text;
  if (run.italics) html = `<em>${html}</em>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  return html;
}

function referenceAuthorKey(text: string): string {
  const trimmed = text.trim();
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex > 0) return trimmed.substring(0, commaIndex).trim();
  const firstSpace = trimmed.search(/\s/);
  return firstSpace > 0 ? trimmed.substring(0, firstSpace) : trimmed;
}

function referencesHtml(references: string[]): string {
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
        ? ref.runs.map(referenceRunHtml).join("")
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

function importedImageHtml(image: ImportedDocumentImage | undefined): string {
  if (!image) return simpleParagraph("[Imagem importada: dados originais indisponíveis — reinsira manualmente]");
  const caption = image.caption ? captionHtml(image.caption) : "";
  const source = image.source ? sourceHtml(image.source) : "";
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

function importedTableHtml(table: ImportedTable | undefined): string {
  if (!table || !table.rows.length) {
    return simpleParagraph("[Tabela importada: dados originais indisponíveis — reinsira manualmente]");
  }
  const caption = table.caption ? captionHtml(table.caption) : "";
  const source = table.source ? sourceHtml(table.source) : "";
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

function bodyBlockHtml(
  block: EditorBlock,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
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
    case "scheduleTable":
    case "plainScheduleTable":
    case "markdownTable":
    case "tabbedTable":
      return tableHtmlFromText(block.text);
    case "importedImage":
      return importedImageHtml(importedImages.find((image) => image.id === block.text));
    case "importedTable":
      return importedTableHtml(importedTables.find((table) => table.id === block.text));
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
  return entries;
}

function summaryHtml(
  bodyBlocks: EditorBlock[],
  references: string[],
  apendices: string,
  anexos: string,
): string {
  const entries = collectPreviewSummaryEntries(bodyBlocks, references, apendices, anexos);
  if (!entries.length) return "";
  const entriesHtml = entries
    .map((entry) => {
      const cls = entry.level === 1 ? "preview-summary-1" : entry.level === 2 ? "preview-summary-2" : "preview-summary-3";
      const bold = entry.level === 1;
      return `<p class="preview-summary ${cls}${bold ? " preview-bold" : ""}">${escapeHtml(entry.text)}</p>`;
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

function resumoAbstractHtml(fields: DocxGenerationInput["fields"]): string {
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
  return page(resumo) + page(abstract);
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

  const bodyHtml = bodyBlocks.map((block) => bodyBlockHtml(block, importedImages, importedTables)).filter(Boolean).join("");

  const preTextual: string[] = [];
  preTextual.push(page(coverHtml(fields), "preview-cover"));
  preTextual.push(page(titlePageHtml(fields), "preview-title-page"));
  if (requirements.requiresCatalogCard) {
    preTextual.push(
      page(
        unnumberedTitle("Ficha catalográfica") +
          simpleParagraph(
            "Ficha catalográfica detectada no arquivo importado. Preserve ou substitua manualmente pela ficha oficial da Biblioteca Universitária da UFLA.",
          ),
      ),
    );
  }
  if (fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese") {
    preTextual.push(page(unnumberedTitle("Folha de aprovação") + simpleParagraph("Folha de aprovação com assinaturas da banca examinadora.")));
  }
  preTextual.push(optionalFrontPage("Dedicatória", fields.dedicatoria));
  preTextual.push(optionalFrontPage("Agradecimentos", fields.agradecimentos));
  preTextual.push(optionalFrontPage("Epígrafe", fields.epigrafe));
  preTextual.push(resumoAbstractHtml(fields));
  preTextual.push(impactIndicatorsHtml(fields));
  preTextual.push(autoListsHtml(bodyBlocks, importedImages, importedTables));
  preTextual.push(optionalFrontPage("Lista de quadros", fields.listaQuadros));
  preTextual.push(optionalFrontPage("Lista de gráficos", fields.listaGraficos));
  preTextual.push(optionalFrontPage("Lista de tabelas", fields.listaTabelas));
  preTextual.push(optionalFrontPage("Lista de siglas", fields.listaSiglas));
  if (hasSummary) {
    preTextual.push(page(summaryHtml(bodyBlocks, references, fields.apendices, fields.anexos)));
  }

  const postTextual: string[] = [];
  postTextual.push(
    page(
      unnumberedTitle("Referências") + referencesHtml(references),
      "preview-references",
    ),
  );
  if (hasText(fields.apendices)) {
    postTextual.push(page(unnumberedTitle("Apêndice A") + simpleParagraph(fields.apendices)));
  }
  if (hasText(fields.anexos)) {
    postTextual.push(page(unnumberedTitle("Anexos") + simpleParagraph(fields.anexos)));
  }

  return [
    `<div class="preview-document" data-template="general" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    ...preTextual,
    page(bodyHtml, "preview-body-flow"),
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
    .map((block) => bodyBlockHtml(block, input.importedImages ?? [], input.importedTables ?? []))
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
    ? `<section class="preview-page preview-references"><h2 class="preview-unnumbered-title">REFERÊNCIAS</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="article" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    page(header + bodyHtml, "preview-article-flow"),
    referencesBlock,
    `</div>`,
  ].join("\n");
}

function normalizeSemicolonKeywords(value: string): string {
  return value.replace(/\s*;\s*/g, "; ").replace(/;\s*$/, "").trim();
}

function cpgPreview(input: DocxGenerationInput): string {
  const { fields } = input;
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = blocks.filter((block) => block.type !== "reference" && block.type !== "importedImage");
  const references = [
    ...splitParagraphs(fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];

  const bodyHtml = bodyBlocks
    .map((block) => bodyBlockHtml(block, input.importedImages ?? [], input.importedTables ?? []))
    .filter(Boolean)
    .join("");

  const header = [
    centeredLine((fields.title || "Título do trabalho").toUpperCase(), true, COVER_TITLE_SIZE_PT),
    centeredLine((fields.author || "Autores").toUpperCase(), true, BODY_SIZE_PT),
    ...splitParagraphs(fields.program).map((line) => centeredLine(line, false, 11)),
    fields.course ? centeredLine(fields.course, false, BODY_SIZE_PT) : "",
    labeledParagraph("Resumo", fields.resumo),
    labeledParagraph("Palavras-chave", fields.palavrasChave, ":"),
    labeledParagraph("Abstract", fields.abstractText),
    labeledParagraph("Keywords", fields.keywords, ":"),
  ]
    .filter(Boolean)
    .join("");

  const referencesSection = referencesHtml(references);
  const referencesBlock = referencesSection
    ? `<section class="preview-page preview-references"><h2 class="preview-unnumbered-title">REFERÊNCIAS</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="cpg" data-first-line-cm="${CPG_RULES.typography.paragraphFirstLineCm}">`,
    page(header + bodyHtml, "preview-cpg-flow"),
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
  const bodyHtml = bodyBlocks
    .map((block) => bodyBlockHtml(block, input.importedImages ?? [], input.importedTables ?? []))
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
  const summary = page(
    unnumberedTitle("Sumário") +
      `<p class="preview-summary-note">O sumário do projeto de pesquisa é atualizável no Word/LibreOffice. As páginas serão preenchidas ao atualizar os campos.</p>`,
  );

  const referencesSection = referencesHtml(references);
  const referencesBlock = referencesSection
    ? `<section class="preview-page preview-references"><h2 class="preview-unnumbered-title">REFERÊNCIAS</h2>${referencesSection}</section>`
    : "";

  return [
    `<div class="preview-document" data-template="research-project" data-first-line-cm="${FIRST_LINE_CM}" data-long-quote-cm="${LONG_QUOTE_INDENT_CM}">`,
    page(coverHtml(fields), "preview-cover"),
    page(titlePageHtml(fields), "preview-title-page"),
    resumo,
    abstract,
    summary,
    page(bodyHtml, "preview-body-flow"),
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
