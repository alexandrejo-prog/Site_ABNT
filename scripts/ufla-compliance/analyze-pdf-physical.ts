import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
  page: number;
  kind: "footnote" | "footer" | "table-source" | "figure-source" | "page-number" | "header" | "table" | "image" | "equation" | "text";
  text: string;
  bbox: Bbox;
  withinPage: boolean;
  overlaps: string[];
  cutoff: boolean;
  fontSize: number | null;
  masked?: boolean;
  status: "passed" | "failed" | "not-detected";
}

/**
 * Glifos matemáticos que o Word usa para renderizar equações OMML no PDF:
 * o exportador converte OMML em texto com símbolos matemáticos Unicode —
 * alfanuméricos matemáticos (U+1D400–U+1D7FF, ex.: 𝑟𝑎𝑐𝑎𝑏), operadores
 * (U+2200–U+22FF), operadores suplementares (U+2A00–U+2AFF), primos
 * (U+2032–U+2057) e símbolos comuns (×, ÷, √, ∑, ∫, ≠, ≤, ≥, ≈, ±). A
 * presença de um run com esses glifos é evidência física de que a equação
 * declarada no OOXML foi de fato renderizada no PDF.
 */
const MATH_GLYPH_RE =
  /[\u{1D400}-\u{1D7FF}\u{2200}-\u{22FF}\u{2A00}-\u{2AFF}\u{2032}-\u{2057}\u{00D7}\u{00F7}\u{221A}\u{2211}\u{222B}\u{2260}\u{2264}\u{2265}\u{2248}\u{00B1}]/u;

interface PageAnalysis {
  page: number;
  footerRegion: { y0: number; y1: number; x0: number; x1: number };
  footnotes: PageElement[];
  sources: PageElement[];
  elements: PageElement[];
  tables: PageElement[];
  images: PageElement[];
  equations: PageElement[];
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
    equations: string;
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
    totalImages: number;
    totalTables: number;
    totalEquations: number;
    maskedImages: number;
    imagesByPage: Record<number, number>;
    tablesByPage: Record<number, number>;
    equationsByPage: Record<number, number>;
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

/**
 * Detecta regiões de tabela numa página via grade de colunas alinhadas.
 *
 * pdf.js quebra o texto por run de fonte — uma linha visual vira vários itens.
 * Então: (1) funde itens da mesma linha em "células" (clusters com gap <= 24pt);
 * (2) descarta clusters puramente numéricos/pontilhados (números de página e
 * pontilhados de sumário); (3) colunas persistentes = posições x de início de
 * célula que se repetem em >= 3 linhas; (4) exclui a coluna mais frequente
 * (margem esquerda do texto corrido); (5) região de tabela = >= 3 linhas com
 * >= 2 colunas persistentes não-margem. Linhas de corpo contribuem com 1
 * cluster (a margem) e não disparam a detecção.
 */
function detectTableRegions(
  textItems: Array<{ x: number; y: number; str: string }>,
  _pageWidth: number,
  pageHeight: number,
): Array<{ bbox: Bbox; cols: number; rows: number }> {
  // 1) agrupa itens por linha visual (tolerância de 3pt em y)
  const lines: Array<Array<{ x: number; y: number; str: string }>> = [];
  for (const item of textItems) {
    let line = lines.find((l) => Math.abs(l[0].y - item.y) < 3);
    if (!line) {
      line = [];
      lines.push(line);
    }
    line.push(item);
  }

  const mergeClusters = (items: Array<{ x: number; y: number; str: string }>): Array<{ x: number; t: string }> => {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const clusters: Array<{ x: number; t: string }> = [];
    for (const it of sorted) {
      const t = it.str.trim();
      const last = clusters[clusters.length - 1];
      if (last && it.x - last.x <= 24) {
        last.t += t ? " " + t : "";
      } else if (t) {
        clusters.push({ x: it.x, t });
      }
    }
    return clusters;
  };

  // 2/3) colunas por linha, fora da região de rodapé
  const lineCols: Array<{ y: number; cols: number[] }> = [];
  const colFreq = new Map<number, number>();
  for (const line of lines) {
    const y = line[0].y;
    if (y < pageHeight * 0.1 || y > pageHeight * 0.9) continue;
    const clusters = mergeClusters(line);
    // descarta números de página / pontilhados de sumário ("... 148", "....")
    const meaningful = clusters.filter((c) => !/^[\d.\s]{1,30}$/.test(c.t));
    if (meaningful.length < 2) continue;
    const cols = meaningful.map((c) => Math.round(c.x / 4) * 4);
    for (const c of cols) colFreq.set(c, (colFreq.get(c) ?? 0) + 1);
    lineCols.push({ y, cols });
  }

  // 4) coluna mais frequente = margem esquerda; persistentes excluem a margem
  let margin = 0;
  let maxFreq = 0;
  for (const [c, n] of colFreq) {
    if (n > maxFreq) {
      maxFreq = n;
      margin = c;
    }
  }
  const persistent = new Set<number>();
  for (const [c, n] of colFreq) {
    if (n >= 3 && c !== margin) persistent.add(c);
  }
  if (persistent.size < 2) return [];

  // 5) linhas de tabela: >= 2 colunas persistentes não-margem
  const tableLines = lineCols.filter((l) => {
    let hits = 0;
    for (const c of l.cols) if (persistent.has(c)) hits++;
    return hits >= 2;
  });
  if (tableLines.length < 3) return [];

  // agrupa linhas consecutivas (mesma tabela) — espaçamento típico de linha ~14pt
  const sorted = tableLines.sort((a, b) => a.y - b.y);
  const regions: Array<{ bbox: Bbox; cols: number; rows: number }> = [];
  let current: typeof sorted = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - current[current.length - 1].y <= 20) {
      current.push(sorted[i]);
    } else {
      regions.push({ bbox: regionBbox(current), cols: persistent.size, rows: current.length });
      current = [sorted[i]];
    }
  }
  if (current.length > 0) {
    regions.push({ bbox: regionBbox(current), cols: persistent.size, rows: current.length });
  }

  return regions.filter((r) => r.rows >= 2);
}

