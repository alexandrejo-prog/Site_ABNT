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

export interface RegionVisualEmission {
  mode: "images" | "marker";
  pagesCovered: number;
  pagesTotal: number;
  pageStart: number;
  pageEnd: number;
}

// Decisao atomica POR REGIAO (mantida para compatibilidade/testes unitários).
// O exportador NÃO deve usá-la diretamente: deve usar decideLogicalVisualEmission
// para garantir atomicidade no nível do logicalVisualId.
export function decideRegionVisualEmission(
  region: PdfLayoutSensitiveRegionDiagnostic,
  cropKeys: Set<string>,
): RegionVisualEmission {
  const visualKey = region.logicalVisualId ?? region.id;
  const total = region.pageEnd - region.pageStart + 1;
  let covered = 0;
  for (let page = region.pageStart; page <= region.pageEnd; page += 1) {
    if (cropKeys.has(pdfRegionCropKey(visualKey, page, region.id))) covered += 1;
  }
  return {
    mode: covered === total ? "images" : "marker",
    pagesCovered: covered,
    pagesTotal: total,
    pageStart: region.pageStart,
    pageEnd: region.pageEnd,
  };
}

export interface LogicalVisualEmission {
  mode: "images" | "marker";
  pagesCovered: number;
  pagesTotal: number;
  pageStart: number;
  pageEnd: number;
  logicalVisualId: string;
}

function expectedCropKeysForRegion(
  region: PdfLayoutSensitiveRegionDiagnostic,
  visualKey: string,
): string[] {
  const keys: string[] = [];
  for (let page = region.pageStart; page <= region.pageEnd; page += 1) {
    keys.push(pdfRegionCropKey(visualKey, page, region.id));
  }
  return keys;
}

// Decisao agregada por logicalVisualId: todas as regiões que compartilham o
// mesmo identificador lógico são avaliadas em conjunto. Somente quando TODAS as
// chaves esperadas de TODAS as regiões estiverem presentes o grupo é emitido
// como imagens. Se uma única chave faltar, nenhuma imagem é emitida e o grupo
// vira um único marcador abrangendo o menor pageStart e o maior pageEnd do grupo.
export function decideLogicalVisualEmission(
  logicalRegions: PdfLayoutSensitiveRegionDiagnostic[],
  cropKeys: Set<string>,
): LogicalVisualEmission {
  const first = logicalRegions[0];
  const logicalVisualId = first?.logicalVisualId ?? first?.id ?? "";
  let covered = 0;
  let total = 0;
  let pageStart = Infinity;
  let pageEnd = -Infinity;
  for (const region of logicalRegions) {
    const visualKey = region.logicalVisualId ?? region.id;
    pageStart = Math.min(pageStart, region.pageStart);
    pageEnd = Math.max(pageEnd, region.pageEnd);
    for (const key of expectedCropKeysForRegion(region, visualKey)) {
      total += 1;
      if (cropKeys.has(key)) covered += 1;
    }
  }
  return {
    mode: covered === total ? "images" : "marker",
    pagesCovered: covered,
    pagesTotal: total,
    pageStart: pageStart === Infinity ? 0 : pageStart,
    pageEnd: pageEnd === -Infinity ? 0 : pageEnd,
    logicalVisualId,
  };
}

// Recupera todos os ativos de um grupo lógico (todas as regiões que compartilham
// o mesmo logicalVisualId), ordenados numericamente por página e, em empate,
// por identificador de região.
export function visualAssetEntriesForLogicalVisual(
  logicalRegions: PdfLayoutSensitiveRegionDiagnostic[],
  visualAssets: Record<string, PdfTextDraftVisualAsset>,
): PdfVisualAssetRegionEntry[] {
  const entries: PdfVisualAssetRegionEntry[] = [];
  for (const region of logicalRegions) {
    entries.push(...visualAssetEntriesForRegion(region, visualAssets));
  }
  entries.sort((left, right) => left.pageNumber - right.pageNumber || left.key.localeCompare(right.key));
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}
