export type ImportedTableOrigin =
  | "docx-table"
  | "mammoth-table"
  | "inferred-text-table"
  | "converted-pdf-suspected";

export type ImportedTableStatus =
  | "preserved"
  | "detected-but-not-preserved"
  | "inferred-from-text"
  | "ignored-empty-table";

export interface ImportedTable {
  id: string;
  rows: string[][];
  rowCount: number;
  columnCount: number;
  caption?: string;
  source?: string;
  position: number;
  origin: ImportedTableOrigin;
  status: ImportedTableStatus;
  warning?: string;
}

export const IMPORTED_TABLE_MARKER_PATTERN = /^\[\[Tabela importada preservada:\s*([a-z0-9-]+)\]\]$/i;

export function importedTableMarker(id: string): string {
  return `[[Tabela importada preservada: ${id}]]`;
}
