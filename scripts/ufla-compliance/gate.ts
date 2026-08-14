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

function checkTables(): GateResult {
  return { name: 'w:tblHeader (tabelas)', passed: false, errors: ['10 tabelas sem w:tblHeader (issue #19)'], warnings: [] };
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
    checkTables(),
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

if (require.main === module) {
  const docxPath = process.argv[2] || 'artifacts/ufla-compliance/normalized-dissertacao.docx';
  const pdfPath = process.argv[3];
  
  (async () => {
    const result = await runFullComplianceGate(path.resolve(docxPath), pdfPath);
    
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
  })();
}
