import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractDocxStructure } from "../src/word-structure-extractor";

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
});
