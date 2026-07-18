import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface FigureRegionClip {
  x: number;
  y: number;
  width: number;
  height: number;
  pageHeight: number;
}

export interface RasterContext {
  pdfBuffer: Uint8Array;
  pageIndex: number;
  region: FigureRegionClip;
}

export interface RasterResult {
  data: Uint8Array;
  width: number;
  height: number;
  backend: string;
}

export interface RasterBackend {
  name: string;
  available(): Promise<boolean>;
  rasterize(ctx: RasterContext): Promise<RasterResult | null>;
}

export interface RasterLogEntry {
  backend: string;
  attempted: boolean;
  succeeded: boolean;
  timeMs: number;
  resolution?: string;
  reason?: string;
}

// Caminho do Chromium embutido no playwright-core (usado apenas se existir).
// Se ausente (ex.: após `npm ci` limpo sem `npx playwright install`), o Playwright
// resolve o binário instalado em seu cache padrão (~/AppData/Local/ms-playwright).
const CHROMIUM_CANDIDATES: string[] = [
  "C:\\Users\\User\\Desktop\\Alexandre\\Site_Normas_UFLA\\Site_ABNT\\node_modules\\playwright-core\\.local-browsers\\chromium-1228\\chrome-win64\\chrome.exe",
  (process.env.LOCALAPPDATA || "") + "\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
  (process.env.LOCALAPPDATA || "") + "\\ms-playwright\\chromium-1228\\chrome-win\\chrome.exe",
];

function chromiumExecutable(): string | undefined {
  for (const candidate of CHROMIUM_CANDIDATES) {
    try {
      if (candidate && existsSync(candidate)) {
        return candidate;
      }
    } catch {
      /* ignore */
    }
  }
  // Deixa o Playwright resolver o browser instalado no cache padrão.
  return undefined;
}


// Registro em memória das escolhas de backend (para benchmarks/auditoria).
const selectionLog: RasterLogEntry[] = [];
let cachedBackendName: string | null | undefined;

function logEntry(entry: RasterLogEntry): void {
  selectionLog.push(entry);
}

export function getRasterLog(): RasterLogEntry[] {
  return [...selectionLog];
}

export function resetRasterLog(): void {
  selectionLog.length = 0;
  cachedBackendName = undefined;
}

