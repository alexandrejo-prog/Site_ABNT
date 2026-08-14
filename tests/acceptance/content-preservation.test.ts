import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const inputPath = new URL("../../artifacts/ufla-compliance/baseline-extraction.json", import.meta.url);
const outputPath = new URL("../../artifacts/ufla-compliance/normalized-dissertacao.docx", import.meta.url);

describe("acceptance: content preservation", () => {
  it("preserves paragraph count in input", () => {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    expect(input.paragraphCount).toBeGreaterThan(4000);
  });

  it("preserves reference count in input", () => {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    expect(input.referenceCount).toBeGreaterThan(200);
    expect(input.references.length).toBe(input.referenceCount);
  });

  it("preserves table count in input", () => {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    expect(input.tableCount).toBeGreaterThan(30);
    expect(input.tables.length).toBe(input.tableCount);
  });

  it("preserves image count in input", () => {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    expect(input.imageCount).toBeGreaterThan(0);
    expect(input.images.length).toBe(input.imageCount);
  });

  it("normalized DOCX exists and is valid", () => {
    const buf = readFileSync(outputPath);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 2)).toEqual(Buffer.from([0x50, 0x4b]));
  });

  it("preserves references between baseline and normalized DOCX", async () => {
    const baselineBuffer = readFileSync(join(root, "artifacts", "baselines", "dissertacao-referencia.docx"));
    const normalizedBuffer = readFileSync(outputPath);

    const baselineFile = new File([baselineBuffer], "baseline.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const normalizedFile = new File([normalizedBuffer], "normalized.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);
    const { normalizeReferences } = await import(pathToFileURL(join(root, "src", "references-normalizer.ts")).href);

    const [baselineImport, normalizedImport] = await Promise.all([
      importDocumentFile(baselineFile),
      importDocumentFile(normalizedFile),
    ]);

    const inputRefs = (baselineImport.fields.referencias || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
    const outputRefs = (normalizedImport.fields.referencias || "").split("\n").map((l: string) => l.trim()).filter(Boolean);

    const inputNormalized = normalizeReferences(inputRefs);
    const outputNormalized = normalizeReferences(outputRefs);

    function normKey(r: { text: string }) {
      return r.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    }

    const outputSet = new Set(outputNormalized.map(normKey));

    let missingCount = 0;
    for (const ref of inputNormalized) {
      if (!outputSet.has(normKey(ref))) {
        missingCount++;
      }
    }

    expect(missingCount).toBe(0);
    expect(outputNormalized.length).toBeGreaterThanOrEqual(inputNormalized.length - 2);
  });

  it("preserves tables between baseline and normalized DOCX", async () => {
    const baselineBuffer = readFileSync(join(root, "artifacts", "baselines", "dissertacao-referencia.docx"));
    const normalizedBuffer = readFileSync(outputPath);

    const baselineFile = new File([baselineBuffer], "baseline.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const normalizedFile = new File([normalizedBuffer], "normalized.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);

    const [baselineImport, normalizedImport] = await Promise.all([
      importDocumentFile(baselineFile),
      importDocumentFile(normalizedFile),
    ]);

    expect(normalizedImport.importedTables.length).toBeGreaterThanOrEqual(baselineImport.importedTables.length);
  });

  it("preserves images between baseline and normalized DOCX", async () => {
    const baselineBuffer = readFileSync(join(root, "artifacts", "baselines", "dissertacao-referencia.docx"));
    const normalizedBuffer = readFileSync(outputPath);

    const baselineFile = new File([baselineBuffer], "baseline.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const normalizedFile = new File([normalizedBuffer], "normalized.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);

    const [baselineImport, normalizedImport] = await Promise.all([
      importDocumentFile(baselineFile),
      importDocumentFile(normalizedFile),
    ]);

    expect(normalizedImport.importedImages.length).toBeGreaterThanOrEqual(baselineImport.importedImages.length);
  });
});