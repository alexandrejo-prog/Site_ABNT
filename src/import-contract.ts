import type { AcademicFieldKey, AcademicFields, Confidence } from "./ufla-rules";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import type { ImportedPdfDocument, PdfRegion, PdfSemanticBlock } from "./imported-pdf";

// Discriminador explícito de origem do arquivo importado.
export type SourceKind = "pdf" | "docx" | "txt" | "markdown";

// Discriminador explícito do modo de saída do documento.
// - "ufla-structured": modelo UFLA (capa, folha de rosto, sumário, etc.).
// - "pdf-text-draft": rascunho textual experimental a partir de PDF (sem capa).
export type DocumentMode = "ufla-structured" | "pdf-text-draft";

export interface ImportedDocumentMetadata {
  pageCount?: number;
  fingerprint?: string;
  quality?: ImportedPdfDocument["quality"];
}

// Contrato de importação. A origem (sourceKind) e o modo (documentMode) são
// explícitos e nunca inferidos pelo conteúdo do editorText, extensão, ausência
// de campos ou existência de pendências.
export interface ImportedDocumentPayload {
  sourceKind: SourceKind;
  documentMode: DocumentMode;
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  editorText: string;
  messages: string[];
  fileName: string;
  importedImages?: ImportedDocumentImage[];
  importedTables?: ImportedTable[];
  // Preservação separada (presente em importações PDF):
  rawPageText?: string; // texto bruto de todas as páginas (diagnóstico)
  orderedText?: string; // texto ordenado para exportação (sem pré-textuais)
  regionDiagnostics?: PdfRegion[]; // diagnóstico de regiões visuais
  importMetadata?: ImportedDocumentMetadata; // metadados técnicos da importação
  // Blocos semânticos reconstruídos (parágrafos, títulos, legendas, fontes,
  // listas e regiões visuais). O DOCX de rascunho é gerado a partir deles.
  semanticBlocks?: PdfSemanticBlock[];
  // Arquivo PDF original (necessário para recortar imagens das regiões visuais).
  pdfFile?: File | ArrayBuffer;
  // Opções de reconstrução escolhidas pelo usuário no momento da importação.
  pdfDraftOptions?: {
    includeVisuals?: boolean;
    includePreTextualPages?: boolean;
  };
}
