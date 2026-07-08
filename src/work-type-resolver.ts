import { WORK_TYPE_LABELS, WORK_TYPES, type WorkType, type WorkTypeValue } from "./ufla-rules";

function foldWorkType(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const WORK_TYPE_ALIASES: Array<[string, WorkType]> = [
  ["artigo", "artigo"],
  ["artigo simples", "artigo"],
  ["artigo academico", "artigo"],
  ["artigo academico simples", "artigo"],
  ["monografia", "monografia"],
  ["tcc", "monografia"],
  ["trabalho de conclusao de curso", "monografia"],
  ["dissertacao", "dissertacao"],
  ["mestrado", "dissertacao"],
  ["tese", "tese"],
  ["doutorado", "tese"],
  ["projeto", "projeto_pesquisa"],
  ["projeto de pesquisa", "projeto_pesquisa"],
  ["resumo cpg", "resumo_cpg"],
  ["resumo cpg ufla", "resumo_cpg"],
  ["resumo expandido cpg", "resumo_expandido_cpg"],
  ["resumo expandido cpg ufla", "resumo_expandido_cpg"],
  ["artigo completo cpg", "artigo_completo_cpg"],
  ["artigo completo cpg ufla", "artigo_completo_cpg"],
];

const WORK_TYPE_BY_NORMALIZED = new Map<string, WorkType>();

for (const type of WORK_TYPES) {
  WORK_TYPE_BY_NORMALIZED.set(foldWorkType(type), type);
  WORK_TYPE_BY_NORMALIZED.set(foldWorkType(WORK_TYPE_LABELS[type]), type);
}

for (const [alias, type] of WORK_TYPE_ALIASES) {
  WORK_TYPE_BY_NORMALIZED.set(foldWorkType(alias), type);
}

export function normalizeWorkType(value: string | null | undefined): WorkTypeValue {
  if (!value) return "";

  const normalized = WORK_TYPE_BY_NORMALIZED.get(foldWorkType(value));
  return normalized ?? "";
}

export function resolveActiveWorkType(...candidates: Array<string | null | undefined>): WorkTypeValue {
  for (const candidate of candidates) {
    const normalized = normalizeWorkType(candidate);
    if (normalized) return normalized;
  }

  return "";
}
