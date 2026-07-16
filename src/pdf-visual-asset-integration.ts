import type { ImportedPdfDiagnostic, PdfLayoutSensitiveRegionDiagnostic } from "./imported-pdf-diagnostic";
import type { PdfVisualCropGeometry } from "./pdf-visual-crop-geometry";
import type { PdfTextDraftVisualAsset } from "./pdf-text-draft-contract";

export { renderPdfVisualAssets } from "./pdf-visual-asset-renderer";
export type {
  PdfVisualAssetImageType,
  PdfVisualAssetRenderOptions,
  PdfVisualAssetRenderResult,
} from "./pdf-visual-asset-renderer";

export type PdfRasterizableRegionKind =
  | "quadro"
  | "tabela"
  | "figura"
  | "grafico"
  | "imagem"
  | "mapa"
  | "ilustracao";

const RASTERIZABLE_KINDS: ReadonlySet<string> = new Set([
  "quadro",
  "tabela",
  "figura",
  "grafico",
  "imagem",
  "mapa",
  "ilustracao",
]);

export function isRasterizablePdfRegionKind(
  kind: PdfLayoutSensitiveRegionDiagnostic["kind"] | undefined,
): boolean {
  return kind != null && RASTERIZABLE_KINDS.has(kind);
}

export function pdfRegionCropKey(
  visualKey: string,
  pageNumber: number,
  regionId: string,
): string {
  return `${visualKey}::p${pageNumber}::r${regionId}`;
}

export interface PdfVisualAssetRegionEntry {
  key: string;
  pageNumber: number;
  asset: PdfTextDraftVisualAsset;
}

function extractCompositeEntries(
  region: PdfLayoutSensitiveRegionDiagnostic,
  visualAssets: Record<string, PdfTextDraftVisualAsset>,
): PdfVisualAssetRegionEntry[] {
  const visualKey = region.logicalVisualId ?? region.id;
  const prefix = `${visualKey}::p`;
  const suffix = `::r${region.id}`;
  const entries: PdfVisualAssetRegionEntry[] = [];
  for (const key of Object.keys(visualAssets)) {
    if (!key.startsWith(prefix)) continue;
    if (!key.endsWith(suffix)) continue;
    const pagePart = key.slice(prefix.length, key.length - suffix.length);
    if (!/^\d+$/.test(pagePart)) continue;
    const pageNumber = Number(pagePart);
    const asset = visualAssets[key];
    if (asset) entries.push({ key, pageNumber, asset });
  }
  entries.sort((left, right) => left.pageNumber - right.pageNumber || left.key.localeCompare(right.key));
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

export function visualAssetEntriesForRegion(
  region: PdfLayoutSensitiveRegionDiagnostic | undefined,
  visualAssets: Record<string, PdfTextDraftVisualAsset> | undefined,
): PdfVisualAssetRegionEntry[] {
  if (!region) return [];
  const assets = visualAssets ?? {};
  const composite = extractCompositeEntries(region, assets);
  if (composite.length > 0) return composite;
  const visualKey = region.logicalVisualId ?? region.id;
  const legacy = assets[visualKey];
  if (legacy) return [{ key: visualKey, pageNumber: region.pageStart, asset: legacy }];
  return [];
}

export function rasterizablePdfCrops(
  diagnostic: ImportedPdfDiagnostic,
  crops: PdfVisualCropGeometry[],
): PdfVisualCropGeometry[] {
  const regionById = new Map(diagnostic.reconstruction.layoutRegions.map((region) => [region.id, region]));
  return crops.filter((crop) => {
    const region = regionById.get(crop.regionId);
    return region ? isRasterizablePdfRegionKind(region.kind) : false;
  });
}