function hasCommand(cmd: string): boolean {
  try {
    execFileSync("where", [cmd], { stdio: "ignore", windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backend 1: PdfJS Canvas (render via pdfjs + @napi-rs/canvas no Node)
// ---------------------------------------------------------------------------
const PdfJSCanvasBackend: RasterBackend = {
  name: "PdfJSCanvas",
  async available() {
    // Specifier não-literal: o rollup/vite não rastreia nem empacota este
    // módulo nativo (somente Node). No browser este backend nunca é invocado.
    const canvasSpec = "@napi-rs/canvas";
    try {
      await import("pdfjs-dist/legacy/build/pdf.mjs");
      await import(canvasSpec);
      return true;
    } catch {
      return false;
    }
  },
  async rasterize(ctx) {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const canvasSpec = "@napi-rs/canvas";
    const canvasMod: any = await import(canvasSpec);
    const createCanvas = canvasMod.createCanvas;
    const params: any = {
      data: ctx.pdfBuffer,
      disableWorker: true,
      standardFontDataUrl: pathToFileURL(resolve("node_modules/pdfjs-dist/standard_fonts")).href + "/",
      wasmUrl: pathToFileURL(resolve("node_modules/pdfjs-dist/wasm")).href + "/",
    };
    const pdf = await pdfjs.getDocument(params).promise;
    const page = await pdf.getPage(ctx.pageIndex + 1);
    const base = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(base.width), Math.ceil(base.height));
    const renderCtx = canvas.getContext("2d");
    await page.render({ canvasContext: renderCtx, viewport: base }).promise;
    const full = canvas.toBuffer("image/png");
    if (typeof (pdf as any).destroy === "function") {
      try { await (pdf as any).destroy(); } catch { /* ignore */ }
    }
    return { data: new Uint8Array(full), width: canvas.width, height: canvas.height, backend: this.name };
  },
};

// ---------------------------------------------------------------------------
// Backend 2: Chromium (Playwright)
// ---------------------------------------------------------------------------
const ChromiumBackend: RasterBackend = {
  name: "Chromium",
  async available() {
    try {
      await import("playwright");
    } catch {
      return false;
    }
    // Sonda rápida de launch para evitar travar o pipeline quando o Chromium
    // não inicializa neste ambiente (hang). Respeita um tempo curto.
    try {
      const { chromium } = await import("playwright");
      const probe = chromium.launch({
        headless: true,
        executablePath: chromiumExecutable(),
        args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        timeout: 15000,
      });
      const guarded = await Promise.race<any>([
        probe,
        new Promise((_, rej) => setTimeout(() => rej(new Error("launch-timeout")), 15000)),
      ]);
      if (guarded && guarded.close) {
        try { await guarded.close(); } catch { /* ignore */ }
      }
      return true;
    } catch {
      return false;
    }
  },
  async rasterize(ctx) {
    const browser = await getSharedChromium();
    const page = await browser.newPage();
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const pdfPath = join(tmpdir(), `raster-src-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    writeFileSync(pdfPath, ctx.pdfBuffer);
    try {
      // Navegação por file:// (data: de PDF base64 dispara download/abort no Chromium).
      // #toolbar=0 esconde a barra do visualizador do Chromium (nome do arquivo +
      // "1/1 — 100%"), que caso contrário vazaria no screenshot e tornaria a saída
      // não-determinística (o nome do arquivo temporário tem sufixo aleatório).
      await page.goto(`file:///${pdfPath}#page=${ctx.pageIndex + 1}&toolbar=0&navpanes=0&view=FitH`, {
        waitUntil: "load",
        timeout: 15000,
      });
      await page.waitForTimeout(300);
      const clip = {
        x: ctx.region.x,
        y: ctx.region.pageHeight - ctx.region.y - ctx.region.height,
        width: ctx.region.width,
        height: ctx.region.height,
      };
      const buf = await page.screenshot({ type: "png", clip } as any);
      return { data: new Uint8Array(buf), width: Math.round(clip.width), height: Math.round(clip.height), backend: this.name };
    } finally {
      try { await page.close(); } catch { /* ignore */ }
      try { unlinkSync(pdfPath); } catch { /* ignore */ }
    }
  },
};

// Browser Chromium compartilhado entre figuras de UMA conversão (reuso):
// elimina o lançamento de um processo por figura (antes ~1,7s/figura, agora
// ~milissegundos). Fechado explicitamente via closeChromiumBrowser() ao fim do
// lote; caso contrário é encerrado com o processo Node.
let sharedChromium: any = null;

async function getSharedChromium(): Promise<any> {
  if (sharedChromium && sharedChromium.isConnected()) {
    return sharedChromium;
  }
  const { chromium } = await import("playwright");
  sharedChromium = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    timeout: 15000,
  });
  return sharedChromium;
}

export async function closeChromiumBrowser(): Promise<void> {
  if (sharedChromium) {
    try { await sharedChromium.close(); } catch { /* ignore */ }
  }
  sharedChromium = null;
}

