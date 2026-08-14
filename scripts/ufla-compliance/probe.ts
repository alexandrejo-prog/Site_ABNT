import { writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { monografiaFixture } from "./fixtures";

const f = monografiaFixture();
const blob = await generateDocxBlob({ fields: f.fields, editorText: f.editorText, importedImages: f.importedImages, importedTables: f.importedTables });
const zip = await JSZip.loadAsync(await blob.arrayBuffer());
const names = Object.keys(zip.files).sort();
console.log("ZIP PARTS:");
for (const n of names) console.log("  " + n);
const doc = await zip.file("word/document.xml")?.async("string") || "";
console.log("\n=== document.xml length:", doc.length);
console.log("\n=== first pgSz/pgMar:");
const m1 = doc.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || [];
console.log("sectPr count:", m1.length);
for (const s of m1.slice(0, 6)) console.log("---\n" + s.slice(0, 600));
console.log("\n=== updateFields in settings?");
const set = await zip.file("word/settings.xml")?.async("string") || "";
console.log(set.includes("updateFields"));
console.log(set.match(/<w:updateFields[^>]*\/?>/) || "NOT FOUND raw");
console.log("\n=== headers present:", names.filter(n => n.startsWith("word/header")).join(", "));
console.log("footers present:", names.filter(n => n.startsWith("word/footer")).join(", "));
if (names.some(n => n.startsWith("word/header"))) {
  const h = await zip.file(names.find(n => n.startsWith("word/header"))!)?.async("string") || "";
  console.log("\nheader1.xml:\n", h.slice(0, 800));
}
console.log("\n=== numbering? ", names.includes("word/numbering.xml"));
console.log("\n=== docProps:", names.filter(n => n.startsWith("docProps")).join(", "));
console.log("\n=== TOC instr:", (doc.match(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g) || []).join("\n"));
console.log("\n=== styles default:");
const st = await zip.file("word/styles.xml")?.async("string") || "";
const def = st.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0]?.slice(0, 800) || "NONE";
console.log(def);
writeFileSync(join(process.cwd(), "tmp", "inspect-probe.docx"), Buffer.from(await blob.arrayBuffer()));
console.log("\nprobe written");