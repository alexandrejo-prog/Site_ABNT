import { readFileSync } from "node:fs";
import JSZip from "jszip";

async function main() {
  const zip = await JSZip.loadAsync(readFileSync("tmp/cpg-comparison/resumo_expandido.docx"));
  const doc = await zip.file("word/document.xml").async("text");
  const sectPr = doc.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  if (sectPr) {
    console.log("sectPr:", sectPr[0]);
  }
}
main();
