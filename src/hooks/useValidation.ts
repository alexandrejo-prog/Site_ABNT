import { useCallback, useMemo, useState } from "react";
import type { AcademicFields } from "../ufla-rules";
import { ValidationIssue, hasBlockingErrors, validateWork } from "../validators";
import { isNonOverridableError } from "../generation-blockers";
import { isCpgWork } from "../ufla-rules";
import { stripCpgForbiddenSections, hasCpgForbiddenSections } from "../cpg-content-filter";

function cpgAutoFilterIssue(workType: AcademicFields["workType"], originalText: string, validationText: string): ValidationIssue | null {
  if (!isCpgWork(workType)) return null;
  if (!hasCpgForbiddenSections(originalText)) return null;
  if (originalText.trim() === validationText.trim()) return null;
  return {
    severity: "warning",
    code: "cpg-auto-filtered-structures",
    message: "Seções incompatíveis com CPG/UFLA serão removidas automaticamente do DOCX.",
    what: "O texto importado contém elementos como indicadores de impacto, sumário, ficha, folha de aprovação, apêndices ou anexos.",
    why: "O modelo CPG/UFLA não usa esses elementos no corpo do artigo/resumo, mas o sistema consegue removê-los com segurança antes da validação e da exportação.",
    action: "Confira o DOCX gerado e revise a numeração das seções no Word/LibreOffice antes da submissão final.",
  };
}

export type EditorMode = "body" | "references";

export function useValidation() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [generateAnyway, setGenerateAnyway] = useState(false);

  const errors = useMemo(() => issues.filter((i) => i.severity === "error"), [issues]);
  const warnings = useMemo(() => issues.filter((i) => i.severity === "warning" || i.severity === "info"), [issues]);

  const runValidation = useCallback((fields: AcademicFields, editorText: string, editorMode: EditorMode, fichaImageProvided?: boolean) => {
    const textToValidate = editorMode === "references" ? fields.referencias : editorText;
    const rawText = textToValidate;
    let processedText = textToValidate;
    if (isCpgWork(fields.workType) && editorMode !== "references") {
      processedText = stripCpgForbiddenSections(textToValidate);
    }
    const nextIssues = [...validateWork(fields, processedText, { fichaImageProvided: fichaImageProvided === true })];
    const autoFilterIssue = cpgAutoFilterIssue(fields.workType, rawText, processedText);
    if (autoFilterIssue) nextIssues.push(autoFilterIssue);
    setIssues(nextIssues);
    return { issues: nextIssues, hasBlocking: hasBlockingErrors(nextIssues), canGenerate: !nextIssues.some((i) => i.severity === "error" && isNonOverridableError(i)) };
  }, []);

  return { issues, errors, warnings, generateAnyway, setGenerateAnyway, setIssues, runValidation, resetValidation: () => setIssues([]) };
}
