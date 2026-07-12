export type ImportedTableOrigin =
  | "docx-table"
  | "mammoth-table"
  | "inferred-text-table"
  | "converted-pdf-suspected";

export type ImportedTableStatus =
  | "preserved"
  | "preserved-with-layout-warning"
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
