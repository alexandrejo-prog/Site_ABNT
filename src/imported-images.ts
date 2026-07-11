export type ImportedImageStatus =
  | "preserved"
  | "detected-but-not-preserved"
  | "ignored-placeholder";

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
}

export const IMPORTED_IMAGE_MARKER_PATTERN = /^\[\[Imagem importada preservada:\s*([a-z0-9-]+)\]\]$/i;

export function importedImageMarker(id: string): string {
  return `[[Imagem importada preservada: ${id}]]`;
}