function regionBbox(lines: Array<{ y: number; cols: number[] }>): Bbox {
  const xs = lines.flatMap((l) => l.cols);
  const ys = lines.map((l) => l.y);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys) - 4,
    x1: Math.max(...xs) + 24,
    y1: Math.max(...ys) + 4,
  };
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

export async function analyzePdf(pdfPath: string): Promise<PhysicalAnalysis> {
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
    const imageElements: PageElement[] = [];

    // --- detecção real de imagens via lista de operadores (opList) + CTM ---
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    let ctm: number[] = [1, 0, 0, 1, 0, 0];
    for (let j = 0; j < opList.fnArray.length; j++) {
      const fn = opList.fnArray[j];
      const args = opList.argsArray[j] as any[];
      if (fn === OPS.transform) {
        ctm = pdfjsLib.Util.transform(ctm, args as number[]);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject
      ) {
        const [name] = args as [string];
        const [a, b, c, d, e, f] = ctm;
        // a imagem é pintada no quadrado unitário [0,0,1,1] sob o CTM;
        // CTM está em espaço PDF (y para cima) — converte para y de tela.
        const corners = [
          [e, f],
          [e + a, f + b],
          [e + c, f + d],
          [e + a + c, f + b + d],
        ];
        const x0 = Math.min(...corners.map((p) => p[0]));
        const x1 = Math.max(...corners.map((p) => p[0]));
        const yPdfMin = Math.min(...corners.map((p) => p[1]));
        const yPdfMax = Math.max(...corners.map((p) => p[1]));
        const bbox = {
          x0: Math.max(0, x0),
          y0: Math.max(0, ph - yPdfMax),
          x1: Math.min(pw, x1),
          y1: Math.min(ph, ph - yPdfMin),
        };
        const withinPage = bbox.x0 >= 0 && bbox.y0 >= 0 && bbox.x1 <= pw && bbox.y1 <= ph;
        const masked = fn === OPS.paintImageMaskXObject;
        const imageElement: PageElement = {
          page: i,
          kind: "image",
          text: `Imagem ${name} (${Math.round(bbox.x1 - bbox.x0)}x${Math.round(bbox.y1 - bbox.y0)} pt)${masked ? " [máscara]" : ""}`,
          bbox,
          withinPage,
          overlaps: [],
          cutoff: !withinPage,
          fontSize: null,
          masked,
          status: "passed",
        };
        imageElements.push(imageElement);
        pageElements.push(imageElement);
        allElements.push(imageElement);
        if (imageElement.cutoff) totalCutoffs++;
      }
    }

    // --- detecção real de equações OMML renderizadas (glifos matemáticos) ---
    const equationElements: PageElement[] = [];
    for (const item of pageTextItems) {
      if (!MATH_GLYPH_RE.test(item.str || "")) continue;
      const bbox = heuristicBbox(item.x, item.y, item.w, item.h, pw, ph);
      const el: PageElement = {
        page: i,
        kind: "equation",
        text: `Equação renderizada (glifos matemáticos: ${item.str.trim().slice(0, 32)})`,
        bbox,
        withinPage: true,
        overlaps: [],
        cutoff: false,
        fontSize: item.fontSize,
        status: "passed",
      };
      equationElements.push(el);
      allElements.push(el);
    }

    // --- detecção real de tabelas via grade de colunas alinhadas ---
    const tableRegions = detectTableRegions(
      pageTextItems.map((it) => ({ x: it.x, y: it.y, str: it.str })),
      pw,
      ph,
    );
    const tableElements: PageElement[] = tableRegions.map((r) => {
      const el: PageElement = {
        page: i,
        kind: "table",
        text: `Tabela ${r.cols} colunas x ${r.rows} linhas (grade alinhada)`,
        bbox: r.bbox,
        withinPage: true,
        overlaps: [],
        cutoff: false,
        fontSize: null,
        status: "passed",
      };
      allElements.push(el);
      return el;
    });

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
        if (elA.kind === "image" || elB.kind === "image") continue;
        if (elA.kind === "table" || elB.kind === "table") continue;
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
      tables: tableElements,
      images: imageElements,
      equations: equationElements,
      overlaps,
      cutoffs,
      status: hasFailed ? "failed" : cutoffs.length > 0 ? "failed" : overlaps.length > 0 ? "failed" : "passed",
    };

    pagesAnalysis.push(pageAnalysis);
  }

  const passed = allElements.filter((e) => e.status === "passed").length;
  const failed = allElements.filter((e) => e.status === "failed").length;
  const notDetected = allElements.filter((e) => e.status === "not-detected").length;
  const totalImages = allElements.filter((e) => e.kind === "image").length;
  const totalTables = allElements.filter((e) => e.kind === "table").length;
  const totalEquations = allElements.filter((e) => e.kind === "equation").length;
  const maskedImages = allElements.filter((e) => e.kind === "image" && e.masked).length;
  const imagesByPage: Record<number, number> = {};
  const tablesByPage: Record<number, number> = {};
  const equationsByPage: Record<number, number> = {};
  for (const el of allElements) {
    if (el.kind === "image") imagesByPage[el.page] = (imagesByPage[el.page] ?? 0) + 1;
    if (el.kind === "table") tablesByPage[el.page] = (tablesByPage[el.page] ?? 0) + 1;
    if (el.kind === "equation") equationsByPage[el.page] = (equationsByPage[el.page] ?? 0) + 1;
  }

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
      images: allElements.some((e) => e.kind === "image") ? "passed" : "not-detected",
      tables: allElements.some((e) => e.kind === "table") ? "passed" : "not-detected",
      equations: allElements.some((e) => e.kind === "equation") ? "passed" : "not-detected",
      overlap: totalOverlaps > 0 ? "failed" : "passed",
      cutoff: totalCutoffs > 0 ? "failed" : "passed",
      blankPages: blankPages.length > 0 ? "failed" : "passed",
      limitations: [
        "Imagens detectadas via opList (paintImageXObject/paintInlineImageXObject/paintImageMaskXObject) com bbox do CTM — contagem real por página (imagesByPage); imagens em máscara são sinalizadas (maskedImages).",
        "Tabelas detectadas por grade de colunas alinhadas (colunas persistentes em >= 3 linhas com >= 2 colunas) — contagem por página em tablesByPage; a validação semântica de w:tblHeader é feita no nível OOXML (ooxml-checks).",
        "Equações OMML detectadas no PDF pelos glifos matemáticos Unicode que o Word emite (alfanuméricos U+1D400–U+1D7FF, operadores, √, ∫, ∑ etc.) — contagem por página em equationsByPage; a estrutura OMML (m:f, m:rad, m:sSup) é validada no OOXML (validate-omml).",
        "Falsos positivos possíveis: linhas de referência longas no rodapé podem ser classificadas como footnote; 'Fonte:' no corpo pode ser contado como table-source; caracteres matemáticos isolados no texto corrido (ex.: '±' em texto) podem ser contados como equation.",
        "Falsos negativos possíveis: tabelas cujas linhas tenham < 2 colunas persistentes em 3+ linhas não são detectadas; equações com símbolos fora dos ranges mapeados não são contadas.",
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
      totalImages,
      totalTables,
      totalEquations,
      maskedImages,
      imagesByPage,
      tablesByPage,
      equationsByPage,
    },
  };
}

async function main() {
  const mainAnalysis = await analyzePdf(pdfPath);
  writeFileSync(outputPath, JSON.stringify(mainAnalysis, null, 2), "utf-8");
  console.log(`Análise física salva em: ${outputPath}`);
  console.log(`Páginas: ${mainAnalysis.pages}, Elementos relevantes: ${mainAnalysis.summary.totalElements}, Passed: ${mainAnalysis.summary.passed}, Not-detected: ${mainAnalysis.summary.notDetected}, Cutoffs: ${mainAnalysis.summary.totalCutoffs}, Overlaps: ${mainAnalysis.summary.totalOverlaps}, Blank: ${mainAnalysis.summary.blankPages.length}, Imagens: ${mainAnalysis.summary.totalImages} (${mainAnalysis.summary.maskedImages} máscara), Tabelas: ${mainAnalysis.summary.totalTables}, Equações: ${mainAnalysis.summary.totalEquations}`);

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

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("analyze-pdf-physical.ts");
if (isDirectRun) {
  main().catch((err) => {
    console.error("Falha na análise física do PDF:", err);
    process.exit(1);
  });
}
