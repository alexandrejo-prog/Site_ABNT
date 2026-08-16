import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractDocxStructure } from "../../src/word-structure-extractor";

async function makeDocx(documentBodyXml: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBodyXml}</w:body></w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("extração estrutural DOCX", () => {
  it("mantém quebra de página dentro do parágrafo como bloco próprio", async () => {
    const docx = await makeDocx(`<w:p><w:r><w:t>Texto antes</w:t></w:r><w:r><w:br w:type="page"/></w:r><w:r><w:t>Texto depois</w:t></w:r></w:p>`);

    const structure = await extractDocxStructure(docx);

    expect(structure.blocks.map((block) => block.type)).toEqual(["paragraph", "pageBreak", "paragraph"]);
    expect(structure.paragraphs.map((paragraph) => paragraph.text)).toEqual(["Texto antes", "Texto depois"]);
    expect(structure.paragraphs.some((paragraph) => paragraph.rawText.includes("\n"))).toBe(false);
    expect(structure.paragraphs[0].containsPageBreak).toBe(true);
  });

  it("preserva quebra de linha comum como texto, sem virar quebra de página", async () => {
    const docx = await makeDocx(`<w:p><w:r><w:t>Linha 1</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Linha 2</w:t></w:r></w:p>`);

    const structure = await extractDocxStructure(docx);

    expect(structure.blocks.map((block) => block.type)).toEqual(["paragraph"]);
    expect(structure.paragraphs[0].rawText).toBe("Linha 1\nLinha 2");
    expect(structure.paragraphs[0].containsPageBreak).toBe(false);
  });

  it("converte hiperlink interno em token de referência cruzada [x:ANCHOR~texto]", async () => {
    const docx = await makeDocx(
      `<w:p><w:r><w:t>Ver </w:t></w:r>` +
        `<w:hyperlink w:history="true" w:anchor="_bookmark5"><w:r><w:t>Quadro 3</w:t></w:r></w:hyperlink>` +
        `<w:r><w:t>.</w:t></w:r></w:p>`,
    );

    const structure = await extractDocxStructure(docx);

    expect(structure.paragraphs[0].text).toContain("[x:_bookmark5~Quadro 3]");
    expect(structure.paragraphs[0].text).toContain("Ver");
    expect(structure.paragraphs[0].text.endsWith(".")).toBe(true);
  });

  it("mantém hiperlink externo (r:id) como texto plano, sem token", async () => {
    const docx = await makeDocx(
      `<w:p><w:hyperlink r:id="rId25"><w:r><w:t>http://exemplo.com</w:t></w:r></w:hyperlink></w:p>`,
    );

    const structure = await extractDocxStructure(docx);

    expect(structure.paragraphs[0].text).toBe("http://exemplo.com");
    expect(structure.paragraphs[0].text).not.toContain("[x:");
  });
});

describe("nível de heading com indicativo misto (numeração quinária)", () => {
  const headingParagraph = (text: string) =>
    `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

  it.each([
    ["1.1.A Fundamento teórico", 3],
    ["A.1 Apresentação do anexo", 2],
    ["1.A.2 Dimensão aplicada", 3],
    ["1.1.1 Subseção numérica", 3],
    ["A.1.1 Item do anexo", 3],
  ])("detecta %s como nível %i", async (headingText, expectedLevel) => {
    const docx = await makeDocx(headingParagraph(headingText));
    const structure = await extractDocxStructure(docx);
    const block = structure.blocks.find((b) => b.type === "heading") as { level?: number } | undefined;
    expect(block?.level).toBe(expectedLevel);
  });

  it("não trata sentença comum iniciando com letra como heading", async () => {
    const docx = await makeDocx(headingParagraph("A. Silva (2020) descreveu o método."));
    const structure = await extractDocxStructure(docx);
    expect(structure.blocks.some((b) => b.type === "heading")).toBe(false);
  });
});
