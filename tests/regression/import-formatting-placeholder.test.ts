import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { generateDocxBlob } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";

// ---------------------------------------------------------------------------
// A2 — importação avisa que formatação de caracteres não é preservada
// A3 — linha de imagem importada com id inválido vira placeholder visível
// (docs/checklist-14-correcoes.md, Bloco A)
// ---------------------------------------------------------------------------

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const NAMESPACES =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

async function minimalDocx(documentXml: string): Promise<Blob> {
  return new JSZip()
    .file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    )
    .file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    )
    .file("word/document.xml", documentXml)
    .generateAsync({ type: "blob" });
}

async function importMinimal(bodyXml: string) {
  const xml = `<w:document ${NAMESPACES}><w:body>${bodyXml}</w:body></w:document>`;
  const file = new File([await (await minimalDocx(xml)).arrayBuffer()], "fmt.docx", {
    type: DOCX_TYPE,
  });
  return importDocumentFile(file);
}

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

const MONOGRAFIA_FIELDS = () => ({
  ...emptyAcademicFields(),
  workType: "monografia" as const,
  author: "SILVA, J.",
  title: "Titulo",
  resumo: "Resumo.",
  palavrasChave: "palavras; chave",
});

describe("A2 — importação avisa perda de formatação de caracteres", () => {
  it("DOCX com negrito/itálico/sublinhado gera aviso no resultado de importação", async () => {
    const result = await importMinimal(
      "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Negrito</w:t></w:r>" +
        "<w:r><w:rPr><w:i/></w:rPr><w:t>Italico</w:t></w:r>" +
        "<w:r><w:rPr><w:u w:val=\"single\"/></w:rPr><w:t>Sublinhado</w:t></w:r></w:p>",
    );
    const joined = result.messages.join("\n");
    expect(joined).toMatch(/formatação de destaque/);
    expect(joined).toMatch(/negrito\/itálico\/sublinhado/);
    expect(result.editorText).toContain("Negrito");
    expect(result.editorText).toContain("Italico");
  });

  it("DOCX sem formatação de destaque NÃO gera o aviso", async () => {
    const result = await importMinimal(
      "<w:p><w:r><w:t>Texto normal sem destaque.</w:t></w:r></w:p>",
    );
    expect(result.messages.join("\n")).not.toMatch(/formatação de destaque/);
    expect(result.editorText).toContain("Texto normal sem destaque.");
  });
});

describe("A3 — imagem importada com id inválido vira placeholder visível", () => {
  it("marcador com id inexistente gera placeholder no DOCX (não some)", async () => {
    const blob = await generateDocxBlob({
      fields: MONOGRAFIA_FIELDS(),
      editorText:
        "[[Imagem importada preservada: img-inexistente]]\n\nTexto normal.",
    });
    const docXml = await documentXml(blob);
    expect(docXml).toContain(
      "[Imagem importada: dados originais indisponíveis (id: img-inexistente)",
    );
    expect(docXml).not.toContain("[[Imagem importada preservada: img-inexistente]]");
  });

  it("DOCX sem marcador de imagem não contém placeholder", async () => {
    const blob = await generateDocxBlob({
      fields: MONOGRAFIA_FIELDS(),
      editorText: "Somente texto, sem imagem.",
    });
    const docXml = await documentXml(blob);
    expect(docXml).not.toContain("[Imagem importada: dados originais indisponíveis");
  });
});
