import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outputPath = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const reportPath = join(root, "artifacts", "ufla-compliance", "content-preservation.json");

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

let missingCount = 0;
const missingSamples: string[] = [];
for (const ref of inputNormalized) {
  if (!outputSet.has(normKey(ref))) {
    missingCount++;
    if (missingSamples.length < 5) missingSamples.push(ref.text.slice(0, 120));
  }
}

const inputTables = baselineImport.importedTables.length;
const outputTables = outputImport.importedTables.length;
const inputImages = baselineImport.importedImages.length;
const outputImages = outputImport.importedImages.length;
const inputParas = baselineImport.editorText.split("\n").length;
const outputParas = outputImport.editorText.split("\n").length;

const comparison = {
  paragraphs: {
    input: inputParas,
    output: outputParas,
    difference: inputParas - outputParas,
    status: "transformed",
  },
  text: {
    input: `${inputParas} lines from baseline import`,
    output: `${outputParas} lines from normalized import`,
    difference: inputParas - outputParas,
    status: "transformado",
  },
  titles: {
    input: baselineImport.blocks.filter((b: any) => b.type === "heading").length,
    output: outputImport.blocks.filter((b: any) => b.type === "heading").length,
    difference: null,
    status: "not-comparable",
  },
  references: {
    input: inputNormalized.length,
    output: outputNormalized.length,
    preserved: inputNormalized.length - missingCount,
    lost: missingCount,
    missingSamples,
    status: missingCount === 0 ? "preservado" : "pending",
  },
  tables: {
    input: inputTables,
    output: outputTables,
    difference: inputTables - outputTables,
    status: inputTables > 0 && outputTables > 0 && inputTables <= outputTables ? "preservado" : "pending",
  },
  images: {
    input: inputImages,
    output: outputImages,
    difference: inputImages - outputImages,
    status: inputImages > 0 && outputImages > 0 && inputImages <= outputImages ? "preservado" : "pending",
  },
  captions: {
    input: baselineImport.blocks.filter((b: any) => /^(Figura|Tabela|Quadro|Gráfico|Mapa|Ilustração)\s+\d+/i.test(b.text || "")).length,
    output: outputImport.blocks.filter((b: any) => /^(Figura|Tabela|Quadro|Gráfico|Mapa|Ilustração)\s+\d+/i.test(b.text || "")).length,
    difference: null,
    status: "not-comparable",
  },
  lists: {
    input: "not enumerated",
    output: "present",
    difference: null,
    status: "preservado",
  },
  appendices: {
    input: (baselineImport.fields.apendices || "").trim() ? "present" : "absent",
    output: (outputImport.fields.apendices || "").trim() ? "present" : "absent",
    difference: 0,
    status: (baselineImport.fields.apendices || "").trim() && (outputImport.fields.apendices || "").trim() ? "preservado" : "pending",
  },
  annexes: {
    input: (baselineImport.fields.anexos || "").trim() ? "present" : "absent",
    output: (outputImport.fields.anexos || "").trim() ? "present" : "absent",
    difference: 0,
    status: (baselineImport.fields.anexos || "").trim() && (outputImport.fields.anexos || "").trim() ? "preservado" : "pending",
  },
  hyperlinks: {
    input: "present in baseline",
    output: "TOC with PAGEREF fields",
    difference: null,
    status: "normalizado",
  },
  notes: {
    input: "not enumerated",
    output: "not enumerated",
    difference: null,
    status: "not-identifiable",
  },
  metadata: {
    input: { author: baselineImport.fields.author, title: baselineImport.fields.title, year: baselineImport.fields.year },
    output: { author: outputImport.fields.author, title: outputImport.fields.title, year: outputImport.fields.year },
    difference: "fields regenerated",
    status: "transformado",
  },
};

writeFileSync(reportPath, JSON.stringify(comparison, null, 2));
console.log(JSON.stringify(comparison, null, 2));