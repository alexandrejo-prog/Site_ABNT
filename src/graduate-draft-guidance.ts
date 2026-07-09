import type { AcademicFields, WorkTypeValue } from "./ufla-rules";
import { isAdvisorRequired } from "./ufla-rules";
import { normalizeWorkType } from "./work-type-resolver";

export const FINAL_VERSION_PENDENCIES_TITLE = "Pendências de versão final";
export const EDITABLE_DRAFT_NOTICE =
  "Este DOCX é um rascunho editável. Antes da versão final, substitua orientador, banca, ficha catalográfica provisória e atualize o sumário no Word/LibreOffice.";
export const TOC_UPDATE_GUIDANCE =
  "O sumário será preenchido no Word/LibreOffice. Após abrir o arquivo, pressione Ctrl+A e F9 no Word, ou Ferramentas > Atualizar > Atualizar tudo no LibreOffice.";
export const DOCX_GENERATED_TOC_GUIDANCE =
  "DOCX gerado. Se o sumário aparecer vazio, atualize os campos no Word/LibreOffice. Isso é esperado.";

const LONG_FORM_TYPES = ["monografia", "dissertacao", "tese"] as const;
const GRADUATE_TYPES = ["dissertacao", "tese"] as const;
const TOC_FIELD_TYPES = ["dissertacao", "tese", "projeto_pesquisa"] as const;

export function isLongFormAcademicWork(workType: WorkTypeValue | string): boolean {
  return LONG_FORM_TYPES.includes(normalizeWorkType(workType) as (typeof LONG_FORM_TYPES)[number]);
}

export function isGraduateWork(workType: WorkTypeValue | string): boolean {
  return GRADUATE_TYPES.includes(normalizeWorkType(workType) as (typeof GRADUATE_TYPES)[number]);
}

export function needsTocUpdateGuidance(workType: WorkTypeValue | string): boolean {
  return TOC_FIELD_TYPES.includes(normalizeWorkType(workType) as (typeof TOC_FIELD_TYPES)[number]);
}

function looksLikeAdvisorPlaceholder(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    !normalized.trim() ||
    normalized.includes("[nome do orientador]") ||
    normalized.includes("nome do orientador") ||
    normalized.includes("preencher") ||
    normalized.includes("placeholder") ||
    normalized.includes("________________")
  );
}

export function finalVersionPendencies(fields: AcademicFields): string[] {
  if (!isLongFormAcademicWork(fields.workType)) return [];

  const pendencies: string[] = [];
  if (isAdvisorRequired(fields.workType) && looksLikeAdvisorPlaceholder(fields.advisor)) {
    pendencies.push("Substituir o orientador provisório pelo nome oficial do orientador.");
  }

  pendencies.push("Substituir a folha de aprovação provisória pelos dados oficiais da banca.");
  pendencies.push("Substituir a ficha catalográfica provisória pela ficha oficial da Biblioteca Universitária da UFLA.");

  return pendencies;
}

const PROJECT_LANGUAGE_PATTERNS = [
  /projeto de pesquisa/gi,
  /este projeto/gi,
  /o projeto/gi,
  /estrutura do projeto/gi,
  /será realizada/gi,
  /serão analisadas/gi,
  /pretende-se/gi,
];

function countProjectLanguageOccurrences(value: string): number {
  return PROJECT_LANGUAGE_PATTERNS.reduce((total, pattern) => {
    const matches = value.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
}

export function projectLanguageWarning(fields: AcademicFields, editorText = ""): string | null {
  if (!isGraduateWork(fields.workType)) return null;

  const source = [
    fields.resumo,
    fields.abstractText,
    fields.introducao,
    fields.conclusao,
    editorText,
  ].join("\n");

  if (countProjectLanguageOccurrences(source) < 3) return null;

  const label = normalizeWorkType(fields.workType) === "tese" ? "Tese" : "Dissertação";
  return `O tipo selecionado é ${label}, mas o texto ainda usa linguagem de projeto. Para ${label.toLowerCase()} final, revise expressões como ‘este projeto de pesquisa’ e verbos no futuro.`;
}
