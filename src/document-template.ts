import type { DocxGenerationInput } from "./export-docx";
import { isCpgWork, isResearchProject, type WorkTypeValue } from "./ufla-rules";

export interface DocumentTemplate {
  id: string;
  label: string;
  supports(workType: string): boolean;
  generate(input: DocxGenerationInput): Promise<Blob>;
}

export const generalTemplate: DocumentTemplate = {
  id: "geral",
  label: "Modelo geral",
  // artigo_cientifico_ufla cai no modelo geral porque a UI sÃ³ exibe o painel "Artigo acadÃªmico simples" para workType === "artigo" (App.tsx).
  supports: (workType) => !workType || (!isCpgWork(workType as WorkTypeValue) && !isResearchProject(workType as WorkTypeValue) && workType !== "artigo"),
  async generate(input) {
    const { generateDocxBlob } = await import("./export-docx");
    return generateDocxBlob(input);
  },
};

export const articleTemplate: DocumentTemplate = {
  id: "artigo",
  label: "Artigo",
  supports: (workType) => workType === "artigo",
  async generate(input) {
    const { generateArticleDocxBlob } = await import("./export-article-docx");
    return generateArticleDocxBlob(input);
  },
};

export const cpgTemplate: DocumentTemplate = {
  id: "cpg",
  label: "CPG",
  supports: (workType) => isCpgWork(workType as WorkTypeValue),
  async generate(input) {
    const { generateCpgDocxBlob } = await import("./export-cpg-docx");
    return generateCpgDocxBlob(input);
  },
};

export const researchProjectTemplate: DocumentTemplate = {
  id: "projeto-pesquisa",
  label: "Projeto de pesquisa",
  supports: (workType) => isResearchProject(workType as WorkTypeValue),
  async generate(input) {
    const { generateResearchProjectDocxBlob } = await import("./export-research-project-docx");
    return generateResearchProjectDocxBlob(input);
  },
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  articleTemplate,
  cpgTemplate,
  researchProjectTemplate,
  generalTemplate,
];

export function templateForWorkType(workType: string): DocumentTemplate {
  return DOCUMENT_TEMPLATES.find((template) => template.supports(workType)) ?? generalTemplate;
}

export function getTemplateForWorkType(workType: string): string {
  return templateForWorkType(workType).id;
}
