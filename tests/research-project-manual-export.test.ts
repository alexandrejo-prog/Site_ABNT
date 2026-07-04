import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { emptyAcademicFields } from "../src/ufla-rules";

async function xmlFrom(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = zip.file("word/document.xml");
  expect(xml).toBeTruthy();
  return xml!.async("text");
}

describe("exportação manual de projeto de pesquisa", () => {
  it("usa campos específicos quando o editor está vazio", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      problemaPesquisa: "Qual é o problema investigado?",
      objetivoGeral: "Analisar o problema investigado.",
      metodologia: "Pesquisa qualitativa.",
      cronograma: "Execução em quatro semestres.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await xmlFrom(await generateResearchProjectDocxBlob({ fields, editorText: "" }));

    expect(xml).toContain("PROBLEMA DE PESQUISA");
    expect(xml).toContain("Qual é o problema investigado?");
    expect(xml).toContain("OBJETIVO GERAL");
    expect(xml).toContain("METODOLOGIA");
    expect(xml).toContain("CRONOGRAMA");
    expect(xml).toContain("TOC");
  });
});
