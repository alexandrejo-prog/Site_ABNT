export type ImportedDocumentBlockKind =
  | "cover"
  | "title-page"
  | "catalog-card"
  | "approval-sheet"
  | "acknowledgements"
  | "resumo"
  | "abstract"
  | "impact-indicators"
  | "impact-indicators-en"
  | "list-of-figures"
  | "list-of-tables"
  | "list-of-acronyms"
  | "toc"
  | "body-section"
  | "references"
  | "appendix"
  | "imported-image"
  | "imported-table"
  | "uncertain";

export interface ImportedDocumentBlock {
  id: string;
  kind: ImportedDocumentBlockKind;
  title?: string;
  content: string;
  startIndex: number;
  endIndex: number;
  confidence: "alta" | "media" | "baixa" | "nao-identificado";
  source: "body" | "header" | "footer" | "textbox" | "inferred";
  preserveOrder: boolean;
}
