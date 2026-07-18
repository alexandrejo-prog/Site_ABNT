import * as mammoth from "mammoth/mammoth.browser";
import { detectAcademicFieldsFromStructure } from "./field-detector";
import {
  AcademicFieldKey,
  AcademicFields,
  Confidence,
  WorkTypeValue,
} from "./ufla-rules";
import {
  ImportedBlock,
  DocxStructure,
  extractDocxStructure,
  normalizeForDetection,
} from "./word-structure-extractor";
import {
  normalizeImportedStructure,
  normalizePlainAcademicText,
} from "./import-normalizer";
import { repairHeadingFragments, repairRecordHeadingFragments } from "./heading-fragment-repair";
import { sanitizeImportedTitle } from "./title-sanitizer";

function normalizeDash(value: string): string {
  return value
    .replace(/[\u2013\u2014\u2012\u2015\uFE58\uFE63]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
import { ImportedDocumentImage, importedImageMarker, looksLikeAcademicImageLabel, looksLikeAcademicImageCaption, looksLikeImageSource } from "./imported-images";
import { ImportedTable, importedTableMarker, normalizePhantomColumns, isTableUnreadable, buildStructuredTextFromTable, removeTrailingEmptyColumn, detectGroupColumn, normalizeGroupColumn } from "./imported-tables";
import { reconstructAcademicTable } from "./academic-table-reconstructor";
import type { DocumentMode, SourceKind } from "./import-contract";
import { importPdfDiagnostic } from "./import-pdf-diagnostic";
import { extractPdfTables } from "./pdf-table-extractor";
import { extractPdfFigures } from "./pdf-figure-extractor";
import { buildFigureAudit, generateFigureReportMarkdown } from "./figure-audit";
import { safeEnv } from "./safe-env";
import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";

function estimateColumnWidths(gridWidths: number[], columnCount: number): number[] {
  const safeWidths = gridWidths.slice(0, columnCount);
  if (safeWidths.length === columnCount && safeWidths.every((w) => Number.isFinite(w) && w > 0)) {
    const total = safeWidths.reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      return safeWidths.map((w) => Math.round((w / total) * 100));
    }
  }
  if (safeWidths.length > 0) {
    const total = safeWidths.reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      return safeWidths.map((w) => Math.round((w / total) * 100));
    }
  }
  return Array.from({ length: columnCount }, () => Math.floor(100 / columnCount));
}

function inferColumnCount(rows: string[][]): number {
  if (!rows.length) return 1;

  const lengths = rows.map((row) => row.length);
  const maxLength = Math.max(...lengths);
  if (maxLength <= 1) return 1;

  const sorted = [...lengths].sort((a, b) => a - b);
  const medianLength = sorted[Math.floor(sorted.length / 2)];

  if (maxLength > medianLength * 1.5) {
    return medianLength;
  }

  return maxLength;
}

function normalizeRowLength(row: string[], targetCount: number): string[] {
  if (row.length <= targetCount) {
    return Array.from({ length: targetCount }, (_, i) => row[i]?.trim() ?? "");
  }

  const result = Array.from({ length: targetCount }, (_, i) => (row[i]?.trim() ?? ""));
  const extra = row.slice(targetCount).map((c) => c.trim()).filter(Boolean).join(" ");
  result[targetCount - 1] = result[targetCount - 1] ? `${result[targetCount - 1]} ${extra}` : extra;
  return result;
}

const ARTIFICIAL_BREAK_PATTERN = /([a-z├á-├║├º])\n([a-z├á-├║├º])/gu;
const PRESERVE_BREAK_BEFORE = /^(?:[-ÔÇó*]\s|\d+[.)]\s|\.\s|:\s|ÔÇö\s|ÔÇô\s)/u;

function cleanCellText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  let result = trimmed.replace(/\n{2,}/g, "\n");

  result = result.replace(ARTIFICIAL_BREAK_PATTERN, (_, prev, next) => {
    const before = prev;
    const after = next;
    if (PRESERVE_BREAK_BEFORE.test(after)) return `${before}\n${after}`;
    return `${before}${after}`;
  });

  result = result.replace(/\s+/g, " ").trim();
  return result;
}

export interface WorkTypeSuggestion {
  workType: WorkTypeValue;
  confidence: Confidence;
  message: string;
}

export interface ImportResult {
  sourceKind: SourceKind;
  documentMode: DocumentMode;
  text: string;
  editorText: string;
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  messages: string[];
  blocks: ImportedBlock[];
  importedImages: ImportedDocumentImage[];
  importedTables: ImportedTable[];
  pdfDiagnostic?: ImportedPdfDiagnostic;
  workTypeSuggestion?: WorkTypeSuggestion;
  figureAudit?: import("./figure-audit").FigureAuditSummary;
}

const DECORATIVE_SECTION_NAMES = new Set([
  "CAPA",
  "FOLHA DE ROSTO",
  "FICHA CATALOGRAFICA",
  "FOLHA DE APROVACAO",
]);

function isLikelyZipFile(arrayBuffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function docxOpenError(fileName: string): Error {
  return new Error(
    `Nao foi possivel abrir "${fileName}" como DOCX valido. O arquivo pode estar corrompido, incompleto ou em formato .doc antigo renomeado para .docx. Abra o arquivo no Word ou LibreOffice, use "Salvar como" > "Documento do Word (.docx)" e tente importar novamente.`,
  );
}

function looksLikeResearchProject(text: string, fields: AcademicFields): boolean {
  const normalized = normalizeForDetection(
    [text, fields.title, fields.subtitle, fields.workNature, fields.resumo, fields.introducao].join("\n"),
  );

  return (
    /\bPROJETO DE PESQUISA\b/.test(normalized) ||
    /\bPROJETO DE PESQUISA APRESENTADO\b/.test(normalized) ||
    /\bRESEARCH PROJECT\b/.test(normalized)
  );
}

function detectWorkTypeSuggestion(text: string, fields: AcademicFields): WorkTypeSuggestion | undefined {
  if (fields.workType === "projeto_pesquisa") return undefined;
  if (!looksLikeResearchProject(text, fields)) return undefined;
  return {
    workType: "projeto_pesquisa",
    confidence: "media",
    message: "O sistema detectou possivel Projeto de pesquisa. Aplicar este tipo?",
  };
}

function sanitizeFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    title: sanitizeImportedTitle(fields.title),
  };
}

