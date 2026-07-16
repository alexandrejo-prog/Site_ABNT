import type { AcademicFields } from "./ufla-rules";
import { UFLA_DOCX_ACCESSIBILITY } from "./ufla-rules";
import { headingLevelFromParagraphXml, splitParagraphs } from "./section-aliases";

export interface DocxAccessibilityIssue {
  id: string;
  severity: "warning" | "info";
  message: string;
  why: string;
  action: string;
}

// Camada minima de acessibilidade digital do DOCX (6a ed. do Manual UFLA).
// Gera AVISOS, nunca bloqueia a geracao, nesta rodada.
//
// Status explicito (Rodada 3):
//  - GARANTIDO: idioma pt-BR em docDefaults (emitido pelo exportador via
//    default.document.run.language); titulos Heading1..5 no outline.
//  - APENAS AVISADO: idioma ausente/divergente, saltos de outline, figuras
//    sem alt. Nenhum deles bloqueia a geracao.
//  - PENDENTE (proximas rodadas): alt text automatico a partir de legenda;
//    verificacao de contraste/estrutura de tabelas; idioma por trecho.
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
  // Sinais explicitos de conformidade (garantido vs ausente).
  languageDetected?: string | null;
  languageOk?: boolean;
}

export function analyzeExportedDocxAccessibility(documentXml: string): ExportedDocxAccessibilityResult {
  const issues: DocxAccessibilityIssue[] = [];

  if (!documentXml || typeof documentXml !== "string") {
    return { issues, inspected: false };
  }

  // 1) Idioma do documento (GARANTIDO quando pt-BR em docDefaults/rPr padrao).
  // Para evitar falso positivo, consideramos o idioma "do documento" apenas se
  // w:lang aparecer em docDefaults (w:rPrDefault/w:lang) ou em rPrDefault.
  // Um run isolado com idioma estrangeiro (citacao) nao conta como idioma do
  // documento.
  const defaultsLang = /<w:rPrDefault\b[\s\S]*?<w:lang\b[^>]*\bw:val="([^"]+)"/i.exec(documentXml) ||
    /<w:docDefaults\b[\s\S]*?<w:lang\b[^>]*\bw:val="([^"]+)"/i.exec(documentXml);
  const languageDetected = defaultsLang ? defaultsLang[1] : null;
  const languageOk = languageDetected != null;
  if (!languageOk) {
    issues.push({
      id: "doc-language-missing",
      severity: "warning",
      message: "O documento nao define idioma (w:lang) em docDefaults. Leitores de tela podem nao configurar a pronuncia correta.",
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "Defina o idioma pt-BR do documento (docDefaults/rPr) no exportador.",
    });
  } else if (languageDetected!.toLowerCase() !== "pt-br") {
    issues.push({
      id: "doc-language-divergent",
      severity: "warning",
      message: `O idioma do documento esta definido como "${languageDetected}" (esperado pt-BR).`,
      why: UFLA_DOCX_ACCESSIBILITY.source,
      action: "Ajuste o idioma do documento para pt-BR no exportador ou no Word/LibreOffice.",
    });
  }

  // 2) Continuidade do outline: detecta saltos de nivel (ex.: 1 -> 1.1.1).
  // Leitura por paragrafo completo <w:p>, usando o criterio semantico
  // compartilhado (headingLevelFromParagraphXml). TOC nao conta como salto.
  const paragraphs = splitParagraphs(documentXml);
  const levelsInOrder: number[] = [];
  for (const p of paragraphs) {
    const lvl = headingLevelFromParagraphXml(p);
    if (lvl !== null) levelsInOrder.push(lvl);
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
  // docPr com title ou <a:title>/<a:desc> (alt). Falso positivo evitado:
  // se houver docPr com title/desc, a figura tem alt. Leitura por desenho
  // individual (split seguro), sem regex guloso.
  const drawings = documentXml.match(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi) || [];
  if (drawings.length > 0) {
    const withoutAlt = drawings.filter((d) => {
      const hasTitleAttr = /<wp:docPr\b[^>]*\btitle="[^"]+/i.test(d);
      const hasDescElem = /<a:(?:title|desc)\b[\s\S]*?<\/a:(?:title|desc)>/i.test(d);
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

  return { issues, inspected: true, languageDetected, languageOk };
}
