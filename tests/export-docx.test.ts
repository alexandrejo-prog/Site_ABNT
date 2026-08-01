import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateArticleDocxBlob } from "../src/export-article-docx";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { calculateTextualStartPage, generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { templateForWorkType } from "../src/document-template";
import { CPG_RULES, UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "outro",
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

const articleFields: AcademicFields = {
  ...fields,
  workType: "artigo",
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
  documentFields: AcademicFields = articleFields,
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
  return /<w:b\s*\/?>|<w:b\b(?=[^>]*w:val="(?:1|true|on)")/.test(xml);
}

function expectNoGraduateOnlyElements(documentXml: string): void {
  for (const forbidden of [
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

  it("keeps main fields and native updatable TOC for graduate thesis", async () => {
    const documentXml = await generatedXml(
      "# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.",
      { ...fields, workType: "tese" },
    );
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

    expect((documentXml.match(/w:val="TOC1"/g) ?? []).length).toBe(0);
  });

  it("remove texto interno da natureza do trabalho no DOCX geral", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
      ...fields,
      workType: "software_aplicativo_ufla",
      workNature:
        "Software e aplicativos UFLA apresentada a Universidade Federal de Lavras conforme formato da Colecao Producao Academica UFLA, com suporte inicial no sistema.",
    });

    expect(documentXml).not.toContain("Software e aplicativos UFLA");
    expect(documentXml).not.toContain("Colecao Producao Academica");
    expect(documentXml).not.toContain("suporte inicial no sistema");
    expect(documentXml).toContain("Trabalho acadêmico apresentado à Universidade Federal de Lavras");
    expect(documentXml).toContain("requisitos acadêmicos aplicáveis");
  });

  it("generates simple article without graduate pre-textual structure", async () => {
    const documentXml = await generatedArticleXml("# Introducao\nTexto do artigo.\n[REF] SOUZA, J. Texto. Lavras: UFLA, 2025.");

    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("MARIA SILVA");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Palavras-chave");
    expect(documentXml).toContain("Abstract text.");
    expect(documentXml).toContain("Keywords");
    expect(documentXml).toContain("REFERÊNCIAS");
    expectNoGraduateOnlyElements(documentXml);
  });

  it("generateDocxBlob respeita artigo simples sem front matter", async () => {
    const documentXml = await generatedXml("# 1 INTRODUCAO\nTexto do artigo.\n[REF] SOUZA, J. Texto. Lavras: UFLA, 2025.", articleFields);

    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("MARIA SILVA");
    expect(documentXml).toContain("Resumo");
    expect(documentXml).toContain("Abstract");
    expect(documentXml).toContain("1 INTRODUCAO");
    expect(documentXml).not.toMatch(/SUM[\s\S]{0,80}RIO/);
    expect(documentXml).not.toContain("FICHA CATALOGR");
    expect(documentXml).not.toContain("APROVADO EM:");
    expect(documentXml).not.toContain("Programa:");
    expect(documentXml).not.toContain("Trabalho acad");
  });
  it("generates CPG summary without graduate structure or page numbers and with CPG margins", async () => {
    const documentXml = await generatedCpgXml("Texto complementar.", {
      ...fields,
      workType: "resumo_cpg",
      program: "Universidade Federal de Lavras",
      course: "maria@ufla.br",
    });

    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("MARIA SILVA");
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

    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("MARIA SILVA, JOAO SOUZA");
    expect(documentXml).toContain("Universidade Federal de Lavras");
    expect(documentXml).toContain("Abstract");
    expect(documentXml).toContain("Keywords");
    expect(documentXml).toContain("Resumo");
    expect(documentXml).toContain("Palavras-chave");
    expect(documentXml.indexOf("Resumo")).toBeLessThan(documentXml.indexOf("Palavras-chave"));
    expect(documentXml.indexOf("Palavras-chave")).toBeLessThan(documentXml.indexOf("Abstract"));
    expect(documentXml.indexOf("Abstract")).toBeLessThan(documentXml.indexOf("Keywords"));
    expectNoGraduateOnlyElements(documentXml);
    expectCpgMargins(documentXml);

    const title = paragraphXmlContaining(documentXml, "QUALIDADE DO CAFE NO SUL DE MINAS");
    const authors = paragraphXmlContaining(documentXml, "MARIA SILVA, JOAO SOUZA");
    const affiliation = paragraphXmlContaining(documentXml, "Universidade Federal de Lavras");
    const abstract = paragraphXmlContaining(documentXml, "Abstract");
    const section = paragraphXmlContainingStyle(documentXml, "INTRODUCAO", "Heading1");
    const body = paragraphXmlContaining(documentXml, "Texto comum.");

    expect(title).toContain('w:sz w:val="32"');
    expect(authors).toContain("MARIA SILVA, JOAO SOUZA");
    expect(paragraphText(authors).split(",")).toHaveLength(2);
    expect(affiliation).toContain('w:jc w:val="center"');
    expect(abstract).toContain('w:left="454"');
    expect(abstract).toContain('w:right="454"');
    expect(section).toContain('w:sz w:val="26"');
    expect(hasPositiveBold(section)).toBe(true);
    expect(hasPositiveBold(body)).toBe(false);
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
      const workNature =
        workType === "tese"
          ? "Tese apresentada para obtencao do titulo de Doutor."
          : "Dissertacao apresentada para obtencao do titulo de Mestre.";
      const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
        ...fields,
        workType,
        workNature,
        indicadoresImpacto: "Impacto social informado.",
        impactIndicators: "Social impact text.",
      });

      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("FICHA CATALOGR");
      expect(documentXml).toContain("APROVADO EM:");
      expect(documentXml).toContain("INDICADORES DE IMPACTO");
      expect(documentXml).toContain("IMPACT INDICATORS");
      expect(documentXml).toContain(workNature);
    }
  });

  it("une titulo solto da banca ao membro seguinte na folha de aprovacao", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
      ...fields,
      workType: "dissertacao",
      aprovalDate: "APROVADA em 08 de julho de 2025.",
      approvalMembers: [
        "Dra. Suzanne Erica Nobrega Correia UFCG",
        "Dr. Rafael dos Santos Pereira UFMG",
        "Prof.",
        "Dr. Dany Flavio Tonelli Orientador",
      ],
    });
    const paragraphs = paragraphsIn(documentXml).map(paragraphText);

    expect(paragraphs).not.toContain("Prof.");
    expect(paragraphs.some((text) => /Prof\.\s+Dr\.\s+Dany Flavio Tonelli.*Orientador/.test(text))).toBe(true);
  });

  it("keeps summary and pre-textual titles out of Word heading levels", async () => {
    const documentXml = await generatedXml("# 1 Introdu\u00e7\u00e3o\nTexto.", {
      ...fields,
      workType: "dissertacao",
      dedicatoria: "A minha familia.",
      agradecimentos: "Agradeco a todos.",
      epigrafe: "Uma frase breve.",
      indicadoresImpacto: "Impacto social informado.",
      impactIndicators: "Social impact text.",
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
    expect(hasPositiveBold(heading2)).toBe(false);
    expect(hasPositiveBold(heading3)).toBe(true);
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

    const titlePos = documentXml.indexOf("TITULO REAL DO TRABALHO");
    const authorPos = documentXml.indexOf("ANA, BRUNO");
    const programPos = documentXml.indexOf("Programa de Pos-Graduacao");
    const advisorPos = documentXml.indexOf("Prof. Dr. Orientador");

    expect(titlePos).toBeGreaterThan(-1);
    expect(authorPos).toBeGreaterThan(-1);
    expect(titlePos).toBeLessThan(authorPos);
    expect(programPos).toBeGreaterThan(authorPos);
    expect(advisorPos).toBe(-1);
  });

  it("CPG resumo page places resumo before abstract", async () => {
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
    expect(resumoPos).toBeLessThan(palavrasPos);
    expect(palavrasPos).toBeLessThan(abstractPos);
    expect(abstractPos).toBeLessThan(keywordsPos);
  });

  it("formata legendas basicas no exportador geral usando nucleo compartilhado", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nFigura 1 - Mapa da area\nTexto comum.\nGráfico 1 - Resultados\nTabela 1 - Dados", {
      ...fields,
      workType: "monografia",
    });

    const figure = paragraphXmlContaining(documentXml, "Figura 1 - Mapa da area");
    const chart = paragraphXmlContaining(documentXml, "Gráfico 1 - Resultados");
    const table = paragraphXmlContaining(documentXml, "Tabela 1 - Dados");

    for (const caption of [figure, chart, table]) {
      expect(caption).toContain('w:jc w:val="center"');
      expect(caption).toContain('w:sz w:val="24"');
      expect(caption).toMatch(/<w:b\s*\/?>|w:b w:val="1"/);
      expectNoHeadingStyle(caption);
    }
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

  it("CPG first page does not bold affiliation and keeps title/author formatting", async () => {
    const documentXml = await generatedCpgXml("# Introducao\nTexto comum.", {
      ...fields,
      workType: "resumo_expandido_cpg",
      title: "Titulo Real do Trabalho",
      author: "Ana, Bruno",
      program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
      course: "ana@ufla.br, bruno@ufla.br",
    });

    const title = paragraphXmlContaining(documentXml, "TITULO REAL DO TRABALHO");
    const authors = paragraphXmlContaining(documentXml, "ANA, BRUNO");
    const affiliation = paragraphXmlContaining(documentXml, "Universidade Federal de Lavras");

    expect(title).toContain('w:sz w:val="32"');
    expect(title).toMatch(/<w:b\s*\/?>|w:b w:val="1"/);
    expect(authors).toContain('w:sz w:val="24"');
    expect(authors).toMatch(/<w:b\s*\/?>|w:b w:val="1"/);
    expect(affiliation).toContain('w:sz w:val="22"');
    expect(affiliation).not.toMatch(/<w:b\s*\/?>|w:b w:val="1"/);
  });

  it("App.tsx keeps DOCX-only CPG generation and no PDF workflow", () => {
    const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const templateSource = readFileSync(new URL("../src/document-template.ts", import.meta.url), "utf8");
    expect(source).toContain("templateForWorkType");
    expect(templateSource).toContain("generateCpgDocxBlob");
    expect(source).toContain("Gerar DOCX");
    expect(source).toContain("void isCpgWork");
    expect(readFileSync(new URL("../src/components/MetadataFields.tsx", import.meta.url), "utf8")).toContain("Saída do sistema");
    expect(source).not.toContain("generateCpgPdfBlob");
    expect(source).not.toContain("handleGeneratePdf");
    expect(source).not.toContain("Gerar PDF experimental");
    expect(source).not.toContain("PDF direto experimental");
  });

  it("dissertação não gera placeholders nem programa duplicado no XML", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", {
      ...fields,
      workType: "dissertacao",
      workNature: "Dissertacao apresentada a Universidade Federal de Lavras como parte das exigencias do Programa de Pos-Graduacao em Ciencia do Solo, para obtencao do titulo de Mestre em Ciencias.",
      program: "Ciência do Solo",
      title: "Titulo valido",
      author: "Maria Silva",
      advisor: "Prof. Dr. João Silva",
      resumo: "Resumo do trabalho.",
      palavrasChave: "palavra1; palavra2",
      abstractText: "Abstract text.",
      keywords: "keyword1; keyword2",
      indicadoresImpacto: "Impacto social informado.",
      impactIndicators: "Social impact text.",
      referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    });

    expect(documentXml).not.toContain("[PREENCHER");
    expect(documentXml).not.toContain("[nome do orientador]");
    expect(documentXml).not.toContain("[nome do membro da banca]");
    expect(documentXml).not.toContain("Programa de Pós-Graduação em Programa de Pós-Graduação em");
    expect(documentXml).toContain("SUMÁRIO");
  });

  it("converte Quadro 1 tabulado em tabela DOCX com fonte separada", async () => {
    const editorText = `Quadro 1 - Delimitacao da presente pesquisa em relacao a Andrade (2025)
Dimensao	Andrade (2025)	Presente pesquisa
Recorte	Implementacao do PGD	Repercussoes do PGD
Sujeitos	TAEs em teletrabalho	TAEs com experiencia
Fonte: elaborado pelo autor (2026).`;
    const documentXml = await generatedXml(editorText, {
      ...fields,
      workType: "monografia",
    });

    expect(documentXml).toContain("Quadro 1 - Delimitacao da presente pesquisa em relacao a Andrade (2025)");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Dimensao");
    expect(documentXml).toContain("Andrade (2025)");
    expect(documentXml).toContain("Presente pesquisa");
    expect(documentXml).toContain("Fonte: elaborado pelo autor (2026).");
    expect(documentXml).not.toContain("Dimensao\tAndrade (2025)\tPresente pesquisa");
    expect(documentXml.indexOf("Fonte: elaborado pelo autor (2026)."))
      .toBeGreaterThan(documentXml.indexOf("</w:tbl>"));
  });

  it("converte Quadro 2 tabulado com 2 colunas", async () => {
    const editorText = `Quadro 2 - Eixos de analise documental
Eixo	Descricao
Eixo 1	Politicas de teletrabalho
Eixo 2	Saude do servidor`;
    const documentXml = await generatedXml(editorText, {
      ...fields,
      workType: "monografia",
    });

    expect(documentXml).toContain("Quadro 2 - Eixos de analise documental");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Eixo");
    expect(documentXml).toContain("Descricao");
  });

  it("converte Quadro 3 tabulado com 3 colunas largas", async () => {
    const editorText = `Quadro 3 - Articulacao entre eixos analiticos, indicadores documentais e roteiro de entrevistas
Eixo analitico	Indicadores documentais	Roteiro de entrevistas
Gestao	Normas internas e atas	Perguntas sobre organizacao do trabalho
Saude	Afastamentos e relatos	Perguntas sobre impactos percebidos`;
    const documentXml = await generatedXml(editorText, {
      ...fields,
      workType: "monografia",
    });

    expect(documentXml).toContain("Quadro 3 - Articulacao entre eixos analiticos, indicadores documentais e roteiro de entrevistas");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Indicadores documentais");
    expect(documentXml).toContain("Roteiro de entrevistas");
  });

  it("converte Quadro 5 e preserva fonte abaixo da tabela", async () => {
    const editorText = `Quadro 5 - Produtos intermediarios da pesquisa
Produto	Finalidade
Matriz documental	Organizar os achados
Roteiro de entrevista	Orientar a coleta
Fonte: elaborado pelo autor (2026).`;
    const documentXml = await generatedXml(editorText, {
      ...fields,
      workType: "monografia",
    });

    const tableEnd = documentXml.indexOf("</w:tbl>");
    const sourceIndex = documentXml.indexOf("Fonte: elaborado pelo autor (2026).");
    expect(documentXml).toContain("Quadro 5 - Produtos intermediarios da pesquisa");
    expect(tableEnd).toBeGreaterThan(-1);
    expect(sourceIndex).toBeGreaterThan(tableEnd);
  });

  it("move bloco [REF] para referencias no DOCX geral", async () => {
    const editorText = "# 1 Introducao\nTexto.\n[REF] SOUZA, J. Texto. Lavras: UFLA, 2025.\n[REF] LIMA, A. Outro texto. Lavras: UFLA, 2024.";
    const documentXml = await generatedXml(editorText, fields);

    expect(documentXml).toContain("REFER\u00caNCIAS");
    expect(documentXml).toContain("SOUZA, J.");
    expect(documentXml).toContain("LIMA, A.");
  });
});

