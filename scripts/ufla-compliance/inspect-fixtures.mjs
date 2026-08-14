import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = "C:\\Users\\User\\Desktop\\Alexandre\\Site_Normas_UFLA\\Site_ABNT\\Site_ABNT";
const fixturesDir = join(root, "artifacts", "ufla-compliance", "fixtures");

console.log("Root:", root);
console.log("Fixtures dir:", fixturesDir);

async function inspectDocx(fileName) {
  const filePath = join(fixturesDir, fileName);
  console.log("\nInspecting:", filePath);
  console.log("Exists:", fs.existsSync(filePath));
  
  const buffer = fs.readFileSync(filePath);
  
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  
  console.log(`\n=== ${fileName} ===`);
  
  const entries = zip.getEntries();
  const wordEntries = entries.filter(e => e.entryName.startsWith("word/"));
  console.log("Word entries:", wordEntries.map(e => e.entryName).join(", "));
  
  const docEntry = entries.find(e => e.entryName === "word/document.xml");
  if (docEntry) {
    const docText = docEntry.getData().toString("utf8");
    console.log("\n--- document.xml highlights ---");
    console.log("Has footnoteReference:", docText.includes("footnoteReference"));
    console.log("Has footnotes.xml rel:", docText.includes("footnotes.xml"));
    console.log("Has Fonte:", docText.includes("Fonte:"));
    console.log("Has Figura:", docText.includes("Figura"));
    console.log("Has Tabela:", docText.includes("Tabela"));
    console.log("Has REFERENCIAS:", docText.includes("REFERÊNCIAS") || docText.includes("REFERENCIAS"));
    
    const footnoteMatches = docText.match(/w:footnoteReference[^/]*\/>/g);
    console.log("FootnoteReference count:", footnoteMatches ? footnoteMatches.length : 0);
    
    const ids = [];
    const idRegex = /w:id="(\d+)"/g;
    let m;
    while ((m = idRegex.exec(docText)) !== null) {
      ids.push(m[1]);
    }
    console.log("Footnote IDs mentioned:", [...new Set(ids)].join(", "));
  }
  
  const fnEntry = entries.find(e => e.entryName === "word/footnotes.xml");
  if (fnEntry) {
    const fnText = fnEntry.getData().toString("utf8");
    console.log("\n--- footnotes.xml (first 2000 chars) ---");
    console.log(fnText.substring(0, 2000));
  } else {
    console.log("\nNo word/footnotes.xml");
  }
  
  const relEntry = entries.find(e => e.entryName === "word/_rels/document.xml.rels");
  if (relEntry) {
    const relText = relEntry.getData().toString("utf8");
    console.log("\n--- relationships ---");
    console.log(relText);
  }
}

(async () => {
  await inspectDocx("fixture-projeto-notas.docx");
  await inspectDocx("fixture-fonte-tabela.docx");
  await inspectDocx("fixture-fonte-ilustracao.docx");
  await inspectDocx("fixture-monografia-anexo-referencias.docx");
  await inspectDocx("fixture-artigo-referencias-rodape.docx");
})();
