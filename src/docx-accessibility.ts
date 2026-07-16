import type { AcademicFields } from "./ufla-rules";
import { UFLA_DOCX_ACCESSIBILITY } from "./ufla-rules";

export interface DocxAccessibilityIssue {
  id: string;
  severity: "warning" | "info";
  message: string;
  why: string;
  action: string;
}

// Camada minima de acessibilidade digital do DOCX (6a ed. do Manual UFLA).
// Gera AVISOS, nunca bloqueia a geracao, no primeiro recorte.
export function collectDocxAccessibilityWarnings(
  fields: AcademicFields,
  editorText: string,
): DocxAccessibilityIssue[] {
  const issues: DocxAccessibilityIssue[] = [];

  // Idioma do documento: o exportador define pt-BR; aviso informativo caso
  // o trabalho seja em lingua estrangeira e exija ajuste manual no Word.
  if (fields.workType !== "artigo" && fields.workType !== "") {
    issues.push({
      id: "doc-language-info",
      severity: "info",
      message: "O DOCX e gerado com idioma do documento pt-BR (ABNT). Confira se o idioma esta correto para o trabalho.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "No Word/LibreOffice, ajuste o idioma do documento se o trabalho for em lingua estrangeira.",
    });
  }

  // Imagens/ilustracoes sem texto alternativo (alt): o pipeline preserva
  // imagens, mas o alt text e exigencia de acessibilidade da 6a ed.
  const importedImageWithoutAlt = /\[Imagem detectada:([^\]]*)\]/i.test(fields.imageWarnings || "");
  const editorImageWithoutAlt = /!\[[^\]]*\]\([^)]*\)/i.test(editorText) === false && /\[Imagem detectada:/i.test(editorText);
  if (importedImageWithoutAlt || editorImageWithoutAlt) {
    issues.push({
      id: "illustration-alt-missing",
      severity: "warning",
      message: "Ha ilustracoes sem texto alternativo (alt) detectado. A 6a ed. reforca a acessibilidade digital.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "Adicione descricao alternativa as ilustracoes/figuras antes da versao final para leitores de tela.",
    });
  }

  return issues;
}
