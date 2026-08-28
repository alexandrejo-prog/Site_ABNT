/**
 * A5 (checklist-15): números do SUMÁRIO coerentes com as páginas reais no PDF.
 *
 * O DOCX usa campos TOC/PAGEREF — o Word recalcula ao abrir/renderizar. Este
 * checker cruza TRÊS fontes:
 *   1. os HEADINGS reais do DOCX (ufla_titulo_primario / _secundario /
 *      _sem_indicativo) — lista autoritativa de seções;
 *   2. as entradas do SUMÁRIO no PDF renderizado (título ... N, por linha,
 *      agrupando itens por coordenada y);
 *   3. a página física de cada seção (topo da página, banda 0.70–0.90 da
 *      altura) e o número IMPRESSO no rodapé (y > 0.90 da altura).
 *
 * Para cada heading do DOCX que aparece no sumário: verifica número do TOC ==
 * número impresso na página real (tolerância 0), com busca SEQUENCIAL (a
 * página da seção i está na/ após a da seção i-1 — reduz falso-positivo de
 * títulos repetidos). Entradas pré-textuais (ficha/listas/sumário) são
 * isentas (número impresso não exigido por padrão — DECISION-010).
 *
 * Sem PDF/DOCX do Word → skipped-no-word (gate passed), consistente com os
 * demais gates físicos.
 *
 *   npx tsx scripts/ufla-compliance/toc-page-consistency.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import AdmZip from "adm-zip";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..", "..");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(ROOT, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
).href;

const DOCX = join(ROOT, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const PDF = join(ROOT, "artifacts", "ufla-compliance", "rendered", "normalized-dissertacao.pdf");

export interface TocEntry {
  title: string;
  tocNumber: number | undefined;
  physicalPage: number | undefined;
  printedNumber: number | undefined;
  consistent: boolean | null;
  note: string;
}

export interface TocPageConsistencyResult {
  passed: boolean;
  wordAvailable: boolean;
  tocPages: number[];
  entries: TocEntry[];
  checked: number;
  failures: string[];
}

/** Mínimo de entradas com número comparado para o gate não ser vazio. */
const MIN_CHECKED = 8;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

interface LineItem {
  str: string;
  x: number;
  y: number;
}

async function extractItems(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<{ items: LineItem[]; pageHeight: number }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = (tc.items as Array<{ str?: string; transform?: number[] }>)
    .map((it) => ({
      str: it.str ?? "",
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
    }))
    .filter((it) => it.str.trim().length > 0);
  return { items, pageHeight: viewport.height };
}

function groupLines(items: LineItem[], tolerance = 3): Array<LineItem[]> {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<LineItem[]> = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - item.y) <= tolerance);
    if (line) line.push(item);
    else lines.push([item]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  return lines;
}

/** Linha de sumário: título + líder de pontos + número à direita. */
function parseTocLine(line: LineItem[]): { title: string; number: number } | undefined {
  const text = line.map((i) => i.str).join("");
  const trailing = text.match(/(\d{1,3})\s*$/);
  if (!trailing) return undefined;
  const number = Number(trailing[1]);
  if (number === 0) return undefined;
  const leaderIdx = text.lastIndexOf(".");
  if (leaderIdx < 0) return undefined;
  const title = text
    .slice(0, leaderIdx)
    .replace(/[.\s·•\u2022]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title || title.length < 3) return undefined;
  return { title, number };
}

async function extractTocEntries(pdf: pdfjsLib.PDFDocumentProxy): Promise<{ tocPages: number[]; entries: Array<{ title: string; number: number }> }> {
  const tocPages: number[] = [];
  const entries: Array<{ title: string; number: number }> = [];
  const total = pdf.numPages;
  // Âncora: página do SUMÁRIO (as listas também usam líder; o cabeçalho é a âncora).
  let start = -1;
  for (let p = 1; p <= total; p++) {
    const { items, pageHeight } = await extractItems(pdf, p);
    const topText = norm(items.filter((it) => it.y > pageHeight * 0.85).map((it) => it.str).join(" "));
    if (topText.includes("SUMARIO")) {
      start = p;
      break;
    }
  }
  if (start < 0) return { tocPages, entries };
  for (let p = start; p <= total; p++) {
    const { items } = await extractItems(pdf, p);
    const dotted = groupLines(items).map(parseTocLine).filter((e): e is { title: string; number: number } => Boolean(e));
    if (dotted.length === 0) break;
    tocPages.push(p);
    entries.push(...dotted);
  }
  const seen = new Set<string>();
  const unique: Array<{ title: string; number: number }> = [];
  for (const e of entries) {
    const key = norm(e.title);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }
  return { tocPages, entries: unique };
}

