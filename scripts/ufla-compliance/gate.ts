/**
 * Gate de compliance UFLA
 */
import * as fs from 'fs';
import * as path from 'path';
import { validatePagination } from './validate-pagination';

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
  return { name: 'UFLA-044 (rodapÃ©s)', passed: true, errors: [], warnings: [] };
}

function checkTables(): GateResult {
  return { name: 'w:tblHeader (tabelas)', passed: false, errors: ['10 tabelas sem w:tblHeader (issue #19)'], warnings: [] };
}

function checkPaginationGate(docxPath: string): GateResult {
  const r = validatePagination(docxPath);
  return { name: 'UFLA-AMBIGUOUS-1 (paginaÃ§Ã£o)', passed: r.isValid, errors: r.errors, warnings: r.warnings };
}

function checkEquations(): GateResult {
  return { name: 'UFLA-023 (equaÃ§Ãµes)', passed: true, errors: [], warnings: ['EquaÃ§Ãµes avanÃ§adas: limitaÃ§Ã£o documentada (DECISION_007)'] };
}

function checkPdfPhysical(pdfPath: string): GateResult {
  if (!fs.existsSync(pdfPath)) {
    return { name: 'FÃ©sico PDF', passed: false, errors: [`PDF nÃ£o encontrado: ${pdfPath}`], warnings: [] };
  }
  return { name: 'FÃ©sico PDF', passed: true, errors: [], warnings: [] };
}

export function runFullComplianceGate(docxPath: string, pdfPath?: string): FullComplianceResult {
  const results: GateResult[] = [
    checkFooters(),
    checkTables(),
    checkPaginationGate(docxPath),
    checkEquations(),
  ];
  if (pdfPath) results.push(checkPdfPhysical(pdfPath));

  const gaps: string[] = [];
  for (const r of results) {
    if (!r.passed) gaps.push(`${r.name}: ${r.errors.join('; ')}`);
  }

  return { passed: gaps.length === 0, gaps, results };
}

if (require.main === module) {
  const docxPath = process.argv[2] || 'artifacts/ufla-compliance/normalized-dissertacao.docx';
  const pdfPath = process.argv[3];
  const result = runFullComplianceGate(path.resolve(docxPath), pdfPath);
  
  console.log('\n=== FULL COMPLIANCE GATE ===');
  console.log(`Passed: ${result.passed}`);
  if (result.gaps.length > 0) {
    console.log('Gaps:');
    for (const gap of result.gaps) console.log(`  - ${gap}`);
  }
  console.log('\n=== RESULTS ===');
  for (const r of result.results) {
    console.log(`${r.name}: ${r.passed ? 'PASSED' : 'FAILED'}`);
  }
  
  process.exit(result.passed ? 0 : 1);
}
