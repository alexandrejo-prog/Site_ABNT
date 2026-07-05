import { describe, expect, it } from "vitest";
import {
  extractAbbreviations,
  extractFiguresAndTables,
  hasConditionalPretextualList,
} from "../src/pretextual-lists";

describe("listas pre-textuais", () => {
  it("extrai figuras e tabelas por legenda", () => {
    const text = "Figura 1 - Logo da UFLA\nTabela 2 - Perfil dos participantes";
    const entries = extractFiguresAndTables(text);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ type: "figure", label: "Figura 1" });
    expect(entries[1]).toMatchObject({ type: "table", label: "Tabela 2" });
  });

  it("extrai siglas candidatas", () => {
    const entries = extractAbbreviations("UFLA PPGECA PGD TAES");
    const labels = entries.map((entry) => entry.label);

    expect(labels).toContain("UFLA");
    expect(labels).toContain("PGD");
  });

  it("detecta listas condicionais", () => {
    expect(hasConditionalPretextualList("Figura 1 - Logo", "figure")).toBe(true);
    expect(hasConditionalPretextualList("Texto sem legenda", "table")).toBe(false);
  });
});
