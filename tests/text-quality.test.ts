import { describe, expect, it } from "vitest";
import { assessSummaryQuality } from "../src/summary-abstract-quality";

function text(count: number): string {
  return Array.from({ length: count }, (_, index) => `term${index + 1}`).join(" ");
}

describe("text quality", () => {
  it("accepts a complete item", () => {
    const quality = assessSummaryQuality(text(160), "one; two; three");
    expect(quality.readyForManualReview).toBe(true);
  });

  it("rejects an incomplete item", () => {
    const quality = assessSummaryQuality("short", "one");
    expect(quality.readyForManualReview).toBe(false);
  });
});
