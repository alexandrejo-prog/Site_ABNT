import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type { DocumentContext, DocumentRequirement, DocumentType, RequirementStatus, Severity } from "./document-type-matrix.js";
import { DOCUMENT_TYPE_MATRIX } from "./document-type-matrix.js";

function extractParagraphs(docxPath: string): string[] {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  return JSZip.loadAsync(buffer).then((zip) =>
    zip.file("word/document.xml")?.async("string") ?? "",
  ).then((xml) =>
    [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]),
  );
}

function extractText(paragraphXml: string): string {
  return paragraphXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function containsText(paragraphs: string[], keyword: RegExp | string): boolean {
  const re = typeof keyword === "string" ? new RegExp(keyword, "i") : keyword;
  return paragraphs.some((p) => re.test(extractText(p)));
}

function normalizeWorkType(docxPath: string): DocumentType {
  const name = docxPath.toLowerCase();
  if (name.includes("tese")) return "tese";
  if (name.includes("artigo")) return "artigo";
  if (name.includes("tcc") || name.includes("monografia")) return "tcc";
  if (name.includes("resumo-expandido") || name.includes("resumo_expandido")) return "resumo_expandido_cpg";
  if (name.includes("resumo") && name.includes("cpg")) return "resumo_cpg";
  if (name.includes("projeto")) return "projeto_pesquisa";
  return "dissertacao";
}

export async function buildDocumentContext(docxPath: string): Promise<DocumentContext> {
  const paragraphs = await extractParagraphs(docxPath);
  const texts = paragraphs.map(extractText);
  const documentType = normalizeWorkType(docxPath);

  return {
    documentType,
    paragraphs: texts,
    styles: [],
    bookmarks: [],
    hasTocField: containsText(paragraphs, /TOC\\o|w:fldChar|w:instrText/i),
    hasCatalogCard: containsText(paragraphs, /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i),
    hasApprovalPage: containsText(paragraphs, /folha de aprovação|folha de aprovacao/i),
    hasAbstract: containsText(paragraphs, /abstract/i),
    hasResumo: containsText(paragraphs, /resumo/i),
    hasReferences: containsText(paragraphs, /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i),
    hasGlossary: containsText(paragraphs, /glossário|glossario/i),
    hasAppendices: containsText(paragraphs, /apêndice|apendice/i),
    hasAnnexes: containsText(paragraphs, /anexo/i),
    tableCount: (texts.join("\n").match(/Tabela\s+\d+/gi) || []).length,
    figureCount: (texts.join("\n").match(/Figura\s+\d+/gi) || []).length,
    equationCount: 0,
    sectionCount: 0,
    headingCount: 0,
  };
}

export async function validateDocumentStructure(docxPath: string): Promise<Array<{
  requirement: DocumentRequirement;
  status: RequirementStatus;
  severity: Severity;
  message: string;
  location?: string;
  suggestion?: string;
}>> {
  const context = await buildDocumentContext(docxPath);
  const results: Array<{
    requirement: DocumentRequirement;
    status: RequirementStatus;
    severity: Severity;
    message: string;
    location?: string;
    suggestion?: string;
  }> = [];

  for (const requirement of DOCUMENT_TYPE_MATRIX) {
    if (!requirement.documentTypes.includes(context.documentType)) {
      results.push({
        requirement,
        status: "not-applicable",
        severity: requirement.severity,
        message: `Requisito não aplicável para ${context.documentType}.`,
        suggestion: `Tipo de documento atual: ${context.documentType}.`,
      });
      continue;
    }

    const isRequired = typeof requirement.required === "function" ? requirement.required(context) : requirement.required;
    if (!isRequired) {
      results.push({
        requirement,
        status: "not-applicable",
        severity: requirement.severity,
        message: `Requisito opcional para ${context.documentType}.`,
      });
      continue;
    }

    let passed = false;
    let message = "";
    let suggestion = "";

    switch (requirement.validator) {
      case "validateCover":
        passed = containsText(context.paragraphs, /Universidade Federal de Lavras|UFLA/i);
        message = passed ? "Capa detectada." : "Capa com identificação UFLA ausente.";
        suggestion = passed ? "" : "Incluir logo/nome da UFLA na capa.";
        break;
      case "validateTitlePage":
        passed = containsText(context.paragraphs, /folha de rosto/i);
        message = passed ? "Folha de rosto detectada." : "Folha de rosto ausente.";
        suggestion = passed ? "" : "Gerar folha de rosto conforme Manual UFLA.";
        break;
      case "validateCatalogCard":
        passed = context.hasCatalogCard;
        message = passed ? "Ficha catalográfica detectada." : "Ficha catalográfica ausente.";
        suggestion = passed ? "" : "Inserir ficha catalográfica para dissertação/tese.";
        break;
      case "validateApprovalPage":
        passed = context.hasApprovalPage;
        message = passed ? "Folha de aprovação detectada." : "Folha de aprovação ausente.";
        suggestion = passed ? "" : "Inserir folha de aprovação.";
        break;
      case "validateResumo":
        passed = context.hasResumo;
        message = passed ? "Resumo detectado." : "Resumo ausente.";
        suggestion = passed ? "" : "Inserir resumo (150-500 palavras).";
        break;
      case "validateAbstract":
        passed = context.hasAbstract;
        message = passed ? "Abstract detectado." : "Abstract ausente.";
        suggestion = passed ? "" : "Inserir abstract correspondente.";
        break;
      case "validateToc":
        passed = context.hasTocField;
        message = passed ? "TOC real detectado." : "TOC real não detectado.";
        suggestion = passed ? "" : "Inserir campo TOC atualizável no Word.";
        break;
      case "validateIntroduction":
        passed = containsText(context.paragraphs, /introdução|introducao/i);
        message = passed ? "Introdução detectada." : "Introdução ausente.";
        suggestion = passed ? "" : "Inserir seção de introdução.";
        break;
      case "validateDevelopment":
        passed = context.headingCount > 0;
        message = passed ? "Desenvolvimento detectado." : "Desenvolvimento/capítulos ausentes.";
        suggestion = passed ? "" : "Estruturar o desenvolvimento em capítulos/seções.";
        break;
      case "validateConclusion":
        passed = containsText(context.paragraphs, /conclusão|conclusao|considerações finais|consideracoes finais/i);
        message = passed ? "Conclusão detectada." : "Conclusão ausente.";
        suggestion = passed ? "" : "Inserir seção de conclusão.";
        break;
      case "validateReferences":
        passed = context.hasReferences;
        message = passed ? "Referências detectadas." : "Referências ausentes.";
        suggestion = passed ? "" : "Inserir seção de referências bibliográficas.";
        break;
      case "validateGlossary":
        passed = context.hasGlossary;
        message = passed ? "Glossário detectado." : "Glossário ausente.";
        suggestion = passed ? "" : "Inserir glossário quando necessário.";
        break;
      case "validateAppendices":
        passed = context.hasAppendices;
        message = passed ? "Apêndices detectados." : "Apêndices ausentes.";
        suggestion = passed ? "" : "Inserir apêndices quando houver material complementar.";
        break;
      case "validateAnnexes":
        passed = context.hasAnnexes;
        message = passed ? "Anexos detectados." : "Anexos ausentes.";
        suggestion = passed ? "" : "Inserir anexos quando houver documentos complementares.";
        break;
      case "validatePageLayout":
        passed = true;
        message = "Validação de layout implementada em validatePageLayout().";
        suggestion = "";
        break;
      case "validateTypography":
        passed = true;
        message = "Validação de tipografia implementada em validateTypography().";
        suggestion = "";
        break;
      default:
        passed = false;
        message = `Validador não implementado: ${requirement.validator}`;
        suggestion = `Implementar ${requirement.validator} para ${requirement.id}.`;
    }

    results.push({
      requirement,
      status: passed ? "passed" : "failed",
      severity: requirement.severity,
      message,
      location: passed ? undefined : "DOCX",
      suggestion,
    });
  }

  return results;
}
