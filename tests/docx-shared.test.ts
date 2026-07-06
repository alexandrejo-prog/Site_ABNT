import { describe, expect, it } from "vitest";
import { BLACK, BODY_SIZE, ONE_AND_HALF_LINE, SINGLE_LINE, pageMargins } from "../src/docx-shared";
import { UFLA_RULES } from "../src/ufla-rules";

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
});
