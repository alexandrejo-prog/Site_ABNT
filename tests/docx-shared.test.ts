import { describe, expect, it } from "vitest";
import { BLACK, BODY_SIZE, ONE_AND_HALF_LINE, SINGLE_LINE, ibgeTable, pageMargins } from "../src/docx-shared";
import { UFLA_RULES } from "../src/ufla-rules";

function collectNonFiniteNumbers(value: unknown, path = "root", found: string[] = []): string[] {
  if (typeof value === "number" && !Number.isFinite(value)) {
    found.push(path);
    return found;
  }

  if (!value || typeof value !== "object") return found;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    collectNonFiniteNumbers(child, `${path}.${key}`, found);
  }

  return found;
}

describe("docx-shared", () => {
  it("expõe constantes UFLA compartilhadas", () => {
    expect(BLACK).toBe("000000");
    expect(BODY_SIZE).toBe(UFLA_RULES.typography.bodyFontSizePt * 2);
    expect(SINGLE_LINE).toBe(UFLA_RULES.spacing.singleLineTwip);
    expect(ONE_AND_HALF_LINE).toBe(UFLA_RULES.spacing.bodyLineTwip);
  });

  it("mantém margens UFLA esperadas", () => {
    expect(pageMargins()).toEqual({
      top: UFLA_RULES.margins.topTwip,
      left: UFLA_RULES.margins.leftTwip,
      bottom: UFLA_RULES.margins.bottomTwip,
      right: UFLA_RULES.margins.rightTwip,
      header: UFLA_RULES.header.distanceFromTopTwip,
      footer: UFLA_RULES.footer.distanceFromBottomTwip,
    });
  });

  it("gera tabela IBGE válida mesmo sem cabeçalhos explícitos", () => {
    const table = ibgeTable({ headerLabels: [], rows: [["A", "B"]] });

    expect(collectNonFiniteNumbers(table)).toHaveLength(0);
  });
});
