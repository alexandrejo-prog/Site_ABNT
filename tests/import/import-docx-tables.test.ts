import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { documentText } from ".././test-utils/ooxml";

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

async function makeSyntheticDocxWithGroupedAcademicTable(
  caption = "Quadro 99 - Beneficios do trabalho remoto.",
  contentHeader = "Vantagens",
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
    paragraphXml("AUTORA SINTETICA"),
    paragraphXml("TITULO SINTETICO"),
    paragraphXml("1 INTRODUCAO"),
    paragraphXml(caption),
    tableXml([
      ["Categoria", contentHeader, "Autores", ""],
      ["Organizacao", "Reducao de custos", "Goulart (2009)", ""],
      ["", "Retencao de talentos", "Boonen (2012)", ""],
      ["Trabalhadores", "Economia de recursos financeiros", "Goulart (2009)", ""],
      ["", "Reducao do estresse", "Aderaldo et al. (2017)", ""],
    ]),
    paragraphXml("Fonte: elaboracao propria (2025)."),
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
  it("reconstrói tabela acadêmica agrupada com autores sem depender do número do quadro", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithGroupedAcademicTable());
    const table = result.importedTables[0];

    expect(table.renderMode).toBe("semantic-reconstructed-table");
    expect(table.reconstructedTable?.headers).toEqual(["Grupo", "Vantagens", "Autores"]);
    expect(table.reconstructedTable?.rows).toHaveLength(4);
    expect(table.reconstructedTable?.rows[0].cells).toEqual(["Organizacao", "Reducao de custos", "Goulart (2009)"]);
    expect(table.reconstructedTable?.rows[1].cells).toEqual(["Organizacao", "Retencao de talentos", "Boonen (2012)"]);
    expect(table.reconstructedTable?.rows[2].cells).toEqual(["Trabalhadores", "Economia de recursos financeiros", "Goulart (2009)"]);
    expect(table.logicalColumnCount).toBe(3);
    expect(table.originalColumnCount).toBe(4);
  });

  it("reconstrói tabela de pontos críticos com caption genérica de tabela", async () => {
    const result = await importSyntheticDocx(
      await makeSyntheticDocxWithGroupedAcademicTable("Tabela 12 - Desafios organizacionais.", "Pontos criticos"),
    );
    const table = result.importedTables[0];

    expect(table.renderMode).toBe("semantic-reconstructed-table");
    expect(table.reconstructedTable?.headers).toEqual(["Grupo", "Pontos críticos", "Autores"]);
    expect(table.reconstructedTable?.rows.some((row) => row.cells.includes("Reducao de custos"))).toBe(true);
  });

  it("exporta tabela reconstruída com três colunas úteis, sem marcador interno nem coluna fantasma", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithGroupedAcademicTable());
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
    expect(text).toContain("Grupo");
    expect(text).toContain("Vantagens");
    expect(text).toContain("Autores");
    expect(text).toContain("Reducao de custos");
    expect(text).toContain("Aderaldo et al. (2017)");
    expect(text).not.toContain("[[Tabela importada preservada:");
    expect((text.match(/Quadro 99 - Beneficios do trabalho remoto\./g) ?? []).length).toBe(1);
    expect((text.match(/Fonte: elaboracao propria \(2025\)\./g) ?? []).length).toBe(1);
  });

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

  it("tabela com colunas fantasmas e padrao academico detectavel vira tabela semantica com aviso", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      `<w:tbl><w:tblGrid><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /><w:gridCol w:w="1000" /></w:tblGrid>` +
        tableXmlWithPhantomColumns([
          ["Fase", "Características", "", "", "", "", "", "", ""],
          ["Projeto", "formação", "", "", "", "", "", "", ""],
          ["Convencimento", "apresentar", "", "", "", "", "", "", ""],
          ["Implementação", "teste", "", "", "", "", "", "", ""],
          ["Avaliação", "revisar", "", "", "", "", "", "", ""],
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

    expect(table.renderMode).toBe("semantic-reconstructed-table");
    expect(table.status).toBe("preserved-with-layout-warning");
    expect(table.layoutWarning).toBeTruthy();
    expect(table.reconstructedTable?.headers).toHaveLength(2);
    expect(table.reconstructedTable?.headers[0]).toBe("Fase");

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
    expect(documentXml).toContain("Fase");
    expect(documentXml).toContain("Características");
    expect(documentXml).toContain("formação");
  });

  it("Quadro 5 com coluna fantasma final vira tabela de 3 colunas com grupo reconstruido", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      tableXml([
        ["Categoria", "Vantagens", "Autores", ""],
        ["Organização", "Redução de custos", "Goulart (2009)", ""],
        ["", "Retenção de talentos", "Boonen (2012)", ""],
        ["Trabalhadores", "Economia de recursos financeiros", "Goulart (2009)", ""],
        ["", "Redução do estresse", "Aderaldo et al. (2017)", ""],
      ]),
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

    expect(table.columnCount).toBe(3);
    expect(table.rowCount).toBe(5);
    expect(table.rows[0]).toEqual([{ text: "Categoria" }, { text: "Vantagens" }, { text: "Autores" }]);
    expect(table.rows[1]).toEqual([{ text: "Organização" }, { text: "Redução de custos" }, { text: "Goulart (2009)" }]);
    expect(table.rows[2]).toEqual([{ text: "" }, { text: "Retenção de talentos" }, { text: "Boonen (2012)" }]);
    expect(table.rows[3]).toEqual([{ text: "Trabalhadores" }, { text: "Economia de recursos financeiros" }, { text: "Goulart (2009)" }]);
    expect(table.rows[4]).toEqual([{ text: "" }, { text: "Redução do estresse" }, { text: "Aderaldo et al. (2017)" }]);
    expect(table.groupColumnIndex).toBe(0);
    expect(table.groupSpans).toEqual([
      { rowStart: 1, rowEnd: 2, text: "Organização" },
      { rowStart: 3, rowEnd: 4, text: "Trabalhadores" },
    ]);
    expect(table.hasReconstructedVerticalMerge).toBe(true);
    expect(table.renderMode).toBe("semantic-reconstructed-table");
    expect(table.status).toBe("preserved-with-layout-warning");
    expect(table.reconstructedTable?.headers).toEqual(["Grupo", "Vantagens", "Autores"]);

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
    expect(documentXml).toContain("Organização");
    expect(documentXml).toContain("Trabalhadores");
    expect(documentXml).toContain("Vantagens");
    expect(documentXml).toContain("Autores");
    expect(documentXml).toContain("Redução de custos");
    expect((documentXml?.match(/<w:tc\b/g) ?? []).length).toBe(15);
  });

  it("Quadro 6 com coluna fantasma final vira tabela de 3 colunas", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      tableXml([
        ["Categoria", "Pontos críticos", "Autores", ""],
        ["Organização", "Resistência à mudança", "Goulart (2009)", ""],
        ["", "Falta de infraestrutura", "Boonen (2012)", ""],
        ["Trabalhadores", "Isolamento social", "Aderaldo et al. (2017)", ""],
        ["", "Sobrecarga de trabalho", "Goulart (2009)", ""],
      ]),
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

    expect(table.columnCount).toBe(3);
    expect(table.rowCount).toBe(5);
    expect(table.rows[0]).toEqual([{ text: "Categoria" }, { text: "Pontos críticos" }, { text: "Autores" }]);
    expect(table.rows[1]).toEqual([{ text: "Organização" }, { text: "Resistência à mudança" }, { text: "Goulart (2009)" }]);
    expect(table.groupColumnIndex).toBe(0);
    expect(table.groupSpans).toEqual([
      { rowStart: 1, rowEnd: 2, text: "Organização" },
      { rowStart: 3, rowEnd: 4, text: "Trabalhadores" },
    ]);
    expect(table.hasReconstructedVerticalMerge).toBe(true);
    expect(table.renderMode).toBe("semantic-reconstructed-table");
    expect(table.status).toBe("preserved-with-layout-warning");
    expect(table.reconstructedTable?.headers).toEqual(["Grupo", "Pontos críticos", "Autores"]);

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
    expect(documentXml).toContain("Pontos críticos");
    expect(documentXml).toContain("Autores");
    expect(documentXml).toContain("Resistência à mudança");
    expect(documentXml).not.toContain("verticalMerge=\"restart\"");
  });

  it("nao aplica heuristica de grupo em tabela comum", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      tableXml([
        ["Nome", "Idade", "Cidade"],
        ["Ana", "30", "São Paulo"],
        ["Bruno", "25", "Rio de Janeiro"],
        ["Carlos", "35", "Belo Horizonte"],
      ]),
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

    expect(table.columnCount).toBe(3);
    expect(table.groupColumnIndex).toBeUndefined();
    expect(table.groupSpans).toBeUndefined();
    expect(table.hasReconstructedVerticalMerge).toBeUndefined();
    expect(table.rows[0]).toEqual([{ text: "Nome" }, { text: "Idade" }, { text: "Cidade" }]);
  });

  it("preserva vMerge real do DOCX fonte", async () => {
    const zip = new JSZip();
    const body = [
      paragraphXml("1 INTRODUCAO"),
      `<w:tbl><w:tblGrid><w:gridCol w:w="2000" /><w:gridCol w:w="2000" /></w:tblGrid>` +
        `<w:tr>` +
          `<w:tc><w:tcPr><w:vMerge w:val="restart" /></w:tcPr><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>` +
          `<w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>` +
        `</w:tr>` +
        `<w:tr>` +
          `<w:tc><w:tcPr><w:vMerge w:val="continue" /></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>` +
          `<w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc>` +
        `</w:tr>` +
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

    expect(table.hasVerticalMerge).toBe(true);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0].text).toBe("A");
    expect(table.rows[1][0].text).toBe("");
    expect(table.rows[1][1].text).toBe("C");

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
    expect(documentXml).toContain("<w:vMerge w:val=\"restart\"");
    expect(documentXml).toContain("<w:vMerge w:val=\"continue\"");
  });
});

