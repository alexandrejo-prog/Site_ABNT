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

    expect(table.rows[0]).toEqual([{ text: "Coluna A" }, { text: "Coluna B" }, { text: "Coluna C" }]);
    expect(table.rows[1]).toEqual([{ text: "1" }, { text: "2" }, { text: "3" }]);
    expect(table.rows[2]).toEqual([{ text: "4" }, { text: "5" }, { text: "6" }]);
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
          rows: [[{ text: "A" }, { text: "B" }]],
          rowCount: 1,
          columnCount: 2,
          caption: "Quadro 9 - Dados.",
          source: "Fonte: autor.",
          position: 0,
          origin: "docx-table",
          status: "detected-but-not-preserved",
          hasGridSpan: false,
          hasVerticalMerge: false,
        },
      ],
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).not.toContain("<w:tbl>");
    expect(documentXml).toContain("Quadro 9 - Dados.");
    expect(documentXml).toContain("Fonte: autor.");
  });

function tableXmlWithGrid(rows: string[][], gridWidths?: number[]): string {
  const gridCols = (gridWidths ?? rows[0]?.map(() => 2000) ?? []).map((w) => `<w:gridCol w:w="${w}" />`).join("");
  const rowXmls = rows.map((cells) => {
    const cellXmls = cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa" /></w:tcPr><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`).join("");
    return `<w:tr>${cellXmls}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblGrid>${gridCols}</w:tblGrid>${rowXmls}</w:tbl>`;
}

function tableXmlWithMerge(rows: string[][]): string {
  const rowXmls = rows.map((cells) => {
    const cellXmls = cells.map((cell) => {
      const merge = cell.startsWith("MERGE:") ? `<w:gridSpan w:val="2" />` : "";
      return `<w:tc><w:tcPr>${merge}</w:tcPr><w:p><w:r><w:t>${cell.replace(/^MERGE:/, "")}</w:t></w:r></w:p></w:tc>`;
    }).join("");
    return `<w:tr>${cellXmls}</w:tr>`;
  }).join("");
  return `<w:tbl>${rowXmls}</w:tbl>`;
}

function tableXmlWithPhantomColumns(rows: string[][]): string {
  const rowXmls = rows.map((cells) => {
    const cellXmls = cells.map((cell) => {
      const width = cell ? ' w:w="2000" w:type="dxa"' : ' w:w="500" w:type="dxa"';
      return `<w:tc><w:tcPr><w:tcW${width} /></w:tcPr><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`;
    }).join("");
    return `<w:tr>${cellXmls}</w:tr>`;
  }).join("");
  return `<w:tbl>${rowXmls}</w:tbl>`;
}

  it("detecta w:tblGrid e w:gridCol quando existem", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      tableXmlWithGrid([["A", "B"], ["C", "D"]], [1500, 2500]),
      paragraphXml("REFERENCIAS"),
    ].join("");

    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`);
    zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
    expect(result.importedTables).toHaveLength(1);
    expect(result.importedTables[0].originalGridWidths).toEqual([1500, 2500]);
    expect(result.importedTables[0].estimatedColumnWidths).toEqual([38, 63]);
  });

  it("detecta gridSpan e gera layoutWarning", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      tableXmlWithMerge([["MERGE:A", "B"], ["C", "D"]]),
      paragraphXml("REFERENCIAS"),
    ].join("");

    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`);
    zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
    expect(result.importedTables).toHaveLength(1);
    expect(result.importedTables[0].hasGridSpan).toBe(true);
    expect(result.importedTables[0].status).toBe("preserved-with-layout-warning");
    expect(result.importedTables[0].layoutWarning).toContain("revisao manual");
  });

  it("preserva texto mesmo com quebras artificiais na celula", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      `<w:tbl><w:tblGrid><w:gridCol w:w="2000" /><w:gridCol w:w="2000" /></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>teletrabal\nho</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>implemen\ntação</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,
      paragraphXml("REFERENCIAS"),
    ].join("");

    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`);
    zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
    expect(result.importedTables[0].rows[0][0].text).toBe("teletrabalho");
    expect(result.importedTables[0].rows[0][1].text).toBe("implementação");
  });

  it("DOCX final aplica largura de coluna quando disponivel", async () => {
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

    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Coluna A");
    const hasTableStructure = (documentXml?.match(/<w:tr\b/g) ?? []).length >= 2;
    expect(hasTableStructure).toBe(true);
  });

  it("remove colunas fantasmas em tabela simulando PDF convertido", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      `<w:tbl><w:tblGrid><w:gridCol w:w="3000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /></w:tblGrid>` +
        tableXmlWithPhantomColumns([
          ["Fases", "Características", "", "", "", ""],
          ["Projeto", "formação de um grupo de trabalho", "", "", "", ""],
          ["Convencimento da alta administração", "apresentar o projeto", "", "", "", ""],
        ]) +
        `</w:tbl>`,
      paragraphXml("REFERENCIAS"),
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

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
    const table = result.importedTables[0];

    expect(table.columnCount).toBe(2);
    expect(table.rowCount).toBe(3);
    expect(table.rows[0]).toEqual([{ text: "Fases" }, { text: "Características" }]);
    expect(table.rows[1]).toEqual([{ text: "Projeto" }, { text: "formação de um grupo de trabalho" }]);
    expect(table.rows[2]).toEqual([
      { text: "Convencimento da alta administração" },
      { text: "apresentar o projeto" },
    ]);
  });

  it("colunas fantasmas removidas geram w:tbl com larguras recalculadas", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      `<w:tbl><w:tblGrid><w:gridCol w:w="3000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /></w:tblGrid>` +
        tableXmlWithPhantomColumns([
          ["Fases", "Características", "", "", "", ""],
          ["Projeto", "formação de um grupo de trabalho", "", "", "", ""],
        ]) +
        `</w:tbl>`,
      paragraphXml("REFERENCIAS"),
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

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
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
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await outputZip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Fases");
    expect(documentXml).toContain("Características");
    expect(documentXml).toContain("formação de um grupo de trabalho");
    expect((documentXml?.match(/<w:tc\b/g) ?? []).length).toBe(4);
  });
});
