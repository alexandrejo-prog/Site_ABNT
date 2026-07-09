import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { emptyAcademicFields } from "../src/ufla-rules";

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = zip.file("word/document.xml");
  expect(xml).toBeTruthy();
  return xml!.async("text");
}

describe("campo de sumario em projeto", () => {
  it("gera sumario estatico sem pagina em branco enganosa e sem ficha catalografica", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto.\n\n# 2 METODOLOGIA\nTexto.",
      }),
    );

    expect(xml).toContain("SUMÁRIO");
    expect(xml).toContain("1 INTRODUÇÃO");
    expect(xml).toContain("2 METODOLOGIA");
    expect(xml).toContain("REFERÊNCIAS");
    expect(xml).not.toContain("TOC");
    expect(xml).not.toContain("FICHA CATALOGRÁFICA");
    expect(xml).not.toContain("BANCA EXAMINADORA");
  });

  it("preserva caixa adequada por nivel de secao no projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: [
          "# 1 introducao",
          "Texto.",
          "## 1.3 objetivos",
          "Texto.",
          "## 1.4 justificativa",
          "Texto.",
          "# 4 resultados esperados, impacto social e limitacoes",
          "Texto.",
          "## 4.1 resultados esperados",
          "Texto.",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("1 INTRODUÇÃO");
    expect(xml).toContain("1.3 Objetivos");
    expect(xml).toContain("1.4 Justificativa");
    expect(xml).toContain("4 RESULTADOS ESPERADOS, IMPACTO SOCIAL E LIMITAÇÕES");
    expect(xml).toContain("4.1 Resultados esperados");
    expect(xml).not.toContain("1.3 OBJETIVOS");
    expect(xml).not.toContain("1.4 JUSTIFICATIVA");
    expect(xml).not.toContain("4.1 RESULTADOS ESPERADOS");
  });

  it("renderiza linhas tabuladas do projeto como quadro/tabela DOCX", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: [
          "# 1 INTRODUÇÃO",
          "Texto.",
          "# 2 METODOLOGIA",
          "Aspecto\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas semiestruturadas com gestores.\tAnálise documental, entrevistas semiestruturadas com TAEs e diário de campo.",
          "Enfoque teórico\tAdministração Pública e implementação institucional do teletrabalho.\tEducação Ambiental Crítica, Saúde do Trabalhador, crítica ao gerencialismo e trabalho real/trabalho prescrito.",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Procedimentos");
    expect(xml).toContain("Enfoque teórico");
    expect(xml).not.toContain("Procedimentos\tQuestionário");
  });

  it("normaliza citacao no texto quando o projeto referencia o Manual UFLA antigo", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      referencias: "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalização e estrutura de trabalhos acadêmicos: TCCs, monografias, dissertações e teses. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nO projeto segue o manual institucional (UNIVERSIDADE FEDERAL DE LAVRAS, 2024, p. 6-8).",
      }),
    );

    expect(xml).toContain("UNIVERSIDADE FEDERAL DE LAVRAS, 2025, p. 6-8");
    expect(xml).not.toContain("UNIVERSIDADE FEDERAL DE LAVRAS, 2024, p. 6-8");
  });

  it("não exporta TITLE/Toc/placeholder e corrige títulos do projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      advisor: "nome do orientador",
      resumo: "Resumo do projeto.",
      palavrasChave: "PGD; saúde do trabalhador; educação ambiental crítica",
      abstractText: "Project abstract.",
      keywords: "PGD; worker health; critical environmental education",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: [
          "TITLE 1 INTRODUÇÃO Toc234433198",
          "Texto.",
          "TITLE 1 REFERENCIAL TERICO",
          "Texto.",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("INTRODUÇÃO");
    expect(xml).toContain("REFERENCIAL TEÓRICO");
    expect(xml).toContain("Palavras-chave: PGD. saúde do trabalhador. educação ambiental crítica.");
    expect(xml).not.toContain("TITLE 1");
    expect(xml).not.toContain("Toc234433198");
    expect(xml).not.toContain("REFERENCIAL TERICO");
    expect(xml).not.toContain("nome do orientador");
  });

  it("aplica recuo frances nas referencias do projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      referencias: "SILVA, M. Projeto de pesquisa com título longo para testar o recuo francês aplicado em segunda linha. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto.",
      }),
    );

    expect(xml).toContain("w:left=\"720\"");
    expect(xml).toContain("w:hanging=\"720\"");
  });
});
