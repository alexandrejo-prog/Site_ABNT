import type { DocxGenerationInput } from "./export-docx";
import { isCpgWork, isResearchProject, type WorkTypeValue } from "./ufla-rules";
import { isLongFormAcademicWork } from "./graduate-draft-guidance";
import { normalizeWorkType } from "./work-type-resolver";
import { ACADEMIC_PRODUCTION_TYPE_IDS } from "./academic-production-types";

export interface DocumentTemplate {
  id: string;
  label: string;
  supports(workType: string): boolean;
  generate(input: DocxGenerationInput): Promise<Blob>;
}

export const generalTemplate: DocumentTemplate = {
  id: "geral",
  label: "Modelo geral",
  supports: (workType) => {
    const normalizedWorkType = normalizeWorkType(workType);
    return (
      !normalizedWorkType ||
      (!isCpgWork(normalizedWorkType as WorkTypeValue) &&
        !isResearchProject(normalizedWorkType as WorkTypeValue) &&
        !isLongFormAcademicWork(normalizedWorkType) &&
        normalizedWorkType !== "artigo" &&
        !(ACADEMIC_PRODUCTION_TYPE_IDS as readonly string[]).includes(normalizedWorkType))
    );
  },
  async generate(input) {
    const { generateDocxBlob } = await import("./export-docx");
    return generateDocxBlob(input);
  },
};

export const graduateEditableDraftTemplate: DocumentTemplate = {
  id: "rascunho-longo-editavel",
  label: "Rascunho editável de monografia, dissertação e tese",
  supports: (workType) => isLongFormAcademicWork(normalizeWorkType(workType)),
  async generate(input) {
    const { generateGraduateEditableDraftDocxBlob } = await import("./export-graduate-editable-draft-docx");
    return generateGraduateEditableDraftDocxBlob(input);
  },
};

export const articleTemplate: DocumentTemplate = {
  id: "artigo",
  label: "Artigo",
  supports: (workType) => {
    const n = normalizeWorkType(workType);
    // Todos os formatos da Coleção Produção Acadêmica UFLA (TCCs estruturados
    // como artigo: sem capa/folha de rosto/ficha/aprovação) seguem a estrutura
    // do artigo — conforme DOCUMENT_TYPE_MATRIX (UFLA-formatos-20).
    return n === "artigo" || (ACADEMIC_PRODUCTION_TYPE_IDS as readonly string[]).includes(n);
  },
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
  graduateEditableDraftTemplate,
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
