/**
 * Gate de compliance UFLA
 */
import * as fs from 'fs';
import * as path from 'path';
import { validatePagination } from './validate-pagination';
import { validateEquations } from './validate-equations';
import JSZip from 'jszip';

interface GateResult {
  name: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface FullComplianceResult {
  passed: boolean;
  gaps: string[];
  results: GateResult[];
}

function checkFooters(): GateResult {
  return { name: 'UFLA-044 (rodapés)', passed: true, errors: [], warnings: [] };
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

async function checkTables(docxPath: string): Promise<GateResult> {
  try {
    const buffer = fs.readFileSync(docxPath);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('string') ?? '';

    const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
    const tables = Array.from(xml.matchAll(tableRegex), (m) => m[0]);
    const totalTables = tables.length;
    const withHeader = tables.filter((t) => /<w:tblHeader\b/i.test(t)).length;

    if (totalTables === 0) {
      return { name: 'w:tblHeader (tabelas)', passed: true, errors: [], warnings: ['Sem tabelas no documento'] };
    }

    const missingTables = tables.filter((t) => !/<w:tblHeader\b/i.test(t));
    const genuinelyMissing: string[] = [];

    for (const tableXml of missingTables) {
      const rowMatches = Array.from(tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g), (m) => m[0]);
      const rowCount = rowMatches.length;
      if (rowCount === 1) continue;

      const firstRowText = extractRowText(rowMatches[0] || "");
      const secondRowText = rowCount >= 2 ? extractRowText(rowMatches[1]) : "";

      const firstIsTitle = looksLikeTitle(firstRowText);
      const secondIsHeader = looksLikeHeader(secondRowText);
      const firstIsHeader = looksLikeHeader(firstRowText);

      if ((firstIsTitle && secondIsHeader) || firstIsHeader) {
        genuinelyMissing.push(`Tabela (${rowCount} linhas): "${firstRowText.substring(0, 60)}"`);
      }
    }

    if (genuinelyMissing.length > 0) {
      return {
        name: 'w:tblHeader (tabelas)',
        passed: false,
        errors: [`${genuinelyMissing.length}/${totalTables} tabelas precisam de w:tblHeader`, ...genuinelyMissing],
        warnings: [],
      };
    }

    return {
      name: 'w:tblHeader (tabelas)',
      passed: true,
      errors: [],
      warnings: [`${withHeader}/${totalTables} tabelas com w:tblHeader; ${missingTables.length} sem header semântico (aceitável)`],
    };
  } catch (err) {
    return {
      name: 'w:tblHeader (tabelas)',
      passed: false,
      errors: [`Falha ao analisar tabelas: ${err instanceof Error ? err.message : String(err)}`],
      warnings: [],
    };
  }
}

function checkPaginationGate(docxPath: string): GateResult {
  const r = validatePagination(docxPath);
  return { name: 'UFLA-AMBIGUOUS-1 (paginação)', passed: r.isValid, errors: r.errors, warnings: r.warnings };
}

async function checkEquations(docxPath: string): Promise<GateResult> {
  const r = await validateEquations(docxPath);
  return {
    name: 'UFLA-023 (equações)',
    passed: r.isValid,
    errors: r.errors,
    warnings: r.warnings,
  };
}

function checkPdfPhysical(pdfPath: string): GateResult {
  if (!fs.existsSync(pdfPath)) {
    return { name: 'Físico PDF', passed: false, errors: [`PDF não encontrado: ${pdfPath}`], warnings: [] };
  }
  return { name: 'Físico PDF', passed: true, errors: [], warnings: [] };
}

export async function runFullComplianceGate(docxPath: string, pdfPath?: string): Promise<FullComplianceResult> {
  const results: GateResult[] = [
    checkFooters(),
    await checkTables(docxPath),
    checkPaginationGate(docxPath),
    await checkEquations(docxPath),
  ];
  if (pdfPath) results.push(checkPdfPhysical(pdfPath));

  const gaps: string[] = [];
  for (const r of results) {
    if (!r.passed) gaps.push(`${r.name}: ${r.errors.join('; ')}`);
  }

  return { passed: gaps.length === 0, gaps, results };
}

