// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildRoundTripReport,
  coreEquivalenceCases,
  legacyRoundTrip,
  tiptapRoundTrip,
  DOCUMENTED_MARKUP_TRANSFORMATIONS,
} from "../src/editor-equivalence";

describe("TEC-01 — equivalência legacy vs Tiptap (round-trip)", () => {
  it("para o corpus essencial, os dois motores produzem exatamente o mesmo markup", () => {
    const report = buildRoundTripReport(coreEquivalenceCases());
    const divergent = report.filter((r) => !r.enginesEquivalent);
    expect(divergent).toEqual([]);
  });

  it("casos canônicos são idempotentes (markup -> html -> markup = markup)", () => {
    for (const input of [
      "Paragrafo simples e direto.",
      "# Titulo",
      "## Subtitulo",
      "### Sub-subtitulo",
      "> Citacao longa com leitura.",
      "**Negrito** e *italico* combinados.",
      "[REF] EMBRAPA. Manual. Lavras, 2020.",
    ]) {
      expect(legacyRoundTrip(input), `legacy: ${input}`).toBe(input);
      expect(tiptapRoundTrip(input), `tiptap: ${input}`).toBe(input);
    }
  });

  it("linhas em branco são compactadas de forma idêntica nos dois motores (transformação documentada)", () => {
    const input = "Primeiro paragrafo.\n\nSegundo paragrafo.";
    const expected = "Primeiro paragrafo.\nSegundo paragrafo.";
    expect(legacyRoundTrip(input)).toBe(expected);
    expect(tiptapRoundTrip(input)).toBe(expected);
  });

  it("'et al.' ganha itálico automático idêntico nos dois motores (transformação documentada)", () => {
    const input = "Paragrafo com citacao et al. no corpo.";
    expect(legacyRoundTrip(input)).toBe("Paragrafo com citacao *et al.* no corpo.");
    expect(tiptapRoundTrip(input)).toBe("Paragrafo com citacao *et al.* no corpo.");
  });

  it("documenta as transformações aceitas para rastreabilidade", () => {
    expect(DOCUMENTED_MARKUP_TRANSFORMATIONS.length).toBeGreaterThanOrEqual(2);
    for (const note of DOCUMENTED_MARKUP_TRANSFORMATIONS) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });
});