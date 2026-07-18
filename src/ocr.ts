import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";
import { safeEnv } from "./safe-env";

export type OcrBackend = "native-cli" | "tesseract.js" | "none";

export interface OcrResult {
  text: string;
  confidence: number;
  backend: OcrBackend;
  available: boolean;
  // Motivo quando não disponível (para auditoria/relatório, sem mascarar).
  reason?: string;
}

export interface OcrOptions {
  lang?: string; // ex.: "por+eng"
  timeoutMs?: number;
}

const DEFAULT_LANG = safeEnv.string("OCR_LANG", "por+eng");

// Acesso preguiçoso a módulos Node (não disponíveis no browser).
let _nodeFs: typeof import("node:fs") | undefined;
let _nodeCp: typeof import("node:child_process") | undefined;
async function loadNodeFs(): Promise<typeof import("node:fs")> {
  if (!_nodeFs) _nodeFs = await import("node:fs");
  return _nodeFs;
}
async function loadNodeCp(): Promise<typeof import("node:child_process")> {
  if (!_nodeCp) _nodeCp = await import("node:child_process");
  return _nodeCp;
}

async function tesseractBinaryPath(): Promise<string | undefined> {
  const tesseractPath = safeEnv.string("TESSERACT_PATH", "");
  if (!tesseractPath) return undefined;
  try {
    const fs = await loadNodeFs();
    if (fs.existsSync(tesseractPath)) return tesseractPath;
  } catch {
    /* browser: módulo node indisponível */
  }
  return undefined;
}

export async function nativeCliAvailable(): Promise<boolean> {
  return Boolean(await tesseractBinaryPath());
}

// Detecta se o backend tesseract.js (WASM) está instalado (dependência opcional).
async function tesseractJsAvailable(): Promise<boolean> {
  try {
    await import("tesseract.js");
    return true;
  } catch {
    return false;
  }
}

export async function ocrBackendInUse(): Promise<OcrBackend> {
  if (await nativeCliAvailable()) return "native-cli";
  if (await tesseractJsAvailable()) return "tesseract.js";
  return "none";
}

// ---- Backend nativo (CLI) ----
// `tesseract <input> stdout --psm 6 -l <lang>` retorna o texto em stdout.
async function recognizeWithNativeCli(
  pngPath: string,
  opts: OcrOptions,
): Promise<OcrResult> {
  const bin = (await tesseractBinaryPath())!;
  const lang = opts.lang || DEFAULT_LANG;
  const timeout = opts.timeoutMs ?? 60000;
  const { spawn } = await loadNodeCp();
  return new Promise<OcrResult>((resolve) => {
    const proc = spawn(bin, [pngPath, "stdout", "--psm", "6", "-l", lang], {
      windowsHide: true,
    });
    let out = "";
    let err = "";
    let done = false;
    const finish = (text: string, confidence: number) => {
      if (done) return;
      done = true;
      resolve({
        text: text.trim(),
        confidence,
        backend: "native-cli",
        available: true,
      });
    };
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", () => {
      resolve({
        text: "",
        confidence: 0,
        backend: "native-cli",
        available: false,
        reason: "Falha ao invocar o binário nativo do Tesseract.",
      });
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          text: "",
          confidence: 0,
          backend: "native-cli",
          available: false,
          reason: `Tesseract nativo retornou código ${code}: ${err.slice(0, 200)}`,
        });
        return;
      }
      // O CLI não devolve confiança direta; estimamos 0 quando vazio.
      finish(out, out.trim().length > 0 ? 80 : 0);
    });
    setTimeout(() => {
      try { proc.kill(); } catch { /* ignore */ }
      finish(out, out.trim().length > 0 ? 80 : 0);
    }, timeout).unref?.();
  });
}

// ---- Backend tesseract.js (WASM, fallback sem binário nativo) ----
async function recognizeWithTesseractJs(
  pngBuffer: Uint8Array,
  opts: OcrOptions,
): Promise<OcrResult> {
  const lang = opts.lang || DEFAULT_LANG;
  const timeout = opts.timeoutMs ?? 60000;
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(lang);
    const job = worker.recognize(Buffer.from(pngBuffer));
    const timer = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("ocr-timeout")), timeout),
    );
    const { data } = await Promise.race([job, timer]);
    await worker.terminate();
    return {
      text: (data.text || "").trim(),
      confidence: typeof data.confidence === "number" ? Math.round(data.confidence) : 0,
      backend: "tesseract.js",
      available: true,
    };
  } catch (e) {
    return {
      text: "",
      confidence: 0,
      backend: "tesseract.js",
      available: false,
      reason: `tesseract.js indisponível ou falhou: ${(e as Error)?.message || e}`,
    };
  }
}

