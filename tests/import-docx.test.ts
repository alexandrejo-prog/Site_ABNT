import { describe, expect, it } from "vitest";
import { identifyAcademicFields } from "../src/import-docx";

describe("importação não reclassifica workType", () => {
  it("monografia que menciona 'projeto de pesquisa' no corpo não vira projeto_pesquisa automaticamente", () => {
    const text = `UNIVERSIDADE FEDERAL DE LAVRAS
JOSE ALUNO
TITULO DO TRABALHO

Monografia apresentada a Universidade Federal de Lavras, como parte das exigências do curso de graduacao, para obtencao do grau de licenciado.

1 INTRODUCAO
Este trabalho discute um PROJETO DE PESQUISA desenvolvido com estudantes da rede publica.

REFERENCIAS
SILVA, M. Titulo. Lavras: UFLA, 2024.`;

    const result = identifyAcademicFields(text);
    expect(result.fields.workType).not.toBe("projeto_pesquisa");
    expect(result.workTypeSuggestion?.workType).toBe("projeto_pesquisa");
  });

  it("documento sem tipo selecionado sugere, mas não aplica sem confirmação", () => {
    const text = `UNIVERSIDADE FEDERAL DE LAVRAS
AUTOR EXEMPLO
TITULO

PROJETO DE PESQUISA apresentado a Universidade Federal de Lavras como requisito parcial.

1 INTRODUCAO
Texto de introducao do projeto.

REFERENCIAS
SILVA, M. Titulo. Lavras: UFLA, 2024.`;

    const result = identifyAcademicFields(text);
    expect(result.fields.workType).not.toBe("projeto_pesquisa");
    expect(result.workTypeSuggestion?.workType).toBe("projeto_pesquisa");
  });

  it("preserva natureza literal sem injetar 'Mestre em Ciéncias'", () => {
    const text = `UNIVERSIDADE FEDERAL DE LAVRAS
AUTORA SINTETICA
TITULO SINTETICO

Dissertacao apresentada a Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduacao em Administracao Publica, area de concentracao em Gestao Publica, Tecnologias e Inovacao, para a obtencao do titulo de Mestre.

1 INTRODUCAO
Texto comum.

REFERENCIAS
SILVA, M. Titulo. Lavras: UFLA, 2024.`;

    const result = identifyAcademicFields(text);
    expect(result.fields.workNature).toContain("Programa de Pós-Graduacao em Administracao Publica");
    expect(result.fields.workNature).toContain("Gestao Publica, Tecnologias e Inovacao");
    expect(result.fields.workNature).not.toContain("Mestre em Ciencias");
  });
});
