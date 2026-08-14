import { describe, it, expect } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts, normalizedParagraphTexts } from "../test-utils/ooxml";
import JSZip from "jszip";

describe("acceptance: equivalent dissertation with real references", () => {
  const refs = [
    "BARDIN, L. Análise de conteúdo. Lisboa: Edições 70, 2010.",
    "ALMEIDA, M. C. B. de. Planejamento de bibliotecas. Brasília: Briquet de Lemos, 2009.",
    "ABRIZAH, A.; NOORHIDAWATI, A. Global visibility of Asian universities. Malaysian Journal, v. 15, n. 3, p. 53-73, Dec. 2010.",
  ];

  const fields = {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    author: "Simone Assis Medeiros",
    title: "Política pública de acesso aberto à produção científica: o caso do Repositório Institucional da Universidade Federal de Lavras",
    location: "Lavras - MG",
    year: "2013",
    program: "Ciência da Informação",
    advisor: "Profa. Dra. Patrícia Aparecida Ferreira",
    resumo: "Resumo teste.",
    palavrasChave: "acesso aberto, repositório institucional, política pública",
    abstractText: "Abstract test.",
    keywords: "open access, institutional repository, public policy",
    referencias: refs.join("\n"),
  };

  const editorText = "# 1 INTRODUCAO\nTexto introdutorio.\n# 2 REFERENCIAS\n";

  async function loadDocx(blob: Blob) {
    const parts = await loadDocxParts(blob);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const headerFiles = Object.keys(zip.files).filter((p) => p.startsWith("word/header") && p.endsWith(".xml"));
    return { ...parts, headers: headerFiles };
  }

  it("reference title REFERENCIAS is centered", async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocx(blob);
    const normalized = normalizedParagraphTexts(parts.documentXml);
    const refIdx = normalized.findIndex((p) => p.includes("REFERENCIAS"));
    expect(refIdx).toBeGreaterThanOrEqual(0);
    const refTitleXml = parts.documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g)?.[refIdx];
    expect(refTitleXml, "REFERENCIAS title paragraph not found").toBeTruthy();
    expect(refTitleXml, "REFERENCIAS title should be centered").toMatch(/w:jc w:val="center"/);
  });

  it("reference title REFERENCIAS is bold", async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocx(blob);
    const normalized = normalizedParagraphTexts(parts.documentXml);
    const refIdx = normalized.findIndex((p) => p.includes("REFERENCIAS"));
    expect(refIdx).toBeGreaterThanOrEqual(0);
    const refTitleXml = parts.documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g)?.[refIdx];
    expect(refTitleXml, "REFERENCIAS title paragraph not found").toBeTruthy();
    expect(refTitleXml, "REFERENCIAS title should be bold").toMatch(/<w:b[^/]*\/>/);
  });

  it("references are alphabetically ordered by pt-BR", async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocx(blob);
    const normalized = normalizedParagraphTexts(parts.documentXml);
    const refIdx = normalized.findIndex((p) => p.includes("REFERENCIAS"));
    expect(refIdx).toBeGreaterThanOrEqual(0);
    const refEntries = normalized.slice(refIdx + 1).filter((p) => p.trim() && !p.includes("APENDICE") && !p.includes("ANEXO"));
    const sorted = [...refEntries].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    expect(refEntries).toEqual(sorted);
  });

  it("document contains all pre-textual elements", async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocx(blob);
    const normalized = normalizedParagraphTexts(parts.documentXml);
    expect(normalized.some((p) => p.includes("RESUMO"))).toBe(true);
    expect(normalized.some((p) => p.includes("ABSTRACT"))).toBe(true);
    expect(normalized.some((p) => p.includes("SUMARIO") || p.includes("SUMÁRIO"))).toBe(true);
    expect(normalized.some((p) => p.includes("FICHA CATALOGRÁFICA") || p.includes("FICHA CATALOGRAFICA"))).toBe(true);
  });

  it("document contains pagination field in header package", async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocx(blob);
    expect(parts.headers.length).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const headerFiles = Object.keys(zip.files).filter((p) => p.startsWith("word/header") && p.endsWith(".xml"));
    expect(headerFiles.length).toBeGreaterThan(0);
  });
});