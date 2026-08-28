/**
 * Renderiza e analisa fisicamente os DOCX de exemplo do gate por tipo.
 *
 * Para cada DOCX em artifacts/ufla-compliance/per-type/:
 *  1. Renderiza PDF via Word COM (render-docx-to-pdf.ps1) — requer Word.
 *  2. Analisa o PDF: número de páginas, imagens embutidas (opList/CTM),
 *     tabelas (grade de colunas alinhadas) e numeração de página no canto
 *     superior direito (DECISION-010: primeiro valor visível = valor contado).
 *  3. Cruza com o OOXML (validatePagination): o que o Word renderiza deve
 *     coincidir com w:pgNumType w:start da seção textual.
 *
 * Uso: npx tsx scripts/ufla-compliance/analyze-per-type-pdfs.ts
 * Saída: artifacts/ufla-compliance/per-type-physical.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { validatePagination } from "./validate-pagination";
import { PER_TYPE_FIELDS } from "./per-type-fixtures";
import { PER_PRODUCTION_FIXTURES } from "./per-production-fixtures";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PER_TYPE_DIR = join(ROOT, "artifacts", "ufla-compliance", "per-type");
const PS_RENDER = join(__dirname, "render-docx-to-pdf.ps1");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(join(ROOT, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")).href;

const PAGE_W = 595.32;
const PAGE_H = 841.92;

function canUseWord(): boolean {
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "(Get-Command WINWORD.EXE -ErrorAction SilentlyContinue) -ne $null"], { stdio: "pipe", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

function renderPdf(docxPath: string, pdfPath: string): void {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS_RENDER, "-DocxPath", docxPath, "-PdfPath", pdfPath],
    { stdio: "pipe", timeout: 120000 },
  );
}

export interface CoverPhysical {
  /** Texto das linhas da página 1 (capa), em ordem de cima para baixo. */
  page1Lines: Array<{ text: string; y: number }>;
  /** Imagens detectadas na página 1 (logo da capa). */
  page1Images: number;
  /** A página 2 (folha de rosto) exibe número visível no canto superior direito? */
  pageTwoNumbered: boolean;
}

export interface CoverVerification {
  passed: boolean;
  institutional: boolean;
  author: boolean;
  title: boolean;
  localYear: boolean;
  ordered: boolean;
  logo: boolean;
  reasons: string[];
}

const normCover = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/**
 * A2: verifica a capa física (página 1) — institucional → autor → título →
 * local/ano, nessa ordem vertical, com o logo presente. Os textos esperados
 * vêm das fixtures por tipo (author/title) e o institucional é fixo da UFLA.
 */
export function verifyCoverPhysical(page1Lines: Array<{ text: string; y: number }>, page1Images: number, expected: { author: string; title: string }): CoverVerification {
  const reasons: string[] = [];
  const inst = page1Lines.find((l) => normCover(l.text).includes("UNIVERSIDADE FEDERAL DE LAVRAS"));
  const author = page1Lines.find((l) => normCover(l.text) === normCover(expected.author));
  const title = page1Lines.find((l) => normCover(l.text) === normCover(expected.title));
  // Local da capa: linha com "LAVRAS" que NÃO seja o institucional
  // ("UNIVERSIDADE FEDERAL DE LAVRAS" também contém a cidade).
  const local = page1Lines.find((l) => normCover(l.text).includes("LAVRAS") && !normCover(l.text).includes("UNIVERSIDADE FEDERAL"));
  const year = page1Lines.find((l) => /20\d\d/.test(l.text));
  const logo = page1Images >= 1;
  if (!inst) reasons.push("institucional ausente na capa");
  if (!author) reasons.push("autor ausente na capa");
  if (!title) reasons.push("título ausente na capa");
  if (!local || !year) reasons.push("local/ano ausentes na capa");
  if (!logo) reasons.push("logo (imagem) ausente na capa");
  // y = yTop (distância do topo da página, cresce para baixo): a ordem UFLA é
  // institucional (mais alto) → autor → título → local/ano (mais baixo).
  const hasAll = Boolean(inst && author && title && local && year);
  const ordered =
    hasAll &&
    inst!.y < author!.y &&
    author!.y < title!.y &&
    title!.y < local!.y &&
    local!.y < year!.y;
  if (!ordered && reasons.length === 0) reasons.push("ordem vertical incorreta (institucional → autor → título → local/ano)");
  return {
    passed: reasons.length === 0,
    institutional: Boolean(inst),
    author: Boolean(author),
    title: Boolean(title),
    localYear: Boolean(local && year),
    ordered,
    logo,
    reasons,
  };
}

