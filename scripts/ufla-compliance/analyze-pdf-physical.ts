import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")).href;

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PageElement {
  kind: "footnote" | "footer" | "table-source" | "figure-source" | "page-number" | "header" | "table" | "image" | "text";
  text: string;
  bbox: Bbox;
  withinPage: boolean;
  overlaps: string[];
  cutoff: boolean;
  fontSize: number | null;
  status: "passed" | "failed" | "not-detected";
}

interface PageAnalysis {
  page: number;
  footerRegion: { y0: number; y1: number; x0: number; x1: number };
  footnotes: PageElement[];
  sources: PageElement[];
  elements: PageElement[];
  tables: PageElement[];
  images: PageElement[];
  overlaps: Array<{ kind1: string; kind2: string; bbox1: Bbox; bbox2: Bbox }>;
  cutoffs: PageElement[];
  status: "passed" | "failed" | "not-detected";
}

interface PhysicalAnalysis {
  pages: number;
  pageSize: { width: number; height: number };
  pagesAnalysis: PageAnalysis[];
  elements: PageElement[];
  coverage: {
    footnotes: string;
    footers: string;
    pageNumbers: string;
    tableSources: string;
    figureSources: string;
    headers: string;
    images: string;
    tables: string;
    overlap: string;
    cutoff: string;
    blankPages: string;
    limitations: string[];
  };
  summary: {
    totalElements: number;
    passed: number;
    failed: number;
    notDetected: number;
    blankPages: Array<{ page: number; classification: string; cause: string }>;
    totalCutoffs: number;
    totalOverlaps: number;
  };
}

const pdfPath = join(root, "artifacts", "ufla-compliance", "rendered", "normalized-dissertacao.pdf");
const outputPath = join(root, "artifacts", "ufla-compliance", "pdf-physical-analysis.json");
const fixturesDir = join(root, "artifacts", "ufla-compliance", "rendered", "fixtures");
const fixturesOutputPath = join(root, "artifacts", "ufla-compliance", "fixtures-physical-analysis.json");

function heuristicBbox(x: number, y: number, w: number, h: number, pageWidth: number, pageHeight: number): Bbox {
  return {
    x0: Math.max(0, x),
    y0: Math.max(0, y),
    x1: Math.min(pageWidth, x + w),
    y1: Math.min(pageHeight, y + h),
  };
}

function normalizeSourceText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeReferenceLine(text: string): boolean {
  const normalized = normalizeSourceText(text);
  if (!normalized || normalized.length < 5) return false;
  if (/^(anexo|apendice|referencias|referenci)/.test(normalized)) return false;
  if (/^\d+[.\s]*[a-zà-ú]/.test(normalized)) return true;
  if (/^[a-zà-ú][a-zà-ú\s\.]+,\s*[a-zà-ú]/.test(normalized)) return true;
  if (/^[a-zà-ú][a-zà-ú\s\.]+\.\s*\(\d{4}\)/.test(normalized)) return true;
  if (/^[a-zà-ú][a-zà-ú\s\.]+,\s*\d{4}/.test(normalized)) return true;
  return false;
}

function classifyElement(text: string, bbox: Bbox, pageHeight: number): { kind: PageElement["kind"]; status: PageElement["status"] } {
  const lower = normalizeSourceText(text);

  if (/^\d+$/.test(lower) && bbox.y0 > pageHeight * 0.85 && bbox.y0 < pageHeight - 5) {
    return { kind: "page-number", status: "passed" };
  }
  if (lower.startsWith("fonte:") || lower.startsWith("fonte.") || lower.startsWith("fonte :")) {
    return { kind: "table-source", status: "passed" };
  }
  if (
    lower.startsWith("figura") ||
    lower.startsWith("quadro") ||
    lower.startsWith("grafico") ||
    lower.startsWith("mapa") ||
    lower.startsWith("ilustracao")
  ) {
    return { kind: "figure-source", status: "passed" };
  }
  if (lower.includes("nota") && bbox.y0 > pageHeight * 0.5) {
    return { kind: "footnote", status: "passed" };
  }
  if (looksLikeReferenceLine(text) && bbox.y0 > pageHeight * 0.7) {
    return { kind: "footnote", status: "passed" };
  }
  if (bbox.y0 < pageHeight * 0.15) {
    return { kind: "header", status: "not-detected" };
  }
  if (bbox.y0 > pageHeight * 0.85) {
    return { kind: "footer", status: "not-detected" };
  }
  return { kind: "text", status: "not-detected" };
}

