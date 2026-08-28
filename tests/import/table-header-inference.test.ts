import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";

/**
 * A1 (checklist-15): w:tblHeader nas tabelas importadas.
 *
 * Na importação, a linha de cabeçalho é detectada por FORMAÇÃO
 * (maioria negrito/centralizada) ou ESTRUTURA (título de célula única +
 * 1ª linha multi-célula) quando a origem não declara w:tblHeader, e a
 * intenção é propagada ao exportador (tableHeader → w:tblHeader no DOCX).
 * Critério: 0 table-header-missing no DOCX regenerado e o TÍTULO nunca é
 * marcado como cabeçalho (regressão corrigida em 2026-08-15).
 */

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function cellXml(text: string, opts: { bold?: boolean; center?: boolean } = {}): string {
  const rPr = opts.bold ? "<w:rPr><w:b/></w:rPr>" : "";
  const jc = opts.center ? "<w:jc w:val=\"center\"/>" : "";
  return `<w:tc><w:p>${jc}<w:r>${rPr}<w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

function rowXml(cells: string[], opts: { header?: boolean } = {}): string {
  const trPr = opts.header ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
  return `<w:tr>${trPr}${cells.join("")}</w:tr>`;
}

function tableXml(rows: string[], columnCount = 3): string {
  const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="2000"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

async function makeDocx(tables: string[], paragraphs: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    ...paragraphs.map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`),
    ...tables,
    `<w:p><w:r><w:t>REFERENCIAS</w:t></w:r></w:p>`,
  ].join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}/>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function importAndExport(buffer: ArrayBuffer) {
  const imported = await importDocumentFile(
    new File([buffer], "tabela.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
  );
  const blob = await generateDocxBlob({ fields: imported.fields, editorText: imported.editorText, importedTables: imported.importedTables });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const tables = [...documentXml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  return { imported, documentXml, tables };
}

function headerRowsOf(tableXml: string): number[] {
  const rows = [...tableXml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
  return rows
    .map((r, i) => (/<w:tblHeader\b/i.test(r) ? i : -1))
    .filter((i) => i >= 0);
}

describe("A1 — w:tblHeader nas tabelas importadas", () => {
  it("título de célula única + 1ª linha multi-célula → header na 1ª linha multi-célula (estrutural)", async () => {
    const title = rowXml([cellXml("Cronograma de ações a serem desenvolvidas", { bold: true, center: true })]);
    const labels = rowXml([cellXml("Ação"), cellXml("Atividade"), cellXml("Responsável")]);
    const data = rowXml([cellXml("Divulgação"), cellXml("criar documentos"), cellXml("Equipe")]);
    const buffer = await makeDocx([tableXml([title, labels, data])], ["1 INTRODUCAO", "Texto."]);
    const { imported, tables } = await importAndExport(buffer);

    expect(imported.importedTables).toHaveLength(1);
    const tbl = tables[0];
    expect(headerRowsOf(tbl), "header deve ser a 2ª linha (rótulos), nunca o título").toEqual([1]);
  });

  it("cabeçalho em negrito na 1ª linha (maioria) → header na linha 0", async () => {
    const header = rowXml([cellXml("Instituição", { bold: true }), cellXml("Tipo de Documento", { bold: true }), cellXml("Data", { bold: true })]);
    const data1 = rowXml([cellXml("FURG"), cellXml("Resolução nº 005"), cellXml("2010")]);
    const data2 = rowXml([cellXml("USP"), cellXml("Portaria nº 1"), cellXml("2012")]);
    const buffer = await makeDocx([tableXml([header, data1, data2])], ["1 INTRODUCAO", "Texto."]);
    const { imported, tables } = await importAndExport(buffer);

    expect(imported.importedTables).toHaveLength(1);
    expect(imported.importedTables[0].headerRowIndex).toBe(0);
    expect(headerRowsOf(tables[0])).toEqual([0]);
  });

  it("cabeçalho centralizado na 1ª linha (maioria) → header na linha 0", async () => {
    const header = rowXml([cellXml("Categoria", { center: true }), cellXml("Questão", { center: true })]);
    const data1 = rowXml([cellXml("Metadados"), cellXml("Usa DublinCore?")]);
    const buffer = await makeDocx([tableXml([header, data1], 2)], ["1 INTRODUCAO", "Texto."]);
    const { tables } = await importAndExport(buffer);
    expect(headerRowsOf(tables[0])).toEqual([0]);
  });

  it("tabela de linha única não ganha w:tblHeader (sem cabeçalho repetível)", async () => {
    const single = rowXml([cellXml("A"), cellXml("B")]);
    const buffer = await makeDocx([tableXml([single], 2)], ["1 INTRODUCAO", "Texto."]);
    const { imported, tables } = await importAndExport(buffer);
    expect(imported.importedTables[0].headerRowIndex).toBeUndefined();
    expect(headerRowsOf(tables[0])).toEqual([]);
  });

  it("w:tblHeader declarado na ORIGEM é respeitado (não sobrescrito pela inferência)", async () => {
    const rows = [
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cellXml("Col A")}${cellXml("Col B")}</w:tr>`,
      rowXml([cellXml("1"), cellXml("2")]),
    ];
    const buffer = await makeDocx([tableXml(rows, 2)], ["1 INTRODUCAO", "Texto."]);
    const { imported, tables } = await importAndExport(buffer);
    expect(imported.importedTables[0].headerRowIndex).toBe(0);
    expect(headerRowsOf(tables[0])).toEqual([0]);
  });
});
