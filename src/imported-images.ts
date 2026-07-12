export type ImportedImageStatus =
  | "preserved"
  | "detected-but-not-preserved"
  | "ignored-placeholder";

export type ImageInsertionHint =
  | "after-caption"
  | "before-source"
  | "between-caption-and-source"
  | "original-position";

export interface ImportedDocumentImage {
  id: string;
  relationshipId?: string;
  target?: string;
  fileName?: string;
  mimeType?: string;
  data?: Uint8Array;
  base64?: string;
  width?: number;
  height?: number;
  caption?: string;
  source?: string;
  position: number;
  status: ImportedImageStatus;
  insertionHint?: ImageInsertionHint;
  insertionAnchorText?: string;
}

export const IMPORTED_IMAGE_MARKER_PATTERN = /^\[\[Imagem importada preservada:\s*([a-z0-9-]+)\]\]$/i;

export function importedImageMarker(id: string): string {
  return `[[Imagem importada preservada: ${id}]]`;
}

export function looksLikeAcademicImageLabel(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^(FIGURA|IMAGEM|GRAF|GRAFICO|QUADRO|TABELA)\s+\d+/.test(normalized);
}

export function looksLikeAcademicImageCaption(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^(FIGURA|IMAGEM|GRAF|GRAFICO|QUADRO|TABELA)\s+\d+\s*[-–—:.)]/.test(normalized);
}

export function looksLikeImageSource(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^FONTE\s*:/.test(normalized);
}
