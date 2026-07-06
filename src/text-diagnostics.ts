import { AcademicFields } from "./ufla-rules";

export interface ResumoHeuristics {
  hasObjective: boolean;
  hasMethod: boolean;
  hasResult: boolean;
  hasConclusion: boolean;
}

const OBJECTIVE_TERMS = ["objetivo", "analisa", "investiga", "compreender", "avaliar", "objetiva", "busca", "propoe", "propõe", "estuda", "verificar"];
const METHOD_TERMS = ["metodologia", "pesquisa qualitativa", "analise", "análise", "registros", "observacao", "observação", "entrevistas", "questionario", "questionário", "levantamento", "abordagem", "procedimentos"];
const RESULT_TERMS = ["resultados indicam", "verificou-se", "evidencia", "evidenciou", "constatou", "observou-se", "demonstrou", "apontaram"];
const CONCLUSION_TERMS = ["conclui-se", "considera-se", "conclui", "considera", "infere-se", "portanto", "dessa forma"];

function hasAny(text: string, terms: string[]): boolean {
  const normalized = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function assessResumoHeuristics(resumo: string): ResumoHeuristics {
  return {
    hasObjective: hasAny(resumo, OBJECTIVE_TERMS),
    hasMethod: hasAny(resumo, METHOD_TERMS),
    hasResult: hasAny(resumo, RESULT_TERMS),
    hasConclusion: hasAny(resumo, CONCLUSION_TERMS),
  };
}

const PT_WORDS = new Set([
  "de", "da", "do", "que", "o", "a", "e", "para", "com", "em", "um", "uma", "os", "as",
  "no", "na", "por", "se", "ao", "dos", "das", "este", "esta", "foi", "sao", "não", "nao",
  "trabalho", "pesquisa", "estudo", "resumo", "objetivo", "metodo", "método", "resultados",
  "conclusao", "conclusão", "autor", "artigo", "sobre", "através", "através", "mais",
]);

const EN_MARKERS = ["the", "of", "and", "in", "on", "to", "for", "with", "this", "study", "paper", "research", "results", "conclusion", "objective", "method"];

export interface AbstractHeuristics {
  isEmpty: boolean;
  looksEnglish: boolean;
  tooMuchPortuguese: boolean;
  sharedTerms: number;
}

export function assessAbstractHeuristics(fields: AcademicFields): AbstractHeuristics {
  const abstract = fields.abstractText.trim();
  const isEmpty = abstract.length === 0;
  if (isEmpty) return { isEmpty: true, looksEnglish: false, tooMuchPortuguese: false, sharedTerms: 0 };

  const words = abstract.toLowerCase().split(/\s+/).filter(Boolean);
  const enCount = words.filter((word) => EN_MARKERS.includes(word)).length;
  const ptCount = words.filter((word) => PT_WORDS.has(word)).length;
  const looksEnglish = enCount >= ptCount;
  const tooMuchPortuguese = ptCount > enCount && ptCount > 0;

  const ptTerms = new Set(
    `${fields.title} ${fields.resumo} ${fields.workNature}`
      .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !PT_WORDS.has(t)),
  );
  const enTerms = new Set(words.filter((t) => t.length > 2 && !EN_MARKERS.includes(t) && !PT_WORDS.has(t)));
  let shared = 0;
  for (const term of enTerms) if (ptTerms.has(term)) shared += 1;

  return { isEmpty, looksEnglish, tooMuchPortuguese, sharedTerms: shared };
}

export interface TextDiagnostic {
  titleResumeConsistent: boolean;
  resumeAbstractConsistent: boolean;
  hasObjective: boolean;
  hasMethod: boolean;
  hasResultConclusion: boolean;
  hasKeywords: boolean;
  genericWarnings: number;
}

export function buildTextDiagnostic(fields: AcademicFields): TextDiagnostic {
  const resumo = assessResumoHeuristics(fields.resumo);
  const abstract = assessAbstractHeuristics(fields);
  const hasKeywords = fields.palavrasChave.split(/[;.]/).map((t) => t.trim()).filter(Boolean).length >= 3;

  const titleTerms = new Set(fields.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const resumoTerms = new Set(fields.resumo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const sharedTitleResume = [...titleTerms].filter((t) => resumoTerms.has(t)).length;
  const titleResumeConsistent = titleTerms.size === 0 || sharedTitleResume > 0;

  const abstractTerms = new Set(fields.abstractText.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const sharedResumeAbstract = [...resumoTerms].filter((t) => abstractTerms.has(t)).length;
  const resumeAbstractConsistent = fields.abstractText.trim().length === 0 || resumoTerms.size === 0 || sharedResumeAbstract > 0 || abstract.sharedTerms > 0;

  return {
    titleResumeConsistent,
    resumeAbstractConsistent,
    hasObjective: resumo.hasObjective,
    hasMethod: resumo.hasMethod,
    hasResultConclusion: resumo.hasResult || resumo.hasConclusion,
    hasKeywords,
    genericWarnings: 0,
  };
}
