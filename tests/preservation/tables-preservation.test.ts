import { describe, it, expect } from "vitest";
import { baselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { loadDocxParts, normalizeOoxmlText } from ".././test-utils/ooxml";

/**
 * Round-trip vivo de tabelas. Falha se tabelas forem perdidas no caminho
 * import->export (contagem e conteudo de celulas).
 */
describe("acceptance: preservacao de tabelas (round-trip vivo)", () => {
  const norm = (t: string) => normalizeOoxmlText(t).replace(/\s+/g, " ").trim();

  it("nao perde tabelas (contagem preservada)", async () => {
    const rt = await baselineRoundTrip();
    expect(rt.input.importedTables.length).toBeGreaterThan(0);
    expect(rt.output.importedTables.length).toBeGreaterThanOrEqual(rt.input.importedTables.length);
  });

  it("preserva o conteudo de cada tabela (celulas)", async () => {
    const rt = await baselineRoundTrip();

    const outTexts = rt.output.importedTables.map((tb) =>
      norm(tb.rows.flat().map((c) => c.text).join(" ")),
    );

    const unmatched: string[] = [];
    for (const tb of rt.input.importedTables) {
      const inText = norm(tb.rows.flat().map((c) => c.text).join(" "));
      const prefix = inText.slice(0, 30);
      const matched = outTexts.some((o) => o.includes(prefix) || prefix.length > 0 && inText.includes(o.slice(0, 30)));
      if (!matched) unmatched.push(tb.caption ?? prefix);
    }

    expect(unmatched, `tabelas de entrada sem correspondencia na saida: ${unmatched.slice(0, 5).join(" | ")}`).toEqual([]);
  });

  it("emite tabelas OOXML (w:tbl) com bordas (tracos)", async () => {
    const rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);

    const tblCount = (parts.documentXml.match(/<w:tbl\b/g) ?? []).length;
    expect(tblCount).toBeGreaterThanOrEqual(rt.input.importedTables.length);
    expect(parts.documentXml).toMatch(/<w:tblBorders\b/);
  });
});

