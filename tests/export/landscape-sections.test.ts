import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { extractDocxStructure } from "../../src/word-structure-extractor";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { runOoxmlChecks, type DocxParts } from "../../scripts/ufla-compliance/ooxml-checks";

const SECT = (orient: string, w: string, h: string) =>
  `<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"${orient ? ` w:orient="${orient}"` : ""}/><w:pgMar w:top="1701" w:bottom="1134" w:left="1701" w:right="1134" w:header="1134" w:footer="1134"/></w:sectPr>`;

function landscapeParts(): DocxParts {
  const portrait = SECT("", "11906", "16838");
  const landscape = SECT("landscape", "16838", "11906");
  return {
    names: ["word/document.xml", "word/styles.xml"],
    documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Intro</w:t></w:r></w:p>${portrait}<w:p><w:r><w:t>Corpo</w:t></w:r></w:p><w:p><w:pPr>${landscape}</w:pPr></w:p><w:r><w:t>Fim</w:t></w:r>${portrait}</w:body></w:document>`,
    stylesXml: '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/></w:rPr></w:rPrDefault></w:styles>',
    settingsXml: "",
    numberingXml: "",
    headerXmls: { "word/header1.xml": '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText> PAGE </w:instrText><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>' },
    footerXmls: {},
    relsXml: "",
    coreXml: "",
  };
}

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

async function documentXml(editorText: string) {
  const blob = await generateDocxBlob({ fields, editorText });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

function sectPrs(xml: string): string[] {
  return [...xml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)].map((m) => m[0]);
}

describe("Paisagem/rotacao de secao (gap P0)", () => {
  it("RED: tabela larga (6+ colunas) gera secao paisagem com A4 rotacionado", async () => {
    const xml = await documentXml(
      [
        "# 1 Introducao",
        "Texto comum.",
        "Tabela 1 - Dados amplos",
        "| A | B | C | D | E | F |",
        "|---|---|---|---|---|---|",
        "| 1 | 2 | 3 | 4 | 5 | 6 |",
        "| 7 | 8 | 9 | 10 | 11 | 12 |",
      ].join("\n"),
    );

    const sections = sectPrs(xml);
    const landscape = sections.filter((s) => /w:orient="landscape"/.test(s));

    expect(landscape.length).toBeGreaterThanOrEqual(1);
    // A4 paisagem: largura/altura trocadas (16838 x 11906 twips).
    const pgSz = landscape[0].match(/<w:pgSz\b[^>]*>/)?.[0] ?? "";
    expect(pgSz).toContain('w:orient="landscape"');
    expect(pgSz).toContain('w:w="16838"');
    expect(pgSz).toContain('w:h="11906"');
  });

  it("checker OOXML aceita A4 paisagem (w/h trocados) como pagina valida", () => {
    const issues = runOoxmlChecks(landscapeParts());
    const a4Issues = issues.filter((i) => i.code === "page-a4");
    expect(a4Issues).toEqual([]);
  });

  it("tabela estreita (2 colunas) nao gera secao paisagem", async () => {
    const xml = await documentXml(
      [
        "# 1 Introducao",
        "Texto comum.",
        "Tabela 1 - Dados",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
      ].join("\n"),
    );

    expect(sectPrs(xml).filter((s) => /w:orient="landscape"/.test(s))).toHaveLength(0);
  });

  it("RED: importacao extrai orientacao landscape do sectPr e propaga para o bloco", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Introducao</w:t></w:r></w:p>
    <w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:pPr><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr></w:pPr></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
  </w:body>
</w:document>`,
    );
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const structure = await extractDocxStructure(buffer);

    const intro = structure.blocks.find((b) => b.type === "paragraph" && b.text === "Introducao");
    expect(intro && "orientation" in intro ? intro.orientation : undefined).toBe("portrait");

    const table = structure.blocks.find((b) => b.type === "table");
    expect(table && "orientation" in table ? table.orientation : undefined).toBe("landscape");
  });
});
