import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tokens de identidade visual UFLA", () => {
  const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

  it("define cores institucionais UFLA no :root", () => {
    expect(css).toContain("--ufla-blue: #004B80");
    expect(css).toContain("--ufla-green: #00943E");
    expect(css).toContain("--ufla-white: #FFFFFF");
  });

  it("define cores de apoio UFLA no :root", () => {
    expect(css).toContain("--ufla-gray-light: #97B1BF");
    expect(css).toContain("--ufla-blue-light: #0087C0");
    expect(css).toContain("--ufla-green-light: #A8CF45");
    expect(css).toContain("--ufla-gray-dark: #5C6C75");
    expect(css).toContain("--ufla-blue-dark: #064B76");
    expect(css).toContain("--ufla-green-dark: #006B3E");
  });

  it("define família tipográfica institucional com Segoe UI", () => {
    expect(css).toContain("--ufla-interface-font:");
    expect(css).toContain("Segoe UI");
  });
});