// Rasteriza a PÁGINA INTEIRA de um PDF para PNG (usado por OCR de PDFs
// digitalizados, que não possuem camada de texto). Reusa o Chromium
// compartilhado. Retorna null se não foi possível rasterizar.
export async function rasterizeFullPage(
  pdfBuffer: Uint8Array,
  pageIndex: number,
): Promise<RasterResult | null> {
  const browser = await getSharedChromium();
  const page = await browser.newPage();
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const pdfPath = join(tmpdir(), `ocr-page-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(pdfPath, pdfBuffer);
  try {
    await page.goto(`file:///${pdfPath}#page=${pageIndex + 1}&toolbar=0&navpanes=0&view=FitH`, {
      waitUntil: "load",
      timeout: 15000,
    });
    await page.waitForTimeout(300);
    const buf = await page.screenshot({ type: "png", fullPage: true } as any);
    return { data: new Uint8Array(buf), width: 0, height: 0, backend: "chromium-page" };
  } catch {
    return null;
  } finally {
    try { await page.close(); } catch { /* ignore */ }
    try { unlinkSync(pdfPath); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Backends 3-5: MuPDF / Poppler / ImageMagick (CLI) — verificados por comando
// ---------------------------------------------------------------------------
function makeCliBackend(
  name: string,
  cmd: string,
  buildArgs: (ctx: RasterContext, outPath: string) => string[],
): RasterBackend {
  return {
    name,
    async available() {
      return hasCommand(cmd);
    },
    async rasterize(ctx) {
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { writeFileSync, readFileSync, unlinkSync } = await import("node:fs");
      const out = join(tmpdir(), `fig-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
      const inPath = join(tmpdir(), `src-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
      writeFileSync(inPath, ctx.pdfBuffer);
      try {
        execFileSync(cmd, buildArgs(ctx, out), { stdio: "ignore", timeout: 15000, windowsHide: true });
        const data = readFileSync(out);
        return { data: new Uint8Array(data), width: 0, height: 0, backend: name };
      } finally {
        try { unlinkSync(inPath); } catch { /* ignore */ }
        try { unlinkSync(out); } catch { /* ignore */ }
      }
    },
  };
}

const MuPdfBackend = makeCliBackend("MuPDF", "mutool", (ctx, out) => {
  const r = ctx.region;
  return ["draw", "-o", out, "-F", "png", "-p", String(ctx.pageIndex + 1), "-c", `0 ${Math.round(r.pageHeight - r.y - r.height)} ${Math.round(r.x + r.width)} ${Math.round(r.pageHeight - r.y)}`, "source.pdf"];
});

const PopplerBackend = makeCliBackend("Poppler", "pdftoppm", (ctx, out) => {
  const r = ctx.region;
  return ["-f", String(ctx.pageIndex + 1), "-l", String(ctx.pageIndex + 1), "-png", "-x", String(Math.round(r.x)), "-y", String(Math.round(r.pageHeight - r.y - r.height)), "-W", String(Math.round(r.width)), "-H", String(Math.round(r.height)), "source.pdf", out.replace(/\.png$/, "")];
});

const ImageMagickBackend = makeCliBackend("ImageMagick", "magick", (ctx, out) => {
  const r = ctx.region;
  return ["convert", "source.pdf", `-page`, String(ctx.pageIndex + 1), `-crop`, `${Math.round(r.width)}x${Math.round(r.height)}+${Math.round(r.x)}+${Math.round(r.pageHeight - r.y - r.height)}`, out];
});

// Ordem de preferência. Chromium vem antes do PdfJSCanvas porque o render de
// canvas do pdfjs em Node é instável (sem wasm/fontes garantidas); Chromium
// produz rasterização fiel e confiável quando disponível. PdfJSCanvas é o
// fallback leve; MuPDF/Poppler/ImageMagick entram se instalados no SO.
const BACKEND_ORDER: RasterBackend[] = [
  ChromiumBackend,
  PdfJSCanvasBackend,
  MuPdfBackend,
  PopplerBackend,
  ImageMagickBackend,
];

export class FigureRasterizerProvider {
  private backends: RasterBackend[];

  constructor(backends: RasterBackend[] = BACKEND_ORDER) {
    this.backends = backends;
  }

  async selectBackend(): Promise<RasterBackend | null> {
    if (cachedBackendName === undefined) {
      let chosen: RasterBackend | null = null;
      for (const backend of this.backends) {
        const start = Date.now();
        let ok = false;
        let reason: string | undefined;
        try {
          ok = await backend.available();
        } catch (e) {
          reason = (e as Error).message.slice(0, 80);
        }
        logEntry({ backend: backend.name, attempted: true, succeeded: ok, timeMs: Date.now() - start, reason });
        if (ok) {
          chosen = backend;
          break;
        }
      }
      cachedBackendName = chosen ? chosen.name : null;
    }
    return this.backends.find((b) => b.name === cachedBackendName) ?? null;
  }

  async rasterize(ctx: RasterContext): Promise<RasterResult | null> {
    const preferred = await this.selectBackend();
    const candidates = preferred
      ? [preferred, ...this.backends.filter((b) => b.name !== preferred.name)]
      : this.backends;

    let lastReason: string | undefined;
    for (const backend of candidates) {
      const start = Date.now();
      try {
        const result = await backend.rasterize(ctx);
        if (result && result.data && result.data.byteLength > 100) {
          logEntry({
            backend: backend.name,
            attempted: true,
            succeeded: true,
            timeMs: Date.now() - start,
            resolution: `${result.width}x${result.height}`,
          });
          return result;
        }
        logEntry({ backend: backend.name, attempted: true, succeeded: false, timeMs: Date.now() - start, reason: "imagem vazia/pequena" });
      } catch (e) {
        lastReason = (e as Error).message.slice(0, 80);
        logEntry({ backend: backend.name, attempted: true, succeeded: false, timeMs: Date.now() - start, reason: lastReason });
      }
    }
    return null;
  }
}

export const figureRasterizer = new FigureRasterizerProvider();
