import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const INPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const OUTPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");

interface TableFix {
  tableIndex: number;
  action: "added_tblpr" | "added_trpr" | "skipped" | "noop";
  reason: string;
}

function extractRowText(rowXml: string): string {
  const texts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) texts.push(m[1]);
  return texts.join(" | ");
}

function looksLikeTitle(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const titlePatterns = [
    /^Quadro\s*\d*\s*[:\-–]/i,
    /^Tabela\s*\d*\s*[:\-–]/i,
    /^Figura\s*\d*\s*[:\-–]/i,
    /^Gráfico\s*\d*\s*[:\-–]/i,
    /^Tema\s*[:\-–]/i,
    /^Tema\s+geral\s*[:\-–]/i,
    /^Cronograma\s+de\s+ações/i,
    /^Avaliação\s+dos\s+repositórios/i,
    /^Política\s+Institucional\s+de\s+Informação/i,
  ];
  return titlePatterns.some((p) => p.test(t));
}

function looksLikeHeader(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const cells = t.split(" | ").filter((c) => c.trim().length > 0);
  if (cells.length < 2) return false;
  const headerKeywords = [
    "Categoria", "Questão", "Avaliação", "Etapa", "Meses", "Período",
    "Atividades", "Objetivo", "Justificativa", "Introdução", "Metodologia",
    "Resultados", "Considerações", "Objetivos", "Cronograma", "Responsável",
    "Ação", "Atividade", "Critérios", "Perguntas", "Unidade", "Tema",
    "Nome", "Cargo", "Setor", "Data", "Local", "Ano", "Descrição", "Tipo",
    "Quantidade", "Valor", "Status", "Obs", "Observação", "Nota", "Pergunta",
    "Resposta", "Sim", "Não", "Código", "Sigla", "Definição", "Descricao",
    "Indicador", "Meta", "Responsável", "Recurso", "Prazo"
  ];
  const hasKeyword = cells.some((c) => headerKeywords.some((k) => c.trim().toLowerCase().includes(k.toLowerCase())));
  const allUpperOrTitle = cells.every((c) => /^[A-ZÀ-Ÿ][a-zà-ÿ]/.test(c.trim()) || /^[A-ZÀ-Ÿ\s]+$/.test(c.trim()));
  return hasKeyword || (allUpperOrTitle && cells.length >= 2);
}

function addTblHeaderToTable(tableXml: string): string {
  if (/<w:tblHeader\b/i.test(tableXml)) return tableXml;
  return tableXml.replace(
    /(<w:tblPr[^>]*>)/i,
    "$1<w:tblHeader/>",
  );
}

function addTblHeaderToRow(rowXml: string): string {
  if (/<w:tblHeader\b/i.test(rowXml)) return rowXml;
  const trPrMatch = rowXml.match(/<w:trPr\b[^>]*>[\s\S]*?<\/w:trPr>/i);
  if (trPrMatch) {
    return rowXml.replace(
      /(<w:trPr\b[^>]*>)/i,
      "$1<w:tblHeader/>",
    );
  }
  return rowXml.replace(
    /(<w:tr\b[^>]*>)/i,
    "$1<w:trPr><w:tblHeader/></w:trPr>",
  );
}

async function fixTableHeadersSelective(inputPath: string, outputPath: string): Promise<TableFix[]> {
  const buffer = readFileSync(inputPath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  const tables = Array.from(documentXml.matchAll(tableRegex), (m) => m[0]);

  const fixes: TableFix[] = [];
  let fixedXml = documentXml;

  for (let i = 0; i < tables.length; i++) {
    const original = tables[i];
    if (/<w:tblHeader\b/i.test(original)) {
      fixes.push({ tableIndex: i, action: "noop", reason: "Já possui w:tblHeader" });
      continue;
    }

    const rowMatches = Array.from(original.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g), (m) => m[0]);
    const rowCount = rowMatches.length;
    const firstRowText = extractRowText(rowMatches[0] || "");
    const secondRowText = rowCount >= 2 ? extractRowText(rowMatches[1]) : "";

    const firstIsTitle = looksLikeTitle(firstRowText);
    const secondIsHeader = looksLikeHeader(secondRowText);
    const firstIsHeader = looksLikeHeader(firstRowText);

    if (rowCount === 1) {
      fixes.push({ tableIndex: i, action: "skipped", reason: "Tabela de linha única" });
      continue;
    }

    if (firstIsTitle && secondIsHeader) {
      const fixedRow = addTblHeaderToRow(rowMatches[1]);
      if (fixedRow !== rowMatches[1]) {
        fixedXml = fixedXml.replace(original, original.replace(rowMatches[1], fixedRow));
        fixes.push({ tableIndex: i, action: "added_trpr", reason: "w:tblHeader adicionado na 2ª linha (header real)" });
      } else {
        fixes.push({ tableIndex: i, action: "skipped", reason: "Não foi possível adicionar w:tblHeader na 2ª linha" });
      }
      continue;
    }

    if (firstIsHeader) {
      const fixedTable = addTblHeaderToTable(original);
      if (fixedTable !== original) {
        fixedXml = fixedXml.replace(original, fixedTable);
        fixes.push({ tableIndex: i, action: "added_tblpr", reason: "w:tblHeader adicionado na tabela (1ª linha é header)" });
      } else {
        fixes.push({ tableIndex: i, action: "skipped", reason: "Não foi possível adicionar w:tblHeader na tabela" });
      }
      continue;
    }

    fixes.push({ tableIndex: i, action: "skipped", reason: "Sem header semântico claro" });
  }

  zip.file("word/document.xml", fixedXml);
  const outputBuffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(outputPath, outputBuffer);

  return fixes;
}

async function main() {
  console.log(`Corrigindo tabelas seletivamente em: ${INPUT_DOCX}`);
  const fixes = await fixTableHeadersSelective(INPUT_DOCX, OUTPUT_DOCX);

  const addedTblpr = fixes.filter((f) => f.action === "added_tblpr").length;
  const addedTrpr = fixes.filter((f) => f.action === "added_trpr").length;
  const skipped = fixes.filter((f) => f.action === "skipped").length;
  const noop = fixes.filter((f) => f.action === "noop").length;

  console.log(`\nResultado:`);
  console.log(`  Adicionados tblPr: ${addedTblpr}`);
  console.log(`  Adicionados trPr:  ${addedTrpr}`);
  console.log(`  Ignorados:         ${skipped}`);
  console.log(`  Já existiam:       ${noop}`);
  console.log(`  Total:             ${fixes.length}`);
  console.log(`\nArquivo corrigido: ${OUTPUT_DOCX}`);
}

main().catch((err) => {
  console.error("Falha na correção seletiva de tabelas:", err);
  process.exit(1);
});
