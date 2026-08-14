import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { documentText } from ".././test-utils/ooxml";

function paragraphXml(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

async function makeSyntheticDocxConvertedFromPdf(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
    paragraphXml("AUTORA SINTETICA"),
    paragraphXml("TITULO SINTETICO"),
    paragraphXml("LAVAS – MG 2025"),
    paragraphXml("A Deus, por me sustentar..."),
    paragraphXml("Agradeço a todos os colegas..."),
    paragraphXml("A presente pesquisa teve como objetivo analisar o Programa de Gestão e Desempenho na modalidade de teletrabalho na Universidade Federal de Lavras (UFLA). Realizou-se uma pesquisa quali-quantitativa a partir de um estudo de caso."),
    paragraphXml("Palavras-chave: teletrabalho; gestao; administracao publica."),
    paragraphXml("This study aimed to analyze the implementation of the Management and Performance Program (Programa de Gestão e Desempenho – PGD) in the telework modality at the Federal University of Lavras (UFLA). A qualitative-quantitative research was conducted through a case study."),
    paragraphXml("Keywords: telework; management; public administration."),
    paragraphXml("1 INTRODUCAO"),
    paragraphXml("Texto da introducao."),
    paragraphXml("REFERENCIAS"),
    paragraphXml("SILVA, A. Referencia sintetica."),
  ].join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

async function importSyntheticDocxConvertedFromPdf() {
  const docx = await makeSyntheticDocxConvertedFromPdf();
  const file = new File([docx], "convertido-pdf.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return importDocumentFile(file);
}

describe("importacao de DOCX convertido de PDF - resumo e abstract", () => {
  it("importa resumo, palavras-chave, abstract e keywords corretamente", async () => {
    const result = await importSyntheticDocxConvertedFromPdf();

    expect(result.fields.resumo).toContain("A presente pesquisa teve como objetivo analisar");
    expect(result.fields.resumo).not.toContain("A Deus");
    expect(result.fields.resumo).not.toContain("Agradeço");
    expect(result.fields.palavrasChave).toBe("teletrabalho; gestao; administracao publica.");

    expect(result.fields.abstractText).toContain("This study aimed to analyze");
    expect(result.fields.abstractText).not.toContain("A Deus");
    expect(result.fields.abstractText).not.toContain("Agradeço");
    expect(result.fields.keywords).toBe("telework; management; public administration.");
  });

  it("DOCX final contem resumo, palavras-chave, abstract e keywords", async () => {
    const result = await importSyntheticDocxConvertedFromPdf();
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: result.fields.resumo,
      abstractText: result.fields.abstractText,
      palavrasChave: result.fields.palavrasChave,
      keywords: result.fields.keywords,
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toBeTruthy();
    expect(documentText(documentXml ?? "")).toContain("A presente pesquisa teve como objetivo analisar");
    expect(documentText(documentXml ?? "")).toContain("Palavras-chave: teletrabalho; gestao; administracao publica.");
    expect(documentText(documentXml ?? "")).toContain("This study aimed to analyze");
    expect(documentText(documentXml ?? "")).toContain("Keywords: telework; management; public administration.");
    expect(documentText(documentXml ?? "")).not.toContain("A Deus");
    expect(documentText(documentXml ?? "")).not.toContain("Agradeço");
  });

  it("nao duplica resumo/abstract no corpo textual", async () => {
    const result = await importSyntheticDocxConvertedFromPdf();
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: result.fields.resumo,
      abstractText: result.fields.abstractText,
      palavrasChave: result.fields.palavrasChave,
      keywords: result.fields.keywords,
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const text = documentText(documentXml ?? "");

    const resumoCount = (text.match(/A presente pesquisa teve como objetivo analisar/g) ?? []).length;
    const abstractCount = (text.match(/This study aimed to analyze/g) ?? []).length;
    expect(resumoCount).toBe(1);
    expect(abstractCount).toBe(1);
  });
});
