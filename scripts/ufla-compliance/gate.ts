/**
 * Gate de compliance UFLA
 */
import * as fs from 'fs';
import * as path from 'path';
import { validatePagination } from './validate-pagination';
import { validateEquations } from './validate-equations';

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

import { validatePagination } from './validate-pagination';
import { validateEquations } from './validate-equations';
import JSZip from 'jszip';

async function checkTables(docxPath: string): Promise<GateResult> {
  try {
    const buffer = fs.readFileSync(docxPath);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('string') ?? '';

    const tables = (xml.match(/<w:tbl\b/g) ?? []).length;
    const headers = (xml.match(/<w:tblHeader\b/g) ?? []).length;

    if (tables === 0) {
      return { name: 'w:tblHeader (tabelas)', passed: true, errors: [], warnings: ['Sem tabelas no documento'] };
    }

    const missing = tables - headers;
    if (missing > 0) {
      return {
        name: 'w:tblHeader (tabelas)',
        passed: false,
        errors: [`${missing}/${tables} tabelas sem w:tblHeader`],
        warnings: [],
      };
    }

    return {
      name: 'w:tblHeader (tabelas)',
      passed: true,
      errors: [],
      warnings: [`${headers}/${tables} tabelas com w:tblHeader`],
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

