import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { UFLA_RULES, emptyAcademicFields } from "../src/ufla-rules";

const fields = {
  ...emptyAcademicFields(),
  workType: "artigo" as const,
  author: "Maria Silva",
  title: "Qualidade do café no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "café; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introdução.",
  referencias: "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
};

async function generatedXml(
  inputFields = fields,
  editorText = "# 1 Introdução\nTexto comum.\n> Citação longa.",
) {
  const logoPath = join(process.cwd(), "public", "assets", "ufla-logo.jpeg");
  const blob = await generateDocxBlob({
    fields: inputFields,
    editorText,
    logo: {
      data: readFileSync(logoPath),
      width: 120,
      height: 44,
    },
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX sem document.xml.");
  return { zip, documentXml };
}

function paragraphsIn(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

function textFromXml(documentXml: string): string {
  return [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

function paragraphXmlContaining(documentXml: string, text: string): string {
  const paragraph = paragraphsIn(documentXml).find((item) => item.includes(text));
  expect(paragraph).toBeTruthy();
  return paragraph ?? "";
}

function textRunsIn(paragraphXml: string): string[] {
  return paragraphXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) ?? [];
}

function runXmlContaining(paragraphXml: string, text: string): string {
  const run = textRunsIn(paragraphXml).find((item) => item.includes(text));
  expect(run).toBeTruthy();
  return run ?? "";
}

function countText(value: string, text: string): number {
  return value.split(text).length - 1;
}

function lastParagraphIndexContaining(documentXml: string, text: string): number {
  const paragraphs = paragraphsIn(documentXml);
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    if (paragraphs[index].includes(text)) return index;
  }
  return -1;
}

describe("exportação DOCX", () => {
  it("gera Blob válido", async () => {
    const blob = await generateDocxBlob({
      fields,
      editorText: "# Introdução\nTexto comum.\n> Citação longa.",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });

  it("converte texto do editor para blocos internos", () => {
    expect(parseEditorContent("# Introdução\n## Contexto\n> Citação")).toEqual([
      { type: "heading1", text: "Introdução" },
      { type: "heading2", text: "Contexto" },
      { type: "longQuote", text: "Citação" },
    ]);
  });

  it("mantém margens UFLA corretas", () => {
    expect(UFLA_RULES.margins.topCm).toBe(3);
    expect(UFLA_RULES.margins.leftCm).toBe(3);
    expect(UFLA_RULES.margins.bottomCm).toBe(2);
    expect(UFLA_RULES.margins.rightCm).toBe(2);
  });

  it("inclui campos acadêmicos principais no DOCX gerado", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("QUALIDADE DO CAFÉ NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Abstract text.");
    expect(documentXml).toContain("Texto comum.");
    expect(textFromXml(documentXml)).toContain("SILVA, M. Qualidade do café.");
  });

  it("aplica normalização de referências no XML do DOCX", async () => {
    const { documentXml } = await generatedXml({
      ...fields,
      referencias: [
        "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
        "SOUZA, J. Manual academico. Lavras: UFLA, 2025. et al.",
      ].join("\n"),
    });

    const referenceParagraph = paragraphXmlContaining(documentXml, "SILVA, M.");
    expect(referenceParagraph).toContain("Qualidade do café");

    const titleRun = runXmlContaining(referenceParagraph, "Qualidade do café");
    expect(titleRun).toContain("<w:b");

    const referenceRuns = textRunsIn(referenceParagraph).filter((run) => run.includes("<w:t"));
    const boldRuns = referenceRuns.filter((run) => run.includes("<w:b"));
    expect(referenceRuns.length).toBeGreaterThan(1);
    expect(boldRuns.length).toBeLessThan(referenceRuns.length);
    expect(runXmlContaining(referenceParagraph, "SILVA, M. ")).not.toContain("<w:b");

    const etAlParagraph = paragraphXmlContaining(documentXml, "et al.");
    const etAlRun = runXmlContaining(etAlParagraph, "et al.");
    expect(etAlRun).toContain("<w:i");

    const paragraphs = paragraphsIn(documentXml);
    const referencesTitleIndex = lastParagraphIndexContaining(documentXml, "REFERÊNCIAS");
    expect(referencesTitleIndex).toBeGreaterThan(0);
    expect(paragraphs[referencesTitleIndex - 1]).toMatch(/<w:br\s+w:type="page"\/>/);
  });

  it("inicia a numeração visível da seção textual em 1", async () => {
    const { documentXml } = await generatedXml({
      ...fields,
      indicadoresImpacto: "Indicador de impacto.",
      impactIndicators: "Impact indicator.",
    });

    expect(documentXml).toContain("SUMÁRIO");
    expect(documentXml).toMatch(/<w:pgNumType\b[^>]*w:start="1"/);
  });

  it("não duplica conclusão quando o corpo já tem considerações finais", async () => {
    const { documentXml } = await generatedXml(
      {
        ...fields,
        conclusao: "Texto final importado do campo.",
      },
      "# 1 Introdução\nTexto comum.\n# 6 Considerações finais\nTexto final do editor.",
    );
    const text = textFromXml(documentXml);
    const finalConsiderationsHeadings = paragraphsIn(documentXml).filter(
      (paragraph) =>
        paragraph.includes("6 CONSIDERAÇÕES FINAIS") &&
        paragraph.includes('<w:pStyle w:val="Heading1"'),
    );

    expect(countText(text, "6 CONSIDERAÇÕES FINAIS")).toBe(2);
    expect(finalConsiderationsHeadings).toHaveLength(1);
    expect(text).not.toContain("CONCLUSÃO");
    expect(text).not.toContain("Texto final importado do campo.");
  });

  it("não aplica cor azul ao resumo ou abstract", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).not.toMatch(/w:color\s+w:val="(?:0000ff|0070c0|0563c1)"/i);
  });

  it("inclui mídia da logo quando o ativo está disponível", async () => {
    const logoPath = join(process.cwd(), "public", "assets", "ufla-logo.jpeg");
    expect(existsSync(logoPath)).toBe(true);

    const { zip } = await generatedXml();
    expect(Object.keys(zip.files).some((name) => name.startsWith("word/media/"))).toBe(true);
  });
});