function sanitizeConfidence(
  confidence: Record<AcademicFieldKey, Confidence>,
  fields: AcademicFields,
): Record<AcademicFieldKey, Confidence> {
  return {
    ...confidence,
    title: fields.title ? confidence.title : "nao-identificado",
  };
}

export function blockText(block: ImportedBlock): string {
  if (block.type === "pageBreak" || block.type === "image") return "";
  if (block.type === "table") return block.rows.map((row) => row.join("\t")).join("\n");
  return block.text.trim();
}

function looksLikeTableCaption(text: string): boolean {
  return /^(Quadro|Tabela|Graf|Grafico)\s+\d+\s*[-ÔÇôÔÇö:.]?/i.test(text.trim());
}

function looksLikeTableSource(text: string): boolean {
  return /^Fonte\s*:/i.test(text.trim());
}

function nearestText(
  blocks: ImportedBlock[],
  startIndex: number,
  direction: -1 | 1,
  predicate: (text: string) => boolean,
): string {
  for (let offset = 1; offset <= 6; offset += 1) {
    const block = blocks[startIndex + offset * direction];
    if (!block || block.type === "pageBreak") break;
    const text = blockText(block);
    if (text && predicate(text)) return text;
  }
  return "";
}

function isDecorativeImageBlock(block: ImportedBlock): boolean {
  if (block.type !== "image") return false;
  const target = normalizeForDetection(block.target || block.fileName || "");
  return DECORATIVE_SECTION_NAMES.has(normalizeForDetection(block.section || "")) || target.includes("logo");
}

function findBodyStartIndex(blocks: ImportedBlock[]): number {
  return blocks.findIndex(
    (block) =>
      block.type === "heading" &&
      /^(\d+\s+)?INTRODU[├çC][A├â]O\b/i.test(block.text.trim()),
  );
}

function findBodyEndIndex(blocks: ImportedBlock[]): number {
  return blocks.findIndex((block) => {
    const normalized = normalizeForDetection(blockText(block));
    return /^(REFERENCIAS|APENDICES|APENDICE|ANEXOS|ANEXO)\b/.test(normalized);
  });
}

// Busca, em ambas as dire├º├Áes (janela de at├® 10 blocos), o r├│tulo/legenda e a fonte
// mais pr├│ximos da imagem. Cobre os padr├Áes de DOCX convertido de PDF em que a
// legenda pode vir antes ou depois da imagem e a fonte aparece em bloco vizinho.
function nearestAcademicImageContext(
  blocks: ImportedBlock[],
  index: number,
): { caption: string; source: string; captionOffset: number; sourceOffset: number } {
  const windowSize = 10;
  let caption = "";
  let source = "";
  let captionOffset = Infinity;
  let sourceOffset = Infinity;

  for (let offset = 1; offset <= windowSize; offset += 1) {
    const before = blocks[index - offset];
    const after = blocks[index + offset];

    if (!caption) {
      if (before && (looksLikeAcademicImageCaption(blockText(before)) || looksLikeAcademicImageLabel(blockText(before)))) {
        caption = blockText(before);
        captionOffset = -offset;
      } else if (after && (looksLikeAcademicImageCaption(blockText(after)) || looksLikeAcademicImageLabel(blockText(after)))) {
        caption = blockText(after);
        captionOffset = offset;
      }
    }

    if (!source) {
      if (before && looksLikeImageSource(blockText(before))) {
        source = blockText(before);
        sourceOffset = -offset;
      } else if (after && looksLikeImageSource(blockText(after))) {
        source = blockText(after);
        sourceOffset = offset;
      }
    }

    if (caption && source) break;
  }

  return { caption, source, captionOffset, sourceOffset };
}

function computeImageInsertionHint(
  captionOffset: number,
  sourceOffset: number,
): { hint: "after-caption" | "before-source" | "between-caption-and-source" | "original-position"; anchorText?: string } {
  const captionBefore = captionOffset < 0;
  const sourceBefore = sourceOffset < 0;
  const captionAfter = captionOffset > 0;
  const sourceAfter = sourceOffset > 0;

  if (captionBefore && sourceBefore) {
    return { hint: "between-caption-and-source", anchorText: "" };
  }
  if (captionBefore && sourceAfter) {
    return { hint: "between-caption-and-source", anchorText: "" };
  }
  if (captionAfter && sourceBefore) {
    return { hint: "between-caption-and-source", anchorText: "" };
  }
  if (captionBefore && sourceOffset === Infinity) {
    return { hint: "after-caption", anchorText: "" };
  }
  if (captionAfter && sourceOffset === Infinity) {
    return { hint: "original-position", anchorText: "" };
  }
  if (!captionBefore && !captionAfter && sourceBefore) {
    return { hint: "before-source", anchorText: "" };
  }
  if (!captionBefore && !captionAfter && sourceAfter) {
    return { hint: "original-position", anchorText: "" };
  }
  if (captionBefore && sourceBefore && captionOffset < sourceOffset) {
    return { hint: "after-caption", anchorText: "" };
  }
  if (captionBefore && sourceBefore && captionOffset > sourceOffset) {
    return { hint: "before-source", anchorText: "" };
  }
  return { hint: "original-position" };
}

function hasAmbiguousNeighbors(blocks: ImportedBlock[], index: number): boolean {
  // Janela estreita (±1): somente imagens IMEDIATAMENTE vizinhas com a MESMA
  // legenda exata são consideradas a mesma figura duplicada (ex.: a mesma figura
  // renderizada duas vezes no DOCX). Subfiguras distintas que o PDF rotulou com o
  // mesmo número (ex.: "FIGURA 6" e "FIGURA 6a"), mesmo se próximas, ficam a ≥2
  // blocos de distância (legendas/fonte entre elas) e NÃO devem ser descartadas,
  // caso contrário figuras reais seriam perdidas no fluxo Cópia → Reimport → ABNT.
  const windowSize = 1;
  const currentCaption = nearestAcademicImageContext(blocks, index).caption;
  if (!currentCaption) return false;

  for (let offset = -windowSize; offset <= windowSize; offset += 1) {
    if (offset === 0) continue;
    const neighbor = blocks[index + offset];
    if (neighbor?.type !== "image") continue;
    const neighborCaption = nearestAcademicImageContext(blocks, index + offset).caption;
    if (neighborCaption && neighborCaption === currentCaption) return true;
  }
  return false;
}

