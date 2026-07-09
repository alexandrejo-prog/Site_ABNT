import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { templateForWorkType } from "../src/document-template";
import { emptyAcademicFields } from "../src/ufla-rules";

async function xmlFrom(blob: Blob): Promise<string> {
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

describe("roteamento e exportacao de projeto de pesquisa", () => {
  it("rotepa projeto_pesquisa para o template dedicado, nunca para o geral", () => {
    expect(templateForWorkType("projeto_pesquisa").id).toBe("projeto-pesquisa");
    expect(templateForWorkType("projeto_pesquisa").id).not.toBe("geral");
    expect(templateForWorkType("projeto de pesquisa").id).toBe("projeto-pesquisa");
    expect(templateForWorkType("PROJETO_PESQUISA").id).toBe("projeto-pesquisa");
  });

  it("nao confunde projeto de pesquisa com desenvolvimento de software", () => {
    expect(templateForWorkType("software_aplicativo_ufla").id).not.toBe("projeto-pesquisa");
    expect(templateForWorkType("projeto_pesquisa").id).not.toBe("geral");
  });

  it("gera DOCX de projeto sem ficha catalografica e com TOC atualizavel", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const blob = await templateForWorkType("projeto_pesquisa").generate({ fields, editorText: "# 1 INTRODUÇÃO\nTexto." });
    const xml = await xmlFrom(blob);

    expect(xml).not.toContain("FICHA CATALOGRÁFICA");
    expect(xml).toContain("SUMÁRIO");
    expect(tocInstruction(xml)).toContain("TOC");
    expect(tocInstruction(xml)).toContain("1-3");
    expect(xml).toContain("Projeto de pesquisa apresentado à Universidade Federal de Lavras");
    expect(xml).not.toContain("Trabalho acadêmico apresentado");
    expect(xml).not.toContain("BANCA EXAMINADORA");
  });

  it("gera natureza correta da folha de rosto para projeto com programa", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      program: "Educação Científica e Ambiental",
      location: "Lavras - MG",
      year: "2026",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const blob = await templateForWorkType("projeto_pesquisa").generate({ fields, editorText: "# 1 INTRODUÇÃO\nTexto." });
    const xml = await xmlFrom(blob);

    expect(xml).toContain("Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do Programa de Pós-Graduação em Educação Científica e Ambiental, para avaliação acadêmica.");
    expect(xml).not.toContain("Trabalho acadêmico apresentado");
  });

  it("contem Palavras-chave e Keywords uma unica vez", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      palavrasChave: "palavra1; palavra2",
      keywords: "keyword1; keyword2",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const blob = await templateForWorkType("projeto_pesquisa").generate({ fields, editorText: "# 1 INTRODUÇÃO\nTexto." });
    const xml = await xmlFrom(blob);

    const resumoMatches = xml.match(/Palavras-chave:/g) || [];
    const abstractMatches = xml.match(/Keywords:/g) || [];
    expect(resumoMatches.length).toBe(1);
    expect(abstractMatches.length).toBe(1);
  });

  it("contem TOC em instrText e pageNumbers start=5", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const blob = await templateForWorkType("projeto_pesquisa").generate({ fields, editorText: "# 1 INTRODUÇÃO\nTexto." });
    const xml = await xmlFrom(blob);

    expect(tocInstruction(xml)).toContain("TOC");
    expect(xml).toContain('w:pgNumType w:start="5"');
  });
});
