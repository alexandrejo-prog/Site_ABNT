import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { calculateTextualStartPage, generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "artigo",
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introducao.",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function extractFileFromZip(buffer: Buffer, fileName: string): string {
  let offset = 0;

  while (offset < buffer.length - 30) {
    if (readUInt32(buffer, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compression = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const uncompressedSize = readUInt32(buffer, offset + 22);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (name === fileName) {
      const data = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compactacao nao suportada: ${compression}.`);
    }

    offset = dataEnd + (uncompressedSize === 0 ? 1 : 0);
  }

  throw new Error(`Arquivo nao encontrado no DOCX: ${fileName}.`);
}

async function generatedXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = fields,
) {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedDocxFiles(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = fields,
) {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  const buffer = Buffer.from(await blob.arrayBuffer());

  return {
    documentXml: extractFileFromZip(buffer, "word/document.xml"),
    stylesXml: extractFileFromZip(buffer, "word/styles.xml"),
  };
}

function paragraphsIn(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

function paragraphXmlContaining(documentXml: string, text: string): string {
  const paragraph = paragraphsIn(documentXml).find((item) => item.includes(text));
  expect(paragraph).toBeTruthy();
  return paragraph ?? "";
}

function fieldInstructionRuns(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

function expectNoHeadingStyle(paragraphXml: string): void {
  expect(paragraphXml).not.toContain('w:val="Heading1"');
  expect(paragraphXml).not.toContain('w:val="Heading2"');
  expect(paragraphXml).not.toContain('w:val="Heading3"');
}

function styleXmlById(stylesXml: string, styleId: string): string {
  const style = stylesXml.match(
    new RegExp(`<w:style\\b(?=[^>]*w:styleId="${styleId}")[\\s\\S]*?<\\/w:style>`),
  )?.[0];
  expect(style).toBeTruthy();
  return style ?? "";
}

function hasPositiveBold(xml: string): boolean {
  return /<w:b\s*\/>|<w:b\b(?=[^>]*w:val="(?:1|true|on)")/.test(xml);
}

function joined(parts: string[]): string {
  return parts.join("");
}

describe("DOCX export", () => {
  it("creates a valid Blob", async () => {
    const blob = await generateDocxBlob({ fields, editorText: "# Introducao\nTexto comum." });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });

  it("parses editor text", () => {
    expect(parseEditorContent("# Introducao\n## Contexto\n> Citacao")).toEqual([
      { type: "heading1", text: "Introducao" },
      { type: "heading2", text: "Contexto" },
      { type: "longQuote", text: "Citacao" },
    ]);
  });

  it("keeps UFLA margins", () => {
    expect(UFLA_RULES.margins.topCm).toBe(3);
    expect(UFLA_RULES.margins.leftCm).toBe(3);
    expect(UFLA_RULES.margins.bottomCm).toBe(2);
    expect(UFLA_RULES.margins.rightCm).toBe(2);
  });

  it("calculates textual start page", () => {
    expect(calculateTextualStartPage(fields, true)).toBe(5);
    expect(calculateTextualStartPage({ ...fields, workType: "dissertacao" }, true)).toBe(7);
  });

  it("keeps main fields and native updatable TOC", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.");
    const tocInstruction = fieldInstructionRuns(documentXml);

    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(tocInstruction).toContain("TOC");
    expect(tocInstruction).toMatch(/\\o\s+&quot;1-3&quot;/);
    expect(tocInstruction).toContain("\\h");
    expect(tocInstruction).toContain("\\z");
    expect(tocInstruction).toContain("\\u");
  });

  it("keeps summary and pre-textual titles out of Word heading levels", async () => {
    const documentXml = await generatedXml(
      "# 1 Introdu\u00e7\u00e3o\nTexto.",
      {
        ...fields,
        workType: "dissertacao",
        dedicatoria: "A minha familia.",
        agradecimentos: "Agradeco a todos.",
        epigrafe: "Uma frase breve.",
      },
    );

    const visualTitles = [
      "SUM\u00c1RIO",
      "FICHA CATALOGR\u00c1FICA",
      "DEDICAT\u00d3RIA",
      "AGRADECIMENTOS",
      "EP\u00cdGRAFE",
      "RESUMO",
      "ABSTRACT",
      "INDICADORES DE IMPACTO",
      "IMPACT INDICATORS",
    ];

    for (const title of visualTitles) {
      expectNoHeadingStyle(paragraphXmlContaining(documentXml, title));
    }
  });

  it("keeps heading levels for the Word TOC without direct bold on title runs", async () => {
    const documentXml = await generatedXml(
      "# 1 Introdu\u00e7\u00e3o\nTexto.\n## 1.3 Objetivos\nTexto.\n### 1.3.1 Objetivo geral\nTexto.",
    );

    const heading1 = paragraphXmlContaining(documentXml, "1 INTRODU\u00c7\u00c3O");
    const heading2 = paragraphXmlContaining(documentXml, "1.3 Objetivos");
    const heading3 = paragraphXmlContaining(documentXml, "1.3.1 Objetivo geral");

    expect(heading1).toContain('w:val="Heading1"');
    expect(heading2).toContain('w:val="Heading2"');
    expect(heading3).toContain('w:val="Heading3"');
    expect(heading1).not.toContain("<w:b");
    expect(heading2).not.toContain("<w:b");
    expect(heading3).not.toContain("<w:b");
  });

  it("keeps non-numbered post-textual titles as headings", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
      ...fields,
      anexos: "Material complementar de terceiro.",
      apendices: "Instrumento elaborado pelo autor.",
    });
    const referencesHeading = paragraphXmlContaining(documentXml, "REFER\u00caNCIAS");
    const anexosHeading = paragraphXmlContaining(documentXml, "ANEXOS");
    const apendicesHeading = paragraphXmlContaining(documentXml, "AP\u00caNDICES");

    expect(referencesHeading).toContain('w:val="Heading1"');
    expect(referencesHeading).not.toContain(">1 REFER");
    expect(anexosHeading).toContain('w:val="Heading1"');
    expect(anexosHeading).not.toContain(">1 ANEX");
    expect(apendicesHeading).toContain('w:val="Heading1"');
    expect(apendicesHeading).not.toContain(">1 AP");
  });

  it("defines visual bold through Word heading styles", async () => {
    const { stylesXml } = await generatedDocxFiles(
      "# 1 Introdu\u00e7\u00e3o\nTexto.\n## 1.3 Objetivos\nTexto.\n### 1.3.1 Objetivo geral\nTexto.",
    );

    const heading1Style = styleXmlById(stylesXml, "Heading1");
    const heading2Style = styleXmlById(stylesXml, "Heading2");
    const heading3Style = styleXmlById(stylesXml, "Heading3");

    expect(hasPositiveBold(heading1Style)).toBe(true);
    expect(hasPositiveBold(heading2Style)).toBe(true);
    expect(hasPositiveBold(heading3Style)).toBe(false);
  });

  it("does not restore the old manual table workaround", () => {
    const source = readFileSync(new URL("../src/export-docx.ts", import.meta.url), "utf8");
    const blocked = [
      ["J", "S", "Z", "ip"],
      ["post", "Process", "Document", "Xml"],
      ["post", "Process", "Docx", "Blob"],
      ["replace", "Toc", "Instruction"],
      ["tc", "Field", "Xml"],
      ["TC", " &", "quot;"],
      ["TOC", " \\", "f"],
    ].map(joined);

    for (const marker of blocked) {
      expect(source).not.toContain(marker);
    }
  });

  it("keeps edited files free of known mojibake markers", () => {
    const files = ["../src/export-docx.ts", "../tests/export-docx.test.ts"];
    const markers = [
      String.fromCharCode(0x00c3, 0x0192),
      String.fromCharCode(0x00ef, 0x00bf, 0x00bd),
      String.fromCharCode(0x00c2, 0x00bb),
      String.fromCharCode(0x00c3, 0x201d, 0x00c3, 0x201e),
      String.fromCharCode(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x201e, 0x00a2),
    ];

    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const marker of markers) {
        expect(source).not.toContain(marker);
      }
    }
  });
});