function classifyAcademicImage(block: ImportedBlock, index: number, blocks: ImportedBlock[]): boolean {
  if (block.type !== "image") return false;
  if (isDecorativeImageBlock(block)) return false;

  if (hasAmbiguousNeighbors(blocks, index)) return false;

  // Uma imagem com legenda acadêmica (FIGURA/IMAGEM/.../FONTE) nas proximidades é,
  // por definição, uma figura real — independentemente da seção heurística atribuída
  // pelo parser de estrutura (que pode classificar incorretamente como "pre-textual"
  // figuras de corpos gerados/convertidos). Isso garante a preservação de figuras no
  // fluxo Cópia → Reimport → ABNT sem relaxar a proteção contra logotipos/decorações
  // (ainda cobertos por isDecorativeImageBlock e hasAmbiguousNeighbors).
  const { caption, source } = nearestAcademicImageContext(blocks, index);
  if (caption || source) return true;

  const section = block.section;
  let inBody: boolean;
  if (section === "textual" || section === "post-textual") {
    inBody = true;
  } else if (section === "pre-textual") {
    inBody = false;
  } else {
    const bodyStart = findBodyStartIndex(blocks);
    const bodyEnd = findBodyEndIndex(blocks);
    inBody = bodyStart >= 0 && index > bodyStart && (bodyEnd < 0 || index < bodyEnd);
  }
  return inBody;
}

