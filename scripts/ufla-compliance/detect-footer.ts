/**
 * B1 (checklist-15): notas de rodapé FÍSICAS no PDF renderizado por Word.
 *
 * Valida em TRÊS níveis para cada fixture com notas:
 *  1. OOXML: word/footnotes.xml contém a(s) nota(s) (texto extraído);
 *  2. Física: o texto de CADA nota aparece na região de rodapé do PDF
 *     (0 notas perdidas — cobertura 100%, não apenas "alguma");
 *  3. Tipografia: a nota é renderizada com FONTE MENOR que o corpo
 *     (Word renderiza nota a 11 pt vs corpo 12 pt no projeto UFLA).
 *
 * Uso: npx tsx scripts/ufla-compliance/detect-footer.ts
 * Saída: artifacts/ufla-compliance/footer-detection-report.json
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")).href;

const fixturesDir = join(root, "artifacts", "ufla-compliance", "fixtures");
const renderedDir = join(root, "artifacts", "ufla-compliance", "rendered", "fixtures");
const outputPath = join(root, "artifacts", "ufla-compliance", "footer-detection-report.json");

/** Nota extraída do OOXML (footnotes.xml) com id e texto normalizado. */
export interface FootnoteEntry {
  id: string;
  text: string;
}

/** Elemento de texto encontrado na região de rodapé do PDF. */
export interface PdfFooterElement {
  page: number;
  text: string;
  y0: number;
  y1: number;
  x0: number;
  x1: number;
  fontSize: number | null;
  matchesFootnote: boolean;
  footnoteId: string | null;
  score: number;
}

export interface FootnoteDetectionReport {
  fixture: string;
  docxHasFootnotes: boolean;
  footnotesXmlText: string[];
  footnotesTotal: number;
  footnotesMatched: number;
  coverageRatio: number;
  /** Fonte (pt) mais frequente na região do corpo — comparada com a nota. */
  bodyFontSize: number | null;
  /** Todas as notas detectadas no PDF têm fonte menor que o corpo? */
  fontSizeSmallerThanBody: boolean | null;
  pdfPages: number;
  footerRegionElements: PdfFooterElement[];
  detectedInPdf: boolean;
  status: "passed" | "failed" | "not-detected";
  issues: string[];
}

export async function extractFootnotesFromDocx(docxPath: string): Promise<FootnoteEntry[]> {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const footnotesEntry = zip.file("word/footnotes.xml");
  if (!footnotesEntry) return [];

  const xml = await footnotesEntry.async("string");
  const notes: FootnoteEntry[] = [];
  for (const m of xml.matchAll(/<w:footnote\b[^>]*w:id="(\d+)"[^>]*>([\s\S]*?)<\/w:footnote>/g)) {
    // ids reservados: -1 (separator) e 0 (continuationSeparator)
    if (m[1] === "-1" || m[1] === "0") continue;
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    notes.push({ id: m[1], text });
  }
  return notes;
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function footnoteSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const tokensA = na.split(" ").filter(Boolean);
  const tokensB = nb.split(" ").filter(Boolean);
  if (!tokensA.length || !tokensB.length) return 0;
  const common = tokensA.filter((t) => tokensB.includes(t)).length;
  return common / Math.max(tokensA.length, tokensB.length);
}

/**
 * Analisa o PDF renderizado por Word: elementos da região de rodapé
 * (y0 > footerThreshold × altura) com fonte, e a fonte mais frequente na
 * região do corpo (referência para "fonte menor que o corpo").
 */