describe("sumário atualizável (campo TOC real do Word)", () => {
  async function documentXmlFromBlob(blob: Blob): Promise<string> {
    return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
  }

  it("gera campo TOC real e atualizável para monografia", async () => {
    const monografiaFields: AcademicFields = {
      ...emptyAcademicFields(),
      workType: "monografia",
      author: "Maria Silva",
      title: "Qualidade do cafe no sul de Minas",
      course: "Ciência do Solo",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo do trabalho.",
      palavrasChave: "cafe; qualidade",
      abstractText: "Abstract text.",
      keywords: "coffee; quality",
      advisor: "Prof. João",
      referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    };
    const blob = await templateForWorkType("monografia").generate({
      fields: monografiaFields,
      editorText: "# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.\n### 1.1.1 Detalhe\nTexto.",
    });
    const xml = await documentXmlFromBlob(blob);

    const instructions = fieldInstructionRuns(xml);
    expect(xml).toContain("SUMÁRIO");
    expect(instructions).toContain("TOC");
    expect(instructions).toContain('\\o &quot;1-3&quot;');
    expect(instructions).toContain("\\h");
    expect(instructions).toContain("\\z");
    expect(instructions).toContain("\\u");
    expect(xml).toMatch(/<w:fldChar w:fldCharType="begin"[^>]*w:dirty="true"/);
    expect(xml).toContain('<w:fldChar w:fldCharType="separate"/>');
    expect(xml).toContain('<w:fldChar w:fldCharType="end"/>');

    // Não sobra sumário apenas estático: ausência de entradas estáticas TOC2/TOC3.
    expect((xml.match(/w:val="TOC2"/g) ?? []).length).toBe(0);
    expect((xml.match(/w:val="TOC3"/g) ?? []).length).toBe(0);

    // Headings do corpo permanecem presentes para povoar o sumário.
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain('w:val="Heading3"');
  });

  it("gera campo TOC real e atualizável para dissertação", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao",
        author: "Maria Silva",
        title: "T",
        program: "Ciência do Solo",
        advisor: "Prof. João",
        resumo: "R",
        abstractText: "A",
        referencias: "SILVA, M. Livro.",
      },
      editorText: "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.",
    });
    const xml = await documentXmlFromBlob(blob);
    const instructions = fieldInstructionRuns(xml);
    expect(instructions).toContain("TOC");
    expect(xml).toMatch(/<w:fldChar w:fldCharType="begin"[^>]*w:dirty="true"/);
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
  });

  it("gera campo TOC real e atualizável para tese", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "tese",
        author: "Maria Silva",
        title: "T",
        program: "Ciência do Solo",
        advisor: "Prof. João",
        resumo: "R",
        abstractText: "A",
        referencias: "SILVA, M. Livro.",
      },
      editorText: "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.",
    });
    const xml = await documentXmlFromBlob(blob);
    const instructions = fieldInstructionRuns(xml);
    expect(instructions).toContain("TOC");
    expect(xml).toMatch(/<w:fldChar w:fldCharType="begin"[^>]*w:dirty="true"/);
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
  });

  it("gera campo TOC real para projeto de pesquisa quando há sumário", async () => {
    const projetoFields: AcademicFields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa",
      author: "Maria Silva",
      title: "Projeto",
      program: "Educação Científica e Ambiental",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      palavrasChave: "p1; p2",
      keywords: "k1; k2",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };
    const editorText = `# 1 INTRODUÇÃO
Texto.

# 2 PROBLEMA DE PESQUISA
Descrição.

# 3 OBJETIVO GERAL
Objetivo.

# 4 METODOLOGIA
Metodologia.

# 5 CRONOGRAMA
Cronograma.

# REFERÊNCIAS
SILVA, M. Projeto. Lavras: UFLA, 2024.
`;
    const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: projetoFields, editorText });
    const xml = await documentXmlFromBlob(blob);
    const instructions = fieldInstructionRuns(xml);
    expect(instructions).toContain("TOC");
    expect(xml).toMatch(/<w:fldChar w:fldCharType="begin"[^>]*w:dirty="true"/);
    expect(xml).toContain('w:val="Heading1"');
  });

  it("artigo simples não recebe campo TOC (apenas monografias/projetos têm sumário)", async () => {
    const blob = await generateArticleDocxBlob({ fields: articleFields, editorText: "# Introducao\nTexto." });
    const xml = await documentXmlFromBlob(blob);
    expect(fieldInstructionRuns(xml)).not.toContain("TOC");
  });

  it("CPG não recebe campo TOC", async () => {
    const cpgFields: AcademicFields = {
      ...emptyAcademicFields(),
      workType: "resumo_cpg",
      author: "Maria Silva",
      title: "Resumo CPG",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      palavrasChave: "p",
      keywords: "k",
    };
    const blob = await generateCpgDocxBlob({ fields: cpgFields, editorText: "# Introducao\nTexto." });
    const xml = await documentXmlFromBlob(blob);
    expect(fieldInstructionRuns(xml)).not.toContain("TOC");
    expect(xml).not.toMatch(/<w:fldChar w:fldCharType="begin"/);
  });
});
