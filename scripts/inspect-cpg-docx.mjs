import { readFileSync } from "fs";
import JSZip from "jszip";

async function inspectDocx(path) {
  const buf = readFileSync(path);
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml").async("text");

  // sectPr
  const sectPrMatch = doc.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  if (sectPrMatch) {
    console.log("=== sectPr ===");
    console.log(sectPrMatch[0]);
  }

  // First 5 paragraphs
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/gi;
  const paras = doc.match(paraRegex) || [];
  console.log(`\n=== Total paragraphs: ${paras.length} ===`);
  for (let i = 0; i < Math.min(5, paras.length); i++) {
    const pprMatch = paras[i].match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const textMatch = paras[i].match(/<w:t[^>]*>([^<]*)<\/w:t>/);
    console.log(`\nP${i} pPr:`, pprMatch ? pprMatch[0] : "none");
    console.log(`P${i} text:`, textMatch ? textMatch[1] : "");
  }

  // Paragraphs with firstLine
  console.log("\n=== Paragraphs with firstLine ===");
  for (let i = 0; i < paras.length; i++) {
    const flMatch = paras[i].match(/w:firstLine="(\d+)"/);
    if (flMatch) {
      const textMatch = paras[i].match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      console.log(`P${i}: firstLine=${flMatch[1]}, text=${textMatch ? textMatch[1].substring(0, 60) : ""}`);
    }
  }

  // All unique spacing line values
  const lineVals = new Set();
  for (const p of paras) {
    const m = p.match(/w:line="(\d+)"/);
    if (m) lineVals.add(m[1]);
  }
  console.log("\n=== Unique line spacing values (twips) ===", [...lineVals].sort().join(", "));
}

async function main() {
  console.log("========== RESUMO SIMPLES ==========\n");
  await inspectDocx("tmp/cpg-comparison/resumo_simples.docx");

  console.log("\n\n========== RESUMO EXPANDIDO ==========\n");
  await inspectDocx("tmp/cpg-comparison/resumo_expandido.docx");

  console.log("\n\n========== ARTIGO COMPLETO ==========\n");
  await inspectDocx("tmp/cpg-comparison/artigo_completo.docx");
}

main().catch(console.error);
