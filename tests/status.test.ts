import { describe, expect, it } from "vitest";
import { COMPLETION_STATUS, allTechnicalWorkComplete } from "../src/completion-status";

describe("status", () => {
  it("tracks all items", () => {
    expect(COMPLETION_STATUS).toHaveLength(15);
  });

  it("is ready", () => {
    expect(allTechnicalWorkComplete()).toBe(true);
  });
});
