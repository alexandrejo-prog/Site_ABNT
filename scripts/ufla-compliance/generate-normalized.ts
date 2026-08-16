import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outPath = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");

const buffer = readFileSync(baselinePath);
const file = new File([buffer], "dissertacao-referencia.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);
const { generateDocxBlob } = await import(pathToFileURL(join(root, "src", "export-docx.ts")).href);

const result = await importDocumentFile(file);

const blob = await generateDocxBlob({
  fields: result.fields,
  editorText: result.editorText,
  importedImages: result.importedImages,
  importedTables: result.importedTables,
});

const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(outPath, buf);
console.log("GERADO:", buf.length, "bytes");
console.log("CAMINHO:", outPath);
console.log("IMAGES:", result.importedImages.length);
console.log("TABLES:", result.importedTables.length);
console.log("REFERENCE_COUNT:", result.fields.referencias?.split("\n").filter((l: string) => l.trim()).length ?? 0);
console.log("EDITOR_TEXT_LENGTH:", result.editorText.length);
console.log("MESSAGES:", result.messages.slice(0, 10));