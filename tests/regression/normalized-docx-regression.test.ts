import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("regression: normalized docx", () => {
  it("normalized DOCX exists and is valid ZIP", () => {
    const path = new URL("../../artifacts/ufla-compliance/normalized-dissertacao.docx", import.meta.url);
    const buffer = readFileSync(path);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.slice(0, 2)).toEqual(Buffer.from([0x50, 0x4b]));
  });

  it("normalized DOCX has valid OOXML structure", () => {
    const path = new URL("../../artifacts/ufla-compliance/normalized-dissertacao.docx", import.meta.url);
    const buffer = readFileSync(path);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});