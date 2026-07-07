import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateArticleDocxBlob } from "../src/export-article-docx";
import { emptyAcademicFields } from "../src/ufla-rules";

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = zip.file("word/document.xml");
  expect(xml).toBeTruthy();
  return xml!.async("text");
}

function countOccurrences(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

describe("exportacao de artigo simples", () => {
  it("remove metadados repetidos no inicio do corpo", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo" as const,
      title: "A B KDIKDI",
      subtitle: "A constelação do Homem Velho",
      author: "Alexandre",
    };

    const xml = await documentXml(
      await generateArticleDocxBlob({
        fields,
        editorText: [
          "A constelação do Homem Velho",
          "A constelação do Homem Velho",
          "Alexandre",
          "A constelação do Homem Velho dos guaranis do Paraná contém três outras constelações indígenas.",
        ].join("\n"),
      }),
    );

    expect(countOccurrences(xml, "A constelação do Homem Velho")).toBe(2);
    expect(countOccurrences(xml, "Alexandre")).toBe(1);
    expect(xml).toContain("A constelação do Homem Velho dos guaranis");
  });

  it("converte marcação markdown do corpo em runs negrito e italico", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo" as const,
      title: "Artigo com marcação",
      author: "Alexandre",
    };

    const xml = await documentXml(
      await generateArticleDocxBlob({
        fields,
        editorText: "# Introdução\nTexto com **negrito** e *italico* no corpo.",
      }),
    );

    expect(xml).not.toContain("**negrito**");
    expect(xml).not.toContain("*italico*");
    expect(xml).toMatch(/<w:b\/>[\s\S]*<w:t[^>]*>negrito<\/w:t>/);
    expect(xml).toMatch(/<w:i\/>[\s\S]*<w:t[^>]*>italico<\/w:t>/);
  });
});
