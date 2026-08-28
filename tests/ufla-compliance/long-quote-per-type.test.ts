/**
 * A4 (checklist-15): citação longa (4 cm / 11 pt / espaço simples) por tipo
 * no DOCX real.
 *
 * Critério de aceite: DOCX com citação direta longa → w:left=2268, sz=22,
 * w:line=240 na ocorrência; conteúdo sem citação direta → sem falso-positivo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { importDocumentFile } from "../../src/import-docx";
import { PER_TYPE_FIELDS, PER_TYPE_EDITOR_TEXT } from "../../scripts/ufla-compliance/per-type-fixtures";
import { generateDocxBlob } from "../../src/export-docx";
import { generateArticleDocxBlob } from "../../src/export-article-docx";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";
import { checkLongQuoteFormatting, countLongQuoteLines } from "../../scripts/ufla-compliance/long-quote-check";
import { runOoxmlChecks, loadDocxPartsFromFile } from "../../scripts/ufla-compliance/ooxml-checks";

const LONG_QUOTE_TEXT =
  "> Citação direta longa com mais de três linhas para verificar o recuo de quatro centímetros, fonte onze e espaço simples conforme o Manual UFLA e a NBR 10520 para trabalhos acadêmicos.";
const EDITOR_WITH_QUOTE = `${PER_TYPE_EDITOR_TEXT}\n${LONG_QUOTE_TEXT}\n`;

const MATRIX = [
  { formatId: "artigo", label: "Artigo academico", generate: (f: Parameters<typeof generateArticleDocxBlob>[0]) => generateArticleDocxBlob(f) },
  { formatId: "tcc", label: "Monografia/TCC", generate: (f: Parameters<typeof generateDocxBlob>[0]) => generateDocxBlob(f) },
  { formatId: "resumo_expandido_cpg", label: "Resumo expandido CPG", generate: (f: Parameters<typeof generateCpgDocxBlob>[0]) => generateCpgDocxBlob(f) },
  { formatId: "projeto_pesquisa", label: "Projeto de pesquisa", generate: (f: Parameters<typeof generateResearchProjectDocxBlob>[0]) => generateResearchProjectDocxBlob(f) },
] as const;

async function docxToTemp(blob: Blob, name: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ufla-a4-"));
  const path = join(dir, name);
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
  return path;
}

describe("A4 — citacao longa (4cm/11pt/simples) por tipo no DOCX real", () => {
  for (const spec of MATRIX) {
    describe(spec.label, () => {
      it("DOCX com citacao direta longa emite o trio 2268/22/240 na ocorrencia", async () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId] };
        const blob = await spec.generate({ fields, editorText: EDITOR_WITH_QUOTE });
        const path = await docxToTemp(blob, `${spec.formatId}.docx`);

        const check = await checkLongQuoteFormatting(path, 1);
        expect(check.passed, check.gap).toBe(true);
        expect(check.contentQuotes).toBeGreaterThanOrEqual(1);
        expect(check.formattedParas).toBeGreaterThanOrEqual(1);
        expect(check.malformed).toEqual([]);

        // Inspeção direta no OOXML: parágrafo ufla_citacao_longa com o trio.
        const zip = await JSZip.loadAsync(readFileSync(path));
        const xml = await zip.file("word/document.xml")!.async("string");
        const lqParas = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
          .map((m) => m[0])
          .filter((p) => p.includes("ufla_citacao_longa") || (p.includes('w:left="2268"') && p.includes('w:sz w:val="22"') && p.includes('w:line="240"')));
        expect(lqParas.length).toBeGreaterThanOrEqual(1);
        for (const p of lqParas) {
          expect(p).toContain('w:left="2268"');
          expect(p).toContain('w:sz w:val="22"');
          expect(p).toContain('w:line="240"');
        }
      });

      it("round-trip vivo: '> ' sobrevive a exportacao e a reimportacao", async () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId] };
        const blob = await spec.generate({ fields, editorText: EDITOR_WITH_QUOTE });
        const reimported = await importDocumentFile(
          new File([await blob.arrayBuffer()], `${spec.formatId}.docx`, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
        expect(countLongQuoteLines(reimported.editorText || "")).toBeGreaterThanOrEqual(1);
      });

      it("runOoxmlChecks sem falso-positivo: conteudo sem citacao direta passa com requireLongQuote=false", async () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId] };
        const blob = await spec.generate({ fields, editorText: PER_TYPE_EDITOR_TEXT });
        const path = await docxToTemp(blob, `${spec.formatId}-plain.docx`);
        const parts = await loadDocxPartsFromFile(path);
        const issues = runOoxmlChecks(parts, { requireLongQuote: false });
        expect(issues.filter((i) => i.code === "long-quote-recuo")).toEqual([]);
        expect(issues.filter((i) => i.code === "long-quote-format")).toEqual([]);
      });
    });
  }

  it("conteudo sem citacao direta nao gera falso-positivo no check por tipo", async () => {
    const blob = await generateDocxBlob({ fields: PER_TYPE_FIELDS.tcc, editorText: PER_TYPE_EDITOR_TEXT });
    const path = await docxToTemp(blob, "tcc-plain.docx");
    const check = await checkLongQuoteFormatting(path, 0);
    expect(check.passed, check.gap).toBe(true);
  });

  it("paragrafo de citacao longa fora do padrao e FLAGADO (recuo errado)", async () => {
    const blob = await generateDocxBlob({ fields: PER_TYPE_FIELDS.tcc, editorText: EDITOR_WITH_QUOTE });
    const path = await docxToTemp(blob, "tcc-malformed.docx");

    // Corrompe o recuo da citação longa (2268 → 1134 = 2 cm) e reembala.
    const zip = await JSZip.loadAsync(readFileSync(path));
    const xml = await zip.file("word/document.xml")!.async("string");
    const patched = xml.replace(
      /(<w:p\b[\s\S]*?ufla_citacao_longa[\s\S]*?)w:left="2268"/,
      '$1w:left="1134"',
    );
    expect(patched).not.toBe(xml);
    zip.file("word/document.xml", patched);
    writeFileSync(path, Buffer.from(await zip.generateAsync({ type: "nodebuffer" })));

    const check = await checkLongQuoteFormatting(path, 1);
    expect(check.passed).toBe(false);
    expect(check.malformed.length).toBeGreaterThanOrEqual(1);
  });
});
