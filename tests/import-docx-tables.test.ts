import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { importDocumentFile } from "../src/import-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { documentText } from "./test-utils/ooxml";

function paragraphXml(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tableXml(rows: string[][]): string {
  const rowXmls = rows.map((cells) => {
    const cellXmls = cells.map((cell) => `<w:tc><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`).join("");
    return `<w:tr>${cellXmls}</w:tr>`;
  }).join("");
  return `<w:tbl>${rowXmls}</w:tbl>`;
}

async function makeSyntheticDocxWithTable(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
    paragraphXml("AUTORA SINTETICA"),
    paragraphXml("TITULO SINTETICO"),
    paragraphXml("1 INTRODUCAO"),
    paragraphXml("Texto antes da tabela."),
    paragraphXml("Quadro 1 - Perfil dos participantes."),
    tableXml([
      ["Coluna A", "Coluna B", "Coluna C"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]),
    paragraphXml("Fonte: elaboração própria (2025)."),
    paragraphXml("Texto depois da tabela."),
    paragraphXml("REFERENCIAS"),
    paragraphXml("SILVA, A. Referencia sintetica."),
  ].join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

async function makeSyntheticDocxWithEmptyTable(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
    paragraphXml("AUTORA SINTETICA"),
    paragraphXml("TITULO SINTETICO"),
    paragraphXml("1 INTRODUCAO"),
    tableXml([["", ""], ["", ""]]),
    paragraphXml("REFERENCIAS"),
    paragraphXml("SILVA, A. Referencia sintetica."),
  ].join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

async function importSyntheticDocx(buffer: ArrayBuffer, fileName = "sintetico.docx") {
  const file = new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return importDocumentFile(file);
}

describe("importacao de tabelas DOCX", () => {
  it("detecta tabela real do DOCX", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());

    expect(result.importedTables).toHaveLength(1);
    expect(result.importedTables[0].origin).toBe("docx-table");
    expect(result.importedTables[0].status).toBe("preserved");
  });

  it("preserva numero de linhas e colunas", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());
    const table = result.importedTables[0];

    expect(table.rowCount).toBe(3);
    expect(table.columnCount).toBe(3);
  });

  it("preserva texto das celulas", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());
    const table = result.importedTables[0];

    expect(table.rows[0]).toEqual(["Coluna A", "Coluna B", "Coluna C"]);
    expect(table.rows[1]).toEqual(["1", "2", "3"]);
    expect(table.rows[2]).toEqual(["4", "5", "6"]);
  });

  it("associa legenda proxima", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());

    expect(result.importedTables[0].caption).toBe("Quadro 1 - Perfil dos participantes.");
  });

  it("associa fonte proxima", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());

    expect(result.importedTables[0].source).toBe("Fonte: elaboração própria (2025).");
  });

  it("editorText contem marcador amigavel, mas nao marcador tecnico de tabela", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());

    expect(result.editorText).not.toContain("[Tabela detectada");
    expect(result.editorText).toContain("[[Tabela importada preservada:");
  });

  it("DOCX final contem w:tbl com textos das celulas", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: "Resumo sintetico.",
      abstractText: "Synthetic abstract.",
      palavrasChave: "teste.",
      keywords: "test.",
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toBeTruthy();
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Coluna A");
    expect(documentXml).toContain("Coluna B");
    expect(documentXml).toContain("Coluna C");
    expect(documentXml).toContain("1");
    expect(documentXml).toContain("6");
  });

  it("DOCX final nao duplica legenda nem fonte consumidas pela tabela importada", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithTable());
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: "Resumo sintetico.",
      abstractText: "Synthetic abstract.",
      palavrasChave: "teste.",
      keywords: "test.",
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const text = documentText(documentXml ?? "");

    expect(documentXml).toContain("<w:tbl>");
    expect((text.match(/Quadro 1 - Perfil dos participantes\./g) ?? []).length).toBe(1);
    expect((text.match(/Fonte: elaboração própria \(2025\)\./g) ?? []).length).toBe(1);
    expect(text).toContain("Coluna A");
    expect(text).toContain("6");
  });

  it("tabela vazia e ignorada com segurança", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithEmptyTable());

    expect(result.importedTables).toHaveLength(1);
    expect(result.importedTables[0].status).toBe("ignored-empty-table");
    expect(result.importedTables[0].rows).toHaveLength(0);
  });

  it("tabela nao preservavel nao gera w:tbl e nao vira lixo textual", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: "Resumo sintetico.",
      abstractText: "Synthetic abstract.",
      palavrasChave: "teste.",
      keywords: "test.",
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: "Quadro 9 - Dados.\nFonte: autor.",
      importedImages: [],
      importedTables: [
        {
          id: "tbl-broken",
          rows: [["A", "B"]],
          rowCount: 1,
          columnCount: 2,
          caption: "Quadro 9 - Dados.",
          source: "Fonte: autor.",
          position: 0,
          origin: "docx-table",
          status: "detected-but-not-preserved",
        },
      ],
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).not.toContain("<w:tbl>");
    expect(documentXml).toContain("Quadro 9 - Dados.");
    expect(documentXml).toContain("Fonte: autor.");
  });

  it("tabelas em header nao sao duplicadas no corpo", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
      paragraphXml("AUTORA SINTETICA"),
      paragraphXml("TITULO SINTETICO"),
      paragraphXml("1 INTRODUCAO"),
      paragraphXml("Texto."),
      paragraphXml("REFERENCIAS"),
      paragraphXml("SILVA, A. Referencia sintetica."),
    ].join("");
    const headerBody = [
      tableXml([["H1", "H2"], ["H3", "H4"]]),
    ].join("");

    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
    );
    zip.file(
      "word/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
    );
    zip.file(
      "word/header1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${headerBody}</w:body></w:hdr>`,
    );

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }), "header-tabela.docx");

    expect(result.importedTables).toHaveLength(0);
  });
});