describe("w:tblHeader — identificação semântica de linha de cabeçalho (NBR 17225 / WCAG 1.3.1)", () => {
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

  async function exportXmlFromTableBody(tableBodyXml: string): Promise<string> {
    const zip = new JSZip();
    const body = [
      paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
      paragraphXml("AUTORA SINTETICA"),
      paragraphXml("TITULO SINTETICO"),
      paragraphXml("1 INTRODUCAO"),
      paragraphXml("Texto antes da tabela."),
      paragraphXml("Quadro 1 - Perfil dos participantes."),
      tableBodyXml,
      paragraphXml("Fonte: elaboração própria (2025)."),
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

    const result = await importSyntheticDocx(await zip.generateAsync({ type: "arraybuffer" }));
    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());
    return (await outputZip.file("word/document.xml")?.async("string")) ?? "";
  }

  const row = (cells: string[], header = false) =>
    `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${cells
      .map((cell) => `<w:tc><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`)
      .join("")}</w:tr>`;

  const tableFromRows = (rowsXml: string) => `<w:tbl>${rowsXml}</w:tbl>`;

  it("mantém a declaração de cabeçalho do DOCX de origem (w:tblHeader na primeira linha)", async () => {
    const documentXml = await exportXmlFromTableBody(
      tableFromRows([
        row(["Coluna A", "Coluna B", "Coluna C"], true),
        row(["1", "2", "3"]),
        row(["4", "5", "6"]),
      ].join("")),
    );

    expect(documentXml).toContain("<w:tbl>");
    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(1);
    expect(documentText(documentXml)).toContain("Coluna A");
    expect(documentText(documentXml)).toContain("4");
  });

  it("usa a primeira linha como cabeçalho em tabela preservada com 2+ linhas (semântica atual de negrito)", async () => {
    const documentXml = await exportXmlFromTableBody(
      tableFromRows([
        row(["Nome", "Cargo", "Setor"]),
        row(["Ana", "Analista", "RH"]),
      ].join("")),
    );

    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(1);
  });

  it("não emite w:tblHeader em tabela de linha única (sem linha de cabeçalho semântica)", async () => {
    const documentXml = await exportXmlFromTableBody(
      tableFromRows(row(["Unica linha", "sem cabeçalho"])),
    );

    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(0);
  });

  it("não trata w:tblHeader w:val=\"false\" como cabeçalho", async () => {
    const documentXml = await exportXmlFromTableBody(
      tableFromRows(
        `<w:tr><w:trPr><w:tblHeader w:val="false"/></w:trPr><w:tc><w:p><w:r><w:t>Unica linha</w:t></w:r></w:p></w:tc></w:tr>`,
      ),
    );

    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(0);
  });

  it("aplica w:tblHeader na linha de headers de tabela reconstruída semanticamente", async () => {
    const result = await importSyntheticDocx(await makeSyntheticDocxWithGroupedAcademicTable());
    const table = result.importedTables[0];
    expect(table.renderMode).toBe("semantic-reconstructed-table");

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const outputZip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = (await outputZip.file("word/document.xml")?.async("string")) ?? "";
    const text = documentText(documentXml);

    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(1);
    expect(text).toContain("Grupo");
    expect(text).toContain("Vantagens");
  });

  it("tabela com cabeçalho declarado no meio mantém o índice correto após filtro de linhas vazias", async () => {
    const documentXml = await exportXmlFromTableBody(
      tableFromRows([
        row(["", "", ""]),
        row(["Coluna A", "Coluna B", "Coluna C"], true),
        row(["1", "2", "3"]),
      ].join("")),
    );

    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(1);
  });

  it("regressão Quadro 2: tabela sem vocabulário de cabeçalho permanece editable-table e preserva o conteúdo", async () => {
    // Cabeçalho real sem vocabulário acadêmico reconhecível (Instituição | Tipo
    // de Documento | De quando | De quem | Endereço eletrônico). Uma heurística
    // de "rótulos curtos" reclassificava esta tabela como grouped-with-authors,
    // descartando a linha de cabeçalho e embaralhando colunas no round-trip
    // (regressão do Quadro 2, 2026-08-14).
    const documentXml = await exportXmlFromTableBody(
      tableFromRows([
        row(["Instituição", "Tipo de Documento", "De quando", "De quem", "Endereço eletrônico"]),
        row(["FURG", "Resolução nº 005", "16 de abril de 2010", "Conselho Universitário", "http://repositorio.furg.br:8080/jspui/politica.jsp"]),
        row(["UFRGS", "Portaria nº 5068", "13 de outubro de 2010", "Gabinete do Reitor", "http://www.lume.ufrgs.br/portaria-5068.pdf"]),
        row(["UTFPR", "[regulamento]", "4 de dezembro de 2009", "Comissão do Repositório Institucional", "http://repositorio.utfpr.edu.br/politica.pdf"]),
        row(["UFBA", "Portaria nº 024", "7 de janeiro de 2010", "Gabinete do Reitor", "https://repositorio.ufba.br/politica.pdf"]),
        row(["UFC", "Resolução nº 02", "29 de abril de 2011", "Conselho Universitário", "http://www.repositorio.ufc.br/Resolucao02.pdf"]),
        row(["UFRN", "Resolução nº 059", "13 de abril de 2010", "Conselho de Ensino, Pesquisa e Extensão", "http://repositorio.ufrn.br/resolucao_59"]),
      ].join("")),
    );
    const text = documentText(documentXml);

    // Todo o conteúdo original presente (cabeçalho + linhas, sem embaralhamento).
    expect(text).toContain("Instituição");
    expect(text).toContain("Tipo de Documento");
    expect(text).toContain("De quando");
    expect(text).toContain("De quem");
    expect(text).toContain("Endereço eletrônico");
    expect(text).toContain("Conselho Universitário");
    expect(text).toContain("Gabinete do Reitor");
    expect(text).toContain("Comissão do Repositório Institucional");
    expect(text).toContain("http://www.lume.ufrgs.br/portaria-5068.pdf");
    expect(text).toContain("Resolução nº 059");
    // Não foi reconstruída como Grupo/Conteúdo/Autores (embaralhamento).
    expect(text).not.toContain("Grupo");
    expect(text).not.toContain("Autores");
    // Acessibilidade mantida: primeira linha é o cabeçalho semântico (2+ linhas).
    expect((documentXml.match(/<w:tblHeader\b[^>]*\/?>/g) ?? []).length).toBe(1);
  });

  it("infere w:tblHeader na linha de rótulos quando a 1ª linha é título (Tema: ...)", async () => {
    // Baseline convertido de PDF: 1ª linha "Tema: ..." (título) + 2ª linha de
    // rótulos. O header semântico é a 2ª linha — não a 1ª (regressão corrigida
    // 2026-08-15: o fallback 0 marcava o TÍTULO como cabeçalho).
    const documentXml = await exportXmlFromTableBody(
      tableFromRows([
        row(["Tema: Formulação e implementação da PII e do RI na UFLA"]),
        row(["Categoria", "Questões", "Avaliação"]),
        row(["Movimento de acesso", "Você acredita?", "Sim"]),
        row(["Visibilidade", "Você conhece?", "Não"]),
      ].join("")),
    );
    const rows = [...documentXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
    const headerRows = rows.map((r, i) => (/(<w:tblHeader\b[^>]*\/?>)/.test(r) ? i : -1)).filter((i) => i >= 0);

    // Exatamente 1 linha com w:tblHeader e ela é a 2ª (index 1), não o título.
    expect(headerRows).toEqual([1]);
    expect(documentText(documentXml)).toContain("Categoria");
    expect(documentText(documentXml)).toContain("Tema: Formulação");
  });
});
