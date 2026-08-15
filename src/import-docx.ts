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
import { ImportedDocumentImage, importedImageMarker, looksLikeAcademicImageLabel, looksLikeAcademicImageCaption, looksLikeImageSource } from "./imported-images";
import { ommlContentToken } from "./docx-render-core";
import { ImportedTable, importedTableMarker, normalizePhantomColumns, isTableUnreadable, buildStructuredTextFromTable, removeTrailingEmptyColumn, detectGroupColumn, normalizeGroupColumn } from "./imported-tables";
import { reconstructAcademicTable } from "./academic-table-reconstructor";

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

const ARTIFICIAL_BREAK_PATTERN = /([a-zà-úç])\n([a-zà-úç])/gu;
const PRESERVE_BREAK_BEFORE = /^(?:[-•*]\s|\d+[.)]\s|\.\s|:\s|—\s|–\s)/u;

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
  text: string;
  editorText: string;
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  messages: string[];
  blocks: ImportedBlock[];
  importedImages: ImportedDocumentImage[];
  importedTables: ImportedTable[];
  footnotes: Record<string, string>;
  workTypeSuggestion?: WorkTypeSuggestion;
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

function collectChangeWarnings(structure: DocxStructure): string[] {
  let insertions = 0;
  let deletions = 0;
  for (const block of structure.blocks) {
    if (!("runs" in block)) continue;
    for (const run of block.runs) {
      if (run.changeKind === "insertion") insertions += 1;
      if (run.changeKind === "deletion") deletions += 1;
    }
  }
  const warnings: string[] = [];
  if (insertions > 0) {
    warnings.push(`Documento contém ${insertions} marcação(ões) de inserção (revisão do Word).`);
  }
  if (deletions > 0) {
    warnings.push(`Documento contém ${deletions} marcação(ões) de exclusão (revisão do Word).`);
  }
  return warnings;
}

function blockText(block: ImportedBlock): string {
  if (block.type === "pageBreak" || block.type === "image") return "";
  if (block.type === "table") return block.rows.map((row) => row.join("\t")).join("\n");
  return block.text.trim();
}

function looksLikeTableCaption(text: string): boolean {
  return /^(Quadro|Tabela|Graf|Grafico)\s+\d+\s*[-–—:.]?/i.test(text.trim());
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
      /^(\d+\s+)?INTRODU[ÇC][AÃ]O\b/i.test(block.text.trim()),
  );
}

function findBodyEndIndex(blocks: ImportedBlock[]): number {
  return blocks.findIndex((block) => {
    const normalized = normalizeForDetection(blockText(block));
    return /^(REFERENCIAS|APENDICES|APENDICE|ANEXOS|ANEXO)\b/.test(normalized);
  });
}

// Busca, em ambas as direções (janela de até 10 blocos), o rótulo/legenda e a fonte
// mais próximos da imagem. Cobre os padrões de DOCX convertido de PDF em que a
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
  const windowSize = 3;
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
  if (!inBody) return false;

  const { caption, source } = nearestAcademicImageContext(blocks, index);
  return Boolean(caption || source);
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
      layoutWarning: "Quadro/tabela importado de DOCX convertido de PDF foi renderizado como texto estruturado para evitar tabela ilegível. Revise manualmente.",
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
    layoutWarning: "Tabela detectada, mas a estrutura não pôde ser reconstruída com confiança. Revise manualmente.",
  };
}

