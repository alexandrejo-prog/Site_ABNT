import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { templateForWorkType } from "../src/document-template";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

async function documentXmlFromBlob(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("word/document.xml não encontrado no DOCX gerado.");
  return documentXml;
}

function monografiaFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Título válido",
    course: "Bacharelado em Biologia",
    program: "Programa de Pós-Graduação em Educação Científica e Ambiental",
    advisor: "Prof. Dr. João Souza",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo válido.",
    abstractText: "Valid abstract.",
    palavrasChave: "UFLA; ABNT; DOCX",
    keywords: "UFLA; ABNT; DOCX",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("rascunho editável de monografia", () => {
  it("usa natureza de monografia e Curso, sem Programa na folha de rosto", async () => {
    const template = templateForWorkType("monografia");
    expect(template.id).toBe("rascunho-longo-editavel");

    const blob = await template.generate({
      fields: monografiaFields(),
      editorText: "# 1 Introdução\nTexto.",
    });

    const documentXml = await documentXmlFromBlob(blob);
    expect(documentXml).toContain("Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Bacharelado em Biologia.");
    expect(documentXml).toContain("Curso: Bacharelado em Biologia");
    expect(documentXml).not.toContain("Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.");
    expect(documentXml).not.toContain("Programa:");
  });
});
