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
  it("gera campo TOC atualizavel", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto",
      author: "Maria Silva",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const xml = await documentXml(
      await generateResearchProjectDocxBlob({
        fields,
        editorText: "# 1 INTRODUÇÃO\nTexto.\n\n# 2 METODOLOGIA\nTexto.",
      }),
    );

    expect(xml).toContain("SUMÁRIO");
    expect(xml).toContain("TOC");
    expect(xml).toContain("1 INTRODUÇÃO");
    expect(xml).toContain("2 METODOLOGIA");
  });
});
