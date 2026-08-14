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

interface FootnoteDetectionReport {
  fixture: string;
  docxHasFootnotes: boolean;
  footnotesXmlText: string[];
  pdfPages: number;
  footerRegionElements: Array<{
    page: number;
    text: string;
    y0: number;
    y1: number;
    x0: number;
    x1: number;
    matchesFootnote: boolean;
    footnoteId: number | null;
  }>;
  detectedInPdf: boolean;
  status: "passed" | "failed" | "not-detected";
  issues: string[];
}

async function extractFootnotesFromDocx(docxPath: string): Promise<string[]> {
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const footnotesEntry = zip.file("word/footnotes.xml");
  if (!footnotesEntry) return [];
  
  const footnotesText = await footnotesEntry.async("string");
  const textMatches = footnotesText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  return textMatches
    .map(m => m.replace(/<[^>]+>/g, "").trim())
    .filter(t => t && !t.match(/^\d+$/));
}

async function analyzePdfFooter(pdfPath: string, footerThreshold: number = 0.85): Promise<Array<{
  page: number;
  text: string;
  y0: number;
  y1: number;
  x0: number;
  x1: number;
}>> {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const firstPage = await doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });
  const pageHeight = viewport.height;
  
  const footerElements: Array<{
    page: number;
    text: string;
    y0: number;
    y1: number;
    x0: number;
    x1: number;
  }> = [];
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    
    for (const item of textContent.items) {
      const tx = item.transform[4];
      const ty = item.transform[5];
      const w = item.width;
      const h = item.height;
      const text = (item.str || "").trim();
      
      if (!text) continue;
      
      const y0 = ty;
      const y1 = ty + h;
      
      // Check if element is in footer region (bottom 15% of page)
      if (y0 > pageHeight * footerThreshold) {
        footerElements.push({
          page: i,
          text,
          y0,
          y1,
          x0: tx,
          x1: tx + w
        });
      }
    }
  }
  
  return footerElements;
}

function matchFootnotesToPdf(
  footnotesText: string[],
  footerElements: Array<{ text: string; page: number; y0: number; y1: number }>
): Array<{ page: number; text: string; matchesFootnote: boolean; footnoteId: number | null }> {
  return footerElements.map(el => {
    const normalizedPdf = el.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let matchesFootnote = false;
    let footnoteId: number | null = null;
    
    for (let i = 0; i < footnotesText.length; i++) {
      const normalizedFootnote = footnotesText[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedPdf.includes(normalizedFootnote) || normalizedFootnote.includes(normalizedPdf)) {
        matchesFootnote = true;
        footnoteId = i + 1;
        break;
      }
    }
    
    return {
      page: el.page,
      text: el.text,
      matchesFootnote,
      footnoteId
    };
  });
}

async function analyzeFixture(name: string): Promise<FootnoteDetectionReport> {
  const docxPath = join(fixturesDir, `${name}.docx`);
  const pdfPath = join(renderedDir, `${name}.pdf`);
  
  const report: FootnoteDetectionReport = {
    fixture: name,
    docxHasFootnotes: false,
    footnotesXmlText: [],
    pdfPages: 0,
    footerRegionElements: [],
    detectedInPdf: false,
    status: "not-detected",
    issues: []
  };

  // Read DOCX
  if (!existsSync(docxPath)) {
    report.issues.push(`DOCX not found: ${docxPath}`);
    return report;
  }

  try {
    report.footnotesXmlText = await extractFootnotesFromDocx(docxPath);
    report.docxHasFootnotes = report.footnotesXmlText.length > 0;
  } catch (err) {
    report.issues.push(`Failed to read DOCX: ${err}`);
    return report;
  }

  // Check if PDF exists
  if (!existsSync(pdfPath)) {
    report.issues.push(`PDF not found: ${pdfPath}`);
    return report;
  }

  try {
    const footerElements = await analyzePdfFooter(pdfPath);
    const matchedElements = matchFootnotesToPdf(report.footnotesXmlText, footerElements);
    
    report.footerRegionElements = matchedElements.map(el => ({
      page: el.page,
      text: el.text,
      y0: footerElements.find(f => f.text === el.text)?.y0 || 0,
      y1: footerElements.find(f => f.text === el.text)?.y1 || 0,
      x0: footerElements.find(f => f.text === el.text)?.x0 || 0,
      x1: footerElements.find(f => f.text === el.text)?.x1 || 0,
      matchesFootnote: el.matchesFootnote,
      footnoteId: el.footnoteId
    }));
    
    report.detectedInPdf = matchedElements.some(el => el.matchesFootnote);
    report.status = report.detectedInPdf ? "passed" : "failed";
    
    if (!report.detectedInPdf && report.docxHasFootnotes) {
      report.issues.push("Footnotes in DOCX but not detected in PDF footer region");
    }
  } catch (err) {
    report.issues.push(`PDF analysis failed: ${err}`);
    report.status = "not-detected";
  }
  
  return report;
}

async function main() {
  const fixtures = [
    "fixture-monografia-anexo-referencias",
    "fixture-artigo-referencias-rodape",
    "fixture-projeto-notas"
  ];

  const reports: FootnoteDetectionReport[] = [];
  for (const fixture of fixtures) {
    const report = await analyzeFixture(fixture);
    reports.push(report);
    
    console.log(`${fixture}:`);
    console.log(`  DOCX has footnotes: ${report.docxHasFootnotes}`);
    console.log(`  Footnotes count: ${report.footnotesXmlText.length}`);
    console.log(`  PDF pages: ${report.pdfPages}`);
    console.log(`  Footer elements found: ${report.footerRegionElements.length}`);
    console.log(`  Detected in PDF: ${report.detectedInPdf}`);
    console.log(`  Status: ${report.status}`);
    if (report.issues.length > 0) {
      console.log(`  Issues: ${report.issues.join("; ")}`);
    }
  }

  mkdirSync(join(root, "artifacts", "ufla-compliance"), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(reports, null, 2));
  console.log(`\nReport saved to: ${outputPath}`);
}

main().catch(console.error);