function importedTablesFromStructure(structure: DocxStructure): ImportedTable[] {
  const imported: ImportedTable[] = [];

  structure.blocks.forEach((block, index) => {
    if (block.type !== "table") return;

    const filteredRows = block.rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => row.some((cell) => cell.trim()));
    const rows = filteredRows.map(({ row }) => row);
    const originalIndices = filteredRows.map(({ originalIndex }) => originalIndex);
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

    const sourceHeaderRows = (block.headerRowIndices ?? []).filter((i) => originalIndices.includes(i));
    const firstSourceHeader = sourceHeaderRows.length ? Math.min(...sourceHeaderRows) : undefined;
    const headerRowIndex =
      firstSourceHeader !== undefined
        ? originalIndices.indexOf(firstSourceHeader)
        : rows.length >= 2 && rows[0].some((cell) => cell.trim())
          ? 0
          : undefined;

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
      headerRowIndex,
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
        (hadGroupNormalization ? "Coluna de grupo reconstruída com mesclagem vertical lógica." : undefined) ||
        (hadPhantomRemoval ? "Colunas artificiais do PDF convertido foram colapsadas." : undefined),
    };

    if (isTableUnreadable(finalTable)) {
      finalTable.status = "rendered-as-structured-text";
      finalTable.layoutWarning = "Quadro importado de DOCX convertido de PDF foi renderizado como texto estruturado para evitar tabela ilegível. Revise o layout manualmente.";
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

function footnoteDefinitionLines(
  footnotes: Record<string, string>,
  usedIds: Set<string>,
): string[] {
  const ids = new Set<string>([...usedIds, ...Object.keys(footnotes)]);
  return [...ids]
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => {
      const body = (footnotes[id] ?? "").trim();
      if (!body) return `[^${id}]: nota sem texto preservado.`;
      const firstLine = body.split(/\n/)[0];
      const continuation = body.split(/\n/).slice(1);
      return [`[^${id}]: ${firstLine}`, ...continuation.map((line) => `  ${line}`)].join("\n");
    });
}

function editorTextWithImageMarkers(
  blocks: ImportedBlock[],
  fallbackEditorText: string,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
  footnotes: Record<string, string> = {},
): string {
  const hasFootnotes = Object.keys(footnotes).length > 0;
  const hasMathBlocks = blocks.some((block) => (block as { hasMath?: boolean }).hasMath === true);
  if (!importedImages.length && !importedTables.length && !hasFootnotes && !hasMathBlocks) return fallbackEditorText;
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
  // Sem INTRODUÇÃO detectada (ex.: documentos sintéticos), percorre todos os
  // blocos para ainda posicionar as chamadas [^N] das notas de rodapé.
  const walkStart = start >= 0 ? start : 0;

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
  const usedFootnoteIds = new Set<string>();
  let sawConclusion = false;
  let tocArtifactMode = false;
  for (let index = walkStart; index < blocks.length; index += 1) {
    const block = blocks[index];
    const normalized = normalizeForDetection(blockText(block));
    if (/^(CONCLUSAO|CONCLUSÃO|CONSIDERACOES FINAIS|CONSIDERAÇÕES FINAIS)\b/.test(normalized)) {
      sawConclusion = true;
    }
    if (/^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized)) {
      if (sawConclusion) break;
      if (!tocArtifactMode) {
        const nextBlocks = blocks.slice(index + 1, index + 6);
        const looksLikeTocArtifact = nextBlocks.some(
          (next) => /^(Na Introdução|Na seção|Nos Resultados|Já na Conclusão|Na Introducao|Na secao|REFERENCIAL TEORICO|REFERENCIAL TEÓRICO)\b/i.test(blockText(next)),
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
    if (text && !preservedTableTexts.has(text)) {
      const footnoteRefs = (block as { footnoteRefs?: string[] }).footnoteRefs ?? [];
      const hasMath = (block as { hasMath?: boolean }).hasMath === true;
      const ommlXml = (block as { ommlXml?: string }).ommlXml;
      const prefix = hasMath ? "[EQ] " : "";
      const ommlToken = hasMath && ommlXml ? ommlContentToken(ommlXml) : "";
      if (footnoteRefs.length) {
        const markers = footnoteRefs.map((id) => `[^${id}]`).join("");
        footnoteRefs.forEach((id) => usedFootnoteIds.add(id));
        lines.push(`${prefix}${text}${markers}${ommlToken}`);
      } else {
        lines.push(`${prefix}${text}${ommlToken}`);
      }
    }
  }

  const footnoteLines = footnoteDefinitionLines(footnotes, usedFootnoteIds);
  if (footnoteLines.length) lines.push(...footnoteLines);

  const output = lines.join("\n\n").trim() || fallbackEditorText;
  return appendMissingPreserved(output, emittedImageIds, emittedTableIds);
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
): ImportResult {
  const text = repairHeadingFragments(normalized.text);
  const importedImages = importedImagesFromStructure(normalized.structure);
  const importedTables = importedTablesFromStructure(normalized.structure);
  const footnotes = normalized.structure.footnotes ?? {};
  const editorText = editorTextWithImageMarkers(
    normalized.structure.blocks,
    repairHeadingFragments(detected.editorText || text),
    importedImages,
    importedTables,
    footnotes,
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
  const mathBlocks = normalized.structure.blocks.filter(
    (block) => (block as { hasMath?: boolean }).hasMath === true,
  ).length;
  const mathMessages: string[] = [];
  if (mathBlocks > 0) {
    mathMessages.push(
      `${mathBlocks} equação(ões)/fórmula(s) detectada(s) no DOCX original e preservada(s) no rascunho como "[EQ]". A exportação regenera a equação nativa (OMML, m:oMath) centralizada com numeração à direita; revise a estrutura em equações com frações/raízes.`,
    );
  }
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
    text,
    editorText,
    fields,
    confidence,
    messages: [...nonImageMessages, ...imageMessages, ...tableMessages, ...mathMessages],
    blocks: normalized.structure.blocks,
    importedImages,
    importedTables,
    footnotes,
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
    workTypeSuggestion,
    footnotes: {},
  };
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
      const changeWarnings = collectChangeWarnings(structure);
      const normalized = normalizeImportedStructure({
        ...structure,
        text: structure.text || mammothText,
      });
      const detected = detectAcademicFieldsFromStructure(normalized.structure);

      return buildImportResult(normalized, detected, [
        ...messages,
        ...changeWarnings,
        ...normalized.messages,
        ...detected.messages,
      ]);
    } catch {
      if (mammothText.trim()) {
        const normalized = normalizePlainAcademicText(mammothText);
        const detected = detectAcademicFieldsFromStructure(normalized.structure);
        return buildImportResult(normalized, detected, [
          ...messages,
          "Nao foi possivel ler a estrutura OOXML; o arquivo foi importado apenas como texto bruto.",
          ...normalized.messages,
          ...detected.messages,
        ]);
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
    ]);
  }

  throw new Error("Formato nao suportado. Use .docx, .txt ou .md.");
}
