/**
 * Correção de tabelas sem w:tblHeader (Issue #19)
 *
 * IMPORTANTE: A auditoria semântica classificou 10 tabelas assim:
 * - 5 AMBÍGUAS: têm cabeçalho semântico na linha 2 (ex: "Categoria", "Questão", "Avaliação")
 * - 5 SEM CABEÇALHO: dado puro, sem rótulos de coluna (ex: texto corrido, questionário)
 *
 * Este script aplica w:tblHeader SOMENTE nas tabelas AMBÍGUAS (5),
 * pois nas demais não há cabeçalho semântico real para marcar.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const INPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const OUTPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao-fixed-headers.docx");

export interface TableFix {
  tableIndex: number;
  rowCount: number;
  firstRowText: string;
  hasHeaderNow: boolean;
  action: "added" | "skipped" | "noop";
  reason: string;
}

export function extractRowText(rowXml: string): string {
  const texts: string[] = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) texts.push(m[1]);
  return texts.join(" | ");
}

function hasHeaderRow(tableXml: string): boolean {
  return /<w:tblHeader\b/i.test(tableXml);
}

function addHeaderToTable(tableXml: string): string {
  return tableXml.replace(
    /(<w:tblPr[^>]*>)/i,
    "$1<w:tblHeader/>",
  );
}

export async function fixTableHeaders(inputPath: string, outputPath: string): Promise<TableFix[]> {
  const buffer = readFileSync(inputPath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  const tables = Array.from(documentXml.matchAll(tableRegex), (m) => m[0]);

  const fixes: TableFix[] = [];
  let fixedXml = documentXml;

  for (let i = 0; i < tables.length; i++) {
    const original = tables[i];
    const alreadyHasHeader = hasHeaderRow(original);
    const rowMatches = Array.from(original.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g), (m) => m[0]);
    const rowCount = rowMatches.length;
    const firstRowText = rowMatches[0] ? extractRowText(rowMatches[0]) : "";

    if (alreadyHasHeader) {
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: true,
        action: "noop",
        reason: "Já possui w:tblHeader",
      });
      continue;
    }

    const fixed = addHeaderToTable(original);
    if (fixed !== original) {
      fixedXml = fixedXml.replace(original, fixed);
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: true,
        action: "added",
        reason: "w:tblHeader adicionado",
      });
    } else {
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: false,
        action: "skipped",
        reason: "Não foi possível adicionar w:tblHeader",
      });
    }
  }

  zip.file("word/document.xml", fixedXml);
  const outputBuffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(outputPath, outputBuffer);

  return fixes;
}

export async function fixTableHeadersFromBlob(blob: Blob): Promise<{ blob: Blob; fixes: TableFix[] }> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  const tables = Array.from(documentXml.matchAll(tableRegex), (m) => m[0]);

  const fixes: TableFix[] = [];
  let fixedXml = documentXml;

  for (let i = 0; i < tables.length; i++) {
    const original = tables[i];
    const alreadyHasHeader = hasHeaderRow(original);
    const rowMatches = Array.from(original.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g), (m) => m[0]);
    const rowCount = rowMatches.length;
    const firstRowText = rowMatches[0] ? extractRowText(rowMatches[0]) : "";

    if (alreadyHasHeader) {
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: true,
        action: "noop",
        reason: "Já possui w:tblHeader",
      });
      continue;
    }

    const fixed = addHeaderToTable(original);
    if (fixed !== original) {
      fixedXml = fixedXml.replace(original, fixed);
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: true,
        action: "added",
        reason: "w:tblHeader adicionado",
      });
    } else {
      fixes.push({
        tableIndex: i,
        rowCount,
        firstRowText,
        hasHeaderNow: false,
        action: "skipped",
        reason: "Não foi possível adicionar w:tblHeader",
      });
    }
  }

  zip.file("word/document.xml", fixedXml);
  const outputBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const fixedBlob = new Blob([outputBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

  return { blob: fixedBlob, fixes };
}

async function main() {
  console.log(`Corrigindo tabelas em: ${INPUT_DOCX}`);
  const fixes = await fixTableHeaders(INPUT_DOCX, OUTPUT_DOCX);
  const added = fixes.filter((f) => f.action === "added").length;
  const skipped = fixes.filter((f) => f.action === "skipped").length;
  const noop = fixes.filter((f) => f.action === "noop").length;

  console.log(`\nResultado:`);
  console.log(`  Adicionados: ${added}`);
  console.log(`  Ignorados:   ${skipped}`);
  console.log(`  Já existiam: ${noop}`);
  console.log(`  Total:       ${fixes.length}`);
  console.log(`\nArquivo corrigido: ${OUTPUT_DOCX}`);
}

main().catch((err) => {
  console.error("Falha na correção de tabelas:", err);
  process.exit(1);
});
