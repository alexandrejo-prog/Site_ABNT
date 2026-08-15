/**
 * Compara a pré-visualização HTML com o DOCX renderizado pelo Word.
 *
 * Para um documento real (monografia com ficha catalográfica):
 *  1. Gera o DOCX (rascunho editável) e renderiza PDF via Word COM.
 *  2. Extrai o texto por página do PDF (pdfjs-dist).
 *  3. Gera o HTML do preview (buildPreviewHtml) e extrai o texto por página.
 *  4. Métricas de divergência: sobreposição de tokens (ambos os sentidos),
 *     diferença de número de páginas, cabeçalhos alinhados.
 *  5. Evidência visual: PNG do preview (Playwright chromium) e do PDF
 *     (@napi-rs/canvas) lado a lado em um relatório HTML.
 *
 * Uso: npx tsx scripts/ufla-compliance/compare-preview-docx.ts
 * Saída: artifacts/ufla-compliance/preview-docx-diff.json + report HTML.
 * Gate: similaridade ≥ 0.65 E |Δpáginas| ≤ 3 (sem Word: skipped, passed).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import pixelmatch from "pixelmatch";
import { buildPreviewHtml } from "../../src/preview-html.js";
import { generateGraduateEditableDraftDocxBlob } from "../../src/export-graduate-editable-draft-docx.js";
import { PER_TYPE_FIELDS, PER_TYPE_EDITOR_TEXT } from "./per-type-fixtures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUT = join(ROOT, "artifacts", "ufla-compliance", "preview-diff");
const PS_RENDER = join(__dirname, "render-docx-to-pdf.ps1");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(ROOT, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
).href;

/** Normaliza texto para comparação: minúsculas, sem acentos/pontuação, tokens únicos. */
function tokens(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (b.size === 0) return 0;
  let hit = 0;
  for (const t of b) if (a.has(t)) hit += 1;
  return hit / b.size;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

function canUseWord(): boolean {
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "(Get-Command WINWORD.EXE -ErrorAction SilentlyContinue) -ne $null"], { stdio: "pipe", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

async function pdfPages(pdfPath: string): Promise<string[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push((tc.items as Array<{ str: string }>).map((it) => it.str).join(" "));
  }
  return pages;
}

async function rasterizePdfPage(pdfPath: string, pageNumber: number): Promise<{ png: Buffer; width: number; height: number }> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { png: await canvas.encode("png"), width: canvas.width, height: canvas.height };
}

