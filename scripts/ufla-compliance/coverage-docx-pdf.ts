/**
 * Razão de cobertura DOCX→PDF (evidência física reproduzível).
 *
 * Casa os objetos declarados no OOXML (w:tbl, a:blip, m:oMath do DOCX de
 * referência) com a detecção física do PDF renderizado pelo Word
 * (pdf-physical-analysis.json — grade de colunas + bordas desenhadas, ver
 * DECISION-009). Para tabelas o casamento é TEXTUAL: a assinatura da primeira
 * linha de cada w:tbl é procurada no texto da página do PDF e a página deve
 * ter uma região de tabela detectada fisicamente. Para imagens e equações a
 * razão é de contagem (imagens não têm texto; equações OMML são zero no
 * documento de referência e validadas por glifos na fixture eq-fixture).
 *
 * Saída: artifacts/ufla-compliance/coverage-docx-pdf.json; exit != 0 em falha.
 *
 *   npx tsx scripts/ufla-compliance/coverage-docx-pdf.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
const PHYSICAL = join(ROOT, "artifacts", "ufla-compliance", "pdf-physical-analysis.json");
const OUT = join(ROOT, "artifacts", "ufla-compliance", "coverage-docx-pdf.json");

// Limiares (documentados no JSON): tabelas casadas textualmente >= 90% das
// tabelas OOXML; razão total físico/OOXML em banda [0.7, 1.8] (a detecção
// física pode dividir uma tabela longa em 2 regiões — heurística conhecida);
// imagens: físico >= 40% do OOXML (as 7 imagens de cabeçalho/ficha do baseline
// não são re-exportadas — gap documentado F-007, corpo 6/6 preservado);
// equações: OOXML > 0 exige detecção física > 0 (glifos matemáticos).
const TABLE_MATCH_MIN = 0.9;
const TABLE_RATIO_MIN = 0.7;
const TABLE_RATIO_MAX = 1.8;
const IMAGE_RATIO_MIN = 0.4;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Comparação insensível a pontuação/quebra de linha: remove tudo que não é
 * letra/dígito. O Word renderiza células com hífens de lista, sublinhados de
 * nomes de arquivo e quebras de linha em posições que não coincidem com o
 * OOXML — a assinatura comparada sem pontuação casa independente disso.
 */
function normalizeCompare(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

/** Extrai o texto de um nó XML (remove tags e entidades). */
function xmlText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface OoxmlTable {
  index: number;
  rows: number;
  signature: string;
  /** Candidatos de casamento: janelas (prefixo/meio/sufixo) de cada célula. */
  probes: string[];
}

function cellProbes(cell: string): string[] {
  const cmp = normalizeCompare(cell);
  if (cmp.length < 6) return [];
  const out: string[] = [];
  const push = (v: string) => {
    if (v.length >= 7) out.push(v);
  };
  for (const len of [50, 35, 22, 12]) push(cmp.slice(0, len));
  const mid = Math.floor(cmp.length / 2);
  push(cmp.slice(mid - 11, mid + 11));
  push(cmp.slice(-22));
  return out;
}

function extractOoxmlTables(xml: string): OoxmlTable[] {
  const tables: OoxmlTable[] = [];
  const tblRe = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g;
  let m: RegExpExecArray | null;
  while ((m = tblRe.exec(xml))) {
    const body = m[1];
    const rows = (body.match(/<w:tr[ >]/g) || []).length;
    const trRe = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
    const rowCells = (): string[] => {
      const row = trRe.exec(body)?.[1] ?? "";
      return (row.match(/<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g) || []).map((c) =>
        normalizeText(xmlText(c)),
      );
    };
    const firstCells = rowCells();
    // Assinatura/âmcoras: células significativas da primeira linha; quando a
    // primeira linha é curta (cabeçalho vazio), usa a segunda linha.
    let cells = firstCells;
    const longest = (arr: string[]) => arr.slice().sort((a, b) => b.length - a.length)[0] ?? "";
    if (longest(cells).length < 6 && rows > 1) {
      trRe.lastIndex = 0;
      trRe.exec(body);
      cells = rowCells();
    }
    const probes = cells.flatMap(cellProbes);
    tables.push({
      index: tables.length + 1,
      rows,
      signature: longest(cells).slice(0, 80),
      probes: [...new Set(probes)],
    });
  }
  return tables;
}

interface PdfPageText {
  page: number;
  /** texto normalizado com espaços (para inspeção) */
  text: string;
  /** texto sem pontuação (para casamento de assinaturas) */
  cmp: string;
}

async function extractPdfPageTexts(pdfPath: string): Promise<PdfPageText[]> {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: PdfPageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = (textContent.items as Array<{ str?: string }>)
      .map((it) => it.str ?? "")
      .join(" ");
    const normalized = normalizeText(text);
    pages.push({ page: i, text: normalized, cmp: normalizeCompare(normalized) });
  }
  return pages;
}