/** Headings do DOCX (estilos UFLA) em ordem de documento. */
function extractDocxHeadings(): Array<{ style: string; text: string }> {
  const zip = new AdmZip(readFileSync(DOCX));
  const documentXml = zip.readAsText("word/document.xml");
  const headings: Array<{ style: string; text: string }> = [];
  const re = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(documentXml)) !== null) {
    const style = m[1].match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1];
    if (style !== "ufla_titulo_primario" && style !== "ufla_titulo_secundario" && style !== "ufla_titulo_sem_indicativo") continue;
    const text = [...m[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((x) => x[1])
      .join("")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();
    if (text) headings.push({ style, text });
  }
  return headings;
}

/** Normaliza texto para comparação (sem acentos, maiúsculas, espaços colapsados). */
export const normalizeTocText = norm;

/** Contém o título como PALAVRAS inteiras (fronteiras de espaço) — evita
 * casar substrings (ex.: "RESOLVE" dentro de "RESOLVER"). */
export function lineContainsWords(lineText: string, needle: string): boolean {
  const line = norm(lineText);
  const need = norm(needle);
  if (!need) return false;
  if (line === need) return true;
  if (line.startsWith(need + " ")) return true;
  if (line.includes(" " + need + " ")) return true;
  if (line.endsWith(" " + need)) return true;
  return false;
}

/** Procura a página do heading (seções principais): a 1ª linha de conteúdo
 * (maior y abaixo do rodapé — headings UFLA começam na margem superior) deve
 * conter o título como palavras inteiras. Busca independente por heading (sem
 * janela sequencial — um falso-positivo não cascateia). */
async function findHeadingPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  needle: string,
  fromPage: number,
  totalPages: number,
): Promise<number | undefined> {
  for (let p = fromPage; p <= totalPages; p++) {
    const { items, pageHeight } = await extractItems(pdf, p);
    const contentLines = groupLines(items.filter((it) => it.y < pageHeight * 0.90));
    if (!contentLines.length) continue;
    // Primeira linha de conteúdo = a de maior y (pdfjs cresce para cima).
    const first = contentLines.reduce((a, b) => (a[0].y > b[0].y ? a : b));
    const firstText = norm(first.map((i) => i.str).join(" "));
    if (lineContainsWords(firstText, needle)) return p;
  }
  return undefined;
}

/** Número impresso no rodapé: item numérico isolado em y > 0.90 da altura. */
function printedNumberAt(items: LineItem[], pageHeight: number): number | undefined {
  const footerBand = items.filter((it) => it.y > pageHeight * 0.90);
  for (const it of [...footerBand].sort((a, b) => b.x - a.x)) {
    const t = it.str.trim();
    if (/^\d{1,3}$/.test(t)) return Number(t);
  }
  return undefined;
}

const PRE_TEXTUAL_RE = /^(FICHA|AGRADECIMENTOS|RESUMO|ABSTRACT|INDICADORES|IMPACT|LISTA|SUMARIO)\b/;

