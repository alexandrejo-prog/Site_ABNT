import type { AcademicFields } from "./ufla-rules";

export type WorkTypeConsistencyLevel = "ok" | "warning";

export interface WorkTypeConsistencyResult {
  level: WorkTypeConsistencyLevel;
  expectedNatureStart?: string;
  reason?: string;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function expectedGraduateNatureStart(workType: AcademicFields["workType"]): string | undefined {
  if (workType === "monografia") return "Monografia apresentada à Universidade Federal de Lavras";
  if (workType === "dissertacao") return "Dissertação apresentada à Universidade Federal de Lavras";
  if (workType === "tese") return "Tese apresentada à Universidade Federal de Lavras";
  return undefined;
}

export function isProjectNature(value: string): boolean {
  return fold(value).includes("projeto de pesquisa apresentado a universidade federal de lavras");
}

export function isGraduateNatureMismatch(fields: AcademicFields): boolean {
  if (fields.workType !== "monografia" && fields.workType !== "dissertacao" && fields.workType !== "tese") return false;
  return isProjectNature(fields.workNature);
}

export function workTypeConsistency(fields: AcademicFields): WorkTypeConsistencyResult {
  const expectedNatureStart = expectedGraduateNatureStart(fields.workType);

  if (!expectedNatureStart) return { level: "ok" };

  if (isProjectNature(fields.workNature)) {
    return {
      level: "warning",
      expectedNatureStart,
      reason: "A natureza do trabalho ainda descreve projeto de pesquisa, mas o tipo selecionado exige natureza própria.",
    };
  }

  const normalizedNature = fold(fields.workNature);
  const normalizedExpected = fold(expectedNatureStart);
  if (normalizedNature && !normalizedNature.startsWith(normalizedExpected)) {
    return {
      level: "warning",
      expectedNatureStart,
      reason: "A natureza do trabalho não começa com a forma esperada para monografia, dissertação ou tese.",
    };
  }

  return { level: "ok" };
}
