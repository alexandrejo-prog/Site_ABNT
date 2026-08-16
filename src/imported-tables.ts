import type { ReconstructedAcademicTable } from "./academic-table-reconstructor";

export type ImportedTableOrigin =
  | "docx-table"
  | "mammoth-table"
  | "inferred-text-table"
  | "converted-pdf-suspected";

export type ImportedTableStatus =
  | "preserved"
  | "preserved-with-layout-warning"
  | "normalized-columns"
  | "rendered-as-structured-text"
  | "detected-but-layout-fragile"
  | "detected-but-not-preserved"
  | "inferred-from-text"
  | "ignored-empty-table";

export type ImportedTableRenderMode =
  | "editable-table"
  | "semantic-reconstructed-table"
  | "structured-text"
  | "manual-review";

export interface ImportedTableCell {
  text: string;
}

export interface ImportedTable {
  id: string;
  caption?: string;
  source?: string;
  /** Orientação da seção OOXML de origem (seção paisagem = tabela larga). */
  orientation?: "portrait" | "landscape";
  rowCount: number;
  columnCount: number;
  rows: ImportedTableCell[][];
  estimatedColumnWidths?: number[];
  originalGridWidths?: number[];
  tableWidthTwips?: number;
  hasGridSpan: boolean;
  hasVerticalMerge: boolean;
  layoutWarning?: string;
  status: ImportedTableStatus;
  position: number;
  origin: ImportedTableOrigin;
  originalColumnCount?: number;
  normalizedColumnCount?: number;
  logicalColumnCount?: number;
  removedPhantomColumns?: number[];
  renderMode?: ImportedTableRenderMode;
  reconstructedTable?: ReconstructedAcademicTable;
  reconstructionConfidence?: "high" | "medium" | "low";
  reconstructionWarnings?: string[];
  groupColumnIndex?: number;
  groupSpans?: Array<{ rowStart: number; rowEnd: number; text: string }>;
  hasReconstructedVerticalMerge?: boolean;
  cellMerges?: Array<{ row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" }>;
  /** Índice da linha de cabeçalho nas linhas normalizadas (0 = primeira), quando confirmada. */
  headerRowIndex?: number;
}

export const IMPORTED_TABLE_MARKER_PATTERN = /^\[\[Tabela importada preservada:\s*([a-z0-9-]+)\]\]$/i;

export function importedTableMarker(id: string): string {
  return `[[Tabela importada preservada: ${id}]]`;
}

const PHANTOM_TEXT_THRESHOLD = 3;

function isPhantomColumn(
  columnIndex: number,
  rows: ImportedTableCell[][],
  widths: number[] | undefined,
): boolean {
  if (rows.length === 0) return false;

  let textCells = 0;
  let allEmptyOrShort = true;

  for (const row of rows) {
    const text = (row[columnIndex]?.text || "").trim();
    if (text.length >= PHANTOM_TEXT_THRESHOLD) {
      textCells += 1;
      allEmptyOrShort = false;
    } else if (text.length > 0) {
      allEmptyOrShort = false;
    }
  }

  const ratio = rows.length > 0 ? textCells / rows.length : 0;

  if (ratio >= 0.1) return false;
  if (!allEmptyOrShort) return false;

  if (widths && widths[columnIndex] !== undefined && widths.length > 1) {
    const totalWidth = widths.reduce((sum, w) => sum + w, 0);
    if (totalWidth > 0) {
      const widthRatio = widths[columnIndex] / totalWidth;
      if (widthRatio >= 0.15) return false;
    }
  }

  return true;
}

export function detectPhantomColumns(table: ImportedTable): number[] {
  if (table.rows.length === 0 || table.columnCount <= 1) return [];
  const phantom: number[] = [];
  for (let c = 0; c < table.columnCount; c++) {
    if (isPhantomColumn(c, table.rows, table.estimatedColumnWidths)) {
      phantom.push(c);
    }
  }
  return phantom;
}

export function normalizePhantomColumns(table: ImportedTable): ImportedTable {
  if (table.rows.length === 0 || table.columnCount <= 1) return table;

  const rows = table.rows;
  const columnCount = table.columnCount;
  const widths = table.estimatedColumnWidths;
  const phantom = new Set(detectPhantomColumns(table));

  if (phantom.size === 0) return table;

  const keptIndices = Array.from({ length: columnCount }, (_, i) => i).filter((i) => !phantom.has(i));
  if (keptIndices.length === 0) return table;

  const newRows: ImportedTableCell[][] = [];
  for (const row of rows) {
    const expanded = Array.from({ length: columnCount }, (_, i) => ({ text: (row[i]?.text || "").trim() }));
    const result: ImportedTableCell[] = [];

    for (const c of keptIndices) {
      let mergedText = expanded[c].text;
      let j = c - 1;
      while (j >= 0 && phantom.has(j)) {
        const prevText = expanded[j].text;
        if (prevText) {
          mergedText = mergedText ? `${prevText} ${mergedText}` : prevText;
        }
        j -= 1;
      }
      result.push({ text: mergedText });
    }

    if (result.length > 0) {
      let headText = "";
      for (let c = 0; c < keptIndices[0]; c++) {
        if (phantom.has(c)) {
          const text = expanded[c].text;
          if (text) headText = headText ? `${text} ${headText}` : text;
        }
      }
      if (headText) {
        result[0].text = result[0].text ? `${headText} ${result[0].text}` : headText;
      }
    }

    newRows.push(result);
  }

  const newWidths: number[] = [];
  if (widths) {
    for (const c of keptIndices) {
      let sum = widths[c] ?? 0;
      let j = c - 1;
      while (j >= 0 && phantom.has(j)) {
        sum += widths[j] ?? 0;
        j -= 1;
      }
      newWidths.push(sum);
    }
    const total = newWidths.reduce((a, b) => a + b, 0);
    if (total > 0) {
      newWidths.forEach((_, i, arr) => {
        arr[i] = Math.round((arr[i] / total) * 100);
      });
    } else {
      newWidths.forEach((_, i, arr) => {
        arr[i] = Math.floor(100 / newWidths.length);
      });
    }
  }

  const newOriginalGridWidths = newWidths.length ? newWidths : table.originalGridWidths;

  return {
    ...table,
    rows: newRows,
    rowCount: newRows.length,
    columnCount: keptIndices.length,
    estimatedColumnWidths: newWidths.length ? newWidths : undefined,
    originalGridWidths: newOriginalGridWidths,
    hasGridSpan: false,
    hasVerticalMerge: false,
    status: table.status === "preserved-with-layout-warning" ? "preserved-with-layout-warning" : ("preserved" as ImportedTableStatus),
  };
}

const EMPTY_CELL_RATIO_THRESHOLD = 0.7;
const ONE_WORD_CELL_RATIO_THRESHOLD = 0.85;
const MIN_COLUMN_WIDTH_RATIO = 5;
const MIN_ROWS_FOR_FRAGMENTATION = 4;

export function isTableUnreadable(table: ImportedTable): boolean {
  if (table.rows.length === 0 || table.columnCount <= 1) return false;

  const widths = table.estimatedColumnWidths;
  const totalWidth = widths?.reduce((sum, w) => sum + w, 0) ?? 0;

  let emptyCells = 0;
  let oneWordCells = 0;
  const totalCells = table.rows.length * table.columnCount;

  for (const row of table.rows) {
    for (const cell of row) {
      const text = (cell?.text || "").trim();
      if (!text) {
        emptyCells += 1;
      } else if (text.split(/\s+/).length <= 1) {
        oneWordCells += 1;
      }
    }
  }

  const emptyRatio = totalCells > 0 ? emptyCells / totalCells : 0;
  const oneWordRatio = totalCells > 0 ? oneWordCells / totalCells : 0;

  if (emptyRatio > EMPTY_CELL_RATIO_THRESHOLD) return true;
  if (table.rows.length >= MIN_ROWS_FOR_FRAGMENTATION && oneWordRatio > ONE_WORD_CELL_RATIO_THRESHOLD) return true;
  if (totalWidth > 0 && table.columnCount > 1) {
    const narrowColumns = widths?.filter((w) => (w / totalWidth) * 100 < MIN_COLUMN_WIDTH_RATIO).length ?? 0;
    if (narrowColumns / table.columnCount > 0.5) return true;
  }
  if (table.columnCount > 8) return true;

  return false;
}

export function buildStructuredTextFromTable(table: ImportedTable): string {
  const lines: string[] = [];

  for (const row of table.rows) {
    const parts = row.map((cell) => (cell?.text || "").trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const line = parts.join("; ");
    lines.push(line);
  }

  return lines.join("\n");
}

const TRAILING_EMPTY_THRESHOLD = 0.8;

function isTrailingEmptyColumn(table: ImportedTable): boolean {
  if (table.rows.length === 0 || table.columnCount <= 1) return false;

  const lastCol = table.columnCount - 1;
  let emptyRows = 0;
  let meaningfulCells = 0;

  for (const row of table.rows) {
    const text = (row[lastCol]?.text || "").trim();
    if (!text) {
      emptyRows += 1;
    } else if (text.length > 3) {
      meaningfulCells += 1;
    }
  }

  const emptyRatio = emptyRows / table.rows.length;
  if (emptyRatio < TRAILING_EMPTY_THRESHOLD) return false;
  if (meaningfulCells > Math.max(1, Math.floor(table.rows.length * 0.1))) return false;

  return true;
}

export function removeTrailingEmptyColumn(table: ImportedTable): ImportedTable {
  if (!isTrailingEmptyColumn(table)) return table;

  const lastCol = table.columnCount - 1;
  const newRows: ImportedTableCell[][] = [];
  for (const row of table.rows) {
    const lastCellText = (row[lastCol]?.text || "").trim();
    const prevText = (row[lastCol - 1]?.text || "").trim();
    const mergedText = lastCellText ? (prevText ? `${prevText} ${lastCellText}` : lastCellText) : prevText;
    const newRow = row.slice(0, lastCol);
    newRow[lastCol - 1] = { text: mergedText };
    newRows.push(newRow);
  }

  const newWidths = table.estimatedColumnWidths?.slice(0, lastCol);
  const total = newWidths?.reduce((a, b) => a + b, 0) ?? 0;
  const normalizedWidths = total > 0 && newWidths
    ? newWidths.map((w) => Math.round((w / total) * 100))
    : newWidths;

  return {
    ...table,
    rows: newRows,
    rowCount: newRows.length,
    columnCount: table.columnCount - 1,
    estimatedColumnWidths: normalizedWidths,
    originalColumnCount: table.originalColumnCount ?? table.columnCount,
    normalizedColumnCount: table.columnCount - 1,
    removedPhantomColumns: [...(table.removedPhantomColumns ?? []), lastCol],
  };
}

export function detectGroupColumn(table: ImportedTable): { isGroup: boolean; groupSpans: Array<{ rowStart: number; rowEnd: number; text: string }> } {
  if (table.rows.length < 2) return { isGroup: false, groupSpans: [] };

  const firstCol = table.rows.map((row) => (row[0]?.text || "").trim());
  const header = firstCol[0].toUpperCase();
  const isGenericHeader = !header || header === "CATEGORIA" || header === "GRUPO" || header === "" ||
    ["ORGANIZACAO", "ORGANIZACOES", "TRABALHADORES", "TRABALHADOR", "EMPRESA", "GESTORES", "FUNCIONARIOS", "COLABORADORES"].includes(header);

  const dataRows = firstCol.slice(1);
  const uniqueValues = [...new Set(dataRows.filter((v) => v))];
  const hasFewDistinct = uniqueValues.length <= 4 && uniqueValues.length >= 1;

  const otherColsHaveContent = table.rows.some((row) =>
    row.slice(1).some((cell) => (cell?.text || "").trim().length > 10),
  );

  if (!isGenericHeader || !hasFewDistinct || !otherColsHaveContent) {
    return { isGroup: false, groupSpans: [] };
  }

  const groupSpans: Array<{ rowStart: number; rowEnd: number; text: string }> = [];
  let currentGroup: { rowStart: number; text: string } | null = null;

  for (let i = 1; i < firstCol.length; i++) {
    const text = firstCol[i];
    if (text) {
      if (currentGroup) {
        groupSpans.push({ rowStart: currentGroup.rowStart, rowEnd: i - 1, text: currentGroup.text });
      }
      currentGroup = { rowStart: i, text };
    }
  }

  if (currentGroup) {
    groupSpans.push({ rowStart: currentGroup.rowStart, rowEnd: firstCol.length - 1, text: currentGroup.text });
  }

  return { isGroup: true, groupSpans };
}

export function normalizeGroupColumn(
  table: ImportedTable,
  groupSpans: Array<{ rowStart: number; rowEnd: number; text: string }>,
): ImportedTable {
  if (!groupSpans.length) return table;

  const rows = table.rows.map((row, rowIndex) => {
    const span = groupSpans.find((s) => rowIndex > s.rowStart && rowIndex <= s.rowEnd);
    if (span) {
      return [{ text: "" }, ...row.slice(1)];
    }
    return row;
  });

  return {
    ...table,
    rows,
    groupColumnIndex: 0,
    groupSpans,
    hasReconstructedVerticalMerge: true,
    logicalColumnCount: table.columnCount,
    layoutWarning:
      table.layoutWarning || "Coluna de grupo reconstruída com mesclagem vertical lógica.",
  };
}
