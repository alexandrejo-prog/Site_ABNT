import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = zip.file("word/document.xml");
  expect(xml).toBeTruthy();
  return xml!.async("text");
}

function tocInstruction(xml: string): string {
  return [...xml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

function textContent(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
}

describe("campo de sumario em projeto", () => {
  it("gera sumario atualizavel sem pagina estimada, sem duplicacao e sem ficha catalografica", async () => {
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
    expect(tocInstruction(xml)).toContain("TOC");
    expect(tocInstruction(xml)).toContain("1-3");
    expect(xml).not.toMatch(/1 INTRODUÇÃO\s+\d+/);
    expect(xml).not.toMatch(/2 METODOLOGIA\s+\d+/);
    expect(xml).not.toContain("FICHA CATALOGRÁFICA");
    expect(xml).not.toContain("BANCA EXAMINADORA");
    const sumarioCount = (xml.match(/SUMÁRIO/g) || []).length;
    expect(sumarioCount).toBe(1);
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

  it("une quebras suaves em resumo e abstract do projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Este resumo foi\nquebrado no meio da frase.",
      abstractText: "This abstract was\nbroken in the middle of a sentence.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto.",
      }),
    );

    expect(xml).toContain("Este resumo foi quebrado no meio da frase.");
    expect(xml).toContain("This abstract was broken in the middle of a sentence.");
    expect(xml).not.toContain("Este resumo foi</w:t></w:r></w:p><w:p");
    expect(xml).not.toContain("This abstract was</w:t></w:r></w:p><w:p");
  });

  it("normaliza palavras-chave do projeto com separadores variados", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      resumo: "Resumo do projeto.",
      abstractText: "Project abstract.",
      palavrasChave: "PGD; saúde do trabalhador; educação ambiental crítica",
      keywords: "worker health; critical environmental education",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto.",
      }),
    );

    expect(textContent(xml)).toContain("Palavras-chave: PGD; saúde do trabalhador; educação ambiental crítica.");
    expect(textContent(xml)).toContain("Keywords: worker health; critical environmental education.");
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
    expect(textContent(xml)).toContain("Palavras-chave: PGD; saúde do trabalhador; educação ambiental crítica.");
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

    expect(xml).toContain("w:left=\"284\"");
    expect(xml).toContain("w:hanging=\"284\"");
  });

  it("remove caracteres invisiveis e normaliza termos compostos no projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "TÉCNICO\uFFFEADMINISTRATIVOS",
      author: "Maria Silva",
      resumo: "Este estudo analisa o histórico\uFFFEdialético.",
      abstractText: "Project abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto sobre servidores técnico\uFFFEadministrativo.",
      }),
    );

    expect(xml).toContain("TÉCNICO-ADMINISTRATIVOS");
    expect(xml).not.toContain("\uFFFE");
    expect(xml).toContain("histórico-dialético");
    expect(xml).toContain("técnico-administrativo");
  });

  it("normaliza titulos do sumario consistentemente com o corpo", async () => {
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
          "# 2 REFERENCIAL TEORICO",
          "Texto.",
          "# 3 REFERENCIAS",
          "Texto.",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("1 INTRODUÇÃO");
    expect(xml).toContain("2 REFERENCIAL TEÓRICO");
    expect(xml).toContain("REFERÊNCIAS");
    expect(xml).not.toContain("REFERENCIAL TEORICO");
    expect(xml).not.toContain("REFERENCIAS");
  });

  it("renderiza quadros com caption, bordas e fonte no projeto", async () => {
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
          "Quadro 1 - Aspectos da pesquisa",
          "Aspecto\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas semiestruturadas com gestores.\tAnálise documental.",
          "Fonte: elaborado pelo autor (2026).",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Quadro 1 - Aspectos da pesquisa");
    expect(xml).toContain("Fonte: elaborado pelo autor (2026).");
    expect(xml).not.toContain("Aspecto\tAndrade");
  });

  it("nao adiciona fonte automatica quando o quadro ja tem fonte explicita", async () => {
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
          "Quadro 1 - Aspectos da pesquisa",
          "Aspecto\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas semiestruturadas com gestores.\tAnálise documental.",
          "Fonte: elaborado pelo autor (2026).",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Fonte: elaborado pelo autor (2026).");
    expect(xml).not.toContain("Fonte: elaborado pelo autor.");
  });

  it("adiciona fonte de fallback uma unica vez quando nao ha fonte explicita", async () => {
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
          "Quadro 1 - Aspectos da pesquisa",
          "Aspecto\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas semiestruturadas com gestores.\tAnálise documental.",
        ].join("\n"),
      }),
    );

    const fallbackCount = (xml.match(/Fonte: elaborado pelo autor\./g) || []).length;
    expect(fallbackCount).toBe(1);
  });

  it("usa TOC atualizavel no projeto para preencher paginas reais no Word", async () => {
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
          "Texto.",
          "# 3 REFERENCIAL TEORICO",
          "Texto.",
          "# 4 RESULTADOS ESPERADOS",
          "Texto.",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("SUMÁRIO");
    expect(tocInstruction(xml)).toContain("TOC");
    expect(xml).not.toMatch(/REFERÊNCIAS\s+\d+/);
    const sumarioCount = (xml.match(/SUMÁRIO/g) || []).length;
    expect(sumarioCount).toBe(1);
  });

  it("nao duplica legenda nem fonte no quadro com legenda e fonte explicitas", async () => {
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
          "Quadro 1 - Aspectos da pesquisa",
          "Aspecto\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas semiestruturadas com gestores.\tAnálise documental.",
          "Fonte: elaborado pelo autor (2026).",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("<w:tbl>");
    expect((xml.match(/Quadro 1 - Aspectos da pesquisa/g) ?? []).length).toBe(1);
    expect((xml.match(/Fonte: elaborado pelo autor \(2026\)\./g) ?? []).length).toBe(1);
    expect(xml).not.toContain("Fonte: elaborado pelo autor.");
    expect(xml).not.toContain("Aspecto\tAndrade");
  });

  it("renderiza markdown table como quadro com fonte unica", async () => {
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
          "Quadro 2 - Comparativo",
          "| Aspecto | Este projeto |",
          "| Procedimentos | Questionário. |",
          "Fonte: elaborado pelo autor (2026).",
        ].join("\n"),
      }),
    );

    expect(xml).toContain("<w:tbl>");
    expect((xml.match(/Quadro 2 - Comparativo/g) ?? []).length).toBe(1);
    expect((xml.match(/Fonte: elaborado pelo autor \(2026\)\./g) ?? []).length).toBe(1);
    expect(xml).not.toContain("Fonte: elaborado pelo autor.");
    expect(xml).not.toContain("| Aspecto | Este projeto |");
  });

  it("remove caracteres invisiveis de todos os caminhos do projeto", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Técnico￾Administrativos",
      author: "Maria Silva",
      resumo: "Estudo com histórico￾dialético relevante.",
      abstractText: "SGP-SRT￾SEGES/MGI relevance.",
      palavrasChave: "Técnico￾Administrativos; histórico￾dialético",
      referencias: "SILVA, M. Técnico￾Administrativos. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: [
          "# 1 INTRODUÇÃO",
          "Texto com técnico￾administrativo no corpo.",
          "# 2 METODOLOGIA",
          "Quadro 1 - Aspectos",
          "Técnico￾Administrativos\tAndrade (2025)\tEsta pesquisa",
          "Procedimentos\tQuestionário e entrevistas.\tAnálise documental.",
          "Fonte: elaborado pelo autor (2026).",
        ].join("\n"),
      }),
    );

    expect(xml).not.toContain("￾");
    expect(xml).toContain("Técnico-Administrativos");
    expect(xml).toContain("histórico-dialético");
    expect(xml).toContain("SGP-SRT-SEGES/MGI");
    expect(xml).toContain("técnico-administrativo");
    expect(xml).toContain("<w:tbl>");
  });
});
