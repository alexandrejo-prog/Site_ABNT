import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { importDocumentFile } from "../../src/import-docx";
import { generateDocxBlob } from "../../src/export-docx";
import type { AcademicFields } from "../../src/ufla-rules";
import type { ImportedTable } from "../../src/imported-tables";
import type { ImportedDocumentImage } from "../../src/imported-images";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

export interface BaselineRoundTrip {
  input: {
    fields: AcademicFields;
    editorText: string;
    importedImages: ImportedDocumentImage[];
    importedTables: ImportedTable[];
    referencias: string[];
  };
  output: {
    fields: AcademicFields;
    editorText: string;
    importedImages: ImportedDocumentImage[];
    importedTables: ImportedTable[];
    referencias: string[];
  };
  blob: Blob;
}

export async function baselineRoundTrip(): Promise<BaselineRoundTrip> {
  const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
  const buffer = readFileSync(baselinePath);
  const file = new File([buffer], "dissertacao-referencia.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const result = await importDocumentFile(file);
  const blob = await generateDocxBlob({
    fields: result.fields,
    editorText: result.editorText,
    importedImages: result.importedImages,
    importedTables: result.importedTables,
  });

  const generatedFile = new File([await blob.arrayBuffer()], "generated.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const reimported = await importDocumentFile(generatedFile);

  const splitRefs = (value: string) =>
    (value || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  return {
    input: {
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
      referencias: splitRefs(result.fields.referencias ?? ""),
    },
    output: {
      fields: reimported.fields,
      editorText: reimported.editorText,
      importedImages: reimported.importedImages,
      importedTables: reimported.importedTables,
      referencias: splitRefs(reimported.fields.referencias ?? ""),
    },
    blob,
  };
}
