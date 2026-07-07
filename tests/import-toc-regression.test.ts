import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromStructure } from "../src/field-detector";
import { identifyAcademicFields } from "../src/import-docx";
import { normalizePlainAcademicText } from "../src/import-normalizer";

const PROJECT_WITH_TOC = `
UNIVERSIDADE FEDERAL DE LAVRAS
ALEXANDRE JOSÉ DE OLIVEIRA

MÉTRICAS, TRABALHO E SAÚDE DOS SERVIDORES TÉCNICO-ADMINISTRATIVOS EM EDUCAÇÃO DA UFLA

Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Educação Científica e Ambiental, para obtenção do título de Doutor em Ciências.

SUMÁRIO
1 INTRODUÇÃO 1
1.1 Contextualização e delimitação do tema 1
1.2 Problema de pesquisa 3
1.3 Objetivos 3
1.3.1 Objetivo geral 3
2 REFERENCIAL TEÓRICO 7
3 METODOLOGIA 18
REFERÊNCIAS 34
APÊNDICE A - ROTEIRO PRELIMINAR DE ENTREVISTA 38

1 INTRODUÇÃO
A universidade pública brasileira constitui uma instituição social marcada por disputas históricas, políticas e pedagógicas. Este trecho representa o corpo real da introdução e não uma entrada do sumário.

1.1 Contextualização e delimitação do tema
O estudo aborda o trabalho técnico-administrativo em educação na UFLA e sua relação com gestão, saúde e formação humana.

1.2 Problema de pesquisa
De que maneira as métricas de produtividade afetam o trabalho e a saúde dos servidores técnico-administrativos em educação da UFLA?

1.3 Objetivos
1.3.1 Objetivo geral
Analisar criticamente a relação entre métricas institucionais, trabalho e saúde dos servidores técnico-administrativos em educação da UFLA.

2 REFERENCIAL TEÓRICO
A fundamentação teórica mobiliza a educação ambiental crítica, a Pedagogia Histórico-Crítica e a crítica ao gerencialismo.

3 METODOLOGIA
A pesquisa possui abordagem qualitativa, com análise documental e entrevistas semiestruturadas.

REFERÊNCIAS
SILVA, M. Trabalho e universidade. Lavras: UFLA, 2024.
`;

describe("regressão de importação com sumário", () => {
  it("remove entradas do SUMÁRIO da estrutura normalizada e preserva o corpo real", () => {
    const normalized = normalizePlainAcademicText(PROJECT_WITH_TOC);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);

    expect(normalized.text).not.toContain("1.1 Contextualização e delimitação do tema 1");
    expect(normalized.text).not.toContain("REFERÊNCIAS 34");
    expect(normalized.text).not.toContain("APÊNDICE A - ROTEIRO PRELIMINAR DE ENTREVISTA 38");

    expect(normalized.text).toContain("# 1 INTRODUÇÃO");
    expect(normalized.text).toContain("A universidade pública brasileira constitui uma instituição social");
    expect(detected.editorText).toContain("A universidade pública brasileira constitui uma instituição social");
    expect(detected.editorText).not.toContain("1.2 Problema de pesquisa 3");
  });

  it("sugere projeto de pesquisa sem reclassificar workType automaticamente", () => {
    const result = identifyAcademicFields(PROJECT_WITH_TOC);

    expect(result.fields.workType).not.toBe("projeto_pesquisa");
    expect(result.workTypeSuggestion?.workType).toBe("projeto_pesquisa");
  });
});
