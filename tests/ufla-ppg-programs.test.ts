import { describe, expect, it } from "vitest";
import { findUflaPpgProgram, formatUflaPpgProgram } from "../src/ufla-ppg-programs";

describe("ufla ppg programs", () => {
  it("reconhece programa do PPGECA", () => {
    const program = findUflaPpgProgram("Educação Científica e Ambiental");
    expect(program?.masters).toBe(true);
    expect(program?.doctorate).toBe(false);
  });

  it("formata nome curto", () => {
    expect(formatUflaPpgProgram("Educação Científica e Ambiental")).toBe("Programa de Pós-Graduação em Educação Científica e Ambiental");
  });
});
