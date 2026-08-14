import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..", "..");

const fixturesDir = join(root, "artifacts", "ufla-compliance", "fixtures");
const renderedDir = join(root, "artifacts", "ufla-compliance", "rendered", "fixtures");
const outputPath = join(root, "artifacts", "ufla-compliance", "footer-detection-report.json");

interface FootnoteDetectionReport {
  fixture: string;
  docxHasFootnotes: boolean;
  footnotesXmlText: string[];
  pdfHasFooterRegion: boolean;
  footerRegionElements: Array<{
    page: number;
    text: string;
    y0: number;
    y1: number;
    matchesFootnote: boolean;
  }>;
  detectedInPdf: boolean;
  status: "passed" | "failed" | "not-detected";
  issues: string[];
}

async function analyzeFixture(name: string): Promise<FootnoteDetectionReport> {
  const docxPath = join(fixturesDir, `${name}.docx`);
  const pdfPath = join(renderedDir, `${name}.pdf`);
  
  const report: FootnoteDetectionReport = {
    fixture: name,
    docxHasFootnotes: false,
    footnotesXmlText: [],
    pdfHasFooterRegion: false,
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

  const docxBuffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(docxBuffer);
  
  // Check for footnotes.xml
  const footnotesEntry = zip.file("word/footnotes.xml");
  if (footnotesEntry) {
    report.docxHasFootnotes = true;
    const footnotesText = await footnotesEntry.async("string");
    const textMatches = footnotesText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    report.footnotesXmlText = textMatches
      .map(m => m.replace(/<[^>]+>/g, "").trim())
      .filter(t => t && !t.match(/^\d+$/));
  } else {
    report.issues.push("No footnotes.xml found");
  }

  // Check if PDF exists
  if (!existsSync(pdfPath)) {
    report.issues.push(`PDF not found: ${pdfPath}`);
    return report;
  }

  // For now, mark as not-detected since we can't easily parse PDF without pdfjs
  report.status = "not-detected";
  report.issues.push("PDF footer detection requires pdfjs-dist parser");
  
  return report;
}

async function main() {
  const fixtures = [
    "fixture-monografia-anexo-referencias",
    "fixture-artigo-referencias-rodape",
    "fixture-projeto-notas"
  ];

  const reports = [];
  for (const fixture of fixtures) {
    const report = await analyzeFixture(fixture);
    reports.push(report);
    console.log(`${fixture}:`);
    console.log(`  DOCX has footnotes: ${report.docxHasFootnotes}`);
    console.log(`  Footnotes text: ${report.footnotesXmlText.join(", ")}`);
    console.log(`  Status: ${report.status}`);
    if (report.issues.length > 0) {
      console.log(`  Issues: ${report.issues.join("; ")}`);
    }
  }

  writeFileSync(outputPath, JSON.stringify(reports, null, 2));
  console.log(`\nReport saved to: ${outputPath}`);
}

main().catch(console.error);
