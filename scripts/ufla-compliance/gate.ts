import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { checkPagination } from "./check-pagination";
import { analyzePdf } from "./analyze-pdf-physical";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outputPath = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const pdfPath = join(root, "artifacts", "ufla-compliance", "dissertacao-rendered.pdf");

const baselineBuffer = readFileSync(baselinePath);
const outputBuffer = readFileSync(outputPath);

const baselineFile = new File([baselineBuffer], "baseline.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const outputFile = new File([outputBuffer], "normalized.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);
const { normalizeReferences } = await import(pathToFileURL(join(root, "src", "references-normalizer.ts")).href);

const [baselineImport, outputImport] = await Promise.all([
  importDocumentFile(baselineFile),
  importDocumentFile(outputFile),
]);

const inputRefs = (baselineImport.fields.referencias || "").split("\n").map((l) => l.trim()).filter(Boolean);
const outputRefs = (outputImport.fields.referencias || "").split("\n").map((l) => l.trim()).filter(Boolean);

const inputNormalized = normalizeReferences(inputRefs);
const outputNormalized = normalizeReferences(outputRefs);

function normKey(r: { text: string }) {
  return r.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

const inputSet = new Set(inputNormalized.map(normKey));
const outputSet = new Set(outputNormalized.map(normKey));

const issues: string[] = [];

for (const ref of inputNormalized) {
  if (!outputSet.has(normKey(ref))) {
    issues.push("reference-loss");
    break;
  }
}

const inputTables = baselineImport.importedTables.length;
const outputTables = outputImport.importedTables.length;
if (outputTables < inputTables) {
  issues.push("table-loss");
}

const inputImages = baselineImport.importedImages.length;
const outputImages = outputImport.importedImages.length;
if (outputImages < inputImages) {
  issues.push("image-loss");
}

const inputParas = baselineImport.editorText.split("\n").length;
const outputParas = outputImport.editorText.split("\n").length;
if (outputParas < inputParas * 0.8) {
  issues.push("text-loss");
}

const hasInputAppendices = (baselineImport.fields.apendices || "").trim().length > 0;
const hasOutputAppendices = (outputImport.fields.apendices || "").trim().length > 0;
if (hasInputAppendices && !hasOutputAppendices) {
  issues.push("appendix-loss");
}

const hasInputAnnexes = (baselineImport.fields.anexos || "").trim().length > 0;
const hasOutputAnnexes = (outputImport.fields.anexos || "").trim().length > 0;
if (hasInputAnnexes && !hasOutputAnnexes) {
  issues.push("annex-loss");
}

const paginationResult = checkPagination(outputPath);
if (paginationResult.errors.length > 0) {
  issues.push(...paginationResult.errors);
}

async function checkPdfPhysical(pdfPath: string): Promise<string[]> {
  const physicalIssues: string[] = [];
  try {
    const analysis = await analyzePdf(pdfPath);
    if (analysis.summary.totalOverlaps > 0) {
      physicalIssues.push(`pdf-overlaps:${analysis.summary.totalOverlaps}`);
    }
    if (analysis.summary.totalCutoffs > 0) {
      physicalIssues.push(`pdf-cutoffs:${analysis.summary.totalCutoffs}`);
    }
    if (analysis.summary.blankPages.length > 0) {
      physicalIssues.push(`pdf-blankPages:${analysis.summary.blankPages.length}`);
    }
  } catch (err) {
    console.error("Falha na análise física do PDF:", err);
    physicalIssues.push("pdf-physical-analysis-error");
  }
  return physicalIssues;
}

if (existsSync(pdfPath)) {
  const physicalIssues = await checkPdfPhysical(pdfPath);
  if (physicalIssues.length > 0) {
    issues.push(...physicalIssues);
  }
}

if (issues.length > 0) {
  console.log("FULL_COMPLIANCE_GATE: FAILED");
  console.log("Issues:", issues.join(", "));
  process.exitCode = 1;
} else {
  console.log("FULL_COMPLIANCE_GATE: PASSED");
  process.exitCode = 0;
}
