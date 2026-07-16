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

  // Idioma do documento: o exportador define pt-BR em docDefaults (w:lang).
  // Aviso informativo caso o trabalho seja em lingua estrangeira e exija
  // ajuste manual no Word/LibreOffice.
  if (fields.workType !== "artigo" && fields.workType !== "") {
    issues.push({
      id: "doc-language-info",
      severity: "info",
      message: "O DOCX e gerado com idioma do documento pt-BR (definido em docDefaults/w:lang). Confira se o idioma esta correto para o trabalho.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "No Word/LibreOffice, ajuste o idioma do documento se o trabalho for em lingua estrangeira.",
    });
  }

  // Imagens/ilustracoes sem texto alternativo (alt). A inspecao DEFINITIVA
  // ocorre em analyzeExportedDocxAccessibility (XML real). Aqui apenas
  // sinalizamos imagens importadas cuja legenda (caption) nao foi preservada,
  // evitando falso positivo quando a legenda existe. A legenda textual vira
  // title/desc no desenho (ver importedImageParagraph), cumprindo o alt.
  const importedWithoutCaption = /\[Imagem detectada:[^\]]*sem legenda[^\]]*\]/i.test(fields.imageWarnings || "");
  const editorWithoutCaption = /\[Imagem detectada:/i.test(editorText) &&
    !/!\[[^\]]*\]\([^)]*\)/i.test(editorText) &&
    !/Imagem detectada:[^\]]*legenda/i.test(editorText);
  if (importedWithoutCaption || editorWithoutCaption) {
    issues.push({
      id: "illustration-alt-missing",
      severity: "warning",
      message: "Ha ilustracoes sem texto alternativo (alt) claro detectado. A 6a ed. reforca a acessibilidade digital.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "Adicione descricao alternativa (legenda) as ilustracoes/figuras antes da versao final para leitores de tela.",
    });
  }

  return issues;
}

// Inspecao REAL do DOCX ja gerado (XML). Substitui a heurística acima quando
// o artefato esta disponivel. Verifica: idioma (w:lang), continuidade do
// outline (Heading1..5 sem saltos) e texto alternativo nos desenhos.
export interface ExportedDocxAccessibilityResult {
  issues: DocxAccessibilityIssue[];
  inspected: boolean;
}

const HEADING_STYLE_RE = /w:val="(Heading[1-5]|TOC[1-5])"/i;

export function analyzeExportedDocxAccessibility(documentXml: string): ExportedDocxAccessibilityResult {
  const issues: DocxAccessibilityIssue[] = [];

  if (!documentXml || typeof documentXml !== "string") {
    return { issues, inspected: false };
  }

  // 1) Idioma do documento (w:lang, em docDefaults ou rPr).
  const hasLang = /<w:lang\b[^>]*\bw:val="([^"]+)"/i.test(documentXml) ||
    /<w:lang\b[^>]*>/i.test(documentXml);
  if (!hasLang) {
    issues.push({
      id: "doc-language-missing",
      severity: "warning",
      message: "O documento nao define idioma (w:lang). Leitores de tela podem nao configurar a pronuncia correta.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "Defina o idioma pt-BR do documento (docDefaults/rPr) no exportador.",
    });
  }

  // 2) Continuidade do outline: detecta saltos de nivel (ex.: 1 -> 1.1.1).
  const styleMatches = documentXml.match(/<w:pStyle\b[^>]*>/gi) || [];
  const levelsInOrder: number[] = [];
  for (const tag of styleMatches) {
    const m = tag.match(HEADING_STYLE_RE);
    if (m) {
      const name = m[1].toLowerCase();
      const isToc = name.startsWith("toc");
      const level = Number(name.replace(/\D/g, ""));
      // TOC nao conta como salto de hierarquia estrutural; consideramos
      // apenas titulos de secao (Heading).
      if (!isToc) levelsInOrder.push(level);
    }
  }
  let previous = 0;
  for (const lvl of levelsInOrder) {
    if (previous !== 0 && lvl > previous + 1) {
      issues.push({
        id: "doc-outline-jump",
        severity: "warning",
        message: "O outline do documento apresenta salto de nivel de secao (ex.: 1 para 1.1.1).",
        why: UFLA_DOCX_ACCESSIBILITY.source,
        action: "Renumere/estruture as secoes de forma continua (1, 1.1, 1.1.1) sem pular niveis.",
      });
      break;
    }
    previous = lvl;
  }

  // 3) Texto alternativo nos desenhos (figuras). Cada <w:drawing> deve ter
  // docPr com title ou desc (alt). Falso positivo evitado: se houver docPr
  // com title/desc, a figura tem alt.
  const drawings = documentXml.match(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi) || [];
  if (drawings.length > 0) {
    const withoutAlt = drawings.filter((d) => {
      // docPr pode vir como <wp:docPr ... title="..."> ou <a:title>...</a:title>/<a:desc>...</a:desc>
      const hasTitleAttr = /<wp:docPr\b[^>]*\btitle="[^"]+/i.test(d);
      const hasDescElem = /<a:(title|desc)\b[\s\S]*?<\/a:(title|desc)>/i.test(d);
      return !(hasTitleAttr || hasDescElem);
    });
    if (withoutAlt.length > 0) {
      issues.push({
        id: "doc-illustration-alt-missing",
        severity: "warning",
        message: `${withoutAlt.length} figura(s) sem texto alternativo (alt) no DOCX gerado. A 6a ed. exige acessibilidade digital.`,
        why: UFLA_DOCX_ACCESSIBILITY.source,
        action: "Inclua legenda/descricao nas figuras (vira title/desc no desenho) para leitores de tela.",
      });
    }
  }

  return { issues, inspected: true };
}
