import { describe, it, expect } from "vitest";
import { headingParagraphsAtLevel } from "../../src/docx-heading-semantics";
import { baselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { loadDocxParts, normalizedParagraphTexts, normalizeOoxmlText } from ".././test-utils/ooxml";

/**
 * Round-trip vivo de estrutura de cabecalhos. Falha se titulos primarios
 * (INTRODUCAO, REFERENCIAL TEORICO, METODOLOGIA, RESULTADOS, CONSIDERACOES,
 * REFERENCIAS) forem perdidos ou degradados no caminho import->export.
 */
describe("acceptance: reconstrucao de cabecalhos (round-trip vivo)", () => {
  const required = [
    "INTRODUCAO",
    "REFERENCIAL TEORICO",
    "METODOLOGIA",
    "RESULTADOS",
    "CONSIDERACOES FINAIS",
    "REFERENCIAS",
  ];

  it("preserva os titulos primarios no editorText reimportado", async () => {
    const rt = await baselineRoundTrip();
    const outUpper = normalizeOoxmlText(rt.output.editorText);

    const missing = required.filter((r) => !outUpper.includes(normalizeOoxmlText(r)));
    expect(missing, `titulos primarios ausentes no editorText reimportado: ${missing.join(", ")}`).toEqual([]);
  });

  it("emite titulos primarios como titulos semanticos (nível 1) no DOCX gerado", async () => {
    const rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);

    const headings = headingParagraphsAtLevel(parts.documentXml, parts.stylesXml, 1).map((p) => {
      const runs = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
      return normalizeOoxmlText(runs).replace(/^\d+\s*/, "").trim();
    });

    const missing = required.filter((r) => !headings.some((h) => h.includes(normalizeOoxmlText(r))));
    expect(missing, `titulos primarios sem titulo semantico no DOCX gerado: ${missing.join(", ")}`).toEqual([]);
  });

  it("produz sumario com campo TOC real no DOCX gerado", async () => {
    const rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);

    expect(normalizedParagraphTexts(parts.documentXml)).toContain("SUMARIO");
    const instr = parts.documentXml.match(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)?.join("") ?? "";
    expect(instr).toContain("TOC");
    expect(instr).toContain("1-3");
  });
});

