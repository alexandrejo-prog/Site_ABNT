import { readdirSync } from "node:fs";
import { join } from "node:path";
import { importDocumentFile } from "./src/import-docx";
import { buildPdfCopyDocxBlob } from "./src/pdf-to-copy-docx";
import { generateDocxBlob } from "./src/export-docx";
import { closeChromiumBrowser } from "./src/figure-rasterizer";
import { normalizeFieldsForSelectedModel } from "./src/work-type-field-normalizer";
import { validateWork } from "./src/validators";
import { isAbsoluteGenerationBlocker, isNonOverridableError } from "./src/generation-blockers";

const dir = "tmp";
const targets = readdirSync(dir).filter((n) => /DISSERT/i.test(n) && /\.pdf$/i.test(n));
console.log("TARGETS:", targets.length, targets);

for (const target of targets) {
  const path = join(dir, target);
  console.log("\n==== FILE:", target, "====");
  try {
    const file = new File([readFileBytes(path)], target, { type: "application/pdf" });
    const res = await importDocumentFile(file as any);
    console.log("OK import | editorText:", res.editorText.length, "| images:", res.importedImages.length);
    console.log("  fields.workType:", (res.fields as any)?.workType);
    console.log("  fields.title:", JSON.stringify((res.fields as any)?.title)?.slice(0, 80));

    const genFields = normalizeFieldsForSelectedModel(res.fields as any);
    const issues = validateWork(genFields as any, res.editorText);
    const nonOver = issues.filter((i) => i.severity === "error" && isNonOverridableError(i));
    const absBlock = issues.filter((i) => i.severity === "error" && isAbsoluteGenerationBlocker(i));
    console.log("  VALIDATION errors:", issues.filter((i) => i.severity === "error").map((i) => i.code));
    console.log("  nonOverridable:", nonOver.map((i) => i.code));
    console.log("  absoluteBlocker:", absBlock.map((i) => i.code));

    const copy = await buildPdfCopyDocxBlob({
      editorText: res.editorText,
      importedImages: res.importedImages,
      importedTables: res.importedTables,
      fileName: target,
    });
    const copyBuf = new Uint8Array(await copy.blob.arrayBuffer());
    console.log("OK copy | bytes:", copyBuf.length);

    const reimport = await importDocumentFile(new File([copyBuf as BlobPart], target.replace(/\.pdf$/i, "-copia.docx"), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) as any);
    const abnt = await generateDocxBlob({
      fields: reimport.fields,
      editorText: reimport.editorText,
      importedImages: reimport.importedImages,
      importedTables: reimport.importedTables,
    });
    const abntBuf = new Uint8Array(await abnt.arrayBuffer());
    console.log("OK ABNT | bytes:", abntBuf.length);
  } catch (e: any) {
    console.log("THREW:", e?.message ?? e);
    console.log((e?.stack ?? "").split("\n").slice(0, 8).join("\n"));
  }
}

await closeChromiumBrowser();

import { readFileSync } from "node:fs";
function readFileBytes(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}
