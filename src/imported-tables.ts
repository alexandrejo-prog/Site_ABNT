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

export interface ImportedTableCell {
  text: string;
}

export interface ImportedTable {
  id: string;
  caption?: string;
  source?: string;
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