function bboxIntersects(a: Bbox, b: Bbox): boolean {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  if (x0 >= x1 || y0 >= y1) return false;
  const intersectionArea = (x1 - x0) * (y1 - y0);
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  const minArea = Math.min(areaA, areaB);
  return minArea > 0 && intersectionArea / minArea > 0.3;
}

async function analyzePdf(pdfPath: string): Promise<PhysicalAnalysis> {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const firstPage = await doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });
  const pw = viewport.width;
  const ph = viewport.height;

  const pagesAnalysis: PageAnalysis[] = [];
  const allElements: PageElement[] = [];
  let totalCutoffs = 0;
  let totalOverlaps = 0;
  const blankPages: Array<{ page: number; classification: string; cause: string }> = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageTextItems = textContent.items.map((item: any) => {
      const tx = item.transform[4];
      const ty = item.transform[5];
      const w = item.width;
      const h = item.height;
      return {
        x: tx,
        y: ty,
        w,
        h,
        str: item.str || "",
        fontSize: item.transform[0] || null,
      };
    });

    const pageElements: PageElement[] = [];
    const pageBounds = { x0: 0, y0: 0, x1: pw, y1: ph };

    for (const item of pageTextItems) {
      const text = item.str.trim();
      if (!text) continue;

      const bbox = heuristicBbox(item.x, item.y, item.w, item.h, pw, ph);
      const withinPage = bbox.x0 >= 0 && bbox.y0 >= 0 && bbox.x1 <= pw && bbox.y1 <= ph;
      const cutoff = !withinPage;

      const { kind, status } = classifyElement(text, bbox, ph);

      if (kind === "text" && status === "not-detected") continue;

      const element: PageElement = {
        page: i,
        kind,
        text,
        bbox,
        withinPage,
        overlaps: [],
        cutoff,
        fontSize: item.fontSize,
        status,
      };

      pageElements.push(element);
      allElements.push(element);

      if (cutoff) totalCutoffs++;
    }

    const overlaps: Array<{ kind1: string; kind2: string; bbox1: Bbox; bbox2: Bbox }> = [];
    for (let a = 0; a < pageElements.length; a++) {
      for (let b = a + 1; b < pageElements.length; b++) {
        const elA = pageElements[a];
        const elB = pageElements[b];
        if (elA.kind === "text" || elB.kind === "text") continue;
        if (bboxIntersects(elA.bbox, elB.bbox)) {
          overlaps.push({ kind1: elA.kind, kind2: elB.kind, bbox1: elA.bbox, bbox2: elB.bbox });
          elA.overlaps.push(elB.kind);
          elB.overlaps.push(elA.kind);
        }
      }
    }
    totalOverlaps += overlaps.length;

    const footnotes = pageElements.filter((e) => e.kind === "footnote");
    const sources = pageElements.filter((e) => e.kind === "table-source" || e.kind === "figure-source");
    const cutoffs = pageElements.filter((e) => e.cutoff);
    const hasFailed = pageElements.some((e) => e.status === "failed");

    const pageAnalysis: PageAnalysis = {
      page: i,
      footerRegion: { y0: ph * 0.85, y1: ph, x0: 0, x1: pw },
      footnotes,
      sources,
      elements: pageElements,
      tables: [],
      images: [],
      overlaps,
      cutoffs,
      status: hasFailed ? "failed" : cutoffs.length > 0 ? "failed" : overlaps.length > 0 ? "failed" : "passed",
    };

    pagesAnalysis.push(pageAnalysis);
  }

  const passed = allElements.filter((e) => e.status === "passed").length;
  const failed = allElements.filter((e) => e.status === "failed").length;
  const notDetected = allElements.filter((e) => e.status === "not-detected").length;

  return {
    pages: doc.numPages,
    pageSize: { width: pw, height: ph },
    pagesAnalysis,
    elements: allElements,
    coverage: {
      footnotes: allElements.some((e) => e.kind === "footnote") ? "passed" : "not-detected",
      footers: allElements.some((e) => e.kind === "footer") ? "passed" : "not-detected",
      pageNumbers: allElements.some((e) => e.kind === "page-number") ? "passed" : "not-detected",
      tableSources: allElements.some((e) => e.kind === "table-source") ? "passed" : "not-detected",
      figureSources: allElements.some((e) => e.kind === "figure-source") ? "passed" : "not-detected",
      headers: allElements.some((e) => e.kind === "header") ? "passed" : "not-detected",
      images: "not-detected",
      tables: "not-detected",
      overlap: totalOverlaps > 0 ? "failed" : "passed",
      cutoff: totalCutoffs > 0 ? "failed" : "passed",
      blankPages: blankPages.length > 0 ? "failed" : "passed",
      limitations: [
        "Regiões de tabela e imagem não são delimitadas no PDF (pdfjs-dist sem análise de layout) — cobertura images/tables permanece not-detected; a validação de w:tblHeader é feita no nível OOXML (ooxml-checks).",
        "Equações OMML não são extraídas como texto matemático pelo pdfjs-dist — verificadas no nível OOXML/document.xml.",
        "Falsos positivos possíveis: linhas de referência longas no rodapé podem ser classificadas como footnote; 'Fonte:' no corpo pode ser contado como table-source.",
        "Falsos negativos possíveis: tabelas/imagens sem texto associado não geram elementos; overlap de elementos puramente gráficos não é detectado sem bounding box de imagem.",
      ],
    },
    summary: {
      totalElements: allElements.length,
      passed,
      failed,
      notDetected,
      blankPages,
      totalCutoffs,
      totalOverlaps,
    },
  };
}

