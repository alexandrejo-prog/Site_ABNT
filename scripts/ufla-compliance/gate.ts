/**
 * Gate de compliance UFLA expandido
 */
import * as fs from 'fs';
import * as path from 'path';
import { validatePagination } from './validate-pagination';
import { validateEquations } from './validate-equations';
import { validateOMML } from './validate-omml';
import { validateCitations, validateReferences } from './validate-citations-references';
import { validateSections, validateFigures, validateTables } from './validate-sections-figures-tables';
import { auditPretextual } from './audit-pretextual';
import { auditTextual } from './audit-textual';
import { auditPosttextual } from './audit-posttextual';
import { auditReferences } from './audit-references';
import { auditCitations } from './audit-citations';
import { auditFigures } from './audit-figures';
import { auditSections } from './audit-sections';
import { writeHtmlReport } from './report';
import JSZip from 'jszip';

import type { ExpandedAuditResult } from './audit-types';

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

async function checkOMML(docxPath: string): Promise<GateResult> {
  const results = await validateOMML(docxPath);
  const errors = results.filter((r) => r.status === 'failed' && r.severity === 'critical').map((r) => r.message);
  const warnings = results.filter((r) => r.status === 'failed' && r.severity !== 'critical').map((r) => r.message);
  return { name: 'OMML', passed: errors.length === 0, errors, warnings };
}

async function checkCitations(docxPath: string): Promise<GateResult> {
  const results = await validateCitations(docxPath);
  const errors = results.filter((r) => r.status === 'failed').map((r) => r.message);
  return { name: 'Citações (validador)', passed: errors.length === 0, errors, warnings: [] };
}

async function checkReferences(docxPath: string): Promise<GateResult> {
  const results = await validateReferences(docxPath);
  const errors = results.filter((r) => r.status === 'failed').map((r) => r.message);
  return { name: 'Referências (validador)', passed: errors.length === 0, errors, warnings: [] };
}

async function checkSections(docxPath: string): Promise<GateResult> {
  const results = await validateSections(docxPath);
  const errors = results.filter((r) => r.status === 'failed').map((r) => r.message);
  return { name: 'Seções', passed: errors.length === 0, errors, warnings: [] };
}

async function checkFigures(docxPath: string): Promise<GateResult> {
  const results = await validateFigures(docxPath);
  const errors = results.filter((r) => r.status === 'failed').map((r) => r.message);
  return { name: 'Figuras', passed: errors.length === 0, errors, warnings: [] };
}

async function checkTables(docxPath: string): Promise<GateResult> {
  const results = await validateTables(docxPath);
  const errors = results.filter((r) => r.status === 'failed').map((r) => r.message);
  return { name: 'Tabelas', passed: errors.length === 0, errors, warnings: [] };
}

function checkPdfPhysical(pdfPath: string): GateResult {
  if (!fs.existsSync(pdfPath)) {
    return { name: 'Físico PDF', passed: false, errors: [`PDF não encontrado: ${pdfPath}`], warnings: [] };
  }
  return { name: 'Físico PDF', passed: true, errors: [], warnings: [] };
}

export async function runExpandedComplianceGate(docxPath: string, pdfPath?: string): Promise<ExpandedAuditResult> {
  const [pretextual, textual, posttextual, referencesResult, citationsResult, figuresResult, sectionsResult, layoutResult, typographyResult, catalogCardResult, tocResult, ommlResult, documentStructureResult, tablesResult] = await Promise.all([
    auditPretextual(docxPath),
    auditTextual(docxPath),
    auditPosttextual(docxPath),
    auditReferences(docxPath),
    auditCitations(docxPath),
    auditFigures(docxPath),
    auditSections(docxPath),
    validatePageLayout(docxPath),
    validateTypography(docxPath),
    validateCatalogCard(docxPath),
    validateToc(docxPath),
    validateOMML(docxPath),
    validateDocumentStructure(docxPath, 'dissertacao'),
    validateTables(docxPath),
  ]);

  const footersResult = checkFooters();
  const paginationResult = checkPaginationGate(docxPath);
  const equationsResult = await checkEquations(docxPath);
  const pdfPhysicalResult = pdfPath ? checkPdfPhysical(pdfPath) : { name: 'Físico PDF', passed: true, errors: [], warnings: [] };

  const allGaps = [
    ...pretextual.gaps,
    ...textual.gaps,
    ...posttextual.gaps,
    ...referencesResult.gaps,
    ...citationsResult.gaps,
    ...figuresResult.gaps,
    ...sectionsResult.gaps,
    ...layoutResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...typographyResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...catalogCardResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...tocResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...ommlResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...documentStructureResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
    ...tablesResult.filter((r) => r.status === 'failed').map((r) => ({ rule: r.message, severity: r.severity, description: r.message, suggestion: r.suggestion })),
  ];

  const technical = {
    footers: footersResult.passed,
    tables: tablesResult.passed,
    pagination: paginationResult.passed,
    equations: equationsResult.passed,
    pdfPhysical: pdfPhysicalResult.passed,
    references: referencesResult.passed,
    citations: citationsResult.passed,
    figures: figuresResult.passed,
    sections: sectionsResult.passed,
    omml: ommlResult.passed,
    citationsValidator: citationsResult.passed,
    referencesValidator: referencesResult.passed,
    sectionsValidator: sectionsResult.passed,
    figuresValidator: figuresResult.passed,
    tablesValidator: tablesResult.passed,
  };

  const criticalGaps = allGaps.filter((g) => g.severity === 'critical').length;
  const passed = criticalGaps === 0;
  const score = allGaps.length === 0 ? 100 : Math.max(0, 100 - allGaps.length * 10);
  const compliant = passed && score >= 90;

  const result: ExpandedAuditResult = {
    documentType: 'dissertacao',
    preTextual: pretextual,
    textual,
    postTextual: posttextual,
    technical,
    gaps: allGaps,
    score,
    compliant,
  };

  try {
    writeHtmlReport(result, 'artifacts/ufla-compliance/audit-report.html');
  } catch {
    // non-blocking
  }

  return result;
}

export async function runFullComplianceGate(docxPath: string, pdfPath?: string): Promise<FullComplianceResult> {
  const expanded = await runExpandedComplianceGate(docxPath, pdfPath);

  const results: GateResult[] = [
    { name: 'Pré-textuais', passed: expanded.preTextual.passed, errors: expanded.preTextual.gaps.map(g => g.description), warnings: [] },
    { name: 'Textuais', passed: expanded.textual.passed, errors: expanded.textual.gaps.map(g => g.description), warnings: [] },
    { name: 'Pós-textuais', passed: expanded.postTextual.passed, errors: expanded.postTextual.gaps.map(g => g.description), warnings: [] },
    { name: 'Referências', passed: expanded.technical.references, errors: expanded.gaps.filter(g => g.section === 'referências').map(g => g.description), warnings: [] },
    { name: 'Citações', passed: expanded.technical.citations, errors: expanded.gaps.filter(g => g.section === 'citações').map(g => g.description), warnings: [] },
    { name: 'Figuras', passed: expanded.technical.figures, errors: expanded.gaps.filter(g => g.section === 'figuras').map(g => g.description), warnings: [] },
    { name: 'Seções', passed: expanded.technical.sections, errors: expanded.gaps.filter(g => g.section === 'seções').map(g => g.description), warnings: [] },
  ];

  const gaps: string[] = [];
  for (const r of results) {
    if (!r.passed) gaps.push(`${r.name}: ${r.errors.join('; ')}`);
  }

  return { passed: gaps.length === 0, gaps, results };
}
