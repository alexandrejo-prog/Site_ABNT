import { describe, it, expect } from "vitest";
import { normalizeReference, normalizeReferencesText } from "../../src/references-normalizer";
import { validateReferencesText } from "../../src/references-validator";
import { validateWork } from "../../src/validators";
import { generateDocxBlob } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";

/**
 * Referências online (NBR 6023 + Manual UFLA): URL, DOI, "Disponível em",
 * "Acesso em", URL quebrada em continuação de linha, referência sem data de
 * acesso, markdown e hiperlink OOXML. Tudo decisão automática (sem revisão
 * manual); falha se qualquer parte for perdida.
 */

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

describe("referencias online: normalizacao e validacao (automatica)", () => {
  it("reconstroi URL quebrada em continuacao de linha (sem espaco artificial)", () => {
    const items = normalizeReferencesText(
      "SILVA, M. Acesso aberto em repositorios. 2024. Disponível em: https://exemplo.test/\nartigo.pdf. Acesso em: 10 jan. 2026.",
    );
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain("https://exemplo.test/artigo.pdf");
    expect(items[0].text).toContain("Acesso em: 10 jan. 2026.");
  });

  it("reconstroi esquema quebrado http:/ + continuacao", () => {
    const items = normalizeReferencesText(
      "SILVA, M. Pagina institucional. 2024. Disponível em: http:/exemplo.test/\npagina. Acesso em: 10 jan. 2026.",
    );
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain("http:/exemplo.test/pagina");
  });

  it("remove quebra artificial com espaco antes do fechamento da URL", () => {
    const item = normalizeReference(
      "SILVA, M. Relatorio. 2024. Disponível em: <https://exemplo.test/arquivo.pdf >. Acesso em: 10 jan. 2026.",
    );
    expect(item.text).toContain("https://exemplo.test/arquivo.pdf");
    expect(item.text).not.toContain("pdf >");
  });

  it("preserva DOI limpo e DOI via doi.org", () => {
    const a = normalizeReference("SILVA, M. Artigo. Revista Aberta, Lavras, v. 1, n. 2, p. 1-9, 2024. DOI: 10.1234/exemplo.");
    expect(a.text).toContain("DOI: 10.1234/exemplo");
    const b = normalizeReference(
      "SILVA, M. Artigo. Revista Aberta, Lavras, v. 1, n. 2, p. 1-9, 2024. DOI: https://doi.org/10.1234/exemplo.",
    );
    expect(b.text).toContain("DOI: 10.1234/exemplo");
    expect(b.text).not.toContain("doi.org");
  });

  it("normaliza URL em markdown para 'Disponível em'", () => {
    const item = normalizeReference(
      "SILVA, M. Pagina institucional. Lavras: UFLA, 2024. [https://ufla.br/pagina](https://ufla.br/pagina). Acesso em: 10 jan. 2026.",
    );
    expect(item.text).toContain("Disponível em: https://ufla.br/pagina");
  });

  it("referencia online sem data de acesso gera decisao automatica reference-access-missing", () => {
    const issues = validateReferencesText(
      "SILVA, M. Acesso aberto. 2024. Disponível em: https://exemplo.test/artigo.pdf.",
    );
    expect(issues.some((i) => i.code === "reference-access-missing")).toBe(true);
  });

  it("referencia online sem 'Acesso em:' BLOQUEIA (severity error) no validateWork", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      title: "Título",
      author: "Maria Silva",
      resumo: "Resumo com conteúdo suficiente para a validação do trabalho acadêmico.",
      referencias: "SILVA, M. Acesso aberto. 2024. Disponível em: https://exemplo.test/artigo.pdf.",
    };
    const issues = validateWork(fields, "# 1 Introdução\nTexto.");
    const access = issues.find((i) => i.code === "reference-access-missing");
    expect(access).toBeDefined();
    expect(access!.severity).toBe("error");
    expect(access!.message).toMatch(/bloqueia/);
  });

  it("referencia online com 'Acesso em' nao gera falso positivo", () => {
    const issues = validateReferencesText(
      "SILVA, M. Acesso aberto. 2024. Disponível em: https://exemplo.test/artigo.pdf. Acesso em: 10 jan. 2026.",
    );
    expect(issues.some((i) => i.code === "reference-access-missing")).toBe(false);
  });
});

describe("referencias online: round-trip vivo (exportacao -> reimportacao)", () => {
  it("URL com quebra de linha sobrevive exportacao e reimportacao intacta", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo" as const,
      author: "SILVA, M.",
      title: "Acesso aberto",
      resumo: "Resumo.",
      palavrasChave: "acesso; aberto",
      referencias:
        "SILVA, M. Política de acesso aberto à produção científica. 2024. Disponível em: https://exemplo.test/\nartigo.pdf. Acesso em: 10 jan. 2026.",
    };

    const blob = await generateDocxBlob({ fields, editorText: "" });
    const reimported = await importDocumentFile(
      new File([await blob.arrayBuffer()], "online.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    const text = norm(reimported.fields.referencias ?? "");
    expect(text).toContain("https://exemplo.test/artigo.pdf");
    expect(text).toContain("Acesso em: 10 jan. 2026.");
    expect(text).toContain("Política de acesso aberto à produção científica");
  });

  it("texto de hiperlink OOXML (URL como texto visivel) e preservado como referência online", async () => {
    const { Document, Packer, Paragraph, TextRun, ExternalHyperlink } = await import("docx");

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "REFERENCIAS" }),
              ],
            }),
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  link: "https://exemplo.test/artigo",
                  children: [new TextRun({ text: "SILVA, M. Acesso aberto. 2024. https://exemplo.test/artigo. Acesso em: 10 jan. 2026." })],
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const imported = await importDocumentFile(
      new File([arrayBuffer], "hyperlink.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    const refs = normalizeReferencesText(imported.fields.referencias ?? "").map((r) => r.text);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.some((r) => r.includes("https://exemplo.test/artigo"))).toBe(true);
    expect(refs.some((r) => r.includes("Acesso em: 10 jan. 2026."))).toBe(true);
  });
});
