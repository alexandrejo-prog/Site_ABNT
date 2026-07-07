import { describe, expect, it } from "vitest";
import { findUflaPpgProgram, findUflaPpgPrograms, formatUflaPpgProgram, resolveUflaPpgProgram } from "../src/ufla-ppg-programs";

describe("ufla ppg programs", () => {
  it("reconhece programa do PPGECA", () => {
    const program = findUflaPpgProgram("Educação Científica e Ambiental");
    expect(program?.masters).toBe(true);
    expect(program?.doctorate).toBe(false);
  });

  it("formata nome curto", () => {
    expect(formatUflaPpgProgram("Educação Científica e Ambiental")).toBe("Programa de Pós-Graduação em Educação Científica e Ambiental");
  });

  it("retorna mais de uma correspondencia para programa duplicado", () => {
    const matches = findUflaPpgPrograms("Genética e Melhoramento de Plantas");
    expect(matches.length).toBeGreaterThan(1);
  });

  it("dissertacao com programa duplicado resolve para entrada academica", () => {
    const resolved = resolveUflaPpgProgram("Genética e Melhoramento de Plantas", { workType: "dissertacao" });
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.program?.type).toBe("academico");
  });

  it("tese com programa duplicado resolve para entrada com doutorado", () => {
    const resolved = resolveUflaPpgProgram("Genética e Melhoramento de Plantas", { workType: "tese" });
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.program?.doctorate).toBe(true);
  });

  it("prefere programa com doutorado para tese quando houver", () => {
    const resolved = resolveUflaPpgProgram("Educação", { workType: "tese" });
    expect(resolved.ambiguous).toBe(false);
    expect(resolved.program?.doctorate).toBe(true);
  });

  it("nao mascara ambiguidade quando nao ha contexto para decidir", () => {
    const resolved = resolveUflaPpgProgram("Genética e Melhoramento de Plantas");
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.program).toBeUndefined();
  });
});
