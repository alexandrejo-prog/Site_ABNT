import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields, type WorkType } from "../../src/ufla-rules";
import { loadDocxParts } from "../test-utils/ooxml";

/**
 * Matriz de aplicabilidade do rodapé POR TIPO DE TRABALHO (não uma decisão
 * única para todos os formatos): monografia, dissertação, tese, artigo e
 * projeto de pesquisa. Verifica no DOCX gerado vivo:
 *   - rodapé de página NÃO é inserido quando não aplicável (paginação no
 *     cabeçalho, canto superior direito — UFLA-FOOTER-005);
 *   - margem inferior de 2 cm (1134 twips) delimita a área do rodapé
 *     (UFLA-FOOTER-008);
 *   - fonte de figura 'Fonte:' gerada com Times New Roman 11 pt, espaço
 *     simples, abaixo do elemento (UFLA-FOOTER-007);
 *   - notas (NBR 10520/2023) não são fabricadas (caso condicional não
 *     implementado, ausência verificada — UFLA-FOOTER-001/002).
 */

const ALL_TYPES: WorkType[] = ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"];

function fieldsFor(workType: WorkType) {
  const base = {
    ...emptyAcademicFields(),
    workType,
    author: "MARIA SILVA",
    title: "Título da pesquisa",
    resumo: "Resumo.",
    palavrasChave: "teste",
    year: "2026",
  };
  if (workType === "artigo") {
    return { ...base, referencias: "SILVA, M. Título. Revista, 2024." };
  }
  return {
    ...base,
    program: "Programa de Pós-Graduação",
    advisor: "Prof. Dr. João Santos",
    location: "Lavras - MG",
  };
}

interface PerTypeInspection {
  footerParts: number;
  hasFooterReference: boolean;
  hasHeaderReference: boolean;
  headerHasPage: boolean;
  headerRightAligned: boolean;
  bottomMarginTwip: number | null;
  hasFootnoteReference: boolean;
}

describe("acceptance: rodapé por tipo de trabalho (matriz de aplicabilidade)", () => {
  const inspection = new Map<WorkType, PerTypeInspection>();

  beforeAll(async () => {
    for (const workType of ALL_TYPES) {
      const blob = await generateDocxBlob({ fields: fieldsFor(workType), editorText: "" });
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const parts = await loadDocxParts(blob);

      const footerParts = Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml/.test(name)).length;
      const headerNames = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml/.test(name));
      const headerXmls = await Promise.all(headerNames.map((name) => zip.file(name)!.async("string")));
      const headerXml = headerXmls.join("");

      const bottomMatch = parts.documentXml.match(/w:pgMar[^>]*w:bottom="(\d+)"/);

      inspection.set(workType, {
        footerParts,
        hasFooterReference: /<w:footerReference/.test(parts.documentXml),
        hasHeaderReference: /<w:headerReference/.test(parts.documentXml),
        headerHasPage: headerXml.includes("PAGE"),
        headerRightAligned: /<w:jc w:val="right"\s*\/?>/.test(headerXml),
        bottomMarginTwip: bottomMatch ? parseInt(bottomMatch[1], 10) : null,
        hasFootnoteReference: /<w:footnoteReference/.test(parts.documentXml),
      });
    }
  });

  it.each(ALL_TYPES)("rodapé de página não inserido indevidamente (%s — ausência quando não aplicável)", (workType) => {
    const result = inspection.get(workType)!;
    expect(result.footerParts, `${workType}: parte footer*.xml presente`).toBe(0);
    expect(result.hasFooterReference, `${workType}: w:footerReference presente no document.xml`).toBe(false);
  });

  it.each(ALL_TYPES)("paginação no cabeçalho (canto superior direito), nunca no rodapé (%s)", (workType) => {
    const result = inspection.get(workType)!;
    expect(result.hasHeaderReference, `${workType}: cabeçalho ausente`).toBe(true);
    expect(result.headerHasPage, `${workType}: campo PAGE ausente no cabeçalho`).toBe(true);
    expect(result.headerRightAligned, `${workType}: número não alinhado à direita`).toBe(true);
  });

  it.each(ALL_TYPES)("margem inferior de 2 cm (1134 twips) delimita a área do rodapé (%s)", (workType) => {
    const result = inspection.get(workType)!;
    expect(result.bottomMarginTwip).toBe(1134);
  });

  it("fonte de figura 'Fonte:' com Times New Roman 11 pt, espaço simples e abaixo do elemento (UFLA-FOOTER-007)", async () => {
    const blob = await generateDocxBlob({
      fields: fieldsFor("dissertacao"),
      editorText: "# 1 INTRODUCAO\nFigura 1 - Grafico da pesquisa.\nFonte: elaborado pelo autor.\n",
    });
    const parts = await loadDocxParts(blob);

    const paragraphs = (parts.documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).filter((p) =>
      /Fonte: elaborado pelo autor\./.test(p),
    );

    expect(paragraphs, "nenhum parágrafo 'Fonte:' gerado (fonte é elemento obrigatório)").toHaveLength(1);
    const fonte = paragraphs[0];
    expect(fonte, "fonte com tamanho diferente de 11 pt (w:sz 22)").toMatch(/w:sz w:val="22"/);
    expect(fonte, "fonte com espaçamento diferente de espaço simples (w:line 240)").toMatch(/w:spacing[^>]*w:line="240"/);
    expect(fonte, "fonte sem Times New Roman").toMatch(/Times New Roman/);
  });

  it("notas (NBR 10520/2023) não são fabricadas quando o texto não as utiliza (UFLA-FOOTER-001/002)", async () => {
    const blob = await generateDocxBlob({
      fields: fieldsFor("dissertacao"),
      editorText: "# 1 INTRODUCAO\nTexto sem nota.\n",
    });
    const parts = await loadDocxParts(blob);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(parts.documentXml).not.toMatch(/<w:footnoteReference/);
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    const customNotes = (footnotesXml.match(/<w:footnote\b(?![^>]*w:type="(?:separator|continuationSeparator)")/g) ?? []).length;
    expect(customNotes, "nota de rodapé real gerada sem chamada no texto").toBe(0);
  });

  it("notas reais: chamada no corpo (document.xml) e conteúdo em footnotes.xml, 11 pt/simples/Times", async () => {
    const blob = await generateDocxBlob({
      fields: fieldsFor("dissertacao"),
      editorText: "# 1 INTRODUCAO\nTexto com nota.[^1]\n\n[^1]: Nota do Manual UFLA, §4.6 — NBR 10520/2023.\n",
    });
    const parts = await loadDocxParts(blob);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";

    // Chamada real (w:footnoteReference) no document.xml, não texto comum no fim da página.
    expect(parts.documentXml).toMatch(/<w:footnoteReference w:id="1"/);
    expect(parts.documentXml).not.toContain("[^1]");

    // Nota real em word/footnotes.xml (não é um separador padrão).
    const note = (footnotesXml.match(/<w:footnote\b(?![^>]*w:type="(?:separator|continuationSeparator)")[\s\S]*?<\/w:footnote>/) ?? [])[0];
    expect(note, "UFLA-FOOTER-001 não implementada: nota de rodapé da entrada não apareceu na saída.").toBeDefined();
    expect(note).toContain("Nota do Manual UFLA");
    expect(note).toMatch(/w:sz w:val="22"/); // 11 pt
    expect(note).toMatch(/w:spacing[^>]*w:line="240"/); // espaço simples
    expect(note).toMatch(/Times New Roman/);
    expect(note).toMatch(/w:ind[^>]*w:hanging="340"/); // segunda linha abaixo da primeira letra
  });
});
