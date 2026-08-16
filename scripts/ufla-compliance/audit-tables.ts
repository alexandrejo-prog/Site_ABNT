import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const INPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const OUTPUT_DOCX = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");

interface TableAudit {
  tableIndex: number;
  rowCount: number;
  hasHeader: boolean;
  firstRowText: string;
  secondRowText: string;
  classification: "needs_header" | "is_title" | "single_row" | "ambiguous" | "no_header_needed";
  reason: string;
  confidence: "high" | "medium" | "low";
}

function extractRowText(rowXml: string): string {
  const texts: string[] = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) texts.push(m[1]);
  return texts.join(" | ");
}

function extractRowTextFromTable(tableXml: string, rowIndex: number): string {
  const rows = Array.from(tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g), (m) => m[0]);
  const row = rows[rowIndex];
  if (!row) return "";
  const texts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(row)) !== null) texts.push(m[1]);
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

function classifyTable(audit: TableAudit): TableAudit {
  if (audit.hasHeader) {
    return { ...audit, classification: "needs_header", reason: "Já possui w:tblHeader", confidence: "high" };
  }
  if (audit.rowCount === 1) {
    return { ...audit, classification: "single_row", reason: "Tabela de linha única", confidence: "high" };
  }
  if (looksLikeTitle(audit.firstRowText) && looksLikeHeader(audit.secondRowText)) {
    return { ...audit, classification: "is_title", reason: "1ª linha é título, 2ª linha é header real", confidence: "high" };
  }
  if (!looksLikeTitle(audit.firstRowText) && looksLikeHeader(audit.firstRowText)) {
    return { ...audit, classification: "needs_header", reason: "1ª linha parece header", confidence: "high" };
  }
  if (audit.firstRowText.length > 200 && !audit.secondRowText) {
    return { ...audit, classification: "no_header_needed", reason: "1ª linha é dado/texto corrido", confidence: "medium" };
  }
  if (looksLikeTitle(audit.firstRowText) && !looksLikeHeader(audit.secondRowText)) {
    return { ...audit, classification: "ambiguous", reason: "1ª linha parece título, 2ª linha não parece header", confidence: "medium" };
  }
  if (audit.rowCount >= 3 && !looksLikeHeader(audit.firstRowText) && !looksLikeHeader(audit.secondRowText)) {
    return { ...audit, classification: "no_header_needed", reason: "Sem header semântico claro", confidence: "medium" };
  }
  return { ...audit, classification: "ambiguous", reason: "Padrão não claramente identificado", confidence: "low" };
}

async function auditTables(inputPath: string): Promise<TableAudit[]> {
  const buffer = readFileSync(inputPath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  const tables = Array.from(documentXml.matchAll(tableRegex), (m) => m[0]);

  return tables.map((tableXml, i) => {
    const hasHeader = /<w:tblHeader\b/i.test(tableXml);
    const rowCount = (tableXml.match(/<w:tr\b/g) ?? []).length;
    const firstRowText = extractRowTextFromTable(tableXml, 0);
    const secondRowText = rowCount >= 2 ? extractRowTextFromTable(tableXml, 1) : "";

    const audit: TableAudit = {
      tableIndex: i,
      rowCount,
      hasHeader,
      firstRowText,
      secondRowText,
      classification: "ambiguous",
      reason: "",
      confidence: "low",
    };

    return classifyTable(audit);
  });
}

async function main() {
  console.log(`Auditando tabelas em: ${INPUT_DOCX}`);
  const audits = await auditTables(INPUT_DOCX);

  const withoutHeader = audits.filter((a) => !a.hasHeader);
  const needsHeader = withoutHeader.filter((a) => a.classification === "needs_header" || a.classification === "is_title");
  const noHeaderNeeded = withoutHeader.filter((a) => a.classification === "no_header_needed");
  const singleRow = withoutHeader.filter((a) => a.classification === "single_row");
  const ambiguous = withoutHeader.filter((a) => a.classification === "ambiguous");

  console.log(`\nTotal de tabelas: ${audits.length}`);
  console.log(`Sem w:tblHeader: ${withoutHeader.length}`);
  console.log(`  Precisa header (ou é título+header): ${needsHeader.length}`);
  console.log(`  Não precisa header: ${noHeaderNeeded.length}`);
  console.log(`  Linha única: ${singleRow.length}`);
  console.log(`  Ambíguas: ${ambiguous.length}`);

  console.log(`\n=== TABELAS QUE DEVERIAM RECEBER w:tblHeader ===`);
  for (const audit of needsHeader) {
    console.log(`\nTabela ${audit.tableIndex + 1} (${audit.rowCount} linhas) [${audit.confidence}]:`);
    console.log(`  Classificação: ${audit.classification}`);
    console.log(`  Motivo: ${audit.reason}`);
    console.log(`  1ª linha: "${audit.firstRowText.substring(0, 120)}${audit.firstRowText.length > 120 ? "..." : ""}"`);
    if (audit.secondRowText) {
      console.log(`  2ª linha: "${audit.secondRowText.substring(0, 120)}${audit.secondRowText.length > 120 ? "..." : ""}"`);
    }
  }

  console.log(`\n=== TABELAS QUE NÃO DEVEM RECEBER w:tblHeader ===`);
  for (const audit of [...noHeaderNeeded, ...singleRow, ...ambiguous]) {
    console.log(`\nTabela ${audit.tableIndex + 1} (${audit.rowCount} linhas) [${audit.confidence}]:`);
    console.log(`  Classificação: ${audit.classification}`);
    console.log(`  Motivo: ${audit.reason}`);
    console.log(`  1ª linha: "${audit.firstRowText.substring(0, 120)}${audit.firstRowText.length > 120 ? "..." : ""}"`);
  }
}

main().catch((err) => {
  console.error("Falha na auditoria de tabelas:", err);
  process.exit(1);
});
