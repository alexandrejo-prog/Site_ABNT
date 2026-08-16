/**
 * Fixtures e especificações por tipo de trabalho, compartilhados entre
 * run-gate-per-type.ts e regenerate-official-artifacts.ts.
 */
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";

const baseFields: AcademicFields = {
  ...emptyAcademicFields(),
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introducao.",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

export const PER_TYPE_FIELDS: Record<string, AcademicFields> = {
  artigo: {
    ...baseFields,
    workType: "artigo",
    workNature: "Artigo apresentado a Universidade Federal de Lavras.",
  },
  tcc: {
    ...baseFields,
    workType: "monografia",
    course: "Bacharelado em Biologia",
    workNature:
      "Monografia apresentada a Universidade Federal de Lavras, como parte das exigencias do Bacharelado em Biologia, para obtencao do titulo de Bacharel em Biologia.",
    advisor: "Prof. Dr. Joao Silva",
  },
  monografia_draft: {
    ...baseFields,
    workType: "monografia",
    course: "Bacharelado em Biologia",
    advisor: "Prof. Dr. Joao Silva",
  },
  dissertacao_draft: {
    ...baseFields,
    workType: "dissertacao",
    program: "Educacao Cientifica e Ambiental",
    advisor: "Prof. Dr. Joao Silva",
    indicadoresImpacto: "Impacto social: informado.",
  },
  tese_draft: {
    ...baseFields,
    workType: "tese",
    program: "Educacao Cientifica e Ambiental",
    advisor: "Prof. Dr. Joao Silva",
    indicadoresImpacto: "Impacto social: informado.",
  },
  resumo_expandido_cpg: {
    ...baseFields,
    workType: "resumo_expandido_cpg",
    program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
    course: "maria@ufla.br",
  },
  projeto_pesquisa: {
    ...baseFields,
    workType: "projeto_pesquisa",
    problemaPesquisa: "Como melhorar a qualidade do cafe?",
    objetivoGeral: "Avaliar a qualidade do cafe no sul de Minas.",
    justificativa: "A pesquisa justifica-se pela importancia do cafe.",
    metodologia: "Metodologia quantitativa.",
    cronograma:
      "Quadro 1 - Cronograma de execucao da pesquisa\n1o semestre 1 a 6 Jan/2026 a Jun/2026 Revisao bibliografica\nFonte: elaborado pelo autor (2026).",
    referencias: "SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.",
  },
};

export const PER_TYPE_EDITOR_TEXT = [
  "# 1 Introducao",
  "Texto do corpo do trabalho com [REF] SOUZA, J. Texto. Lavras: UFLA, 2025. e referencia cruzada [x:_bookmark7~1 Introducao].",
  "# 2 Desenvolvimento",
  "Segunda secao com conteudo.",
  "",
].join("\n");