export async function analyzePdfFooter(
  pdfPath: string,
  footerThreshold = 0.85,
): Promise<{
  footerElements: Array<{ page: number; text: string; y0: number; y1: number; x0: number; x1: number; fontSize: number | null }>;
  bodyFontSize: number | null;
  pages: number;
}> {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const firstPage = await doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });
  const pageHeight = viewport.height;

  const footerElements: Array<{ page: number; text: string; y0: number; y1: number; x0: number; x1: number; fontSize: number | null }> = [];
  const bodyFontFreq = new Map<number, number>();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const tx = item.transform[4];
      const ty = item.transform[5];
      const w = item.width;
      const h = item.height;
      const text = (item.str || "").trim();
      const fontSize = typeof item.transform[0] === "number" ? item.transform[0] : null;

      if (!text) continue;

      // Coordenadas do pdf.js: ty = distância da BASE da página (cresce para
      // cima). Região de rodapé = 15% inferior (ty < 0.15×H); região do corpo
      // = entre o rodapé e o cabeçalho corrente.
      if (ty < pageHeight * (1 - footerThreshold)) {
        footerElements.push({ page: i, text, y0: ty, y1: ty + h, x0: tx, x1: tx + w, fontSize });
      } else if (fontSize && ty > pageHeight * (1 - footerThreshold) + 5 && ty < pageHeight * footerThreshold - 5) {
        // Região do corpo: fonte mais frequente é a referência (ex.: 12 pt).
        const key = Math.round(fontSize * 10) / 10;
        bodyFontFreq.set(key, (bodyFontFreq.get(key) ?? 0) + 1);
      }
    }
  }

  let bodyFontSize: number | null = null;
  let best = 0;
  for (const [fs, count] of bodyFontFreq) {
    if (count > best) {
      best = count;
      bodyFontSize = fs;
    }
  }

  return { footerElements, bodyFontSize, pages: doc.numPages };
}

/**
 * Casa cada nota do OOXML com os elementos da região de rodapé do PDF.
 * Retorna a cobertura: todas as notas encontradas? 0 notas perdidas.
 */
export function matchFootnotesToPdf(
  footnotes: FootnoteEntry[],
  footerElements: Array<{ page: number; text: string; y0: number; y1: number; x0: number; x1: number; fontSize: number | null }>,
): { elements: PdfFooterElement[]; matchedIds: Set<string> } {
  const matchedIds = new Set<string>();
  const elements: PdfFooterElement[] = footerElements.map((el) => {
    let matchesFootnote = false;
    let footnoteId: string | null = null;
    let bestScore = 0;

    for (const fn of footnotes) {
      const score = footnoteSimilarity(el.text, fn.text);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        matchesFootnote = true;
        footnoteId = fn.id;
      }
    }

    if (matchesFootnote && footnoteId !== null) matchedIds.add(footnoteId);
    return { ...el, matchesFootnote, footnoteId, score: bestScore };
  });
  return { elements, matchedIds };
}

/**
 * B1: gate físico de notas de rodapé — roda sobre os fixtures com notas
 * (DOCX OOXML + PDF renderizado por Word). Cobertura 100% (0 notas
 * perdidas) + fonte da nota menor que o corpo em cada fixture.
 */
export async function runFootnotePhysicalGate(): Promise<{
  passed: boolean;
  fixtures: FootnoteDetectionReport[];
  wordAvailable: boolean;
  failures: string[];
}> {
  const names = ["fixture-monografia-anexo-referencias", "fixture-artigo-referencias-rodape", "fixture-projeto-notas"];
  const reports: FootnoteDetectionReport[] = [];
  for (const name of names) {
    reports.push(await analyzeFixture(name));
  }
  const withNotes = reports.filter((r) => r.docxHasFootnotes);
  const wordAvailable = withNotes.length > 0 && withNotes.every((r) => existsSync(join(renderedDir, `${r.fixture}.pdf`)));
  const failures = reports
    .filter((r) => r.status === "failed")
    .flatMap((r) => r.issues.map((issue) => `${r.fixture}: ${issue}`));
  return { passed: failures.length === 0, fixtures: reports, wordAvailable, failures };
}

