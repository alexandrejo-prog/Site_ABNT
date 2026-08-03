import type { AcademicFieldKey } from "./ufla-rules";

/** Alvos especiais que não correspondem a um id de input. */
export const FIELD_TARGET_EDITOR = "__editor__";
export const FIELD_TARGET_WORK_TYPE = "__work_type__";

export type FieldTarget =
  | { kind: "field"; id: string }
  | { kind: "editor" }
  | { kind: "workType" };

/**
 * Traduz uma chave de campo/área em um alvo de navegação concreto.
 * Campos acadêmicos têm um input com id igual à chave; texto principal e
 * referências são alvos especiais no editor.
 */
export function resolveFieldTarget(key: string): FieldTarget {
  if (key === FIELD_TARGET_EDITOR) return { kind: "editor" };
  if (key === FIELD_TARGET_WORK_TYPE) return { kind: "workType" };
  return { kind: "field", id: key };
}

const METADATA_KEYS: ReadonlySet<string> = new Set([
  "author", "title", "subtitle", "englishTitle", "workNature", "course", "program",
  "advisor", "coadvisor", "location", "year", "resumo", "palavrasChave",
  "abstractText", "keywords", "introducao", "conclusao", "referencias",
  "anexos", "apendices", "dedicatoria", "agradecimentos", "epigrafe", "errata",
  "listaAbreviaturas", "listaSimbolos", "glossario",
  "indicadoresImpacto", "impactIndicators",
]);

export function isAcademicFieldKey(key: string): key is AcademicFieldKey {
  return METADATA_KEYS.has(key as AcademicFieldKey);
}

/** Indica se um alvo aponta para o editor do texto principal. */
export function targetsEditor(target: FieldTarget): boolean {
  return target.kind === "editor";
}