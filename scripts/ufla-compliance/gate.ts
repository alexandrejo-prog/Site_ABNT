import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outputPath = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");

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

const criticalContentLosses: string[] = [];

for (const ref of inputNormalized) {
  if (!outputSet.has(normKey(ref))) {
    criticalContentLosses.push("reference-loss");
    break;
  }
}

const inputTables = baselineImport.importedTables.length;
const outputTables = outputImport.importedTables.length;
if (outputTables < inputTables) {
  criticalContentLosses.push("table-loss");
}

const inputImages = baselineImport.importedImages.length;
const outputImages = outputImport.importedImages.length;
if (outputImages < inputImages) {
  criticalContentLosses.push("image-loss");
}

const inputParas = baselineImport.editorText.split("\n").length;
const outputParas = outputImport.editorText.split("\n").length;
if (outputParas < inputParas * 0.8) {
  criticalContentLosses.push("text-loss");
}

const hasInputAppendices = (baselineImport.fields.apendices || "").trim().length > 0;
const hasOutputAppendices = (outputImport.fields.apendices || "").trim().length > 0;
if (hasInputAppendices && !hasOutputAppendices) {
  criticalContentLosses.push("appendix-loss");
}

const hasInputAnnexes = (baselineImport.fields.anexos || "").trim().length > 0;
const hasOutputAnnexes = (outputImport.fields.anexos || "").trim().length > 0;
if (hasInputAnnexes && !hasOutputAnnexes) {
  criticalContentLosses.push("annex-loss");
}

if (criticalContentLosses.length > 0) {
  console.log("GATE REPROVADO — PERDA CRÍTICA DE CONTEÚDO");
  console.log("Perdas:", criticalContentLosses.join(", "));
  process.exitCode = 1;
} else {
  console.log("GATE APROVADO — SEM PERDA CRÍTICA DE CONTEÚDO");
  process.exitCode = 0;
}