function importedImagesFromStructure(structure: DocxStructure): ImportedDocumentImage[] {
  const assetsByRelationship = new Map(
    structure.images
      .filter((image) => image.relationshipId)
      .map((image) => [image.relationshipId as string, image]),
  );
  const assetsByTarget = new Map(structure.images.map((image) => [image.target, image]));
  const seen = new Set<string>();
  const imported: ImportedDocumentImage[] = [];

  structure.blocks.forEach((block, index) => {
    if (block.type !== "image") return;
    if (!classifyAcademicImage(block, index, structure.blocks)) return;

    const asset =
      (block.relationshipId ? assetsByRelationship.get(block.relationshipId) : undefined) ||
      (block.target ? assetsByTarget.get(block.target) : undefined);
    const dedupeKey = asset?.target ?? block.target ?? block.relationshipId ?? `image-${index}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const id = `img-${imported.length + 1}`;
    const data = asset?.data;
    const { caption, source, captionOffset, sourceOffset } = nearestAcademicImageContext(structure.blocks, index);
    const insertion = computeImageInsertionHint(captionOffset, sourceOffset);
    imported.push({
      id,
      relationshipId: block.relationshipId,
      target: asset?.target ?? block.target,
      fileName: asset?.fileName,
      mimeType: asset?.mimeType,
      data,
      caption,
      source,
      position: index,
      status: data?.byteLength ? "preserved" : "detected-but-not-preserved",
      insertionHint: insertion.hint,
      insertionAnchorText: insertion.anchorText,
    });
  });

  return imported;
}

function tableNeedsSemanticDecision(table: ImportedTable): boolean {
  return (
    table.status === "preserved-with-layout-warning" ||
    table.status === "rendered-as-structured-text" ||
    isTableUnreadable(table) ||
    Boolean(table.removedPhantomColumns?.length) ||
    Boolean(table.hasGridSpan || table.hasVerticalMerge) ||
    table.columnCount > 3
  );
}

function chooseTableRenderMode(table: ImportedTable): ImportedTable {
  if (!table.rows.length || table.status === "ignored-empty-table") {
    return { ...table, renderMode: "manual-review" };
  }

  if (!tableNeedsSemanticDecision(table)) {
    return { ...table, renderMode: "editable-table" };
  }

  const reconstructed = reconstructAcademicTable(table);
  if (reconstructed.confidence === "high" || reconstructed.confidence === "medium") {
    return {
      ...table,
      renderMode: "semantic-reconstructed-table",
      reconstructedTable: reconstructed,
      reconstructionConfidence: reconstructed.confidence,
      reconstructionWarnings: reconstructed.warnings,
      logicalColumnCount: reconstructed.headers.length,
      status: "preserved-with-layout-warning",
      layoutWarning: reconstructed.warnings[0] ?? table.layoutWarning,
    };
  }

  const structuredText = buildStructuredTextFromTable(table);
  if ((table.status === "rendered-as-structured-text" || isTableUnreadable(table)) && structuredText.trim()) {
    return {
      ...table,
      renderMode: "structured-text",
      status: "rendered-as-structured-text",
      reconstructedTable: reconstructed,
      reconstructionConfidence: "low",
      reconstructionWarnings: reconstructed.warnings,
      layoutWarning: "Quadro/tabela importado de DOCX convertido de PDF foi renderizado como texto estruturado para evitar tabela ileg├¡vel. Revise manualmente.",
    };
  }

  if (structuredText.trim()) {
    return {
      ...table,
      renderMode: "editable-table",
      layoutWarning: table.layoutWarning || "Tabela importada com layout complexo. Revise manualmente.",
    };
  }

  return {
    ...table,
    renderMode: "manual-review",
    status: "detected-but-layout-fragile",
    reconstructedTable: reconstructed,
    reconstructionConfidence: "low",
    reconstructionWarnings: reconstructed.warnings,
    layoutWarning: "Tabela detectada, mas a estrutura n├úo p├┤de ser reconstru├¡da com confian├ºa. Revise manualmente.",
  };
}

function importedTablesFromStructure(structure: DocxStructure): ImportedTable[] {
  const imported: ImportedTable[] = [];

  structure.blocks.forEach((block, index) => {
    if (block.type !== "table") return;

    const rows = block.rows.filter((row) => row.some((cell) => cell.trim()));
    if (!rows.length) {
      imported.push({
        id: `tbl-${imported.length + 1}`,
        rows: [],
        rowCount: 0,
        columnCount: 0,
        position: index,
        origin: "docx-table",
        status: "ignored-empty-table",
        hasGridSpan: false,
        hasVerticalMerge: false,
      });
      return;
    }

    const columnCount = inferColumnCount(rows);
    const caption = nearestText(structure.blocks, index, -1, looksLikeTableCaption);
    const source = nearestText(structure.blocks, index, 1, looksLikeTableSource);
    const estimatedColumnWidths = estimateColumnWidths(block.gridWidths ?? [], columnCount);
    const hasFragileLayout = !block.tableWidthTwips && estimatedColumnWidths.some((w) => w < 5);
    const hasComplexMerge = block.hasGridSpan || block.hasVerticalMerge;
    const tooManyColumns = columnCount > 8;
    const hasLayoutWarning = hasComplexMerge || tooManyColumns || hasFragileLayout;

    const tableRows = rows.map((row) =>
      normalizeRowLength(row.map((cell) => cleanCellText(cell)), columnCount).map((text) => ({ text })),
    );

    const rawTable: ImportedTable = {
      id: `tbl-${imported.length + 1}`,
      rows: tableRows,
      rowCount: rows.length,
      columnCount,
      caption: caption || undefined,
      source: source || undefined,
      position: index,
      origin: "docx-table",
      status: hasLayoutWarning ? "preserved-with-layout-warning" : "preserved",
      estimatedColumnWidths,
      originalGridWidths: block.gridWidths,
      tableWidthTwips: block.tableWidthTwips,
      hasGridSpan: block.hasGridSpan ?? false,
      hasVerticalMerge: block.hasVerticalMerge ?? false,
      cellMerges: block.cellMerges,
      layoutWarning: hasLayoutWarning
        ? "Tabelas/quadros importados de DOCX convertido de PDF podem exigir revisao manual de layout."
        : undefined,
    };

    const afterTrailingRemoval = removeTrailingEmptyColumn(rawTable);
    const { isGroup, groupSpans } = detectGroupColumn(afterTrailingRemoval);
    const afterGroupNormalization = isGroup ? normalizeGroupColumn(afterTrailingRemoval, groupSpans) : afterTrailingRemoval;
    const normalized = normalizePhantomColumns(afterGroupNormalization);

    const hadTrailingRemoval = afterTrailingRemoval.columnCount < rawTable.columnCount;
    const hadGroupNormalization = isGroup;
    const hadPhantomRemoval = normalized.columnCount < afterGroupNormalization.columnCount;

    const finalTable: ImportedTable = {
      ...normalized,
      originalColumnCount: rawTable.columnCount,
      normalizedColumnCount: normalized.columnCount,
      logicalColumnCount: normalized.columnCount,
      layoutWarning:
        (normalized.layoutWarning || rawTable.layoutWarning) ||
        (hadTrailingRemoval ? "Coluna artificial final do PDF convertido foi removida." : undefined) ||
        (hadGroupNormalization ? "Coluna de grupo reconstru├¡da com mesclagem vertical l├│gica." : undefined) ||
        (hadPhantomRemoval ? "Colunas artificiais do PDF convertido foram colapsadas." : undefined),
    };

    if (isTableUnreadable(finalTable)) {
      finalTable.status = "rendered-as-structured-text";
      finalTable.layoutWarning = "Quadro importado de DOCX convertido de PDF foi renderizado como texto estruturado para evitar tabela ileg├¡vel. Revise o layout manualmente.";
    }

    imported.push(chooseTableRenderMode(finalTable));
  });

  return imported;
}

function isEditorHeading(block: ImportedBlock): boolean {
  if (block.type !== "heading") return false;
  const normalized = normalizeForDetection(block.text);
  return /^(\d+(?:\.\d+)*)\s+\S+/.test(normalized) || normalized === "INTRODUCAO";
}

function isReferenceOrPostTextual(block: ImportedBlock): boolean {
  const normalized = normalizeForDetection(blockText(block));
  return /^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized);
}

function editorTextWithImageMarkers(
  blocks: ImportedBlock[],
  fallbackEditorText: string,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
): string {
  if (!importedImages.length && !importedTables.length) return fallbackEditorText;
  const appendMissingPreserved = (
    output: string,
    emittedImageIds: Set<string>,
    emittedTableIds: Set<string>,
  ): string => {
    const missingPreservedImages = importedImages.filter(
      (image) => image.status === "preserved" && !emittedImageIds.has(image.id),
    );
    const missingPreservedTables = importedTables.filter(
      (table) => (table.status === "preserved" || table.status === "preserved-with-layout-warning") && !emittedTableIds.has(table.id),
    );

    const appended: string[] = [];
    for (const image of missingPreservedImages) {
      appended.push(
        "Imagem detectada, mas nao inserida automaticamente por baixa confianca de posicionamento. Revise e reinsira manualmente se necessario.",
      );
      if (image.caption) appended.push(image.caption);
      appended.push(importedImageMarker(image.id));
      if (image.source) appended.push(image.source);
    }
    for (const table of missingPreservedTables) {
      if (table.caption) appended.push(table.caption);
      appended.push(importedTableMarker(table.id));
      if (table.source) appended.push(table.source);
    }

    if (!appended.length) return repairHeadingFragments(output);

    return repairHeadingFragments([output, ...appended].filter(Boolean).join("\n\n"));
  };

  const imagesByPosition = new Map(importedImages.map((image) => [image.position, image]));
  const tablesByPosition = new Map(importedTables.map((table) => [table.position, table]));
  const start = blocks.findIndex((block) => {
    const normalized = normalizeForDetection(blockText(block));
    return normalized === "1 INTRODUCAO" || normalized === "INTRODUCAO";
  });
  if (start < 0) return appendMissingPreserved(fallbackEditorText, new Set(), new Set());

  const preservedTableTexts = new Set<string>();
  for (const table of importedTables) {
    if (table.status === "preserved" || table.status === "preserved-with-layout-warning") {
      if (table.caption) preservedTableTexts.add(table.caption);
      if (table.source) preservedTableTexts.add(table.source);
    }
  }

  const lines: string[] = [];
  const emittedImageIds = new Set<string>();
  const emittedTableIds = new Set<string>();
  let sawConclusion = false;
  let tocArtifactMode = false;
  for (let index = start; index < blocks.length; index += 1) {
    const block = blocks[index];
    const normalized = normalizeForDetection(blockText(block));
    if (/^(CONCLUSAO|CONCLUS├âO|CONSIDERACOES FINAIS|CONSIDERA├ç├òES FINAIS)\b/.test(normalized)) {
      sawConclusion = true;
    }
    if (/^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized)) {
      if (sawConclusion) break;
      if (!tocArtifactMode) {
        const nextBlocks = blocks.slice(index + 1, index + 6);
        const looksLikeTocArtifact = nextBlocks.some(
          (next) => /^(Na Introdu├º├úo|Na se├º├úo|Nos Resultados|J├í na Conclus├úo|Na Introducao|Na secao|REFERENCIAL TEORICO|REFERENCIAL TE├ôRICO)\b/i.test(blockText(next)),
        );
        if (looksLikeTocArtifact) {
          tocArtifactMode = true;
          continue;
        }
      }
    }
    if (tocArtifactMode) {
      if (block.type === "heading") {
        tocArtifactMode = false;
        if (isReferenceOrPostTextual(block)) continue;
      } else {
        continue;
      }
    }
    if (isReferenceOrPostTextual(block) && sawConclusion) break;
    if (block.type === "pageBreak") continue;

    if (block.type === "image") {
      const image = imagesByPosition.get(index);
      if (image?.status === "preserved") {
        lines.push(importedImageMarker(image.id));
        emittedImageIds.add(image.id);
      }
      continue;
    }

    if (block.type === "table") {
      const table = tablesByPosition.get(index);
      if (table?.status === "rendered-as-structured-text") {
        const structured = buildStructuredTextFromTable(table);
        const parts = [table.caption, structured, table.source, table.layoutWarning].filter(Boolean);
        lines.push(parts.join("\n"));
        emittedTableIds.add(table.id);
        continue;
      }
      if (table?.status === "preserved" || table?.status === "preserved-with-layout-warning") {
        lines.push(importedTableMarker(table.id));
        emittedTableIds.add(table.id);
      }
      continue;
    }

    if (block.type === "heading") {
      lines.push(`${block.level <= 1 || isEditorHeading(block) ? "#" : "##"} ${block.text}`);
      continue;
    }

    if (block.type === "longQuote") {
      lines.push(`> ${block.text}`);
      continue;
    }

    const text = blockText(block);
    if (text && !preservedTableTexts.has(text)) lines.push(text);
  }

  const output = lines.join("\n\n").trim() || fallbackEditorText;
  if (typeof console !== "undefined" && process.env.BUILD_PDF_DEBUG === "1") {
    console.error(`[ETWIM_DEBUG] imageBlocks=${blocks.filter((b) => b.type === "image").length} tableBlocks=${blocks.filter((b) => b.type === "table").length} emittedImg=${emittedImageIds.size} emittedTab=${emittedTableIds.size} outputMarkers=${(output.match(/\[\[Imagem importada preservada:[^\]]+\]\]/g) || []).length} importedImages=${importedImages.length}`);
  }
  return appendMissingPreserved(output, emittedImageIds, emittedTableIds);
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
  sourceKind: SourceKind,
): ImportResult {
  const text = repairHeadingFragments(normalized.text);
  const importedImages = importedImagesFromStructure(normalized.structure);
  const importedTables = importedTablesFromStructure(normalized.structure);
  const editorText = editorTextWithImageMarkers(
    normalized.structure.blocks,
    repairHeadingFragments(detected.editorText || text),
    importedImages,
    importedTables,
  );
  const fields = sanitizeFields(repairRecordHeadingFragments(detected.fields));
  const confidence = sanitizeConfidence(detected.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(text, fields);
  const sourceImages = normalized.structure.images.length;
  const preservedImages = importedImages.filter((image) => image.status === "preserved").length;
  const missingImages = importedImages.filter((image) => image.status === "detected-but-not-preserved").length;
  const reviewImages = Math.max(0, sourceImages - preservedImages);
  const preservedTables = importedTables.filter((table) => table.status === "preserved" || table.status === "preserved-with-layout-warning").length;
  const missingTables = importedTables.filter((table) => table.status === "detected-but-not-preserved").length;
  const layoutWarningTables = importedTables.filter((table) => table.layoutWarning).length;
  const imageMessages = [
    preservedImages
      ? `${preservedImages} imagem(ns) importada(s) e preservada(s) no rascunho. Revise posicao, legenda e fonte antes da versao final.`
      : "",
    missingImages
      ? `${missingImages} imagem(ns) detectada(s), mas nem todas puderam ser preservadas automaticamente. Reinsira manualmente as imagens ausentes e confira legendas e fontes.`
      : "",
    sourceImages
      ? `${sourceImages} imagem(ns)/grafico(s) detectado(s) no DOCX original; ${preservedImages} preservado(s) automaticamente; ${reviewImages} exigem revisao manual. Graficos/imagens do corpo podem ter sido deslocados em decorrencia da conversao PDF-DOCX. Revise e reinsira manualmente os elementos ausentes.`
      : "",
  ].filter(Boolean);
  const tableMessages = [
    preservedTables
      ? `${preservedTables} tabela(s)/quadro(s) importada(s) e preservada(s) no rascunho. Revise estrutura, legenda e fonte antes da versao final.`
      : "",
    missingTables
      ? `${missingTables} tabela(s)/quadro(s) detectada(s), mas nao preservada(s) automaticamente. Reinsira manualmente as tabelas ausentes se necessario.`
      : "",
    layoutWarningTables
      ? "Tabelas/quadros importados de DOCX convertido de PDF podem exigir revisao manual de layout."
      : "",
  ].filter(Boolean);
  if (sourceImages || preservedImages || missingImages) {
    fields.imageWarnings = imageMessages.join(" ");
  }
  const nonImageMessages = messages.filter(
    (message) => !/imagem\(ns\) detectada\(s\)|imagem\(ns\) importada\(s\)/i.test(message),
  );

  return {
    sourceKind,
    documentMode: "ufla-structured",
    text,
    editorText,
    fields,
    confidence,
    messages: [...nonImageMessages, ...imageMessages, ...tableMessages],
    blocks: normalized.structure.blocks,
    importedImages,
    importedTables,
    workTypeSuggestion,
  };
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks" | "importedImages" | "importedTables"> {
  const normalized = normalizePlainAcademicText(text);
  const identified = detectAcademicFieldsFromStructure(normalized.structure);
  const repairedText = repairHeadingFragments(normalized.text);
  const fields = sanitizeFields(repairRecordHeadingFragments(identified.fields));
  const confidence = sanitizeConfidence(identified.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(repairedText, fields);
  return {
    fields,
    confidence,
    sourceKind: "txt",
    documentMode: "ufla-structured",
    workTypeSuggestion,
  };
}

function buildPdfEditorText(
  diagnostic: ImportedPdfDiagnostic,
  tables: ImportedTable[] = [],
  figures: ImportedDocumentImage[] = [],
): string {
  const sections: string[] = [];
  const { pretextual, reconstruction } = diagnostic;

  if (pretextual.titlePage?.title || pretextual.cover?.title) {
    sections.push(`# ${pretextual.titlePage?.title || pretextual.cover?.title}`);
  }
  if (pretextual.titlePage?.author || pretextual.cover?.author) {
    sections.push(`**Autor:** ${pretextual.titlePage?.author || pretextual.cover?.author}`);
  }
  if (pretextual.titlePage?.natureText) {
    sections.push(`**Natureza:** ${pretextual.titlePage.natureText}`);
  }
  if (pretextual.titlePage?.program) {
    sections.push(`**Programa:** ${pretextual.titlePage.program}`);
  }
  if (pretextual.titlePage?.advisor) {
    sections.push(`**Orientador:** ${pretextual.titlePage.advisor}`);
  }
  if (pretextual.titlePage?.coadvisor) {
    sections.push(`**Coorientador:** ${pretextual.titlePage.coadvisor}`);
  }
  if (pretextual.titlePage?.institution || pretextual.cover?.institution) {
    sections.push(`**Instituição:** ${pretextual.titlePage?.institution || pretextual.cover?.institution}`);
  }
  if (pretextual.titlePage?.city || pretextual.cover?.city) {
    sections.push(`**Local:** ${pretextual.titlePage?.city || pretextual.cover?.city}`);
  }
  if (pretextual.titlePage?.year || pretextual.cover?.year) {
    sections.push(`**Ano:** ${pretextual.titlePage?.year || pretextual.cover?.year}`);
  }

  if (pretextual.resumo?.text) {
    sections.push(`# RESUMO\n\n${pretextual.resumo.text}`);
    if (pretextual.resumo.keywords) {
      sections.push(`**Palavras-chave:** ${pretextual.resumo.keywords}`);
    }
  }
  if (pretextual.abstract?.text) {
    sections.push(`# ABSTRACT\n\n${pretextual.abstract.text}`);
    if (pretextual.abstract.keywords) {
      sections.push(`**Keywords:** ${pretextual.abstract.keywords}`);
    }
  }

  const bodyStartPage = reconstruction.bodyStart.found ? (reconstruction.bodyStart.pageNumber ?? 1) : 1;
  const emittedFigureIds = new Set<string>();
  const emittedTableIds = new Set<string>();
  for (const block of reconstruction.blocks) {
    if (block.pageStart < bodyStartPage) continue;
    const text = block.text.trim();
    if (!text) continue;
    if (block.type === "heading") {
      sections.push(`# ${text}`);
    } else if (block.type === "list-item") {
      sections.push(`- ${text}`);
    } else if (block.type === "caption" || block.type === "source") {
      sections.push(`_${text}_`);
      const matchingTable = tables.find(
        (table) => !emittedTableIds.has(table.id) && table.caption && text.startsWith(table.caption.slice(0, 24)),
      );
      if (matchingTable) {
        emittedTableIds.add(matchingTable.id);
        sections.push(importedTableMarker(matchingTable.id));
      }
      const matchingFigure = figures.find(
        (fig) => !emittedFigureIds.has(fig.id) && fig.caption && text.startsWith(fig.caption.slice(0, 24)),
      );
      if (matchingFigure) {
        emittedFigureIds.add(matchingFigure.id);
        sections.push(importedImageMarker(matchingFigure.id));
      }
    } else {
      sections.push(text);
    }
  }

  if (tables.length) {
    for (const table of tables) {
      if (!emittedTableIds.has(table.id)) {
        emittedTableIds.add(table.id);
        sections.push(importedTableMarker(table.id));
      }
    }
  }

  if (figures.length) {
    for (const figure of figures) {
      if (!emittedFigureIds.has(figure.id)) {
        emittedFigureIds.add(figure.id);
        sections.push(importedImageMarker(figure.id));
      }
    }
  }

  return sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pdfPretextualFields(diagnostic: ImportedPdfDiagnostic): Partial<AcademicFields> {
  const { pretextual } = diagnostic;
  const fields: Partial<AcademicFields> = {};
  const title = pretextual.titlePage?.title || pretextual.cover?.title;
  const author = pretextual.titlePage?.author || pretextual.cover?.author;
  if (author) fields.author = author;
  if (title) fields.title = title;
  if (pretextual.titlePage?.natureText) fields.workNature = pretextual.titlePage.natureText;
  if (pretextual.titlePage?.program) {
    fields.program = pretextual.titlePage.program;
  } else if (pretextual.titlePage?.natureText) {
    const programMatch = pretextual.titlePage.natureText.match(/(?:programa|curso) de p[óo]s-gradua[cç][aã]o em ([^,]+)/i);
    if (programMatch?.[1]) fields.program = programMatch[1].trim();
  }
  if (pretextual.titlePage?.advisor) {
    fields.advisor = pretextual.titlePage.advisor;
  }
  if (pretextual.titlePage?.coadvisor) {
    fields.coadvisor = pretextual.titlePage.coadvisor;
  }
  if (pretextual.titlePage?.institution || pretextual.cover?.institution) {
    fields.course = pretextual.titlePage?.institution || pretextual.cover?.institution || "";
  }
  if (pretextual.titlePage?.city || pretextual.cover?.city) {
    fields.location = normalizeDash(pretextual.titlePage?.city || pretextual.cover?.city || "");
  }
  if (pretextual.titlePage?.year || pretextual.cover?.year) {
    fields.year = pretextual.titlePage?.year || pretextual.cover?.year || "";
  }
  if (pretextual.resumo?.text) fields.resumo = pretextual.resumo.text;
  if (pretextual.resumo?.keywords) fields.palavrasChave = pretextual.resumo.keywords;
  if (pretextual.abstract?.text) fields.abstractText = pretextual.abstract.text;
  if (pretextual.abstract?.keywords) fields.keywords = pretextual.abstract.keywords;
  return fields;
}

function mapDiagnosticConfidence(
  level: "high" | "medium" | "low" | undefined,
): Confidence | undefined {
  if (level === "high") return "alta";
  if (level === "medium") return "media";
  if (level === "low") return "baixa";
  return undefined;
}

function pdfPretextualConfidence(diagnostic: ImportedPdfDiagnostic): Partial<Record<AcademicFieldKey, Confidence>> {
  const { pretextual } = diagnostic;
  const conf: Partial<Record<AcademicFieldKey, Confidence>> = {};
  const tp = pretextual.titlePage;
  const cover = pretextual.cover;
  const levelFromDiagnostic = mapDiagnosticConfidence(
    tp?.confidence || cover?.confidence,
  );

  const fieldConfidence = (present: boolean, strong: boolean): Confidence | undefined => {
    if (!present) return undefined;
    if (strong) return "alta";
    return levelFromDiagnostic ?? "media";
  };

  conf.author = fieldConfidence(
    Boolean(tp?.author || cover?.author),
    /^[A-ZÀ-Ý][a-zà-ÿ]+(?: [A-ZÀ-Ý][a-zà-ÿ]+){1,}$/u.test((tp?.author || cover?.author || "").trim()),
  );
  conf.title = fieldConfidence(
    Boolean(tp?.title || cover?.title),
    (tp?.title || cover?.title || "").trim().length >= 10,
  );
  conf.workNature = fieldConfidence(
    Boolean(tp?.natureText),
    /\b(?:dissertac?a?o|tese|trabalho)\b/i.test(tp?.natureText || ""),
  );
  conf.program = fieldConfidence(Boolean(tp?.program), /\bprograma\b/i.test(tp?.program || ""));
  conf.advisor = fieldConfidence(
    Boolean(tp?.advisor),
    /\borientador|a\b/i.test(tp?.advisor || ""),
  );
  conf.coadvisor = fieldConfidence(Boolean(tp?.coadvisor), /\bcoorientador|a\b/i.test(tp?.coadvisor || ""));
  conf.course = fieldConfidence(Boolean(tp?.institution || cover?.institution), true);
  conf.location = fieldConfidence(
    Boolean(tp?.city || cover?.city),
    /lavras/i.test((tp?.city || cover?.city || "")),
  );
  conf.year = fieldConfidence(
    Boolean(tp?.year || cover?.year),
    /^(?:19|20)\d{2}$/.test((tp?.year || cover?.year || "").trim()),
  );

  const resLevel = mapDiagnosticConfidence(pretextual.resumo?.confidence);
  if (pretextual.resumo?.text) {
    conf.resumo = resLevel ?? "alta";
    conf.palavrasChave = resLevel ?? "alta";
  }
  const absLevel = mapDiagnosticConfidence(pretextual.abstract?.confidence);
  if (pretextual.abstract?.text) {
    conf.abstractText = absLevel ?? "alta";
    conf.keywords = absLevel ?? "alta";
  }
  return conf;
}

export async function importDocumentFile(file: File): Promise<ImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const messages: string[] = [];

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    let mammothText = "";

    if (!arrayBuffer.byteLength || !isLikelyZipFile(arrayBuffer)) {
      throw docxOpenError(file.name);
    }

    try {
      const mammothResult = await mammoth.extractRawText({ arrayBuffer });
      mammothText = mammothResult.value;
      messages.push(
        ...mammothResult.messages.map(
          (message) => message.message ?? "Aviso do importador DOCX.",
        ),
      );
    } catch {
      messages.push("Mammoth nao conseguiu extrair texto bruto; tentando estrutura OOXML.");
    }

    try {
      const structure = await extractDocxStructure(arrayBuffer, { includeMediaData: true });
      const normalized = normalizeImportedStructure({
        ...structure,
        text: structure.text || mammothText,
      });
      const detected = detectAcademicFieldsFromStructure(normalized.structure);

      return buildImportResult(normalized, detected, [
        ...messages,
        ...normalized.messages,
        ...detected.messages,
      ], "docx");
    } catch {
      if (mammothText.trim()) {
        const normalized = normalizePlainAcademicText(mammothText);
        const detected = detectAcademicFieldsFromStructure(normalized.structure);
        return buildImportResult(normalized, detected, [
          ...messages,
          "Nao foi possivel ler a estrutura OOXML; o arquivo foi importado apenas como texto bruto.",
          ...normalized.messages,
          ...detected.messages,
        ], "docx");
      }

      throw docxOpenError(file.name);
    }
  }

  if (extension === "txt" || extension === "md") {
    const text = await file.text();
    const normalized = normalizePlainAcademicText(text);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);
    return buildImportResult(normalized, detected, [
      ...normalized.messages,
      ...detected.messages,
    ], extension === "md" ? "markdown" : "txt");
  }

  if (extension === "pdf") {
    const pdfDiagnostic = await importPdfDiagnostic(file);
    const pdfTables = extractPdfTables(pdfDiagnostic);
    const pdfBuffer = new Uint8Array(await file.arrayBuffer());
    const pdfFigures = await extractPdfFigures(pdfDiagnostic, pdfBuffer).catch(() => [] as ImportedDocumentImage[]);
    const editorText = buildPdfEditorText(pdfDiagnostic, pdfTables, pdfFigures);
    const normalized = normalizePlainAcademicText(editorText);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);
    const seed = pdfPretextualFields(pdfDiagnostic);
    const mergedFields = { ...detected.fields, ...seed };
    const result = buildImportResult(normalized, { ...detected, fields: mergedFields }, [
      ...pdfDiagnostic.warnings,
      ...normalized.messages,
      ...detected.messages,
    ], "pdf");
    result.importedTables = pdfTables;
    result.importedImages = pdfFigures;
    // R-C1R20: o editorText produzido por buildPdfEditorText retém todos os
    // marcadores de figura/tabela (um por elemento detectado), enquanto o
    // editorText derivado de normalized.structure (via buildImportResult) perde
    // figuras cujos blocos não foram classificados como "image" na normalização.
    // Usamos o texto com marcadores completos para garantir que a Etapa 1
    // (PDF -> DOCX Cópia) preserve 100% das figuras/tabelas detectadas.
    result.editorText = editorText;
    const seedConfidence = pdfPretextualConfidence(pdfDiagnostic);
    const confidence = { ...result.confidence };
    for (const key of Object.keys(seed) as AcademicFieldKey[]) {
      const value = seed[key] as unknown;
      const hasValue = typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : false;
      if (hasValue && seedConfidence[key]) {
        confidence[key] = seedConfidence[key] as Confidence;
      }
    }
    const imageWarningText = pdfDiagnostic.warnings.find((warning) => /IMAGENS NÃO PRESERVADAS/i.test(warning));
    const tableDetectedText = pdfDiagnostic.warnings.find((warning) => /TABELAS DETECTADAS/i.test(warning));

    // R14: o aviso NUNCA usa "regiões candidatas detectadas" como base de perda.
    // Usa a auditoria, que distingue figura confirmada de falso positivo e conta
    // apenas figuras confirmadas que de fato não foram inseridas.
    const figureAudit = buildFigureAudit(pdfFigures, pdfDiagnostic);
    const preservedFigures = figureAudit.rasterized;
    const confirmedFigures = figureAudit.confirmedFigures;
    const lostFigures = figureAudit.lost; // figuras confirmadas não inseridas (perda real)
    const falsePositives = figureAudit.falsePositives;
    const rawImageCountMatch = imageWarningText?.match(/(\d+)\s*imagem/i);
    const rawImageCount = rawImageCountMatch ? Number(rawImageCountMatch[1]) : 0;

    let imageWarningAdjusted: string | undefined;
    if (preservedFigures > 0 && lostFigures === 0) {
      imageWarningAdjusted = `IMAGENS PRESERVADAS: ${preservedFigures} figura(s) do PDF foram rasterizadas e inseridas no DOCX.`;
    } else if (preservedFigures > 0) {
      imageWarningAdjusted = `IMAGENS PARCIALMENTE PRESERVADAS: ${preservedFigures} figura(s) inseridas no DOCX; ${lostFigures} figura(s) confirmada(s) NÃO inserida(s) (rasterização falhou). Reinsira manualmente as ausentes antes da versão final.${falsePositives > 0 ? ` ${falsePositives} região(ões) candidata(s) foram descartadas como falso(s) positivo(s) e não contam como perda.` : ""}`;
    } else if (confirmedFigures > 0) {
      imageWarningAdjusted = `IMAGENS NÃO PRESERVADAS: ${confirmedFigures} figura(s) confirmada(s) no PDF não puderam ser rasterizadas nem inseridas. Reinsira manualmente cada imagem, com leganda e fonte, no editor antes da versão final.`;
    } else if (rawImageCount > 0) {
      // Não há figuras confirmadas por legenda, mas o PDF contém imagens cruas.
      // Reporta como imagens detectadas, NUNCA como figuras confirmadas perdidas.
      imageWarningAdjusted = `IMAGENS DETECTADAS NO PDF: ${rawImageCount} imagem(ns)/figura(s) crua(s) encontrada(s) no PDF, porém nenhuma pôde ser confirmada como figura com legenda nem rasterizada. Reinsira manualmente as ilustrações ausentes antes da versão final.`;
    }

    // R14/R-OCR: gera relatórios detalhados quando solicitado
    // (evita efeito colateral em tempo de execução do app no browser).
    if (safeEnv.flag("FIGURE_AUDIT_REPORT", false)) {
      try {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { generateOcrReportMarkdown } = await import("./ocr");
        const reportPath = join(process.cwd(), "tmp", "RELATORIO_FIGURAS.md");
        const markdown = generateFigureReportMarkdown(figureAudit, {
          fileName: file.name,
          source: "Conversão PDF → DOCX (Site_ABNT)",
          generatedAt: new Date().toISOString(),
        });
        writeFileSync(reportPath, markdown, "utf8");
        const ocrPath = join(process.cwd(), "tmp", "RELATORIO_OCR.md");
        writeFileSync(ocrPath, generateOcrReportMarkdown(pdfDiagnostic, {
          source: "Conversão PDF → DOCX (Site_ABNT) — OCR de páginas",
          generatedAt: new Date().toISOString(),
        }), "utf8");
      } catch {
        /* relatório opcional: falha não deve quebrar a importação */
      }
    }

    const tableStatus = pdfTables.length > 0
      ? `TABELAS RECONSTRUÍDAS PARCIALMENTE: ${pdfTables.length} tabela(s) reconstruída(s) por coordenadas no DOCX (reconstrução mínima; confira alinhamento, células mescladas e fontes). As demais permanecem ausentes e exigem revisão manual.`
      : tableDetectedText;
    const preservationWarnings = [imageWarningAdjusted, tableStatus].filter(Boolean) as string[];
    if (preservationWarnings.length && !result.fields.imageWarnings) {
      result.fields.imageWarnings = preservationWarnings.join(" ");
    }
    // Expõe a auditoria de figuras para validação/relatório (R14).
    (result as ImportResult & { figureAudit?: typeof figureAudit }).figureAudit = figureAudit;
    // The title/coadvisor extracted from the structured PDF pretextual diagnostic are
    // authoritative; sanitization steps (sanitizeImportedTitle, heading-fragment repair)
    // may wrongly blank a legitimate title-page value. Restore it when the seed had one.
    if (seed.title && !result.fields.title) {
      result.fields.title = seed.title;
      if (seedConfidence.title) confidence.title = seedConfidence.title as Confidence;
    }
    if (seed.coadvisor && !result.fields.coadvisor) {
      result.fields.coadvisor = seed.coadvisor;
      if (seedConfidence.coadvisor) confidence.coadvisor = seedConfidence.coadvisor as Confidence;
    }
    return {
      ...result,
      confidence,
      sourceKind: "pdf",
      documentMode: "pdf-diagnostic",
      pdfDiagnostic,
    };
  }

  throw new Error("Formato nao suportado. Use .docx, .txt, .md ou .pdf.");
}