/** Tipos com capa e folha de rosto físicas (A2/A3). */
export const COVER_TYPES = new Set(["tcc", "monografia", "dissertacao", "tese", "projeto_pesquisa"]);
/** Tipos com contagem contínua a partir da folha de rosto (A3: Introdução ≥ 2). */
export const COUNTED_TYPES = new Set(["tcc", "monografia", "dissertacao", "tese"]);

async function analyzePdf(pdfPath: string): Promise<{
  pages: number;
  images: number;
  tables: number;
  pageNumbers: number[];
  pageSize: { width: number; height: number } | null;
  landscapePages: number;
  /** Páginas com conteúdo invadindo a margem inferior (área do rodapé). */
  bottomMarginViolations: number[];
  /** Coordenadas do 1º número de página visível (cabeçalho corrente) — evidência de posição. */
  headerNumber: { page: number; value: number; x: number; yTop: number } | null;
  /** A2/A3: física da capa e da folha de rosto. */
  cover: CoverPhysical;
}> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
  const pageNumbers: number[] = [];
  let images = 0;
  let tableRegions = 0;
  let pageSize: { width: number; height: number } | null = null;
  let landscapePages = 0;
  const bottomMarginViolations: number[] = [];
  let headerNumber: { page: number; value: number; x: number; yTop: number } | null = null;
  let page1Images = 0;
  let page1Lines: Array<{ text: string; y: number }> = [];
  let pageTwoHasNumber = false;

  // Margem inferior ABNT = 2 cm = 56.7 pt. Conteúdo abaixo de (PAGE_H - 40) pt
  // (1.4 cm — folga de 0.6 cm para o que o Word renderiza perto da margem)
  // invade a área do rodapé: o cabeçalho corrente deve ser a ÚNICA coisa no
  // canto superior direito e a margem inferior deve ficar limpa (DECISION-010).
  const BOTTOM_MARGIN_PT = 40;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    if (!pageSize) pageSize = { width: vp.width, height: vp.height };
    // A4 paisagem: w/h trocados (841.92 × 595.32 pt) — validação física do gap P0.
    if (Math.abs(vp.width - 841.92) < 2 && Math.abs(vp.height - 595.32) < 2) landscapePages += 1;

    // Imagens: opList — contagem de ops paintImageXObject (técnica DECISION-009).
    const OPS = pdfjsLib.OPS;
    const ops = (await page.getOperatorList()).fnArray;
    const pageImageCount = ops.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject).length;
    images += pageImageCount;
    if (p === 1) page1Images = pageImageCount;

    // Texto: número de página (canto superior direito) + grade de colunas p/ tabelas.
    const tc = await page.getTextContent();
    const items = (tc.items as Array<{ str: string; transform: number[] }>).map((it) => ({
      t: it.str.trim(),
      x: it.transform[4],
      yTop: PAGE_H - it.transform[5],
    }));
    const nums = items.filter((it) => /^\d{1,3}$/.test(it.t) && it.yTop < 70 && it.x > PAGE_W * 0.7).map((it) => parseInt(it.t, 10));
    if (nums.length > 0) {
      pageNumbers.push(nums[0]);
      if (p === 2) pageTwoHasNumber = true;
      if (!headerNumber) {
        const first = items.find((it) => /^\d{1,3}$/.test(it.t) && it.yTop < 70 && it.x > PAGE_W * 0.7);
        if (first) headerNumber = { page: p, value: parseInt(first.t, 10), x: first.x, yTop: first.yTop };
      }
    }

    // A2: linhas da página 1 (capa) com posição vertical (yTop do topo p/ baixo).
    if (p === 1) {
      const lineMap = new Map<number, Array<{ text: string; y: number }>>();
      for (const it of items) {
        const key = Math.round(it.yTop / 4);
        if (!lineMap.has(key)) lineMap.set(key, []);
        lineMap.get(key)!.push({ text: it.t, y: it.yTop });
      }
      page1Lines = [...lineMap.values()]
        .map((arr) => ({ text: arr.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim(), y: Math.max(...arr.map((i) => i.y)) }))
        .filter((l) => l.text.length > 0);
    }

    // Margem inferior: qualquer item de texto abaixo da área útil = violação.
    const pageH = vp.height;
    const bottomOverflow = items.filter((it) => it.t && it.yTop > pageH - BOTTOM_MARGIN_PT);
    if (bottomOverflow.length > 0) bottomMarginViolations.push(p);

    // Tabelas: linhas com >= 2 colunas alinhadas persistentes (heurística compacta).
    const lines = new Map<number, number[]>();
    for (const it of items) {
      if (it.yTop < vp.height * 0.1 || it.yTop > vp.height * 0.9) continue;
      if (/^[\d.]+$/.test(it.t) && it.t.length <= 4 && it.yTop < 70) continue;
      const yKey = Math.round(it.yTop / 4);
      if (!lines.has(yKey)) lines.set(yKey, []);
      lines.get(yKey)!.push(Math.round(it.x / 4) * 4);
    }
    const colFreq = new Map<number, number>();
    for (const cols of lines.values()) {
      if (cols.length < 2) continue;
      for (const c of new Set(cols)) colFreq.set(c, (colFreq.get(c) ?? 0) + 1);
    }
    const persistent = [...colFreq.entries()].filter(([, f]) => f >= 3);
    const persistentCols = persistent.map(([c]) => c);
    // Margem esquerda = coluna persistente mais frequente; as demais são colunas de tabela.
    let margin = -1;
    if (persistent.length > 0) {
      margin = [...persistent].sort((a, b) => b[1] - a[1])[0][0];
    }
    const nonMarginCols = persistentCols.filter((c) => c !== margin);
    const rowsWith2Cols = [...lines.values()].filter((cols) => new Set(cols).size >= 2 && [...new Set(cols)].filter((c) => nonMarginCols.includes(c)).length >= 1).length;
    if (nonMarginCols.length >= 2 && rowsWith2Cols >= 3) tableRegions += 1;
  }

  return {
    pages: doc.numPages,
    images,
    tables: tableRegions,
    pageNumbers,
    pageSize,
    landscapePages,
    bottomMarginViolations,
    headerNumber,
    cover: {
      page1Lines,
      page1Images,
      // A3: a folha de rosto (página 2) NÃO pode exibir número no cabeçalho corrente.
      pageTwoNumbered: pageTwoHasNumber,
    },
  };
}

