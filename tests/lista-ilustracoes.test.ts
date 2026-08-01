import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";
import { loadDocxParts, normalizeOoxmlText, paragraphTexts } from "./test-utils/ooxml";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    course: "Bacharelado em Biologia",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

const EDITOR_TEXT = [
  "# 1 Introducao",
  "Texto comum.",
  "Figura 1 - Grafico de barras da producao",
  "Fonte: IBGE (2024).",
  "## 1.1 Contexto",
  "Texto.",
  "Tabela 1 - Resultados das analises",
  "Fonte: elaborado pelo autor (2026).",
  "# 2 Metodologia",
  "Texto.",
  "Figura 2 - Fluxograma do processo",
  "Fonte: elaborado pelo autor (2026).",
].join("\n");

async function documentXmlFor(fields: AcademicFields = baseFields()): Promise<string> {
  const blob = await generateDocxBlob({ fields, editorText: EDITOR_TEXT });
  return (await loadDocxParts(blob)).documentXml;
}

describe("Lista de Ilustrações", () => {
  it("Deve ter título centralizado, maiúsculas e negrito", async () => {
    const documentXml = await documentXmlFor();

    const titleParagraph = (documentXml.match(/<w:p\b[\s\S]*?LISTA DE ILUSTRAÇÕES[\s\S]*?<\/w:p>/) ?? [""])[0];
    expect(titleParagraph).toContain("LISTA DE ILUSTRAÇÕES");
    expect(titleParagraph).toContain('w:jc w:val="center"');
    expect(titleParagraph).toContain("w:b");
  });

  it("Deve listar figuras na ordem do texto", async () => {
    const documentXml = await documentXmlFor();

    const texts = paragraphTexts(documentXml);
    const listaIndex = texts.findIndex((t) => normalizeOoxmlText(t) === "LISTA DE ILUSTRACOES");
    expect(listaIndex).toBeGreaterThan(-1);

    const listaParagrafos = texts.slice(listaIndex, listaIndex + 5);
    const normalizados = listaParagrafos.map(normalizeOoxmlText);

    const figura1Index = normalizados.findIndex((t) => t.includes("FIGURA 1 - GRAFICO DE BARRAS DA PRODUCAO"));
    const figura2Index = normalizados.findIndex((t) => t.includes("FIGURA 2 - FLUXOGRAMA DO PROCESSO"));
    expect(figura1Index).toBeGreaterThan(-1);
    expect(figura2Index).toBeGreaterThan(-1);
    expect(figura2Index).toBeGreaterThan(figura1Index);
  });

  it("Deve ter formato: tipo + número + travessão + título + página", async () => {
    const documentXml = await documentXmlFor();

    const texts = paragraphTexts(documentXml);
    const listaIndex = texts.findIndex((t) => normalizeOoxmlText(t) === "LISTA DE ILUSTRACOES");
    const entries = texts.slice(listaIndex, listaIndex + 3);

    const fig1 = entries.find((t) => normalizeOoxmlText(t).includes("FIGURA 1 - GRAFICO DE BARRAS DA PRODUCAO"));
    expect(fig1).toBeDefined();
    expect(normalizeOoxmlText(fig1 ?? "")).toContain("FIGURA 1 - GRAFICO DE BARRAS DA PRODUCAO");

    const figEntryXml = (documentXml.match(/<w:p\b[\s\S]*?FIGURA 1 - GRAFICO DE BARRAS[\s\S]*?<\/w:p>/i) ?? [""])[0];
    expect(figEntryXml).toContain('w:instr="PAGEREF');
  });

  it("Deve ter números de página à direita", async () => {
    const documentXml = await documentXmlFor();

    const figEntryXml = (documentXml.match(/<w:p\b[\s\S]*?FIGURA 1 - GRAFICO DE BARRAS[\s\S]*?<\/w:p>/i) ?? [""])[0];
    expect(figEntryXml).toContain('w:val="right"');
    expect(figEntryXml).toContain('w:leader="dot"');
  });

  it("Deve alinhar títulos longos em escada (recuo deslocante)", async () => {
    const documentXml = await documentXmlFor();

    const figEntryXml = (documentXml.match(/<w:p\b[\s\S]*?FIGURA 1 - GRAFICO DE BARRAS[\s\S]*?<\/w:p>/i) ?? [""])[0];
    expect(figEntryXml).toContain('w:hanging="709"');
    expect(figEntryXml).toContain('w:left="709"');
  });
});

describe("Lista de Tabelas", () => {
  it("Deve ter título centralizado, maiúsculas e negrito", async () => {
    const documentXml = await documentXmlFor();

    const titleParagraph = (documentXml.match(/<w:p\b[\s\S]*?LISTA DE TABELAS[\s\S]*?<\/w:p>/) ?? [""])[0];
    expect(titleParagraph).toContain("LISTA DE TABELAS");
    expect(titleParagraph).toContain('w:jc w:val="center"');
    expect(titleParagraph).toContain("w:b");
  });

  it("Deve listar tabelas na ordem do texto", async () => {
    const documentXml = await documentXmlFor();

    const texts = paragraphTexts(documentXml);
    const listaIndex = texts.findIndex((t) => normalizeOoxmlText(t) === "LISTA DE TABELAS");
    expect(listaIndex).toBeGreaterThan(-1);

    const entries = texts.slice(listaIndex, listaIndex + 3);
    expect(entries.map(normalizeOoxmlText).some((t) => t.includes("TABELA 1 - RESULTADOS DAS ANALISES"))).toBe(true);
  });

  it("Deve ter formato: número + travessão + título + página à direita", async () => {
    const documentXml = await documentXmlFor();

    const tableEntryXml = (documentXml.match(/<w:p\b[\s\S]*?TABELA 1 - RESULTADOS DAS ANALISES[\s\S]*?<\/w:p>/i) ?? [""])[0];
    expect(tableEntryXml).toContain('w:instr="PAGEREF');
    expect(tableEntryXml).toContain('w:val="right"');
    expect(tableEntryXml).toContain('w:leader="dot"');
    expect(tableEntryXml).toContain('w:hanging="709"');
  });

  it("Deve ficar após o Abstract e antes do Sumário", async () => {
    const documentXml = await documentXmlFor();
    const normalized = normalizeOoxmlText(documentXml);

    const abstractIndex = normalized.indexOf("ABSTRACT");
    const listaIlustracoesIndex = normalized.indexOf("LISTA DE ILUSTRACOES");
    const listaTabelasIndex = normalized.indexOf("LISTA DE TABELAS");
    const sumarioIndex = normalized.indexOf("SUMARIO");

    expect(abstractIndex).toBeGreaterThan(-1);
    expect(listaIlustracoesIndex).toBeGreaterThan(abstractIndex);
    expect(listaTabelasIndex).toBeGreaterThan(listaIlustracoesIndex);
    expect(sumarioIndex).toBeGreaterThan(listaTabelasIndex);
  });
});
