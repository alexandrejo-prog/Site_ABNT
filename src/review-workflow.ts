import type { AcademicFieldKey } from "./ufla-rules";

export type ReviewBlockId = "metadata" | "pretextual" | "research" | "body" | "references" | "posttextual" | "validation";

export interface ReviewBlock {
  id: ReviewBlockId;
  title: string;
  fields: AcademicFieldKey[];
  defaultOpen: boolean;
}

export const REVIEW_BLOCKS: ReviewBlock[] = [
  {
    id: "metadata",
    title: "Metadados",
    fields: ["author", "title", "subtitle", "workNature", "course", "program", "advisor", "coadvisor", "location", "year"],
    defaultOpen: true,
  },
  {
    id: "pretextual",
    title: "Elementos pre-textuais",
    fields: ["resumo", "palavrasChave", "abstractText", "keywords", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators"],
    defaultOpen: true,
  },
  {
    id: "research",
    title: "Projeto de pesquisa",
    fields: ["tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia", "cronograma", "recursosOrcamento", "resultadosEsperados"],
    defaultOpen: true,
  },
  {
    id: "body",
    title: "Corpo do texto",
    fields: ["introducao", "conclusao"],
    defaultOpen: false,
  },
  {
    id: "references",
    title: "Referencias",
    fields: ["referencias"],
    defaultOpen: true,
  },
  {
    id: "posttextual",
    title: "Elementos pos-textuais",
    fields: ["apendices", "anexos", "imageWarnings"],
    defaultOpen: false,
  },
  {
    id: "validation",
    title: "Validação e aderência",
    fields: [],
    defaultOpen: true,
  },
];

export function fieldsForBlock(id: ReviewBlockId): AcademicFieldKey[] {
  return REVIEW_BLOCKS.find((block) => block.id === id)?.fields ?? [];
}

export function blockForField(field: AcademicFieldKey): ReviewBlockId | undefined {
  return REVIEW_BLOCKS.find((block) => block.fields.includes(field))?.id;
}
