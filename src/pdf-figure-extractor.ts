import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";
import type { ImportedDocumentImage } from "./imported-images";
import { classifyFigureRegion } from "./figure-audit";
import { safeEnv } from "./safe-env";

const FIGURE_CAPTION_RE = /^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b[\s.:]*([0-9IVXLC]+(?:\.[0-9]+)?)/i;
const SOURCE_RE = /^FONTE\s*:/i;

interface FigureRegion {
  pageNumber: number;
  top: number;
  bottom: number;
  caption?: string;
  source?: string;
  x0: number;
  x1: number;
  pageHeight: number;
  pageWidth: number;
}

export function detectPdfFigureRegions(diagnostic: ImportedPdfDiagnostic): FigureRegion[] {
  const regions: FigureRegion[] = [];

  for (const page of diagnostic.pages) {
    const pageWidth = page.width || 595;
    const pageHeight = page.height || 842;
    const items = page.items.filter((it) => (it.text || "").trim().length > 0);

    const captionLines = page.lines
      .filter((line) => FIGURE_CAPTION_RE.test(line.text.trim()))
      .sort((a, b) => a.top - b.top);

    const byKey = new Map<string, (typeof captionLines)[number]>();
    for (const line of captionLines) {
      const m = line.text.trim().match(/^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b[\s.:]*([0-9IVXLC]+)/i);
      const key = m ? `${m[1].toUpperCase()}-${m[2].toUpperCase()}` : line.text.trim().slice(0, 20).toUpperCase();
      const existing = byKey.get(key);
      if (!existing || line.text.trim().length > existing.text.trim().length) byKey.set(key, line);
    }
    const caps = [...byKey.values()];

    for (let c = 0; c < caps.length; c += 1) {
      const caption = caps[c];
      const regionTop = caption.top;
      const nextCap = caps[c + 1];
      let regionBottom = nextCap ? nextCap.top : pageHeight;
      for (const line of page.lines) {
        if (SOURCE_RE.test(line.text.trim()) && line.top > regionTop) {
          if (line.top < regionBottom) regionBottom = line.top;
          break;
        }
      }

      // Qualquer legenda do tipo FIGURA/IMAGEM/ESQUEMA/FLUXOGRAMA/GRÁFICO caracteriza
      // uma região de ilustração: ela NUNCA vira tabela (R5.3). A densidade de texto
      // é usada apenas para classificação, não para descartar a região.
      const regionItems = items.filter((it) => it.y >= regionTop - 2 && it.y < regionBottom);

      let x0 = pageWidth;
      let x1 = 0;
      for (const it of regionItems) {
        x0 = Math.min(x0, it.x);
        x1 = Math.max(x1, it.x + (it.width || 0));
      }
      if (x1 <= x0) {
        x0 = pageWidth * 0.15;
        x1 = pageWidth * 0.85;
      }

      let source: string | undefined;
      for (const line of page.lines) {
        if (SOURCE_RE.test(line.text.trim()) && line.top > regionTop && line.top < regionBottom + 40) {
          source = line.text.trim();
          break;
        }
      }

      regions.push({
        pageNumber: page.pageNumber,
        top: regionTop,
        bottom: regionBottom,
        caption: caption.text.trim(),
        source,
        x0,
        x1,
        pageHeight,
        pageWidth,
      });
    }
  }

  return regions;
}

async function rasterizeRegion(
  pdfBuffer: Uint8Array,
  region: FigureRegion,
  pageIndex: number,
): Promise<{ data: Uint8Array; width: number; height: number; backend: string } | null> {
  const { figureRasterizer } = await import("./figure-rasterizer");
  const result = await figureRasterizer.rasterize({
    pdfBuffer,
    pageIndex,
    region: {
      x: region.x0,
      y: region.top,
      width: Math.max(10, region.x1 - region.x0),
      height: Math.max(10, region.bottom - region.top),
      pageHeight: region.pageHeight,
    },
  });
  return result;
}

