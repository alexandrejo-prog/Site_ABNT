import { describe, expect, it } from "vitest";
import { identifyAcademicFields } from "../src/import-docx";

describe("importação não reclassifica workType", () => {
  it("monografia que menciona 'projeto de pesquisa' no corpo não vira projeto_pesquisa automaticamente", () => {
    const text = `UNIVERSIDADE FEDERAL DE LAVRAS
JOSÉ ALUNO
TÍTULO DO TRABALHO

Monografia apresentada à Universidade Federal de Lavras, como parte das exigências do curso de graduação, para obtenção do grau de licenciado.

1 INTRODUÇÃO
Este trabalho discute um PROJETO DE PESQUISA desenvolvido com estudantes da rede pública.

REFERÊNCIAS
SILVA, M. Título. Lavras: UFLA, 2024.`;

    const result = identifyAcademicFields(text);
    expect(result.fields.workType).not.toBe("projeto_pesquisa");
    expect(result.workTypeSuggestion?.workType).toBe("projeto_pesquisa");
  });

  it("documento sem tipo selecionado sugere, mas não aplica sem confirmação", () => {
    const text = `UNIVERSIDADE FEDERAL DE LAVRAS
AUTOR EXEMPLO
TÍTULO

PROJETO DE PESQUISA apresentado à Universidade Federal de Lavras como requisito parcial.

1 INTRODUÇÃO
Texto de introdução do projeto.

REFERÊNCIAS
SILVA, M. Título. Lavras: UFLA, 2024.`;

    const result = identifyAcademicFields(text);
    expect(result.fields.workType).not.toBe("projeto_pesquisa");
    expect(result.workTypeSuggestion?.workType).toBe("projeto_pesquisa");
  });
});
