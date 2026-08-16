/**
 * Compara a pré-visualização HTML com o DOCX renderizado pelo Word, por template.
 *
 * Para cada template (monografia, dissertação, tese, artigo, resumo expandido CPG,
 * projeto de pesquisa):
 *  1. Gera o DOCX (exportador correspondente) e renderiza PDF via Word COM.
 *  2. Extrai o texto por página do PDF (pdfjs-dist).
 *  3. Gera o HTML do preview (buildPreviewHtml) e extrai o texto por página.
 *  4. Métricas de divergência: sobreposição de tokens (ambos os sentidos),
 *     diferença de número de páginas, best-match por página.
 *  5. Evidência visual (3 primeiras páginas): PNG do preview (Playwright
 *     chromium) e do PDF (@napi-rs/canvas), com diff (pixelmatch).
 *
 * Uso: npx tsx scripts/ufla-compliance/compare-preview-docx.ts
 * Saída: artifacts/ufla-compliance/preview-docx-diff.json + preview-diff/*.png.
 * Gate (por template): similaridade ≥ 0.65 E |Δpáginas| ≤ 3 (sem Word: skipped, passed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import pixelmatch from "pixelmatch";
import { createHash } from "node:crypto";
import { buildPreviewHtml } from "../../src/preview-html.js";
import { generateArticleDocxBlob } from "../../src/export-article-docx.js";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx.js";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx.js";
import { generateGraduateEditableDraftDocxBlob } from "../../src/export-graduate-editable-draft-docx.js";
import type { DocxGenerationInput } from "../../src/export-docx.js";
import { PER_TYPE_EDITOR_TEXT, PER_TYPE_FIELDS } from "./per-type-fixtures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUT = join(ROOT, "artifacts", "ufla-compliance", "preview-diff");
const PS_RENDER = join(__dirname, "render-docx-to-pdf.ps1");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(ROOT, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
).href;

interface TemplateCase {
  id: string;
  input: DocxGenerationInput;
  generate: (input: DocxGenerationInput) => Promise<Blob>;
}

const GRADUATE = (input: DocxGenerationInput) => generateGraduateEditableDraftDocxBlob(input);

export const TEMPLATES: TemplateCase[] = [
  {
    id: "monografia",
    input: {
      fields: {
        ...PER_TYPE_FIELDS.monografia_draft,
        fichaCatalografica: "Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA.",
      },
      editorText: PER_TYPE_EDITOR_TEXT,
    },
    generate: GRADUATE,
  },
  { id: "dissertacao", input: { fields: PER_TYPE_FIELDS.dissertacao_draft, editorText: PER_TYPE_EDITOR_TEXT }, generate: GRADUATE },
  { id: "tese", input: { fields: PER_TYPE_FIELDS.tese_draft, editorText: PER_TYPE_EDITOR_TEXT }, generate: GRADUATE },
  { id: "artigo", input: { fields: PER_TYPE_FIELDS.artigo, editorText: PER_TYPE_EDITOR_TEXT }, generate: (i) => generateArticleDocxBlob(i) },
  { id: "resumo_expandido_cpg", input: { fields: PER_TYPE_FIELDS.resumo_expandido_cpg, editorText: PER_TYPE_EDITOR_TEXT }, generate: (i) => generateCpgDocxBlob(i) },
  { id: "projeto_pesquisa", input: { fields: PER_TYPE_FIELDS.projeto_pesquisa, editorText: PER_TYPE_EDITOR_TEXT }, generate: (i) => generateResearchProjectDocxBlob(i) },
];

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

function normalizeForSignature(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function pdfPagesInfo(pdfPath: string): Promise<Array<{ text: string; number: number | null }>> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
  const out: Array<{ text: string; number: number | null }> = [];
  const PAGE_W = 595.32;
  const PAGE_H = 841.92;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items as Array<{ str: string; transform: number[] }>;
    const text = items.map((it) => it.str).join(" ");
    // número visível: token numérico isolado no canto superior direito (mesma heurística do validate-pagination)
    const nums = items
      .filter((it) => /^\d{1,3}$/.test(it.str.trim()) && it.transform[5] > PAGE_H - 75 && it.transform[4] > PAGE_W * 0.7)
      .map((it) => parseInt(it.str.trim(), 10));
    out.push({ text, number: nums[0] ?? null });
  }
  return out;
}

async function rasterizePdfPage(pdfPath: string, pageNumber: number): Promise<{ png: Buffer; width: number; height: number }> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise;
  return { png: await canvas.encode("png"), width: canvas.width, height: canvas.height };
}

export async function runPreviewDocxCompare(): Promise<{ passed: boolean; failures: string[]; wordAvailable: boolean; result: Record<string, unknown> }> {
  const failures: string[] = [];
  const wordAvailable = canUseWord();
  mkdirSync(OUT, { recursive: true });

  const result: Record<string, unknown> = {
    wordAvailable,
    templates: {} as Record<string, unknown>,
    overall: { similarityMin: 0.65, pageDeltaMax: 3, templates: TEMPLATES.length, passedTemplates: 0 },
  };
  const overall = result.overall as { passedTemplates: number; templates: number };

  if (!wordAvailable) {
    result.status = "skipped-no-word";
    result.passed = true;
    return { passed: true, failures, wordAvailable, result };
  }

  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
    const css = readFileSync(join(ROOT, "src", "preview-styles.css"), "utf8");

    for (const tpl of TEMPLATES) {
      const entry: Record<string, unknown> = {};
      const tplFailures: string[] = [];
      try {
        // 1) DOCX + PDF
        const docxPath = join(OUT, `${tpl.id}.docx`);
        const pdfPath = join(OUT, `${tpl.id}.pdf`);
        const blob = await tpl.generate(tpl.input);
        writeFileSync(docxPath, Buffer.from(await blob.arrayBuffer()));
        execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_RENDER, "-DocxPath", docxPath, "-PdfPath", pdfPath], { stdio: "pipe", timeout: 120000 });

        // 2) Texto por página
        const pdfInfo = await pdfPagesInfo(pdfPath);
        const pdfTexts = pdfInfo.map((p) => p.text);
        const previewHtml = buildPreviewHtml(tpl.input);
        const pageRe = /<section class="preview-page[^"]*"[^>]*>([\s\S]*?)<\/section>/g;
        const previewPages: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = pageRe.exec(previewHtml)) !== null) previewPages.push(stripHtml(m[1]));

        // 3) Métricas globais
        const pdfTokens = tokens(pdfTexts.join(" "));
        const previewTokens = tokens(previewPages.join(" "));
        const simP2D = overlap(pdfTokens, previewTokens);
        const simD2P = overlap(previewTokens, pdfTokens);
        const similarity = Math.min(simP2D, simD2P);
        const pageDelta = Math.abs(pdfTexts.length - previewPages.length);

        // 4) Best-match por página (conteúdo do preview existe no DOCX)
        const isContentPage = (t: string): boolean => t.split(/\s+/).filter(Boolean).length >= 15;
        const pdfContentTokens = pdfTexts.filter(isContentPage).map(tokens);
        const previewContent = previewPages.filter(isContentPage);
        const perPage: Array<{ page: number; pdfPage: number | null; bestMatchOverlap: number; sequentialOverlap: number }> = [];
        for (let i = 0; i < previewContent.length; i++) {
          const prevToks = tokens(previewContent[i]);
          let best = 0;
          let bestIdx = -1;
          for (let j = 0; j < pdfContentTokens.length; j++) {
            const o = overlap(pdfContentTokens[j], prevToks);
            if (o > best) { best = o; bestIdx = j; }
          }
          perPage.push({
            page: i + 1,
            pdfPage: bestIdx >= 0 ? bestIdx + 1 : null,
            bestMatchOverlap: Number(best.toFixed(3)),
            sequentialOverlap: Number(overlap(pdfContentTokens[i] ?? new Set(), prevToks).toFixed(3)),
          });
        }

        entry.previewPages = previewPages.length;
        entry.pdfPages = pdfTexts.length;
        entry.pageDelta = pageDelta;
        entry.similarityPreviewToPdf = Number(simP2D.toFixed(3));
        entry.similarityPdfToPreview = Number(simD2P.toFixed(3));
        entry.similarity = Number(similarity.toFixed(3));
        entry.perPage = perPage;
        // Assinaturas do PDF (referência do Word): hash por página + números visíveis.
        entry.pdfSignatures = pdfInfo.map((p) => sha256(normalizeForSignature(p.text)));
        entry.pdfPageNumbers = pdfInfo.map((p) => p.number);

        // 5) Evidência visual (3 primeiras páginas)
        const screenshots: unknown[] = [];
        const shotCount = Math.min(3, pdfTexts.length, previewPages.length);
        for (let i = 0; i < shotCount; i++) {
          const pdfShot = await rasterizePdfPage(pdfPath, i + 1);
          // preview: página i+1 em HTML standalone com o CSS real
          const wrapper = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="preview-document">${previewHtml}</div></body></html>`;
          const tmpFile = join(OUT, `_${tpl.id}-${i + 1}.html`);
          writeFileSync(tmpFile, wrapper);
          const page = await browser!.newPage({ viewport: { width: 900, height: 1200 } });
          let prevShot: Buffer;
          let prevW = 0;
          let prevH = 0;
          try {
            await page.goto(pathToFileURL(tmpFile).href);
            const section = page.locator(".preview-page").nth(i);
            await section.scrollIntoViewIfNeeded();
            prevShot = await section.screenshot();
            const box = await section.boundingBox();
            prevW = Math.round(box?.width ?? 595);
            prevH = Math.round(box?.height ?? 842);
          } finally {
            await page.close();
          }

          // diff em miniatura 300px de largura
          const tw = 300;
          const th = Math.round((Math.min(prevW, prevH, pdfShot.height, pdfShot.width) / Math.max(prevW, 1)) * tw);
          const safeH = Math.max(20, Math.min(th, 600));
          const d1 = createCanvas(tw, safeH);
          const c1 = d1.getContext("2d");
          c1.drawImage(await (await import("@napi-rs/canvas")).loadImage(pdfShot.png), 0, 0, tw, safeH);
          const d2 = createCanvas(tw, safeH);
          const c2 = d2.getContext("2d");
          c2.drawImage(await (await import("@napi-rs/canvas")).loadImage(prevShot), 0, 0, tw, safeH);
          const diffCanvas = createCanvas(tw, safeH);
          const diffCtx = diffCanvas.getContext("2d");
          const diffPixels = diffCtx.createImageData(tw, safeH);
          const n = pixelmatch(c1.getImageData(0, 0, tw, safeH).data, c2.getImageData(0, 0, tw, safeH).data, diffPixels.data, tw, safeH, { threshold: 0.25 });
          diffCtx.putImageData(diffPixels, 0, 0);

          writeFileSync(join(OUT, `${tpl.id}-page-${i + 1}-docx.png`), await pdfShot.png);
          writeFileSync(join(OUT, `${tpl.id}-page-${i + 1}-preview.png`), prevShot);
          writeFileSync(join(OUT, `${tpl.id}-page-${i + 1}-diff.png`), await diffCanvas.encode("png"));
          screenshots.push({
            page: i + 1,
            docx: `preview-diff/${tpl.id}-page-${i + 1}-docx.png`,
            preview: `preview-diff/${tpl.id}-page-${i + 1}-preview.png`,
            diff: `preview-diff/${tpl.id}-page-${i + 1}-diff.png`,
            diffRatio: Number((n / (tw * safeH)).toFixed(3)),
          });
        }
        entry.screenshots = screenshots;

        // 6) Gate do template
        const similarityOk = similarity >= 0.65;
        const pageDeltaOk = pageDelta <= 3;
        entry.status = similarityOk && pageDeltaOk ? "passed" : "failed";
        entry.passed = similarityOk && pageDeltaOk;
        if (!similarityOk) tplFailures.push(`${tpl.id}: similaridade ${similarity.toFixed(3)} < 0.65`);
        if (!pageDeltaOk) tplFailures.push(`${tpl.id}: Δpáginas ${pageDelta} > 3 (preview ${previewPages.length} vs PDF ${pdfTexts.length})`);
        if (entry.passed) overall.passedTemplates += 1;
        console.log(`${tpl.id}: ${entry.passed ? "passed" : "FAILED"} (sim ${similarity.toFixed(3)}, Δpágs ${pageDelta}, best-match médio ${(perPage.length ? perPage.reduce((s: number, p: { bestMatchOverlap: number }) => s + p.bestMatchOverlap, 0) / perPage.length : 0).toFixed(3)})`);
      } catch (err) {
        tplFailures.push(`${tpl.id}: ${err instanceof Error ? err.message : String(err)}`);
        entry.status = "failed";
        entry.passed = false;
        entry.error = err instanceof Error ? err.message : String(err);
      }
      failures.push(...tplFailures);
      (result.templates as Record<string, unknown>)[tpl.id] = entry;
    }

    result.status = failures.length === 0 ? "passed" : "failed";
    result.passed = failures.length === 0;
  } finally {
    await browser?.close().catch(() => {});
  }

  return { passed: failures.length === 0, failures, wordAvailable, result };
}

async function main(): Promise<void> {
  const { passed, failures, wordAvailable, result } = await runPreviewDocxCompare();
  writeFileSync(join(ROOT, "artifacts", "ufla-compliance", "preview-docx-diff.json"), JSON.stringify({ wordAvailable, ...result }, null, 2) + "\n", "utf8");
  const failedList = failures.length > 0 ? `\n  - ${failures.join("\n  - ")}` : "";
  const templates = Object.entries((result.templates as Record<string, unknown>) ?? {}).map(([id, e]) => `${id}:${(e as { passed: boolean }).passed ? "P" : "F"}`).join(" ");
  console.log(`Preview vs DOCX: ${passed ? "PASSED" : `FAILED${failedList}`} [${templates}]`);
  process.exit(passed ? 0 : 1);
}

if (basename(process.argv[1] ?? "") === "compare-preview-docx.ts") {
  void main();
}