export async function checkTocPageConsistency(): Promise<TocPageConsistencyResult> {
  if (!existsSync(PDF) || !existsSync(DOCX)) {
    return {
      passed: true,
      wordAvailable: false,
      tocPages: [],
      entries: [],
      checked: 0,
      failures: ["PDF/DOCX do Word indisponível — gate saltado (skipped-no-word)."],
    };
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(readFileSync(PDF)) }).promise;
  const totalPages = pdf.numPages;
  const { tocPages, entries } = await extractTocEntries(pdf);

  // Mapa título-normalizado -> número do TOC (maior cobertura: o título do
  // heading do DOCX pode ser mais longo que a linha truncada do sumário).
  const tocByNorm = new Map<string, number>();
  for (const e of entries) {
    const key = norm(e.title);
    if (!tocByNorm.has(key)) tocByNorm.set(key, e.number);
  }
  const findTocNumber = (heading: string): number | undefined => {
    const h = norm(heading);
    if (tocByNorm.has(h)) return tocByNorm.get(h);
    // fallback: entrada do TOC contida no heading (linha truncada pelo líder).
    for (const [key, num] of tocByNorm) {
      if (key.length >= 6 && h.includes(key)) return num;
    }
    return undefined;
  };

  const afterPage = tocPages[tocPages.length - 1] ?? 1;
  // Dedup por texto normalizado (headings repetidos no DOCX geram entradas duplicadas).
  const seenHeading = new Set<string>();
  const docxHeadings = extractDocxHeadings().filter((h) => {
    const key = norm(h.text);
    if (seenHeading.has(key)) return false;
    seenHeading.add(key);
    return true;
  });

  const result: TocEntry[] = [];
  const failures: string[] = [];
  let checked = 0;

  for (const heading of docxHeadings) {
    // Apenas seções PRINCIPAIS (primárias + sem-indicativo): o critério A5 é
    // "seções principais"; secundárias repetem títulos e geram falso-positivo.
    if (heading.style === "ufla_titulo_secundario") continue;
    const tocNumber = findTocNumber(heading.text);
    if (tocNumber === undefined) continue; // heading sem entrada no sumário → não verificável aqui

    // Pré-textual (ficha/agradecimentos/resumo/listas/sumário): isento.
    if (PRE_TEXTUAL_RE.test(norm(heading.text))) {
      result.push({ title: heading.text, tocNumber, physicalPage: undefined, printedNumber: undefined, consistent: null, note: "pré-textual (número impresso não exigido por padrão)" });
      continue;
    }
    // Notas de rodapé estilizadas como primárias no baseline ("N DISPONÍVEL
    // EM:", URLs entre <>) — não são seções; a busca de página colide entre
    // notas vizinhas e geraria falso-positivo.
    const normalizedTitle = norm(heading.text);
    if (normalizedTitle.includes("<") || /(?:EM|EM:)$/.test(normalizedTitle)) {
      result.push({ title: heading.text, tocNumber, physicalPage: undefined, printedNumber: undefined, consistent: null, note: "nota de rodapé (não é seção) — não verificado" });
      continue;
    }

    const needle = norm(heading.text).split(" ").filter((w) => w.length >= 4).join(" ");
    if (!needle) {
      result.push({ title: heading.text, tocNumber, physicalPage: undefined, printedNumber: undefined, consistent: null, note: "título sem palavra significativa (não verificado)" });
      continue;
    }
    const physicalPage = await findHeadingPage(pdf, needle, afterPage + 1, totalPages);

    let printed: number | undefined;
    if (physicalPage !== undefined) {
      const { items, pageHeight } = await extractItems(pdf, physicalPage);
      printed = printedNumberAt(items, pageHeight);
    }

    let consistent: boolean | null = null;
    let note: string;
    if (physicalPage === undefined) {
      note = "heading não localizado no PDF (não verificado)";
    } else if (printed === undefined) {
      note = `página física ${physicalPage} sem número impresso (não verificado)`;
    } else if (printed !== tocNumber) {
      consistent = false;
      note = `página física ${physicalPage} imprime ${printed} (TOC=${tocNumber})`;
      failures.push(`Sumário "${heading.text.slice(0, 60)}": TOC=${tocNumber} ≠ página real ${printed} (física ${physicalPage}).`);
    } else {
      consistent = true;
      note = `página física ${physicalPage} imprime ${printed}`;
    }
    if (consistent !== null) checked++;
    result.push({
      title: heading.text,
      tocNumber,
      physicalPage,
      printedNumber: printed,
      consistent,
      note,
    });
  }

  if (checked < MIN_CHECKED) {
    failures.push(`apenas ${checked} entradas verificadas (mínimo ${MIN_CHECKED}) — verifique a extração do sumário.`);
  }

  return {
    passed: failures.length === 0,
    wordAvailable: true,
    tocPages,
    entries: result,
    checked,
    failures,
  };
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("toc-page-consistency.ts");
if (isDirectRun) {
  const result = await checkTocPageConsistency();
  console.log(`TOC pages: ${result.tocPages.join(", ")} | headings DOCX casados: ${result.entries.length} | verificadas: ${result.checked}`);
  for (const e of result.entries) {
    const status = e.consistent === true ? "OK" : e.consistent === false ? "MISMATCH" : "skip";
    console.log(`  [${status.padEnd(8)}] ${e.title.slice(0, 50).padEnd(52)} TOC=${e.tocNumber ?? "-"} phys=${e.physicalPage ?? "-"} print=${e.printedNumber ?? "-"} :: ${e.note}`);
  }
  console.log(result.passed ? "\nPASSED" : `\nFAILED (${result.failures.length})`);
  for (const f of result.failures) console.log("  -", f);
  process.exit(result.passed ? 0 : 1);
}