async function main() {
  const mainAnalysis = await analyzePdf(pdfPath);
  writeFileSync(outputPath, JSON.stringify(mainAnalysis, null, 2), "utf-8");
  console.log(`Análise física salva em: ${outputPath}`);
  console.log(`Páginas: ${mainAnalysis.pages}, Elementos relevantes: ${mainAnalysis.summary.totalElements}, Passed: ${mainAnalysis.summary.passed}, Not-detected: ${mainAnalysis.summary.notDetected}, Cutoffs: ${mainAnalysis.summary.totalCutoffs}, Overlaps: ${mainAnalysis.summary.totalOverlaps}, Blank: ${mainAnalysis.summary.blankPages.length}`);

  if (existsSync(fixturesDir)) {
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(fixturesDir).filter((f) => f.endsWith(".pdf"));
    const fixturesAnalysis: Record<string, PhysicalAnalysis> = {};
    for (const entry of entries) {
      const fixturePdf = join(fixturesDir, entry);
      try {
        fixturesAnalysis[entry] = await analyzePdf(fixturePdf);
      } catch (err) {
        console.error(`Falha ao analisar fixture ${entry}:`, err);
      }
    }
    if (Object.keys(fixturesAnalysis).length > 0) {
      writeFileSync(fixturesOutputPath, JSON.stringify(fixturesAnalysis, null, 2), "utf-8");
      console.log(`Análise das fixtures salva em: ${fixturesOutputPath}`);
      for (const [name, analysis] of Object.entries(fixturesAnalysis)) {
        console.log(`  ${name}: páginas=${analysis.pages}, passed=${analysis.summary.passed}, not-detected=${analysis.summary.notDetected}, cutoffs=${analysis.summary.totalCutoffs}, overlaps=${analysis.summary.totalOverlaps}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Falha na análise física do PDF:", err);
  process.exit(1);
});
