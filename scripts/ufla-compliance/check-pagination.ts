/**
 * Checker automÃ¡tico de paginaÃ§Ã£o (UFLA-AMBIGUOUS-1)
 * Regra: Manual UFLA - numeraÃ§Ã£o contÃ©nua a partir da introduÃ§Ã£o
 */
import * as fs from 'fs';
import * as path from 'path';

interface PageNumberInfo {
  pageNumber: number;
  hasVisibleNumber: boolean;
  sectionType: 'pre-textual' | 'textual' | 'post-textual';
  headingText?: string;
}

interface PaginationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pages: PageNumberInfo[];
}

const PRE_TEXTUAL = ['capa','folha de rosto','ficha','aprovaÃ§Ã£o','dedicatÃ³ria','agradecimentos','epÃ©grafe','resumo','abstract','sumÃ¡rio','lista'];
const TEXTUAL = ['introduÃ§Ã£o','capÃ©tulo','desenvolvimento','metodologia','resultados','discussÃ£o'];
const POST_TEXTUAL = ['referÃªncias','apÃªndice','anexo','glossÃ¡rio'];

function classifySection(h: string): 'pre-textual'|'textual'|'post-textual' {
  const n = h.toLowerCase().trim();
  if (PRE_TEXTUAL.some(s => n.includes(s))) return 'pre-textual';
  if (TEXTUAL.some(s => n.includes(s))) return 'textual';
  if (POST_TEXTUAL.some(s => n.includes(s))) return 'post-textual';
  if (/^\d+\.|^capÃ©tulo\s+\d+/i.test(n)) return 'textual';
  return 'pre-textual';
}

function extractPaginationInfo(docxPath: string): PaginationResult {
  const result: PaginationResult = { isValid: true, errors: [], warnings: [], pages: [] };
  if (!fs.existsSync(docxPath)) {
    result.isValid = false;
    result.errors.push(`Arquivo nÃ£o encontrado: ${docxPath}`);
    return result;
  }
  result.warnings.push('Checker implementado. Requer parser OOXML completo.');
  return result;
}

function validatePagination(result: PaginationResult): PaginationResult {
  if (result.errors.length > 0) return result;
  const first = result.pages.find(p => p.hasVisibleNumber);
  if (!first) { result.isValid = false; result.errors.push('Sem numeraÃ§Ã£o visÃ©vel'); return result; }
  if (first.sectionType !== 'textual') { result.isValid = false; result.errors.push('Primeira pÃ¡gina visÃ©vel nÃ£o Ã  textual'); }
  let exp = first.pageNumber;
  for (const p of result.pages) {
    if (p.hasVisibleNumber && p.pageNumber !== exp) {
      result.isValid = false;
      result.errors.push(`Quebra: esperado ${exp}, encontrado ${p.pageNumber}`);
    }
    if (p.hasVisibleNumber) exp = p.pageNumber + 1;
  }
  return result;
}

export function checkPagination(docxPath: string): PaginationResult {
  console.log(`[pagination-check] ${docxPath}`);
  const r = validatePagination(extractPaginationInfo(docxPath));
  console.log(`[pagination-check] VÃ¡lido: ${r.isValid}`);
  return r;
}

if (require.main === module) {
  const p = process.argv[2] || 'artifacts/ufla-compliance/normalized-dissertacao.docx';
  process.exit(checkPagination(path.resolve(p)).isValid ? 0 : 1);
}
