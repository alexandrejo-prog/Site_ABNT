import type {
  PdfBodyLayoutMetrics,
  PdfLayoutSensitiveRegionDiagnostic,
  PdfLineDiagnostic,
  PdfPageDiagnostic,
} from "./imported-pdf-diagnostic";

export interface PdfVisualCropGeometry {
  regionId: string;
  visualKey: string;
  logicalVisualId?: string;
  pageNumber: number;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  normalizedRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageWidth: number;
  pageHeight: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export interface PdfVisualCropSkip {
  regionId: string;
  pageNumber?: number;
  reason:
    | "page-not-found"
    | "invalid-page-size"
    | "no-valid-lines"
    | "invalid-line-range"
    | "empty-crop"
    | "implausible-crop-height"
    | "implausible-crop-aspect-ratio"
    | "caption-only-region"
    | "incomplete-structural-crop"
    | "incomplete-horizontal-coverage";
}

export interface PdfVisualCropGeometryResult {
  crops: PdfVisualCropGeometry[];
  skipped: PdfVisualCropSkip[];
}

const GRAPHIC_LIKE_KINDS: ReadonlySet<PdfLayoutSensitiveRegionDiagnostic["kind"]> = new Set([
  "quadro",
  "tabela",
  "figura",
  "grafico",
  "imagem",
  "mapa",
  "ilustracao",
  "multicolumn",
]);

const MIN_PAD = 6;
const MIN_PLAUSIBLE_CROP_HEIGHT = 40;
const MAX_CROP_ASPECT_RATIO = 25;
const CROP_EDGE_GAP = 4;
const BLOCK_EXTEND_MAX_GAP = 18;
// Margem de segurança (pt) usada para derivar a extensão vertical de um gráfico
// sem texto interno a partir da legenda e da fonte.
const GRAPHIC_CONTENT_MARGIN = 4;
// Folga (pt) aceitável entre o topo do recorte e a primeira linha estrutural,
// garantindo que o cabeçalho da tabela/quadro não seja cortado.
const HEADER_SAFE_PAD = 1;
// Tolerância (pt) de cobertura horizontal: o recorte deve abranger toda a
// largura do conteúdo estrutural; fora dessa tolerância a parte falha.
const HORIZONTAL_COVERAGE_TOLERANCE = 4;
// Janela (em linhas) ao redor do intervalo estrutural usada para localizar a
// legenda/fonte mais próxima de cada região, sem capturar a de um visual vizinho.
const CAPTION_SOURCE_SEARCH = 8;

const CAPTION_RE = /^(Quadro|Tabela|Figura|Gr[áa]fico|Imagem|Mapa|Ilustra[çc][ãa]o)\s+(\d+)\s*[-–—.:]/iu;
const SOURCE_RE = /^Fonte\s*:/iu;
const HEADING_RE = /^\d+(?:\.\d+)*\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/u;

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

interface CaptionSourceBlock {
  startIdx: number;
  endIdx: number;
  top: number;
  bottom: number;
}

function isPageFurniture(page: PdfPageDiagnostic, line: PdfLineDiagnostic): boolean {
  const t = line.text.trim();
  if (t.length === 0) return true;
  const edge = line.top < page.height * 0.1 || line.bottom > page.height * 0.9;
  if (edge && /^(\d{1,4}|[ivxlcdm]{1,8})$/iu.test(t)) return true;
  return false;
}

// Reconstitui um bloco de legenda/fonte concatenando linhas consecutivas
// SOMENTE enquanto o texto concatenado for igual ao alvo ou continuar sendo
// prefixo real do alvo. Linhas de célula, cabeçalho ou parágrafo seguinte
// (que não continuam o alvo) interrompem o bloco imediatamente.
function matchBlockByPrefix(
  page: PdfPageDiagnostic,
  startIdx: number,
  target: string | null,
): CaptionSourceBlock {
  if (target == null) {
    return { startIdx, endIdx: startIdx, top: page.lines[startIdx].top, bottom: page.lines[startIdx].bottom };
  }
  let endIdx = startIdx;
  let concatenated = normalizeForCompare(page.lines[startIdx].text);
  let prevBottom = page.lines[startIdx].bottom;
  for (let i = startIdx + 1; i < page.lines.length; i += 1) {
    const line = page.lines[i];
    if (!hasValidCoords(line)) break;
    if (line.top - prevBottom > BLOCK_EXTEND_MAX_GAP) break;
    const n = normalizeForCompare(line.text);
    if (n.length === 0) break;
    if (SOURCE_RE.test(line.text.trim()) || CAPTION_RE.test(line.text.trim()) || HEADING_RE.test(line.text.trim())) break;
    const candidate = `${concatenated} ${n}`;
    if (candidate === target) {
      endIdx = i;
      break;
    }
    if (target.startsWith(candidate)) {
      endIdx = i;
      concatenated = candidate;
      prevBottom = line.bottom;
      continue;
    }
    break;
  }
  return { startIdx, endIdx, top: page.lines[startIdx].top, bottom: page.lines[endIdx].bottom };
}

function findCaptionBlock(
  page: PdfPageDiagnostic,
  region: PdfLayoutSensitiveRegionDiagnostic,
  pageNumber: number,
): CaptionSourceBlock | null {
  const target = region.caption != null && region.caption.trim().length > 0
    ? normalizeForCompare(region.caption)
    : null;
  const range = selectedIndexRange(region, pageNumber, page.lines.length);
  const searchStart = range ? Math.max(0, Math.min(range.start, region.startLineIndex) - CAPTION_SOURCE_SEARCH) : 0;
  const searchEnd = range
    ? Math.min(page.lines.length - 1, Math.max(range.end, region.endLineIndex) + CAPTION_SOURCE_SEARCH)
    : page.lines.length - 1;
  let bestIdx = -1;
  let bestDistance = Infinity;
  for (let i = searchStart; i <= searchEnd; i += 1) {
    const line = page.lines[i];
    if (!hasValidCoords(line)) continue;
    if (!CAPTION_RE.test(line.text.trim())) continue;
    const n = normalizeForCompare(line.text);
    const matches = target == null ? true : (n === target || (n.length > 0 && target.startsWith(n)));
    if (!matches) continue;
    // Legenda mais próxima do início estrutural; empate prefere a anterior.
    const distance = Math.abs(i - (range?.start ?? i));
    if (distance < bestDistance || (distance === bestDistance && i < bestIdx)) {
      bestDistance = distance;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) bestIdx = page.lines.findIndex((line) => CAPTION_RE.test(line.text.trim()));
  if (bestIdx < 0) return null;
  return matchBlockByPrefix(page, bestIdx, target);
}

function findSourceBlock(
  page: PdfPageDiagnostic,
  region: PdfLayoutSensitiveRegionDiagnostic,
  pageNumber: number,
): CaptionSourceBlock | null {
  const target = region.source != null && region.source.trim().length > 0
    ? normalizeForCompare(region.source)
    : null;
  const range = selectedIndexRange(region, pageNumber, page.lines.length);
  const searchStart = range ? Math.max(0, range.start - CAPTION_SOURCE_SEARCH) : 0;
  const searchEnd = range
    ? Math.min(page.lines.length - 1, range.end + CAPTION_SOURCE_SEARCH)
    : page.lines.length - 1;
  let bestIdx = -1;
  let bestDistance = Infinity;
  for (let i = searchStart; i <= searchEnd; i += 1) {
    const line = page.lines[i];
    if (!hasValidCoords(line)) continue;
    if (!SOURCE_RE.test(line.text.trim())) continue;
    const n = normalizeForCompare(line.text);
    const matches = target == null ? true : (n === target || (n.length > 0 && target.startsWith(n)));
    if (!matches) continue;
    // Fonte deve estar APÓS o fim estrutural (nunca vincular a fonte de um
    // visual anterior) e ser a mais próxima desse fim.
    const distance = i - (range?.end ?? i);
    if (distance < 0) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) bestIdx = page.lines.findIndex((line) => SOURCE_RE.test(line.text.trim()));
  if (bestIdx < 0) return null;
  return matchBlockByPrefix(page, bestIdx, target);
}

function sourceSafetyGap(page: PdfPageDiagnostic, sourceBlock: CaptionSourceBlock): number {
  const heights = page.lines.filter(hasValidCoords).map((line) => line.height);
  const median = medianValue(heights);
  const blockHeight = sourceBlock.bottom - sourceBlock.top;
  return Math.max(CROP_EDGE_GAP, blockHeight * 0.6, median * 0.6);
}

function lineInBlock(idx: number, block: CaptionSourceBlock | null): boolean {
  return block != null && idx >= block.startIdx && idx <= block.endIdx;
}

interface ContentExtent {
  empty: boolean;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function contentExtentForRegion(
  page: PdfPageDiagnostic,
  region: PdfLayoutSensitiveRegionDiagnostic,
  pageNumber: number,
  captionBlock: CaptionSourceBlock | null,
  sourceBlock: CaptionSourceBlock | null,
): ContentExtent {
  const range = selectedIndexRange(region, pageNumber, page.lines.length);
  if (!range) {
    return { empty: true, top: 0, bottom: page.height, left: 0, right: page.width };
  }
  // Nunca calcular top/bottom/left/right usando linhas fora do intervalo
  // estrutural da região: o recorte é delimitado exclusivamente por suas
  // próprias linhas (legenda, conteúdo e fonte), nunca por texto vizinho.
  const lines = page.lines.filter(
    (line, idx) =>
      idx >= range.start &&
      idx <= range.end &&
      hasValidCoords(line) &&
      !lineInBlock(idx, captionBlock) &&
      !lineInBlock(idx, sourceBlock) &&
      // Linhas depois da fonte não pertencem ao conteúdo estrutural do visual.
      (sourceBlock == null || line.top <= sourceBlock.top) &&
      !isPageFurniture(page, line),
  );
  if (lines.length === 0) {
    return { empty: true, top: 0, bottom: page.height, left: 0, right: page.width };
  }
  return {
    empty: false,
    top: Math.min(...lines.map((l) => l.top)),
    bottom: Math.max(...lines.map((l) => l.bottom)),
    left: Math.min(...lines.map((l) => l.left)),
    right: Math.max(...lines.map((l) => l.right)),
  };
}

function findFollowingParagraphTop(page: PdfPageDiagnostic, afterIdx: number): number | undefined {
  for (let i = afterIdx + 1; i < page.lines.length; i += 1) {
    const line = page.lines[i];
    if (!hasValidCoords(line)) continue;
    if (line.text.trim().length >= 35) return line.top;
  }
  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function clampRange(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function clampUnit(value: number): number {
  return clampRange(value, 0, 1);
}

function hasValidCoords(line: PdfLineDiagnostic): boolean {
  return (
    isFiniteNumber(line.left) &&
    isFiniteNumber(line.right) &&
    isFiniteNumber(line.top) &&
    isFiniteNumber(line.bottom) &&
    isFiniteNumber(line.height) &&
    line.right > line.left &&
    line.bottom > line.top &&
    line.height > 0
  );
}

function manchaIsValid(metrics: PdfBodyLayoutMetrics | undefined, pageWidth: number): boolean {
  if (!metrics) return false;
  const { dominantLeft, dominantRight } = metrics;
  if (!isFiniteNumber(dominantLeft) || !isFiniteNumber(dominantRight)) return false;
  if (dominantRight <= dominantLeft) return false;
  if (dominantLeft < 0 || dominantRight > pageWidth) return false;
  return true;
}

function selectedIndexRange(
  region: PdfLayoutSensitiveRegionDiagnostic,
  pageNumber: number,
  lineCount: number,
): { start: number; end: number } | null {
  const lastLineIndex = lineCount - 1;
  let rawStart: number;
  let rawEnd: number;
  if (region.pageStart === region.pageEnd) {
    rawStart = region.startLineIndex;
    rawEnd = region.endLineIndex;
  } else if (pageNumber === region.pageStart) {
    rawStart = region.startLineIndex;
    rawEnd = lastLineIndex;
  } else if (pageNumber === region.pageEnd) {
    rawStart = 0;
    rawEnd = region.endLineIndex;
  } else {
    rawStart = 0;
    rawEnd = lastLineIndex;
  }
  const safeStart = Math.max(0, rawStart);
  const safeEnd = Math.min(lastLineIndex, rawEnd);
  if (safeStart > safeEnd) return null;
  return { start: safeStart, end: safeEnd };
}

export function computePdfVisualCropGeometry(
  pages: PdfPageDiagnostic[],
  regions: PdfLayoutSensitiveRegionDiagnostic[],
  bodyLayoutMetrics?: PdfBodyLayoutMetrics,
): PdfVisualCropGeometryResult {
  const crops: PdfVisualCropGeometry[] = [];
  const skipped: PdfVisualCropSkip[] = [];
  const pageByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const regionStartLineById = new Map(regions.map((region) => [region.id, region.startLineIndex]));

  for (const region of regions) {
    if (region.pageStart > region.pageEnd) {
      skipped.push({ regionId: region.id, reason: "invalid-line-range" });
      continue;
    }
    if (region.pageStart === region.pageEnd && region.startLineIndex > region.endLineIndex) {
      skipped.push({ regionId: region.id, reason: "invalid-line-range" });
      continue;
    }

    const visualKey = region.logicalVisualId ?? region.id;
    const pageNumbers: number[] = [];
    for (let page = region.pageStart; page <= region.pageEnd; page++) pageNumbers.push(page);

    for (const pageNumber of pageNumbers) {
      const page = pageByNumber.get(pageNumber);
      if (!page) {
        skipped.push({ regionId: region.id, pageNumber, reason: "page-not-found" });
        continue;
      }
      if (!isFiniteNumber(page.width) || !isFiniteNumber(page.height) || page.width <= 0 || page.height <= 0) {
        skipped.push({ regionId: region.id, pageNumber, reason: "invalid-page-size" });
        continue;
      }

      const structural = region.caption != null || region.source != null;
      let top: number;
      let bottom: number;
      let left: number;
      let right: number;
      let content: ContentExtent | null = null;

      if (!structural) {
        const indices = selectedIndexRange(region, pageNumber, page.lines.length);
        if (!indices) {
          skipped.push({ regionId: region.id, pageNumber, reason: "no-valid-lines" });
          continue;
        }
        const selected = page.lines.filter(
          (line, idx) => idx >= indices.start && idx <= indices.end && hasValidCoords(line),
        );
        if (selected.length === 0) {
          skipped.push({ regionId: region.id, pageNumber, reason: "no-valid-lines" });
          continue;
        }
        const minTop = Math.min(...selected.map((line) => line.top));
        const maxBottom = Math.max(...selected.map((line) => line.bottom));
        const medianLineHeight = medianValue(selected.map((line) => line.height));
        const verticalPadding = Math.max(MIN_PAD, medianLineHeight * 0.6);
        top = minTop - verticalPadding;
        bottom = maxBottom + verticalPadding;
        left = Math.min(...selected.map((line) => line.left));
        right = Math.max(...selected.map((line) => line.right));
      } else {
        const captionBlock: CaptionSourceBlock | null = findCaptionBlock(page, region, pageNumber);
        const sourceBlock: CaptionSourceBlock | null = findSourceBlock(page, region, pageNumber);
        content = contentExtentForRegion(page, region, pageNumber, captionBlock, sourceBlock);
        if (content.empty) {
          // Gráficos/figuras sem texto interno (linhas vetoriais ou raster)
          // não fornecem linhas de conteúdo. Nesses casos, deriva-se a extensão
          // vertical a partir da legenda e da fonte, desde que plausível.
          if (GRAPHIC_LIKE_KINDS.has(region.kind) && captionBlock) {
            // A extensão vertical vai do fim da legenda até o início da fonte,
            // independentemente de a legenda estar acima ou abaixo do gráfico.
            const upper = Math.min(captionBlock.bottom, sourceBlock ? sourceBlock.top : page.height);
            const lower = Math.max(captionBlock.bottom, sourceBlock ? sourceBlock.top : page.height);
            const top = upper + GRAPHIC_CONTENT_MARGIN;
            const bottom = lower - GRAPHIC_CONTENT_MARGIN;
            const left = manchaIsValid(bodyLayoutMetrics, page.width)
              ? bodyLayoutMetrics!.dominantLeft
              : 0;
            const right = manchaIsValid(bodyLayoutMetrics, page.width)
              ? bodyLayoutMetrics!.dominantRight
              : page.width;
            if (bottom > top + MIN_PLAUSIBLE_CROP_HEIGHT && bottom <= page.height && top >= 0) {
              content = { empty: false, top, bottom, left, right };
            }
          }
          if (content.empty) {
            skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
            continue;
          }
        }
        const isFirst = pageNumber === region.pageStart;
        const isLast = pageNumber === region.pageEnd;
        const isOnePage = isFirst && isLast;
        const medianLineHeight = medianValue(page.lines.filter(hasValidCoords).map((line) => line.height));
        const verticalPadding = Math.max(MIN_PAD, medianLineHeight * 0.6);

        // Intervalo estrutural esperado (para avaliar completude em página única).
        const expectedTop = captionBlock ? captionBlock.bottom : content.top;
        const expectedBottom = sourceBlock ? sourceBlock.top : content.bottom;
        const expectedSpan = expectedBottom - expectedTop;

        // O topo do recorte exclui a legenda quando ela está ACIMA do conteúdo;
        // quando a legenda está ABAIXO (figuras/gráficos) ou ausente, o topo
        // recua pela altura mediana para preservar a borda superior / área
        // gráfica acima do primeiro texto interno reconhecido.
        if ((isFirst || isOnePage) && captionBlock && captionBlock.top < content.top) {
          // Legenda acima do conteúdo: o topo exclui a legenda, mas deve incluir
          // toda a primeira linha estrutural (cabeçalho) sem cortá-la.
          const forcedTop = captionBlock.bottom + CROP_EDGE_GAP;
          const headerSafeTop = content.top - HEADER_SAFE_PAD;
          top = Math.min(forcedTop, headerSafeTop);
          if (top <= captionBlock.bottom) top = forcedTop;
        } else {
          top = content.top - verticalPadding;
        }
        if (isLast || isOnePage) {
          if (sourceBlock) {
            // Limite antes de "Fonte:". O recorte nunca ultrapassa a linha de
            // fonte (fonte permanece fora do PNG) e, ao mesmo tempo, preserva a
            // borda inferior do visual (não corta o conteúdo estrutural).
            const sourceLimit = sourceBlock.top - sourceSafetyGap(page, sourceBlock);
            bottom = Math.max(content.bottom, sourceLimit);
            // Validações estruturais: o recorte deve conter todo o conteúdo do
            // visual e não deve ultrapassar a linha de fonte.
            if (bottom <= top) {
              skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
              continue;
            }
            if (content.bottom > bottom + 0.5) {
              // alguma linha estrutural do visual ficaria abaixo do limite
              skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
              continue;
            }
          } else {
            // Sem bloco de fonte: o parágrafo posterior é localizado a partir do
            // fim ESTURUTRAL da região (selectedIndexRange), nunca logo após a
            // legenda. Uma célula longa da tabela não deve ser confundida com o
            // parágrafo posterior.
            const indices = selectedIndexRange(region, pageNumber, page.lines.length);
            if (!indices) {
              skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
              continue;
            }
            const following = findFollowingParagraphTop(page, indices.end);
            bottom = (following ?? content.bottom) - CROP_EDGE_GAP;
          }
        } else {
          bottom = content.bottom;
        }

        // Guardas defensivas: o recorte nunca deve engolir a legenda nem a fonte
        // do elemento visual. Só se aplica quando a legenda está ACIMA do conteúdo
        // (caso contrário, para figuras/gráficos a legenda fica abaixo e o recorte
        // deve incluir o conteúdo acima dela) e quando a fonte está ABAIXO.
        // Em caso de colisão irrecuperável, a parte falha e o grupo vira marcador
        // (nunca gera PNG com legenda/fonte embutidas).
        if (captionBlock && captionBlock.top < content.top && top <= captionBlock.bottom) {
          top = captionBlock.bottom + CROP_EDGE_GAP;
        }
        if (sourceBlock && sourceBlock.top > content.bottom && bottom >= sourceBlock.top) {
          bottom = sourceBlock.top - sourceSafetyGap(page, sourceBlock);
        }
        if (bottom <= top) {
          skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
          continue;
        }

        // Página única: rejeitar fragmentos (<80% do intervalo estrutural real).
        if (isOnePage && expectedSpan > 0) {
          const capturedSpan = bottom - top;
          if (capturedSpan < expectedSpan * 0.8) {
            skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-structural-crop" });
            continue;
          }
        }

        left = content.left;
        right = content.right;
      }

      const horizontalPadding = Math.max(MIN_PAD, page.width * 0.01);
      const manchaValid = manchaIsValid(bodyLayoutMetrics, page.width);
      const graphicLike = GRAPHIC_LIKE_KINDS.has(region.kind);

      if (manchaValid && graphicLike && content) {
        // O recorte deve abranger TODA a largura do conteúdo estrutural. Tabelas
        // e quadros paisagem podem ultrapassar a margem de texto dominante; por
        // isso o limite é o máximo entre o conteúdo e a mancha dominante (nunca
        // encolhe abaixo da largura real do elemento visual).
        left = Math.min(content.left, bodyLayoutMetrics!.dominantLeft);
        right = Math.max(content.right, bodyLayoutMetrics!.dominantRight);
      } else if (manchaValid && graphicLike) {
        left = bodyLayoutMetrics!.dominantLeft;
        right = bodyLayoutMetrics!.dominantRight;
      } else if (manchaValid && region.kind === "unknown") {
        const manchaWidth = bodyLayoutMetrics!.dominantRight - bodyLayoutMetrics!.dominantLeft;
        const minWidth = manchaWidth * 0.5;
        let width = right - left;
        if (width < minWidth) {
          width = minWidth;
          left = Math.min(left, page.width - width);
          left = Math.max(0, left);
          right = left + width;
        }
      } else if (manchaValid) {
        left = bodyLayoutMetrics!.dominantLeft;
        right = bodyLayoutMetrics!.dominantRight;
      }
      left -= horizontalPadding;
      right += horizontalPadding;

      const x = clampRange(left, 0, page.width);
      const rightEdge = clampRange(right, x, page.width);

      // Cobertura horizontal: o recorte (já limitado à página) deve conter todo
      // o conteúdo estrutural. Se não cobrir (ex.: conteúdo mais largo que a
      // página), a parte falha e o grupo vira marcador.
      if (content && (content.right > rightEdge + HORIZONTAL_COVERAGE_TOLERANCE || content.left < x - HORIZONTAL_COVERAGE_TOLERANCE)) {
        skipped.push({ regionId: region.id, pageNumber, reason: "incomplete-horizontal-coverage" });
        continue;
      }

      if (rightEdge <= x) {
        skipped.push({ regionId: region.id, pageNumber, reason: "empty-crop" });
        continue;
      }
      const y = clampRange(top, 0, page.height);
      const bottomEdge = clampRange(bottom, y, page.height);
      if (bottomEdge <= y) {
        skipped.push({ regionId: region.id, pageNumber, reason: "empty-crop" });
        continue;
      }
      const width = rightEdge - x;
      const height = bottomEdge - y;

      if (height < MIN_PLAUSIBLE_CROP_HEIGHT) {
        skipped.push({ regionId: region.id, pageNumber, reason: "implausible-crop-height" });
        continue;
      }
      if (width / height > MAX_CROP_ASPECT_RATIO) {
        skipped.push({ regionId: region.id, pageNumber, reason: "implausible-crop-aspect-ratio" });
        continue;
      }

      const reasons = [...region.reasons];
      if (isFiniteNumber(page.rotation) && page.rotation !== 0) {
        reasons.push(
          "Geometria calculada no sistema de coordenadas diagnóstico; rotação será tratada pelo renderizador.",
        );
      }

      crops.push({
        regionId: region.id,
        visualKey,
        logicalVisualId: region.logicalVisualId,
        pageNumber,
        sourceRect: { x, y, width, height },
        normalizedRect: {
          x: clampUnit(x / page.width),
          y: clampUnit(y / page.height),
          width: clampUnit(width / page.width),
          height: clampUnit(height / page.height),
        },
        pageWidth: page.width,
        pageHeight: page.height,
        confidence: region.confidence,
        reasons,
      });
    }
  }

  crops.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      (regionStartLineById.get(a.regionId) ?? 0) - (regionStartLineById.get(b.regionId) ?? 0) ||
      a.regionId.localeCompare(b.regionId),
  );

  skipped.sort(
    (a, b) =>
      (a.pageNumber ?? -1) - (b.pageNumber ?? -1) ||
      a.regionId.localeCompare(b.regionId) ||
      a.reason.localeCompare(b.reason),
  );

  return { crops, skipped };
}