// OCR de uma imagem PNG (figura rasterizada ou página renderizada).
export async function recognizePng(
  pngBuffer: Uint8Array,
  opts: OcrOptions = {},
): Promise<OcrResult> {
  if (await nativeCliAvailable()) {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const path = join(tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    writeFileSync(path, Buffer.from(pngBuffer));
    try {
      return await recognizeWithNativeCli(path, opts);
    } finally {
      try { unlinkSync(path); } catch { /* ignore */ }
    }
  }
  if (await tesseractJsAvailable()) {
    return recognizeWithTesseractJs(pngBuffer, opts);
  }
  return {
    text: "",
    confidence: 0,
    backend: "none",
    available: false,
    reason: "Nenhum backend de OCR disponível (sem binário Tesseract nativo e sem tesseract.js instalado).",
  };
}

// OCR de uma página inteira de PDF (para PDFs digitalizados sem camada de
// texto). Renderiza a página via Chromium e aplica OCR na imagem resultante.
export async function recognizePdfPage(
  pdfBuffer: Uint8Array,
  pageIndex: number,
  opts: OcrOptions = {},
): Promise<OcrResult> {
  const { rasterizeFullPage } = await import("./figure-rasterizer");
  const png = await rasterizeFullPage(pdfBuffer, pageIndex);
  if (!png) {
    return {
      text: "",
      confidence: 0,
      backend: "none",
      available: false,
      reason: "Não foi possível rasterizar a página para OCR (Chromium indisponível).",
    };
  }
  return recognizePng(png.data, opts);
}

// Relatório de OCR de páginas (PDFs digitalizados) em Markdown.
export function generateOcrReportMarkdown(
  diagnostic: ImportedPdfDiagnostic,
  meta: { source: string; generatedAt: string },
): string {
  const stats = diagnostic.ocrStats;
  const lines: string[] = [];
  lines.push("# Relatório de OCR — " + (diagnostic.fileName || "PDF"));
  lines.push("");
  lines.push(`- Fonte: ${meta.source}`);
  lines.push(`- Gerado em: ${meta.generatedAt}`);
  lines.push("");
  lines.push("## Resumo (OCR de páginas)");
  lines.push("");
  if (!stats) {
    lines.push("OCR de páginas não foi aplicado (PDF com camada de texto nativa ou OCR desativado via PDF_OCR=0).");
  } else {
    lines.push("| Métrica | Valor |");
    lines.push("| --- | --- |");
    lines.push(`| Páginas digitalizadas (sem texto) | ${stats.pagesScanned} |`);
    lines.push(`| Páginas com OCR bem-sucedido | ${stats.pagesOcrSuccess} |`);
    lines.push(`| Backend utilizado | ${stats.backend} |`);
    lines.push(`| Confiança média | ${stats.avgConfidence}% |`);
    lines.push("");
    lines.push("## Por página");
    lines.push("");
    lines.push("| Página | Backend | Disponível | Confiança | Caracteres |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const p of stats.perPage) {
      lines.push(`| ${p.pageNumber} | ${p.backend} | ${p.available ? "sim" : "não"} | ${p.confidence}% | ${p.charCount} |`);
    }
  }
  lines.push("");
  lines.push("## Notas");
  lines.push("");
  lines.push("- Backend primário: Tesseract nativo (CLI), quando o binário está presente (env TESSERACT_PATH).");
  lines.push("- Fallback: tesseract.js (WASM) quando não há binário nativo — usado neste ambiente de validação.");
  lines.push("- OCR de figuras (alt-text) é aplicado separadamente em cada figura rasterizada; veja RELATORIO_FIGURAS.md.");
  lines.push("- OCR é heurístico: o texto reconhecido pode conter erros e deve ser revisado manualmente.");
  lines.push("");
  return lines.join("\n");
}