export async function runPreviewDocxCompare(): Promise<{ passed: boolean; failures: string[]; wordAvailable: boolean; result: Record<string, unknown> }> {
  const failures: string[] = [];
  const wordAvailable = canUseWord();
  mkdirSync(OUT, { recursive: true });

  const fields = { ...PER_TYPE_FIELDS.monografia_draft, fichaCatalografica: "Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA." };
  const input = { fields, editorText: PER_TYPE_EDITOR_TEXT };

  // 1) DOCX + PDF
  const docxPath = join(OUT, "monografia.docx");
  const pdfPath = join(OUT, "monografia.pdf");
  const blob = await generateGraduateEditableDraftDocxBlob(input);
  writeFileSync(docxPath, Buffer.from(await blob.arrayBuffer()));
  if (wordAvailable) {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_RENDER, "-DocxPath", docxPath, "-PdfPath", pdfPath], { stdio: "pipe", timeout: 120000 });
  }

  // 2) Preview HTML
  const previewHtml = buildPreviewHtml(input);

  const result: Record<string, unknown> = {
    docx: "preview-diff/monografia.docx",
    pdf: "preview-diff/monografia.pdf",
    previewPages: 0,
    pdfPages: 0,
    pageDelta: 0,
    similarityPreviewToPdf: 0,
    similarityPdfToPreview: 0,
    similarity: 0,
    perPage: [] as unknown[],
    screenshots: [] as unknown[],
    gate: { similarityMin: 0.65, pageDeltaMax: 3 },
  };

  if (!wordAvailable) {
    result.status = "skipped-no-word";
    result.passed = true;
    return { passed: true, failures, wordAvailable, result };
  }

  try {
    const pdfTexts = await pdfPages(pdfPath);
    result.pdfPages = pdfTexts.length;

    // Páginas do preview: <section class="preview-page">…</section>
    const pageRe = /<section class="preview-page[^"]*"[^>]*>([\s\S]*?)<\/section>/g;
    const previewPages: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pageRe.exec(previewHtml)) !== null) previewPages.push(stripHtml(m[1]));
    result.previewPages = previewPages.length;

    const pdfTokens = tokens(pdfTexts.join(" "));
    const previewTokens = tokens(previewPages.join(" "));
    const simP2D = overlap(pdfTokens, previewTokens);
    const simD2P = overlap(previewTokens, pdfTokens);
    result.similarityPreviewToPdf = Number(simP2D.toFixed(3));
    result.similarityPdfToPreview = Number(simD2P.toFixed(3));
    result.similarity = Number(Math.min(simP2D, simD2P).toFixed(3));
    result.pageDelta = Math.abs(result.pdfPages - result.previewPages);

    // Alinhamento por página: páginas de conteúdo (≥ 15 tokens) em ordem
    const perPage: unknown[] = [];
    const isContentPage = (t: string): boolean => t.split(/\s+/).filter(Boolean).length >= 15;
    const pdfTextual = pdfTexts.filter(isContentPage);
    const previewTextual = previewPages.filter(isContentPage);
    const pdfContentTokens = pdfTextual.map(tokens);
    for (let i = 0; i < previewTextual.length; i++) {
      const prevToks = tokens(previewTextual[i]);
      // melhor correspondência no PDF (conteúdo existe em alguma página)
      let best = 0;
      let bestIdx = -1;
      for (let j = 0; j < pdfContentTokens.length; j++) {
        const o = overlap(pdfContentTokens[j], prevToks);
        if (o > best) { best = o; bestIdx = j; }
      }
      perPage.push({
        page: i + 1,
        previewText: previewTextual[i].slice(0, 80),
        pdfPage: bestIdx >= 0 ? bestIdx + 1 : null,
        bestMatchOverlap: Number(best.toFixed(3)),
        // overlap sequencial (paginação do preview vs Word na mesma posição)
        sequentialOverlap: Number(overlap(pdfContentTokens[i] ?? new Set(), prevToks).toFixed(3)),
      });
    }
    result.perPage = perPage;

    // 3) Screenshots lado a lado (evidência visual informativa)
    const screenshots: unknown[] = [];
    const previewScreenshot = async (html: string, pageNumber: number): Promise<{ png: Buffer; width: number; height: number }> => {
      // usa o chromium do Playwright para renderizar a página do preview
      const { chromium } = await import("playwright");
      const css = readFileSync(join(ROOT, "src", "preview-styles.css"), "utf8");
      const wrapper = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="preview-document">${html}</div></body></html>`;
      const tmpFile = join(OUT, `_preview-${pageNumber}.html`);
      writeFileSync(tmpFile, wrapper);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
        await page.goto(pathToFileURL(tmpFile).href);
        const section = page.locator(".preview-page").nth(pageNumber - 1);
        await section.scrollIntoViewIfNeeded();
        const shot = await section.screenshot();
        const box = await section.boundingBox();
        return { png: shot, width: Math.round(box?.width ?? 595), height: Math.round(box?.height ?? 842) };
      } finally {
        await browser.close();
      }
    };

    for (let i = 0; i < Math.min(3, pdfTexts.length); i++) {
      const pdfShot = await rasterizePdfPage(pdfPath, i + 1);
      const prevShot = await previewScreenshot(previewHtml, i + 1);
      const w = Math.min(pdfShot.width, prevShot.width);
      const h = Math.min(pdfShot.height, prevShot.height);
      const pdfPng = pdfShot.png;
      const prevPng = prevShot.png;
      // redimensionar ambos para o mesmo canvas de diff (só a página inteira, escala fixa)
      const { createCanvas: cc } = await import("@napi-rs/canvas");
      const dc = cc(w, h);
      const dctx = dc.getContext("2d");
      const img1 = (await import("@napi-rs/canvas")).loadImage(pdfPng);
      const img2 = (await import("@napi-rs/canvas")).loadImage(prevPng);
      // diff em miniatura 300px
      const tw = 300;
      const th = Math.round((h / w) * tw);
      const d1 = cc(tw, th);
      const c1 = d1.getContext("2d");
      c1.drawImage(await img1, 0, 0, tw, th);
      const d2 = cc(tw, th);
      const c2 = d2.getContext("2d");
      c2.drawImage(await img2, 0, 0, tw, th);
      const diffCanvas = cc(tw, th);
      const diffCtx = diffCanvas.getContext("2d");
      const diffPixels = diffCtx.createImageData(tw, th);
      const n = pixelmatch(c1.getImageData(0, 0, tw, th).data, c2.getImageData(0, 0, tw, th).data, diffPixels.data, tw, th, { threshold: 0.25 });
      diffCtx.putImageData(diffPixels, 0, 0);

      const pdfFile = join(OUT, `page-${i + 1}-docx.png`);
      const prevFile = join(OUT, `page-${i + 1}-preview.png`);
      const diffFile = join(OUT, `page-${i + 1}-diff.png`);
      writeFileSync(pdfFile, await pdfShot.png);
      writeFileSync(prevFile, await prevShot.png);
      writeFileSync(diffFile, await diffCanvas.encode("png"));
      screenshots.push({
        page: i + 1,
        docx: `preview-diff/page-${i + 1}-docx.png`,
        preview: `preview-diff/page-${i + 1}-preview.png`,
        diff: `preview-diff/page-${i + 1}-diff.png`,
        diffRatio: Number((n / (tw * th)).toFixed(3)),
      });
    }
    result.screenshots = screenshots;

    const gate = result.gate as { similarityMin: number; pageDeltaMax: number };
    const similarityOk = result.similarity >= gate.similarityMin;
    const pageDeltaOk = result.pageDelta <= gate.pageDeltaMax;
    if (!similarityOk) failures.push(`similaridade ${result.similarity} < ${gate.similarityMin} (conteúdo divergente entre preview e DOCX)`);
    if (!pageDeltaOk) failures.push(`Δpáginas ${result.pageDelta} > ${gate.pageDeltaMax} (preview ${result.previewPages} vs PDF ${result.pdfPages})`);
    result.status = failures.length === 0 ? "passed" : "failed";
    result.passed = failures.length === 0;
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
    result.status = "failed";
    result.passed = false;
  }

  return { passed: failures.length === 0, failures, wordAvailable, result };
}

async function main(): Promise<void> {
  const { passed, failures, wordAvailable, result } = await runPreviewDocxCompare();
  writeFileSync(join(ROOT, "artifacts", "ufla-compliance", "preview-docx-diff.json"), JSON.stringify({ wordAvailable, ...result }, null, 2) + "\n", "utf8");
  const failedList = failures.length > 0 ? `\n  - ${failures.join("\n  - ")}` : "";
  console.log(`Preview vs DOCX: ${passed ? "PASSED" : `FAILED${failedList}`} (similaridade ${result.similarity}, páginas preview ${result.previewPages} vs PDF ${result.pdfPages})`);
  process.exit(passed ? 0 : 1);
}

if (basename(process.argv[1] ?? "") === "compare-preview-docx.ts") {
  void main();
}