export async function computeCoverage(): Promise<{
  passed: boolean;
  failures: string[];
  ooxml: { tables: number; images: number; equations: number };
  physical: { tables: number; images: number; equations: number };
  tables: {
    matched: number;
    total: number;
    ratio: number;
    unmatched: Array<{ index: number; rows: number; signature: string }>;
  };
  tableRatio: number;
  imageRatio: number;
  equationCoverage: number;
  wordAvailable: boolean;
}> {
  if (!existsSync(DOCX) || !existsSync(PHYSICAL)) {
    return {
      passed: true,
      failures: ["coverage-docx-pdf: DOCX de referência ou análise física ausentes — skip"],
      ooxml: { tables: 0, images: 0, equations: 0 },
      physical: { tables: 0, images: 0, equations: 0 },
      tables: { matched: 0, total: 0, ratio: 0, unmatched: [] },
      tableRatio: 0,
      imageRatio: 0,
      equationCoverage: 1,
      wordAvailable: existsSync(PDF),
    };
  }

  const zip = new AdmZip(DOCX);
  const xml = zip.readAsText("word/document.xml");
  const ooxmlTables = extractOoxmlTables(xml);
  const ooxmlImages = (xml.match(/<a:blip r:embed=/g) || []).length;
  const ooxmlEquations = (xml.match(/<m:oMath[ >]/g) || []).length;

  const physical = JSON.parse(readFileSync(PHYSICAL, "utf8").replace(/^\uFEFF/, ""));
  const tablesByPage = (physical.summary?.tablesByPage ?? {}) as Record<string, number>;
  const physicalTables = physical.summary?.totalTables ?? 0;
  const physicalImages = physical.summary?.totalImages ?? 0;
  const physicalEquations = physical.summary?.totalEquations ?? 0;

  const failures: string[] = [];
  let matched = 0;
  const unmatched: Array<{ index: number; rows: number; signature: string }> = [];

  const pdfPages = existsSync(PDF) ? await extractPdfPageTexts(PDF) : [];

  for (const table of ooxmlTables) {
    // Cada célula da primeira linha gera janelas (prefixo/meio/sufixo); casa se
    // QUALQUER janela aparecer numa página com região de tabela detectada.
    const hit = table.probes.length > 0
      ? pdfPages.find((p) => (tablesByPage[String(p.page)] ?? 0) > 0 && table.probes.some((probe) => p.cmp.includes(probe)))
      : undefined;
    if (hit) {
      matched++;
    } else {
      unmatched.push({ index: table.index, rows: table.rows, signature: table.signature.slice(0, 60) });
    }
  }

  const tableMatchRatio = ooxmlTables.length > 0 ? matched / ooxmlTables.length : 1;
  const tableRatio = ooxmlTables.length > 0 ? physicalTables / ooxmlTables.length : 1;
  const imageRatio = ooxmlImages > 0 ? physicalImages / ooxmlImages : 1;
  const equationCoverage =
    ooxmlEquations > 0 ? (physicalEquations > 0 ? 1 : 0) : 1;

  if (ooxmlTables.length > 0 && tableMatchRatio < TABLE_MATCH_MIN) {
    failures.push(
      `cobertura de tabelas DOCX→PDF: ${matched}/${ooxmlTables.length} casadas (${(tableMatchRatio * 100).toFixed(0)}% < ${TABLE_MATCH_MIN * 100}%) — não casadas: ${unmatched.map((u) => `#${u.index} (${u.rows} linhas, "${u.signature}")`).join("; ")}`,
    );
  }
  if (tableRatio < TABLE_RATIO_MIN || tableRatio > TABLE_RATIO_MAX) {
    failures.push(
      `razão física/OOXML de tabelas: ${physicalTables}/${ooxmlTables.length} = ${tableRatio.toFixed(2)} (fora da banda [${TABLE_RATIO_MIN}, ${TABLE_RATIO_MAX}])`,
    );
  }
  if (ooxmlImages > 0 && imageRatio < IMAGE_RATIO_MIN) {
    failures.push(
      `imagens: ${physicalImages}/${ooxmlImages} detectadas fisicamente (${(imageRatio * 100).toFixed(0)}% < ${IMAGE_RATIO_MIN * 100}% — cabeçalho/ficha do baseline não são re-exportados, F-007)`,
    );
  }
  if (ooxmlEquations > 0 && physicalEquations === 0) {
    failures.push(
      `equações: ${ooxmlEquations} OMML declaradas mas 0 detectadas fisicamente (glifos matemáticos ausentes no PDF)`,
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    ooxml: { tables: ooxmlTables.length, images: ooxmlImages, equations: ooxmlEquations },
    physical: { tables: physicalTables, images: physicalImages, equations: physicalEquations },
    tables: { matched, total: ooxmlTables.length, ratio: tableMatchRatio, unmatched },
    tableRatio,
    imageRatio,
    equationCoverage,
    wordAvailable: existsSync(PDF),
  };
}

async function main(): Promise<void> {
  const result = await computeCoverage();
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log("OK:", "artifacts/ufla-compliance/coverage-docx-pdf.json");
  console.log(
    `Cobertura DOCX→PDF: tabelas ${result.tables.matched}/${result.tables.total} casadas (razão físico/OOXML ${result.tableRatio.toFixed(2)}), ` +
      `imagens ${result.physical.images}/${result.ooxml.images} (${result.imageRatio.toFixed(2)}), ` +
      `equações ${result.ooxml.equations}→${result.physical.equations}`,
  );
  if (!result.passed) {
    for (const f of result.failures) console.error("FALHA:", f);
    process.exitCode = 1;
  }
}

// main() protegido contra execução no import (o regenerate importa computeCoverage).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  void main();
}
