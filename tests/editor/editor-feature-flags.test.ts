import { describe, expect, it, vi, afterEach } from "vitest";
import { isTiptapExperimentalEditor } from "../../src/editor-feature-flags";

describe("editor feature flags", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna false sem window", () => {
    vi.stubGlobal("window", undefined);
    expect(isTiptapExperimentalEditor()).toBe(false);
  });

  it("retorna true com editor=tiptap", () => {
    vi.stubGlobal("window", { location: { search: "?editor=tiptap" } });
    expect(isTiptapExperimentalEditor()).toBe(true);
  });

  it("retorna false com outro valor", () => {
    vi.stubGlobal("window", { location: { search: "?editor=legacy" } });
    expect(isTiptapExperimentalEditor()).toBe(false);
  });
});
