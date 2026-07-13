import { describe, expect, it } from "vitest";
import { deduplicateNatureLines, detectPdfPretextual } from "../src/pdf-pretextual-diagnostic";
import type { PdfLineDiagnostic, PdfPageDiagnostic } from "../src/imported-pdf-diagnostic";

function visualLine(text: string, pageNumber: number, index: number, centered = true): PdfLineDiagnostic {
  const top = 70 + index * 72;
  const left = centered ? 95 : 250;
  const right = centered ? 500 : 555;
  return {
    pageNumber,
    text,
    items: [{ text, x: left, y: top, width: right - left, height: 12 }],
    left,
    right,
    top,
    bottom: top + 12,
    height: 12,
  };
}

function page(pageNumber: number, texts: Array<string | { text: string; centered?: boolean }>): PdfPageDiagnostic {
  const lines = texts.map((entry, index) => {
    const value = typeof entry === "string" ? entry : entry.text;
    const centered = typeof entry === "string" ? true : entry.centered !== false;
    return visualLine(value, pageNumber, index, centered);
  });
  return {
    pageNumber,
    width: 595,
    height: 842,
    rotation: 0,
    rawText: lines.map((line) => line.text).join(" "),
    textItemCount: lines.length,
    items: lines.flatMap((line) => line.items),
    lines,
  };
}

describe("regressoes dos pre-textuais reconstruidos do PDF", () => {
  it("nao confunde titulo em caixa alta com nome de autor", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "MARIANA RAQUEL DE OLIVEIRA ANDRADE",
        "POLÍTICAS PÚBLICAS NO BRASIL",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        "MARIANA RAQUEL DE OLIVEIRA ANDRADE",
        "POLÍTICAS PÚBLICAS NO BRASIL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências para obtenção do título de Mestre.",
        "Orientador: Prof. Dr. João da Silva",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.author).toBe("MARIANA RAQUEL DE OLIVEIRA ANDRADE");
    expect(result.cover?.title).toContain("POLÍTICAS PÚBLICAS NO BRASIL");
    expect(result.cover?.author).not.toBe("POLÍTICAS PÚBLICAS NO BRASIL");
  });

  it("nao confunde TELETRABALHO ou TRABALHO no titulo com natureza", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "MARIANA RAQUEL DE OLIVEIRA ANDRADE",
        "O TRABALHO REMOTO NAS UNIVERSIDADES",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        "MARIANA RAQUEL DE OLIVEIRA ANDRADE",
        "TELETRABALHO E GESTÃO PÚBLICA",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Administração Pública, para obtenção do título de Mestre.",
        "Orientador: Prof. Dr. João da Silva",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.titlePage?.title).toContain("TELETRABALHO E GESTÃO PÚBLICA");
    expect(result.titlePage?.natureText).toMatch(/^Dissertação apresentada/u);
    expect(result.titlePage?.natureText).not.toMatch(/^TELETRABALHO/u);
  });

  it("folha de rosto com natureza centralizada nao vira capa", () => {
    const result = detectPdfPretextual([
      page(1, [
        "MARIANA RAQUEL DE OLIVEIRA ANDRADE",
        "GESTÃO E DESEMPENHO ORGANIZACIONAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências para obtenção do título de Mestre.",
        "Programa de Pós-Graduação em Administração Pública",
        "Orientador: Prof. Dr. João da Silva",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 2);

    expect(result.cover).toBeUndefined();
    expect(result.titlePage?.sourceLines[0]?.pageNumber).toBe(1);
    expect(result.titlePage?.natureText).toContain("Dissertação apresentada");
  });

  it("extrai orientador com nome antes da etiqueta", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Lavras - MG",
        "2025",
      ]),
      page(2, [
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Administração Pública, para a obtenção do título de Mestre.",
        "Prof. Dr. Dany Flavio Tonelli",
        "Orientador:",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.titlePage?.advisor).toBe("Orientador: Prof. Dr. Dany Flavio Tonelli");
    expect(result.titlePage?.natureText).not.toContain("Dany Flavio Tonelli");
    expect(result.titlePage?.city).toBe("LAVRAS-MG");
    expect(result.titlePage?.year).toBe("2025");
  });

  it("extrai orientador com nome depois da etiqueta", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Lavras - MG",
        "2025",
      ]),
      page(2, [
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências para obtenção do título de Mestre.",
        "Orientador:",
        "Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.titlePage?.advisor).toBe("Orientador: Prof. Dr. Dany Flavio Tonelli");
    expect(result.titlePage?.natureText).not.toContain("Dany Flavio Tonelli");
    expect(result.titlePage?.city).toBe("LAVRAS-MG");
  });

  it("etiqueta Orientador: sem nome ao lado nao consome cidade ou ano", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Lavras - MG",
        "2025",
      ]),
      page(2, [
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências para obtenção do título de Mestre.",
        "Orientador:",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.titlePage?.advisor).toBe("Orientador:");
    expect(result.titlePage?.city).toBe("LAVRAS-MG");
    expect(result.titlePage?.year).toBe("2025");
  });

  it("natureText nao contem nome do orientador", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Lavras - MG",
        "2025",
      ]),
      page(2, [
        "Alexandre Andrade",
        "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Administração Pública, para a obtenção do título de Mestre.",
        "Orientador:",
        "Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.titlePage?.natureText).toMatch(/para a obtenção do título de Mestre\.?$/);
    expect(result.titlePage?.natureText).not.toContain("Flavio Tonelli");
  });

  it("remove repeticao parcial da natureza sem apagar informacao legitima", () => {
    const text = deduplicateNatureLines([
      "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Administração Pública, área de concentração em Gestão Pública, para obtenção do título de Mestre.",
      "do Programa de Pós-Graduação em Administração Pública, área de concentração em Gestão Pública",
    ]);

    expect((text.match(/Programa de Pós-Graduação em Administração Pública/g) ?? [])).toHaveLength(1);
    expect(text).toContain("para obtenção do título de Mestre");
  });
});
