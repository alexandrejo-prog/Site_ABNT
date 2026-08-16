import { describe, expect, it } from "vitest";
import { REVIEW_BLOCKS, blockForField, fieldsForBlock } from "../../src/review-workflow";

describe("blocos de revisao", () => {
  it("define blocos principais da interface", () => {
    const ids = REVIEW_BLOCKS.map((block) => block.id);
    expect(ids).toContain("metadata");
    expect(ids).toContain("pretextual");
    expect(ids).toContain("research");
    expect(ids).toContain("references");
    expect(ids).toContain("validation");
  });

  it("mapeia campos para blocos", () => {
    expect(blockForField("problemaPesquisa")).toBe("research");
    expect(blockForField("referencias")).toBe("references");
    expect(fieldsForBlock("metadata")).toContain("author");
  });
});
