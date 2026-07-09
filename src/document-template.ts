import type { DocxGenerationInput } from "./export-docx";
import { isCpgWork, isResearchProject, type WorkTypeValue } from "./ufla-rules";
import { normalizeWorkType } from "./work-type-resolver";

export interface DocumentTemplate {
  id: string;
  label: string;
  supports(workType: string): boolean;
  generate(input: DocxGenerationInput): Promise<Blob>;
}

export const generalTemplate: DocumentTemplate = {
  id: "geral",
  label: "Modelo geral",
  // Decisão conservadora da auditoria P4: artigo_cientifico_ufla permanece no modelo geral; ele é item da Coleção Produção Acadêmica UFLA, não o Artigo acadêmico simples da UI.
  supports: (workType) => {
    const normalizedWorkType = normalizeWorkType(workType);
    return !normalizedWorkType || (!isCpgWork(normalizedWorkType as WorkTypeValue) && !isResearchProject(normalizedWorkType as WorkTypeValue) && normalizedWorkType !== "artigo");
  },
  async generate(input) {
    const { generateDocxBlob } = await import("./export-docx");
    return generateDocxBlob(input);
  },
};

export const articleTemplate: DocumentTemplate = {
  id: "artigo",
  label: "Artigo",
  supports: (workType) => normalizeWorkType(workType) === "artigo",
  async generate(input) {
    const { generateArticleDocxBlob } = await import("./export-article-docx");
    return generateArticleDocxBlob(input);
  },
};

export const cpgTemplate: DocumentTemplate = {
  id: "cpg",
  label: "CPG",
  supports: (workType) => isCpgWork(normalizeWorkType(workType) as WorkTypeValue),
  async generate(input) {
    const { generateCpgDocxBlob } = await import("./export-cpg-docx");
    return generateCpgDocxBlob(input);
  },
};

export const researchProjectTemplate: DocumentTemplate = {
  id: "projeto-pesquisa",
  label: "Projeto de pesquisa",
  supports: (workType) => isResearchProject(normalizeWorkType(workType) as WorkTypeValue),
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
  const normalizedWorkType = normalizeWorkType(workType);

  // Projeto de pesquisa é um modelo distinto (NBR 15287) e nunca deve ser
  // exportado pelo modelo geral nem confundido com "Desenvolvimento de
  // software e aplicativos". Garantia direta de roteamento para o exportador
  // dedicado, independente da ordem dos templates ou de normalizações.
  if (isResearchProject(normalizedWorkType as WorkTypeValue)) return researchProjectTemplate;

  return DOCUMENT_TEMPLATES.find((template) => template.supports(normalizedWorkType)) ?? generalTemplate;
}

export function getTemplateForWorkType(workType: string): string {
  return templateForWorkType(workType).id;
}