export async function runPerTypePhysical(): Promise<{ rendered: Record<string, unknown>; passed: boolean; failures: string[]; wordAvailable: boolean }> {
  const rendered: Record<string, unknown> = {};
  const failures: string[] = [];
  const wordAvailable = canUseWord();

  if (!existsSync(PER_TYPE_DIR)) {
    return { rendered, passed: false, failures: ["Diretório per-type não encontrado — rode ci-checks/run-gate-per-type antes."], wordAvailable };
  }

  const docxes = readdirSync(PER_TYPE_DIR).filter((f) => f.endsWith(".docx"));

  // Cada render abre sua PRÓPRIA instância do Word COM (render-docx-to-pdf.ps1
  // cria/derruba o WINWORD por chamada), então os renders podem rodar em
  // paralelo com um pool de concorrência — corta minutos por auditoria.
  const processDocx = async (file: string): Promise<[string, Record<string, unknown>]> => {
    const docxPath = join(PER_TYPE_DIR, file);
    const pdfPath = join(PER_TYPE_DIR, file.replace(/\.docx$/, ".pdf"));
    const entry: Record<string, unknown> = { docx: file };
    try {
      if (!wordAvailable) {
        entry.status = "skipped-no-word";
      } else {
        renderPdf(docxPath, pdfPath);
        if (!existsSync(pdfPath)) throw new Error("PDF não criado");
        const physical = await analyzePdf(pdfPath);
        entry.pdf = file.replace(/\.docx$/, ".pdf");
        entry.pages = physical.pages;
        entry.imagesDetected = physical.images;
        entry.tablesDetected = physical.tables;
        entry.landscapePages = physical.landscapePages;
        // Cabeçalho corrente (DECISION-010): posição exata do 1º número visível
        // (canto superior direito, yTop < 70 pt) + margem inferior limpa.
        entry.headerNumber = physical.headerNumber;
        entry.bottomMarginViolations = physical.bottomMarginViolations;
        if (physical.bottomMarginViolations.length > 0) {
          failures.push(`${file}: conteúdo na margem inferior (área do rodapé) nas páginas ${physical.bottomMarginViolations.join(", ")} — yTop > altura - 40pt`);
        }

        // A2/A3: física da capa e da folha de rosto por tipo (tipos com parte
        // pré-textual — tcc/monografia/dissertação/tese/projeto). As ASSERÇÕES
        // ficam após o cálculo da paginação (dependem de firstVisibleValue).
        const entryType = entryTypeFor(file);
        entry.cover = {
          page1Lines: physical.cover.page1Lines,
          page1Images: physical.cover.page1Images,
          pageTwoNumbered: physical.cover.pageTwoNumbered,
        };
        // Papel A4 (595.32 × 841.92 pt) ou A4 paisagem (841.92 × 595.32 pt) —
        // checagem física real do layout; toda página deve ser A4 em qualquer
        // orientação (gap P0: tabela larga → seção paisagem).
        const ps = physical.pageSize;
        entry.pageSize = ps;
        const a4Portrait = ps && Math.abs(ps.width - 595.32) < 2 && Math.abs(ps.height - 841.92) < 2;
        const a4Landscape = ps && Math.abs(ps.width - 841.92) < 2 && Math.abs(ps.height - 595.32) < 2;
        if (ps && !a4Portrait && !a4Landscape) failures.push(`${file}: papel ${ps.width.toFixed(1)}×${ps.height.toFixed(1)}pt ≠ A4 (retrato ou paisagem)`);
        // Alinhamento OOXML ↔ PDF (DECISION-010)
        const pagination = await validatePagination(docxPath, pdfPath, entryTypeFor(file));
        entry.pagination = {
          passed: pagination.isValid,
          declaredStart: pagination.declaredStart,
          firstVisiblePage: pagination.firstVisiblePage,
          firstVisibleValue: pagination.firstVisibleValue,
          errors: pagination.errors,
        };
        if (physical.pages === 0) failures.push(`${file}: PDF sem páginas`);
        if (!pagination.isValid) failures.push(`${file}: paginação — ${pagination.errors.join("; ")}`);

        // A2: capa física (institucional → autor → título → local/ano + logo).
        if (entryType && COVER_TYPES.has(entryType)) {
          const cover = verifyCoverPhysical(physical.cover.page1Lines, physical.cover.page1Images, fixtureFieldsFor(file));
          (entry.cover as { verified?: boolean }).verified = cover.passed;
          if (!cover.passed) {
            failures.push(`${file}: capa física (A2) — ${cover.reasons.join("; ")}`);
          }
        }
        // A3: folha de rosto sem número visível + Introdução com o valor contado.
        if (entryType && COVER_TYPES.has(entryType) && physical.cover.pageTwoNumbered) {
          failures.push(`${file}: folha de rosto (página 2) exibe número visível (A3/DECISION-010)`);
        }
        if (
          entryType &&
          COUNTED_TYPES.has(entryType) &&
          pagination.firstVisibleValue !== undefined &&
          pagination.firstVisibleValue < 2
        ) {
          failures.push(`${file}: Introdução deve exibir o valor contado (≥ 2); exibe ${pagination.firstVisibleValue} (A3/DECISION-010)`);
        }
        entry.status = "passed";
      }
    } catch (err) {
      entry.status = "failed";
      entry.error = err instanceof Error ? err.message : String(err);
      failures.push(`${file}: ${entry.error}`);
    }
    console.log(`${file}: ${entry.status}${entry.pages ? ` (${entry.pages} págs, ${entry.imagesDetected} imagens, ${entry.tablesDetected} tabelas, ${entry.pagination ? "pag OK" : "pag -"})` : ""}`);
    return [file, entry];
  };

  const CONCURRENCY = 3; // Word COM: 3 instâncias paralelas é seguro e acelera ~3× o render
  const queue = [...docxes];
  const workers = Array.from({ length: Math.min(CONCURRENCY, docxes.length) }, async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const [name, entry] = await processDocx(file);
      rendered[name] = entry;
    }
  });
  await Promise.all(workers);

  return { rendered, passed: failures.length === 0, failures, wordAvailable };
}

