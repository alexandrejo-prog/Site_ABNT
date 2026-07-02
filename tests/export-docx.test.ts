import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateArticleDocxBlob } from "../src/export-article-docx";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { generateCpgPdfBlob, inspectCpgPdfLayout } from "../src/export-cpg-pdf";
import { calculateTextualStartPage, generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { CPG_RULES, UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

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

    offset = dataEnd;
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

async function generatedArticleXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = fields,
) {
  const blob = await generateArticleDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedCpgXml(
  editorText = "# Introducao\nTexto comum.",
  documentFields: AcademicFields,
) {
  const blob = await generateCpgDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedStylesXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = fields,
) {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/styles.xml");
}

function paragraphsIn(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

function paragraphXmlContaining(documentXml: string, text: string): string {
  const paragraph = paragraphsIn(documentXml).find((item) => item.includes(text));
  expect(paragraph).toBeTruthy();
  return paragraph ?? "";
}

function paragraphText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

function paragraphXmlContainingStyle(documentXml: string, text: string, styleId: string): string {
  const paragraph = paragraphsIn(documentXml).find(
    (item) => item.includes(text) && item.includes(`w:val="${styleId}"`),
  );
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

function expectNoGraduateOnlyElements(documentXml: string): void {
  for (const forbidden of [
    "SUMÃRIO",
    "SUM\u00c1RIO",
    "FICHA CATALOGR",
    "FOLHA DE APROVA",
    "INDICADORES DE IMPACTO",
    "IMPACT INDICATORS",
    "Disserta",
    "Tese apresentada",
  ]) {
    expect(documentXml).not.toContain(forbidden);
  }
}

function expectCpgMargins(documentXml: string): void {
  expect(documentXml).toContain(`w:top="${CPG_RULES.margins.topTwip}"`);
  expect(documentXml).toContain(`w:bottom="${CPG_RULES.margins.bottomTwip}"`);
  expect(documentXml).toContain(`w:left="${CPG_RULES.margins.leftTwip}"`);
  expect(documentXml).toContain(`w:right="${CPG_RULES.margins.rightTwip}"`);
}

function decodedPdfText(pdfBytes: Buffer): string {
  const source = pdfBytes.toString("latin1");
  const texts: string[] = [];
  for (const match of source.matchAll(/\(([^()]*)\)\s*Tj/g)) {
    texts.push(
      match[1].replace(/\\([0-7]{3}|[\\()])/g, (_, escaped: string) => {
        if (escaped.length === 3) return String.fromCharCode(parseInt(escaped, 8));
        return escaped;
      }),
    );
  }
  return texts.join(" ");
}

function longCpgText(): string {
  return Array.from({ length: 90 }, (_, index) =>
    `# ${index + 1} Secao de teste\nEste paragrafo trata de Pos-Graduacao, Educacao, Ciencias, Docencia e Praxis com conteudo suficiente para validar quebra de pagina, margens e ausencia de sobreposicao no PDF CPG gerado.`,
  ).join("\n");
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
    expect(calculateTextualStartPage({ ...fields, workType: "dissertacao" }, true)).toBe(8);
  });

  it("keeps main fields and native updatable TOC", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.");
    const tocInstruction = fieldInstructionRuns(documentXml);

    expect(documentXml).toContain("MARIA SILVA");
    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("SUMÁRIO");
    expect(tocInstruction).toContain("TOC");
    expect(tocInstruction).toMatch(/\\o\s+&quot;1-3&quot;/);
    expect(tocInstruction).toContain("\\h");
    expect(tocInstruction).toContain("\\z");
    expect(tocInstruction).toContain("\\u");
  });

  it("generates simple article without graduate pre-textual structure", async () => {
    const documentXml = await generatedArticleXml("# Introducao\nTexto do artigo.\n[REF] SOUZA, J. Texto. Lavras: UFLA, 2025.");

    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Palavras-chave");
    expect(documentXml).toContain("Abstract text.");
    expect(documentXml).toContain("Keywords");
    expect(documentXml).toContain("Referencias");
    expectNoGraduateOnlyElements(documentXml);
  });

  it("generates CPG summary without graduate structure or page numbers and with CPG margins", async () => {
    const documentXml = await generatedCpgXml("Texto complementar.", {
      ...fields,
      workType: "resumo_cpg",
      program: "Universidade Federal de Lavras",
      course: "maria@ufla.br",
    });

    expect(documentXml).toContain("Qualidade do cafe no sul de Minas");
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Palavras-chave");
    expect(documentXml).not.toContain("PageNumber");
    expectNoGraduateOnlyElements(documentXml);
    expectCpgMargins(documentXml);
  });

  it("generates expanded CPG with first page abstracts and CPG margins", async () => {
    const documentXml = await generatedCpgXml("# Introducao\nTexto comum.", {
      ...fields,
      workType: "resumo_expandido_cpg",
      author: "Maria Silva, Joao Souza",
      program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
      course: "maria@ufla.br, joao@ufla.br",
    });

    expect(documentXml).toContain("Qualidade do cafe no sul de Minas");
    expect(documentXml).toContain("Maria Silva, Joao Souza");
    expect(documentXml).toContain("Universidade Federal de Lavras");
    expect(documentXml).toContain("Abstract");
    expect(documentXml).toContain("Keywords");
    expect(documentXml).toContain("Resumo");
    expect(documentXml).toContain("Palavras-chave");
    expect(documentXml.indexOf("Abstract")).toBeLessThan(documentXml.indexOf("Resumo"));
    expectNoGraduateOnlyElements(documentXml);
    expectCpgMargins(documentXml);

    const title = paragraphXmlContaining(documentXml, "Qualidade do cafe no sul de Minas");
    const authors = paragraphXmlContaining(documentXml, "Maria Silva, Joao Souza");
    const affiliation = paragraphXmlContaining(documentXml, "Universidade Federal de Lavras");
    const abstract = paragraphXmlContaining(documentXml, "Abstract");
    const section = paragraphXmlContainingStyle(documentXml, "Introducao", "Heading1");
    const body = paragraphXmlContaining(documentXml, "Texto comum.");

    expect(title).toContain('w:sz w:val="32"');
    expect(authors).toContain("Maria Silva, Joao Souza");
    expect(paragraphText(authors).split(",")).toHaveLength(2);
    expect(affiliation).toContain('w:jc w:val="center"');
    expect(abstract).toContain('w:left="454"');
    expect(abstract).toContain('w:right="454"');
    expect(section).toContain('w:sz w:val="26"');
    expect(hasPositiveBold(section)).toBe(true);
    expect(hasPositiveBold(body)).toBe(false);

    expect(title).toBeTruthy();
    expect(authors).toBeTruthy();
    expect(affiliation).toBeTruthy();
  });

  it("generates complete CPG article without dissertation-only elements", async () => {
    const documentXml = await generatedCpgXml("# Introducao\nTexto comum.", {
      ...fields,
      workType: "artigo_completo_cpg",
    });

    expect(documentXml).toContain("Abstract");
    expect(documentXml).toContain("Resumo");
    expectNoGraduateOnlyElements(documentXml);
    expectCpgMargins(documentXml);
  });

  it("keeps dissertation and thesis complete UFLA structure", async () => {
    for (const workType of ["dissertacao", "tese"] as const) {
      const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
        ...fields,
        workType,
        workNature:
          workType === "tese"
            ? "Dissertacao apresentada para obtencao do titulo de Mestre em Ciencias."
            : "Tese apresentada para obtencao do titulo de Doutor em Ciencias.",
        indicadoresImpacto: "Impacto social informado.",
        impactIndicators: "Social impact text.",
      });

      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("FICHA CATALOGR");
      expect(documentXml).toContain("Aprovado em:");
      expect(documentXml).toContain("INDICADORES DE IMPACTO");
      expect(documentXml).toContain("IMPACT INDICATORS");
      expect(documentXml).toContain(workType === "tese" ? "Doutor em Ciencias" : "Mestre em Ciencias");
    }
  });

  it("generates readable multi-page CPG PDF without graduate elements", async () => {
    const pdfFields = {
      ...fields,
      workType: "artigo_completo_cpg" as const,
      title: "Praxis na Pos-Graduacao",
      author: "Maria Silva, Joao Souza",
      program: "Programa de Pós-Graduação em Educação",
      course: "maria@ufla.br",
      resumo: "Educação, Ciências, Docência e Práxis orientam a pesquisa.",
      abstractText: "Education, Science, Teaching and Praxis guide the research.",
    };
    const layout = inspectCpgPdfLayout({ fields: pdfFields, editorText: longCpgText() });
    const blob = await generateCpgPdfBlob({ fields: pdfFields, editorText: longCpgText() });
    const pdfText = decodedPdfText(Buffer.from(await blob.arrayBuffer()));

    expect(layout.pageCount).toBeGreaterThan(1);
    expect(layout.duplicateYPositions).toBeLessThan(8);
    expect(pdfText).toContain("Pós-Graduação");
    expect(pdfText).toContain("Educação");
    expect(pdfText).toContain("Ciências");
    expect(pdfText).toContain("Docência");
    expect(pdfText).toContain("Práxis");
    expect(pdfText).not.toContain("SUMÁRIO");
    expect(pdfText).not.toContain("FICHA CATALOGRÁFICA");
    expect(pdfText).not.toContain("FOLHA DE APROVAÇÃO");
    expect(pdfText).not.toContain("PageNumber");
  });

  it("keeps summary and pre-textual titles out of Word heading levels", async () => {
    const documentXml = await generatedXml("# 1 Introdu\u00e7\u00e3o\nTexto.", {
      ...fields,
      workType: "dissertacao",
      dedicatoria: "A minha familia.",
      agradecimentos: "Agradeco a todos.",
      epigrafe: "Uma frase breve.",
    });

    const visualTitles = [
      "SUM\u00c1RIO",
      "FICHA CATALOGR\u00c1FICA",
      "AGRADECIMENTOS",
      "RESUMO",
      "ABSTRACT",
      "INDICADORES DE IMPACTO",
      "IMPACT INDICATORS",
    ];

    for (const title of visualTitles) {
      expectNoHeadingStyle(paragraphXmlContaining(documentXml, title));
    }
  });

  it("keeps heading levels for body titles with visual UFLA bold rules", async () => {
    const documentXml = await generatedXml(
      "# 1 Introdu\u00e7\u00e3o\nTexto.\n## 1.3 Objetivos\nTexto.\n### 1.3.1 Objetivo geral\nTexto.",
    );

    const heading1 = paragraphXmlContainingStyle(documentXml, "1 INTRODU\u00c7\u00c3O", "Heading1");
    const heading2 = paragraphXmlContainingStyle(documentXml, "1.3 Objetivos", "Heading2");
    const heading3 = paragraphXmlContainingStyle(documentXml, "1.3.1 Objetivo geral", "Heading3");

    expect(hasPositiveBold(heading1)).toBe(true);
    expect(hasPositiveBold(heading2)).toBe(true);
    expect(hasPositiveBold(heading3)).toBe(false);
  });

  it("keeps non-numbered post-textual titles as headings", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
      ...fields,
      anexos: "Material complementar de terceiro.",
      apendices: "Instrumento elaborado pelo autor.",
    });
    const referencesHeading = paragraphXmlContainingStyle(documentXml, "REFER\u00caNCIAS", "Heading1");
    const anexosHeading = paragraphXmlContainingStyle(documentXml, "ANEXOS", "Heading1");
    const apendicesHeading = paragraphXmlContainingStyle(documentXml, "AP\u00caNDICE A", "Heading1");

    expect(referencesHeading).not.toContain(">1 REFER");
    expect(anexosHeading).not.toContain(">1 ANEX");
    expect(apendicesHeading).not.toContain(">1 AP");
  });

  it("defines Word heading styles for summary structure", async () => {
    const stylesXml = await generatedStylesXml(
      "# 1 Introdu\u00e7\u00e3o\nTexto.\n## 1.3 Objetivos\nTexto.\n### 1.3.1 Objetivo geral\nTexto.",
    );

    const heading1Style = styleXmlById(stylesXml, "Heading1");
    const heading2Style = styleXmlById(stylesXml, "Heading2");
    const heading3Style = styleXmlById(stylesXml, "Heading3");

    expect(heading1Style).toContain('w:styleId="Heading1"');
    expect(heading2Style).toContain('w:styleId="Heading2"');
    expect(heading3Style).toContain('w:styleId="Heading3"');
    expect(hasPositiveBold(heading3Style)).toBe(false);
  });

  it("keeps edited files free of known mojibake markers", () => {
    const source = readFileSync(new URL("../src/export-docx.ts", import.meta.url), "utf8");
    const markers = [
      String.fromCharCode(0x00c3, 0x0192),
      String.fromCharCode(0x00ef, 0x00bf, 0x00bd),
      String.fromCharCode(0x00c2, 0x00bb),
      String.fromCharCode(0x00c3, 0x201d, 0x00c3, 0x201e),
      String.fromCharCode(0x00c3, 0x00a2, 0x00e2, 0x201a, 0x00ac, 0x00e2, 0x201e, 0x00a2),
    ];

    for (const marker of markers) {
      expect(source).not.toContain(marker);
    }
  });

  it("CPG first page uses title before author and does not use advisor as title", async () => {
    const documentXml = await generatedCpgXml("# Introducao\nTexto comum.", {
      ...fields,
      workType: "resumo_expandido_cpg",
      title: "Titulo Real do Trabalho",
      author: "Ana, Bruno",
      program: "Programa de Pos-Graduacao",
      course: "ana@ufla.br",
      advisor: "Prof. Dr. Orientador",
    });

    const titlePos = documentXml.indexOf("Titulo Real do Trabalho");
    const authorPos = documentXml.indexOf("Ana, Bruno");
    const programPos = documentXml.indexOf("Programa de Pos-Graduacao");
    const advisorPos = documentXml.indexOf("Prof. Dr. Orientador");

    expect(titlePos).toBeGreaterThan(-1);
    expect(authorPos).toBeGreaterThan(-1);
    expect(titlePos).toBeLessThan(authorPos);
    expect(programPos).toBeGreaterThan(authorPos);
    expect(advisorPos).toBe(-1);
  });

  it("CPG resumo page places abstract and keywords before resumo", async () => {
    const documentXml = await generatedCpgXml("", {
      ...fields,
      workType: "resumo_cpg",
      abstractText: "Abstract text.",
      keywords: "keyword1; keyword2",
      resumo: "Resumo texto do resumo.",
      palavrasChave: "palavra1; palavra2",
    });

    const abstractPos = documentXml.indexOf("Abstract");
    const keywordsPos = documentXml.indexOf("Keywords");
    const resumoPos = documentXml.indexOf("Resumo.");
    const palavrasPos = documentXml.indexOf("Palavras-chave");

    expect(abstractPos).toBeGreaterThan(-1);
    expect(keywordsPos).toBeGreaterThan(-1);
    expect(resumoPos).toBeGreaterThan(-1);
    expect(palavrasPos).toBeGreaterThan(-1);
    expect(abstractPos).toBeLessThan(resumoPos);
    expect(keywordsPos).toBeLessThan(resumoPos);
    expect(resumoPos).toBeLessThan(palavrasPos);
  });

  it("joins reference entries Referencias and BIBLIOGRAFICAS into a single title", async () => {
    const documentXml = await generatedCpgXml("", {
      ...fields,
      workType: "resumo_expandido_cpg",
      referencias: "Referencias\nBIBLIOGRÁFICAS\nSILVA, M. Livro. UFLA, 2024.",
    });

    const refTitle = paragraphXmlContaining(documentXml, "REFERÊNCIAS BIBLIOGRÁFICAS");
    expect(refTitle).toBeTruthy();
    expect(documentXml).toContain("SILVA, M. Livro");
  });

  it("generates readable multi-page CPG PDF with preserved accents and no question marks for quotes", async () => {
    const pdfFields = {
      ...fields,
      workType: "resumo_expandido_cpg" as const,
      title: "Título com Aspas “Curvas” e Acentos",
      author: "Maria Silva",
      program: "Programa de Pós-Graduação em Educação",
      course: "maria@ufla.br",
      resumo: "Resumo com aspas “não basta saber fazer” e acentos Pós-Graduação.",
      abstractText: "Abstract with quotes and accents.",
      keywords: "quotes; accents",
      palavrasChave: "aspas; acentos",
    };
    const blob = await generateCpgPdfBlob({ fields: pdfFields, editorText: "# Introdução\nTexto com aspas “teste”." });
    const pdfText = decodedPdfText(Buffer.from(await blob.arrayBuffer()));

    expect(pdfText).toContain("Pós-Graduação");
    expect(pdfText).toContain("Educação");
    expect(pdfText).not.toContain("?");
    expect(pdfText).toContain('"');
  });
});