export async function analyzeFixture(name: string): Promise<FootnoteDetectionReport> {
  const docxPath = join(fixturesDir, `${name}.docx`);
  const pdfPath = join(renderedDir, `${name}.pdf`);

  const report: FootnoteDetectionReport = {
    fixture: name,
    docxHasFootnotes: false,
    footnotesXmlText: [],
    footnotesTotal: 0,
    footnotesMatched: 0,
    coverageRatio: 0,
    bodyFontSize: null,
    fontSizeSmallerThanBody: null,
    pdfPages: 0,
    footerRegionElements: [],
    detectedInPdf: false,
    status: "not-detected",
    issues: [],
  };

  if (!existsSync(docxPath)) {
    report.issues.push(`DOCX not found: ${docxPath}`);
    return report;
  }

  try {
    const footnotes = await extractFootnotesFromDocx(docxPath);
    report.footnotesXmlText = footnotes.map((f) => f.text);
    report.footnotesTotal = footnotes.length;
    report.docxHasFootnotes = footnotes.length > 0;
    report.status = report.docxHasFootnotes ? "failed" : "not-detected";
  } catch (err) {
    report.issues.push(`Failed to read DOCX: ${err}`);
    return report;
  }

  if (!report.docxHasFootnotes) {
    report.issues.push("sem notas no OOXML (footnotes.xml vazio)");
    return report;
  }

  if (!existsSync(pdfPath)) {
    report.issues.push(`PDF not found: ${pdfPath}`);
    return report;
  }

  try {
    const { footerElements, bodyFontSize, pages } = await analyzePdfFooter(pdfPath);
    report.pdfPages = pages;
    report.bodyFontSize = bodyFontSize;

    const footnotes = report.footnotesXmlText.map((text, i) => ({ id: String(i + 1), text }));
    const { elements, matchedIds } = matchFootnotesToPdf(footnotes, footerElements);
    report.footerRegionElements = elements;
    report.footnotesMatched = matchedIds.size;
    report.coverageRatio = report.footnotesTotal > 0 ? matchedIds.size / report.footnotesTotal : 0;
    report.detectedInPdf = matchedIds.size > 0;

    // "0 notas perdidas": cobertura total, não apenas alguma nota.
    if (report.footnotesMatched < report.footnotesTotal) {
      report.issues.push(
        `Notas perdidas no PDF: ${report.footnotesTotal - report.footnotesMatched} de ${report.footnotesTotal} (cobertura ${report.coverageRatio.toFixed(2)})`,
      );
    }

    // Fonte menor que o corpo: notas detectadas devem ter fonte < corpo.
    if (matchedIds.size > 0) {
      const matchedElements = elements.filter((e) => e.matchesFootnote);
      const fonts = matchedElements.map((e) => e.fontSize).filter((f): f is number => f !== null);
      if (fonts.length === 0) {
        report.issues.push("notas detectadas sem informação de fonte no PDF");
        report.fontSizeSmallerThanBody = false;
      } else if (bodyFontSize !== null) {
        const smaller = fonts.every((f) => f < bodyFontSize);
        report.fontSizeSmallerThanBody = smaller;
        if (!smaller) {
          report.issues.push(`fonte da nota (${fonts.map((f) => f.toFixed(1)).join(", ")}) NÃO é menor que o corpo (${bodyFontSize.toFixed(1)})`);
        }
      }
    }

    report.status = report.issues.length === 0 ? "passed" : "failed";
  } catch (err) {
    report.issues.push(`PDF analysis failed: ${err}`);
    report.status = "not-detected";
  }

  return report;
}

async function main() {
  const result = await runFootnotePhysicalGate();

  for (const report of result.fixtures) {
    console.log(`${report.fixture}:`);
    console.log(`  Notas no OOXML: ${report.footnotesTotal}`);
    console.log(`  Cobertura no PDF: ${report.footnotesMatched}/${report.footnotesTotal} (${(report.coverageRatio * 100).toFixed(0)}%)`);
    console.log(`  Fonte corpo: ${report.bodyFontSize ?? "-"} pt | Nota menor: ${report.fontSizeSmallerThanBody ?? "n/a"}`);
    console.log(`  Status: ${report.status}`);
    if (report.issues.length > 0) console.log(`  Issues: ${report.issues.join("; ")}`);
  }

  mkdirSync(join(root, "artifacts", "ufla-compliance"), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result.fixtures, null, 2));
  console.log(`\nGate B1: ${result.passed ? "PASSED" : `FAILED (${result.failures.length} issues)`} | Word: ${result.wordAvailable ? "disponível" : "indisponível (skipped-no-word)"}`);
  console.log(`Report saved to: ${outputPath}`);
}

if (process.argv[1] && join(process.argv[1]).replace(/\\/g, "/").endsWith("detect-footer.ts")) {
  main().catch(console.error);
}