export function entryTypeFor(file: string): string | undefined {
  const base = basename(file, ".docx");
  if (base === "artigo" || base === "artigo_cientifico_ufla" || base.endsWith("_ufla")) return "artigo";
  if (base === "tcc") return "tcc";
  if (base === "monografia-draft") return "monografia";
  if (base === "dissertacao-draft") return "dissertacao";
  if (base === "tese-draft") return "tese";
  if (base === "resumo-expandido-cpg") return "resumo_expandido_cpg";
  if (base === "projeto-pesquisa") return "projeto_pesquisa";
  return undefined;
}

/** Campos esperados (author/title) da fixture do DOCX por arquivo (A2). */
export function fixtureFieldsFor(file: string): { author: string; title: string } {
  const base = basename(file, ".docx");
  const keyMap: Record<string, string> = {
    artigo: "artigo",
    tcc: "tcc",
    "monografia-draft": "monografia_draft",
    "dissertacao-draft": "dissertacao_draft",
    "tese-draft": "tese_draft",
    "resumo-expandido-cpg": "resumo_expandido_cpg",
    "projeto-pesquisa": "projeto_pesquisa",
  };
  const key = keyMap[base] ?? base;
  const direct = PER_TYPE_FIELDS[key as keyof typeof PER_TYPE_FIELDS];
  if (direct) return { author: direct.author, title: direct.title };
  const prod = PER_PRODUCTION_FIXTURES.find((f) => f.def.id === base);
  if (prod) return { author: prod.fields.author, title: prod.fields.title };
  return { author: "", title: "" };
}

async function main(): Promise<void> {
  const result = await runPerTypePhysical();
  const out = join(ROOT, "artifacts", "ufla-compliance", "per-type-physical.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: "ufla-audit/per-type-physical/v1", generatedAt: new Date().toISOString(), ...result }, null, 2) + "\n", "utf8");
  const failedList = result.failures.length > 0 ? `\n  - ${result.failures.join("\n  - ")}` : "";
  console.log(`\nWord: ${result.wordAvailable ? "disponível" : "INDISPONÍVEL (skipped)"} | Per-type física: ${result.passed ? "PASSED" : `FAILED${failedList}`}`);
  process.exit(result.passed ? 0 : 1);
}

if (process.argv[1] && basename(process.argv[1]) === "analyze-per-type-pdfs.ts") {
  void main();
}
