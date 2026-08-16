import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractDocxStructure } from "../../src/word-structure-extractor";
import { importDocumentFile } from "../../src/import-docx";

function buildDocx(bodyXml: string, extraFiles: Array<[string, string]> = []): Promise<ArrayBuffer> {
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
  <w:body>${bodyXml}<w:sectPr/></w:body>
</w:document>`,
  );
  for (const [path, content] of extraFiles) zip.file(path, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("importDocx track changes/comments/bookmarks/vMerge", () => {
  it("extrai runs com w:ins (changeKind), comentários e bookmarks", async () => {
    const buffer = await buildDocx(`
      <w:p>
        <w:bookmarkStart w:id="0" w:name="bm1"/>
        <w:r><w:t>Texto original</w:t></w:r>
        <w:bookmarkEnd w:id="0"/>
        <w:commentRangeStart w:id="5"/>
        <w:ins w:id="1" w:author="Revisor" w:date="2026-01-01T00:00:00Z">
          <w:r><w:t>Texto inserido</w:t></w:r>
        </w:ins>
        <w:commentRangeEnd w:id="5"/>
      </w:p>`);

    const structure = await extractDocxStructure(buffer);

    expect(structure.paragraphs).toHaveLength(1);
    const paragraph = structure.paragraphs[0];
    expect(paragraph.bookmarks).toContainEqual({ id: "0", start: true });
    expect(paragraph.bookmarks).toContainEqual({ id: "0", start: false });

    const insertedRun = paragraph.runs.find((r) => r.text.includes("inserido"));
    expect(insertedRun?.changeKind).toBe("insertion");
    expect(insertedRun?.commentId).toBe("5");

    const block = structure.blocks.find((b) => b.type === "paragraph");
    expect(block && "commentIds" in block && block.commentIds).toContain("5");
  });

  it("detecta vMerge restart/continue em tabelas", async () => {
    const buffer = await buildDocx(`
      <w:tbl>
        <w:tr>
          <w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>Celula A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:tcPr><w:vMerge w:val="continue"/></w:tcPr><w:p><w:r><w:t/></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>`);

    const structure = await extractDocxStructure(buffer);

    const tableBlock = structure.blocks.find((b) => b.type === "table");
    expect(tableBlock).toBeDefined();
    expect(tableBlock && "hasVerticalMerge" in tableBlock && tableBlock.hasVerticalMerge).toBe(true);
    const merges =
      tableBlock && "cellMerges" in tableBlock && tableBlock.cellMerges
        ? tableBlock.cellMerges
        : [];
    expect(merges).toContainEqual({ row: 0, col: 0, type: "vMerge-restart" });
    expect(merges).toContainEqual({ row: 1, col: 0, type: "vMerge-continue" });
  });

  it("extrai word/comments.xml (id → texto) na estrutura", async () => {
    const buffer = await buildDocx(
      `<w:p>
        <w:commentRangeStart w:id="3"/>
        <w:r><w:t>Texto com comentário</w:t></w:r>
        <w:commentRangeEnd w:id="3"/>
      </w:p>`,
      [["word/comments.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="3" w:author="Orientador" w:date="2026-08-01T00:00:00Z">
    <w:p><w:r><w:t>Reformular este parágrafo.</w:t></w:r></w:p>
  </w:comment>
</w:comments>`]],
    );

    const structure = await extractDocxStructure(buffer);
    expect(structure.comments["3"]).toBe("Reformular este parágrafo.");
  });

  it("alerta explicitamente que comentários/revisões não são reemitidos no round-trip", async () => {
    const buffer = await buildDocx(
      `<w:p>
        <w:commentRangeStart w:id="3"/>
        <w:ins w:id="1" w:author="Revisor" w:date="2026-01-01T00:00:00Z">
          <w:r><w:t>Inserido</w:t></w:r>
        </w:ins>
        <w:commentRangeEnd w:id="3"/>
      </w:p>`,
      [["word/comments.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="3" w:author="Orientador"><w:p><w:r><w:t>Comentário de revisão.</w:t></w:r></w:p></w:comment>
</w:comments>`]],
    );

    const file = new File([buffer], "revisado.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const result = await importDocumentFile(file);

    const joined = result.messages.join(" ");
    expect(joined).toContain("comentário");
    expect(joined).toContain("não são reemitidos");
    expect(joined.toLocaleLowerCase()).toContain("marcações");
  });

  it("retorna estrutura com arrays vazios quando não há marcação", async () => {
    const buffer = await buildDocx(`<w:p><w:r><w:t>Paragrafo simples</w:t></w:r></w:p>`);

    const structure = await extractDocxStructure(buffer);
    expect(structure.blocks).toBeDefined();
    expect(structure.paragraphs).toBeDefined();
    const paragraph = structure.paragraphs[0];
    expect(paragraph.runs.every((r) => r.changeKind === undefined)).toBe(true);
  });
});
