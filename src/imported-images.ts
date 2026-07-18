export type ImportedImageStatus =
  | "preserved"
  | "detected-but-not-preserved"
  | "ignored-placeholder";

export type ImageInsertionHint =
  | "after-caption"
  | "before-source"
  | "between-caption-and-source"
  | "original-position";

// Classificação de auditoria de uma região candidata. Nunca confunda
// "região candidata" com "figura perdida": apenas regiões confirmadas como
// figura real e que falharam a rasterização/inserção contam como perda.
export type FigureAuditClass =
  | "figura-real"
  | "falso-positivo"
  | "grafico-vetorial"
  | "imagem-raster"
  | "decoracao"
  | "assinatura"
  | "logotipo"
  | "formula"
  | "outro";

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
  // --- Campos de auditoria de figuras (R14) ---
  // Tipo de ilustração inferido da legenda (Figura, Gráfico, Esquema, etc.).
  figureType?: string;
  // Confiança da classificação como figura (0..1).
  confidence?: number;
  // A região é realmente uma figura (legenda numerada válida)?
  isFigure?: boolean;
  // Foi rasterizada com sucesso (status === "preserved")?
  rasterized?: boolean;
  // Foi efetivamente inserida no DOCX (marcador + dados)?
  inserted?: boolean;
  // Classificação de auditoria (ver FigureAuditClass).
  auditClass?: FigureAuditClass;
  // Motivo quando não rasterizada/inserida.
  reason?: string;
  // Número da página onde a região foi detectada.
  page?: number;
  // Texto extraído por OCR da imagem rasterizada (acessibilidade/alt-text).
  ocrText?: string;
  // Confiança média do OCR da figura (0..100), se aplicável.
  ocrConfidence?: number;
  // Backend de OCR utilizado ("native-cli" | "tesseract.js" | "none").
  ocrBackend?: string;
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
