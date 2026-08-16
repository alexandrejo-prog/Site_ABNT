import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { Document, FootnoteReferenceRun, Packer, Paragraph, TextRun } from "docx";
import { importDocumentFile } from "../../src/import-docx";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts } from ".././test-utils/ooxml";

/**
 * Round-trip de notas de rodapé reais:
 *
 *   entrada (DOCX com word/footnotes.xml + chamadas w:footnoteReference)
 *   → importação (marcadores [^N] no editorText + definições [^N]: corpo)
 *   → geração (word/footnotes.xml com a nota real + chamadas no document.xml)
 *
 * A nota NÃO pode ser simulada como texto comum no fim da página: deve existir
 * como <w:footnote> em word/footnotes.xml e a chamada como
 * <w:footnoteReference> em word/document.xml (UFLA-FOOTER-001/002).
 */

function dissertacaoFields() {
  return {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    author: "MARIA SILVA",
    title: "Título da pesquisa",
    program: "Programa de Pós-Graduação",
    advisor: "Prof. Dr. João Santos",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo.",
    palavrasChave: "teste",
  };
}

function customFootnotes(footnotesXml: string): string[] {
  const regex = /<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g;
  const notes: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(footnotesXml)) !== null) {
    const attributes = match[1] ?? "";
    if (/w:type="(?:separator|continuationSeparator)"/.test(attributes)) continue;
    const texts = [...(match[2] ?? "").matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
    notes.push(texts.join(""));
  }
  return notes;
}

async function buildInputDocxWithFootnote(footnoteId: number, footnoteText: string, bodyText: string): Promise<File> {
  const doc = new Document({
    footnotes: {
      [footnoteId]: {
        children: [new Paragraph({ children: [new TextRun({ text: footnoteText })] })],
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: bodyText }), new FootnoteReferenceRun(footnoteId)],
          }),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return new File([new Uint8Array(buffer)], "com-nota.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

describe("round-trip: notas de rodapé reais (entrada → importação → geração)", () => {
  it("nota única: texto preservado em footnotes.xml e chamada no document.xml", async () => {
    const input = await buildInputDocxWithFootnote(1, "Nota de rodapé real da entrada.", "Texto com chamada de nota.");
    const imported = await importDocumentFile(input);

    expect(imported.footnotes["1"], "nota da entrada não extraída na importação").toContain("Nota de rodapé real da entrada");
    expect(imported.editorText).toContain("[^1]");
    expect(imported.editorText).toContain("[^1]: Nota de rodapé real da entrada.");

    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText: `# 1 INTRODUCAO\n${imported.editorText}`,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    const parts = await loadDocxParts(blob);

    const notes = customFootnotes(footnotesXml);
    expect(notes.some((note) => note.includes("Nota de rodapé real da entrada.")), "UFLA-FOOTER-001 não implementada: nota de rodapé da entrada não apareceu na saída.").toBe(true);
    expect(parts.documentXml).toMatch(/<w:footnoteReference w:id="1"/);
  });

  it("múltiplas notas com numeração única e consecutiva preservada na ordem das chamadas", async () => {
    const doc = new Document({
      footnotes: {
        1: { children: [new Paragraph({ children: [new TextRun({ text: "Primeira nota." })] })] },
        2: { children: [new Paragraph({ children: [new TextRun({ text: "Segunda nota." })] })] },
      },
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: "Corpo um." }), new FootnoteReferenceRun(1)] }),
            new Paragraph({ children: [new TextRun({ text: "Corpo dois." }), new FootnoteReferenceRun(2)] }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    const input = new File([new Uint8Array(buffer)], "duas-notas.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const imported = await importDocumentFile(input);

    expect(Object.keys(imported.footnotes).sort()).toEqual(["1", "2"]);
    expect(imported.editorText).toContain("[^1]: Primeira nota.");
    expect(imported.editorText).toContain("[^2]: Segunda nota.");
    expect(imported.editorText.indexOf("[^1]")).toBeLessThan(imported.editorText.indexOf("[^2]"));

    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText: `# 1 INTRODUCAO\n${imported.editorText}`,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    const parts = await loadDocxParts(blob);

    const notes = customFootnotes(footnotesXml);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("Primeira nota.");
    expect(notes[1]).toContain("Segunda nota.");
    expect((parts.documentXml.match(/<w:footnoteReference\b/g) ?? []).length).toBe(2);
  });

  it("nota com mais de uma linha preserva o texto completo", async () => {
    const doc = new Document({
      footnotes: {
        1: {
          children: [
            new Paragraph({ children: [new TextRun({ text: "Primeira linha da nota." })] }),
            new Paragraph({ children: [new TextRun({ text: "Segunda linha da nota." })] }),
          ],
        },
      },
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: "Corpo." }), new FootnoteReferenceRun(1)] }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    const input = new File([new Uint8Array(buffer)], "nota-multilinha.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const imported = await importDocumentFile(input);

    expect(imported.footnotes["1"]).toContain("Primeira linha da nota.");
    expect(imported.footnotes["1"]).toContain("Segunda linha da nota.");

    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText: `# 1 INTRODUCAO\n${imported.editorText}`,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    const notes = customFootnotes(footnotesXml);

    expect(notes.some((note) => note.includes("Primeira linha da nota.") && note.includes("Segunda linha da nota."))).toBe(true);
  });

  it("formatação da nota no DOCX gerado: 11 pt, espaço simples, Times New Roman, recuo da segunda linha", async () => {
    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText: "# 1 INTRODUCAO\nTexto com nota.[^1]\n\n[^1]: Nota formatada para o manual.\n",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";

    const noteParagraph = (footnotesXml.match(/<w:footnote\b(?![^>]*w:type="(?:separator|continuationSeparator)")[\s\S]*?<\/w:footnote>/) ?? [])[0];
    expect(noteParagraph, "nota real ausente em footnotes.xml").toBeDefined();
    expect(noteParagraph).toContain("Nota formatada para o manual.");
    expect(noteParagraph).toMatch(/w:sz w:val="22"/); // 11 pt
    expect(noteParagraph).toMatch(/w:spacing[^>]*w:line="240"/); // espaço simples
    expect(noteParagraph).toMatch(/Times New Roman/);
    expect(noteParagraph).toMatch(/w:ind[^>]*w:hanging="340"/); // segunda linha abaixo da primeira letra
  });

  it("nota órfã na entrada (sem chamada no corpo) ainda é preservada como definição", async () => {
    const doc = new Document({
      footnotes: {
        7: { children: [new Paragraph({ children: [new TextRun({ text: "Nota órfã preservada." })] })] },
      },
      sections: [{ children: [new Paragraph({ children: [new TextRun({ text: "Corpo sem nota." })] })] }],
    });
    const buffer = await Packer.toBuffer(doc);
    const input = new File([new Uint8Array(buffer)], "nota-orfa.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const imported = await importDocumentFile(input);

    expect(imported.footnotes["7"]).toContain("Nota órfã preservada.");

    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText: `# 1 INTRODUCAO\n${imported.editorText}`,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    expect(customFootnotes(footnotesXml).some((note) => note.includes("Nota órfã preservada."))).toBe(true);
  });
});
