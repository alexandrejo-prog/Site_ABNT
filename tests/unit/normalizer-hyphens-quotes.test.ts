import { describe, it, expect } from "vitest";

function stripSoftHyphens(value: string): string {
  return value.replace(/[\u00AD\u200B]/g, "");
}

function normalizeQuotes(value: string): string {
  const map: Record<string, string> = {
    "\u201C": '"',
    "\u201D": '"',
    "\u2018": "'",
    "\u2019": "'",
    "\u00AB": '"',
    "\u00BB": '"',
  };
  return value.replace(/[\u201C\u201D\u2018\u2019\u00AB\u00BB]/g, (ch) => map[ch] ?? ch);
}

describe("normalizer: soft hyphens + smart quotes", () => {
  it("remove soft hyphen", () => {
    expect(stripSoftHyphens("co\u00ADopera\u00ADção")).toBe("coopera\u00e7\u00e3o");
  });

  it("remove zero-width space", () => {
    expect(stripSoftHyphens("palavra\u200Bseparada")).toBe("palavraseparada");
  });

  it("normaliza aspas duplas tipográficas para retas", () => {
    expect(normalizeQuotes('\u201Ctexto\u201D')).toBe('"texto"');
  });

  it("normaliza aspas simples tipográficas para retas", () => {
    expect(normalizeQuotes("\u2018exemplo\u2019")).toBe("'exemplo'");
  });

  it("mantém aspas retas existentes", () => {
    expect(normalizeQuotes('"texto"')).toBe('"texto"');
  });

  it("combina soft hyphen + smart quotes", () => {
    expect(normalizeQuotes(stripSoftHyphens("\u00ADex\u00ADemplo \u201Ct\u00ADexto\u201D"))).toBe("exemplo \"texto\"");
  });
});