export async function extractPdfFigures(
  diagnostic: ImportedPdfDiagnostic,
  pdfBuffer: Uint8Array,
): Promise<ImportedDocumentImage[]> {
  const regions = detectPdfFigureRegions(diagnostic);
  if (!regions.length) return [];

  const images: ImportedDocumentImage[] = [];
  const regionsById = new Map<string, FigureRegion>();
  let counter = 0;

  // 1) Detecção (rápida, sem Chromium): registra TODAS as regiões candidatas
  //    como "detectadas-mas-não-preservadas". A auditoria posterior distingue
  //    região candidata de figura confirmada/perdida (R14).
  for (const region of regions) {
    counter += 1;
    const id = `pdf-figure-${region.pageNumber}-${counter}`;
    regionsById.set(id, region);
    const typeWord = (region.caption || "").trim().match(/^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b/i)?.[1] ?? "";
    const figureType =
      typeWord.toUpperCase() === "GRAFICO" || typeWord.toUpperCase() === "GRÁFICO"
        ? "Gráfico"
        : typeWord.toUpperCase() === "ESQUEMA"
          ? "Esquema"
          : typeWord.toUpperCase() === "FLUXOGRAMA"
            ? "Fluxograma"
            : typeWord.toUpperCase() === "IMAGEM"
              ? "Imagem"
              : typeWord
                ? "Figura"
                : "Outro";
    const hasNumberedCaption = /^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b[\s.:]*[0-9IVXLC]+/i.test(region.caption || "");
    images.push({
      id,
      data: new Uint8Array(0),
      width: 0,
      height: 0,
      caption: region.caption,
      source: region.source,
      fileName: `figura-${region.pageNumber}-${counter}.png`,
      position: region.pageNumber * 1000 + counter,
      status: "detected-but-not-preserved",
      figureType,
      isFigure: hasNumberedCaption,
      confidence: hasNumberedCaption ? 0.7 : 0.3,
      rasterized: false,
      inserted: false,
      page: region.pageNumber,
    });
  }

  // 2) Rasterização via FigureRasterizerProvider (backend selecionado
  //    automaticamente: PdfJS → Chromium → MuPDF → Poppler → ImageMagick).
  //    Falhas não interrompem a conversão: a figura permanece como placeholder.
  //    Por padrão rasteriza. Defina PDF_FIGURE_RASTERIZE=0 para pular (útil em
  //    ambientes sem navegador/CLI ou para testar o aviso de perda visual).
  const rasterizeEnabled = safeEnv.flag("PDF_FIGURE_RASTERIZE", true);
  if (!rasterizeEnabled) {
    for (const img of images) {
      const region = regionsById.get(img.id)!;
      const cls = classifyFigureRegion(region, diagnostic, false);
      img.auditClass = cls.auditClass;
      img.reason = cls.reason;
    }
    return images;
  }

  try {
    for (let i = 0; i < regions.length; i += 1) {
      const region = regions[i];
      try {
        const raster = await Promise.race<any>([
          rasterizeRegion(pdfBuffer, region, region.pageNumber - 1),
          new Promise((resolve) => setTimeout(() => resolve(null), 30000)),
        ]);
        if (raster && raster.data && raster.data.byteLength > 100) {
          images[i] = {
            ...images[i],
            data: raster.data,
            width: raster.width,
            height: raster.height,
          status: "preserved",
          rasterized: true,
          inserted: true,
        };
        // R-OCR-2: aplica OCR na figura rasterizada para gerar alt-text
        // acessível (texto embutido na ilustração). Não interrompe a
        // conversão se o OCR falhar.
        try {
          const { recognizePng } = await import("./ocr");
          const ocr = await recognizePng(raster.data, { lang: safeEnv.string("OCR_LANG", "por+eng") });
          if (ocr.available && ocr.text) {
            images[i].ocrText = ocr.text;
            images[i].ocrConfidence = ocr.confidence;
            images[i].ocrBackend = ocr.backend;
          }
        } catch {
          /* OCR opcional */
        }
      }
    } catch {
      /* mantém placeholder */
    }
      const cls = classifyFigureRegion(region, diagnostic, images[i].status === "preserved");
      images[i].auditClass = cls.auditClass;
      images[i].reason = cls.reason;
      images[i].confidence = cls.confidence;
      images[i].isFigure = cls.isFigure;
    }
  } finally {
    // Fecha o browser Chromium compartilhado em TODOS os casos (sucesso ou erro),
    // evitando processo órfão e trava em runners de teste. Antes estava fora de
    // um finally, logo uma exceção durante a rasterização vazaria o navegador.
    try {
      const { closeChromiumBrowser } = await import("./figure-rasterizer");
      await closeChromiumBrowser();
    } catch {
      /* ignore */
    }
  }

  return images;
}
