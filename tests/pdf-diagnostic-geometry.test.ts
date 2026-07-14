import { describe, expect, it } from "vitest";
import {
  buildPdfDiagnosticLines,
  dedupePdfTextItems,
  detectPdfBodyStart,
  normalizePdfTextItem,
} from "../src/import-pdf-diagnostic";
import type { PdfPageDiagnostic, PdfTextItemDiagnostic } from "../src/imported-pdf-diagnostic";

function item(text: string, x: number, y: number, width = 10, height = 10): PdfTextItemDiagnostic {
  return { text, x, y, width, height, transform: [1, 0, 0, 1, x, y] };
}

function page(lines: string[]): PdfPageDiagnostic {
  return {
    pageNumber: 1,
    width: 595,
    height: 842,
    rotation: 0,
    rawText: lines.join(" "),
    textItemCount: lines.length,
    items: [],
    lines: lines.map((text, index) => ({
      pageNumber: 1,
      text,
      items: [],
      left: 72,
      right: 220,
      top: 80 + index * 20,
      bottom: 92 + index * 20,
      height: 12,
    })),
  };
}

describe("diagnostico geometrico de PDF", () => {
  it("agrupa itens da mesma linha e mantem linhas diferentes separadas", () => {
    const lines = buildPdfDiagnosticLines([item("A", 10, 10), item("B", 24, 11), item("C", 10, 40)], 1);

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("A B");
    expect(lines[1].text).toBe("C");
  });

  it("ordena horizontalmente por X crescente", () => {
    const lines = buildPdfDiagnosticLines([item("B", 40, 10), item("A", 10, 10)], 1);

    expect(lines[0].text).toBe("A B");
  });

  it("ordena verticalmente do topo para a base", () => {
    const lines = buildPdfDiagnosticLines([item("Base", 10, 80), item("Topo", 10, 10)], 1);

    expect(lines.map((line) => line.text)).toEqual(["Topo", "Base"]);
  });

  it("usa tolerancia baseada na altura mediana", () => {
    const lines = buildPdfDiagnosticLines([
      item("A", 10, 10, 10, 10),
      item("B", 24, 14, 10, 10),
      item("C", 10, 20, 10, 100),
    ], 1);

    expect(lines.map((line) => line.text)).toEqual(["A B", "C"]);
  });

  it("remove fragmento duplicado e sobreposto, mas preserva texto igual em outra posicao", () => {
    const deduped = dedupePdfTextItems([
      item("2024", 10, 10, 20, 10),
      item("2024", 10.5, 10.2, 20, 10),
      item("2024", 90, 10, 20, 10),
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((entry) => entry.x)).toEqual([10, 90]);
  });

  it("nao insere espaco indevido antes de pontuacao", () => {
    const lines = buildPdfDiagnosticLines([item("Olá", 10, 10, 20), item(",", 34, 10, 3), item("mundo", 42, 10, 30)], 1);

    expect(lines[0].text).toBe("Olá, mundo");
  });

  it("usa o viewport para pagina rotacionada e mantem ordem visual", () => {
    const viewport = { width: 200, height: 200, rotation: 90, transform: [0, 1, 1, 0, 0, 0] };
    const top = normalizePdfTextItem({ str: "Topo", width: 20, height: 10, transform: [1, 0, 0, 1, 10, 10] }, viewport);
    const bottom = normalizePdfTextItem({ str: "Base", width: 20, height: 10, transform: [1, 0, 0, 1, 60, 10] }, viewport);

    expect(top).not.toBeNull();
    expect(bottom).not.toBeNull();
    const lines = buildPdfDiagnosticLines([bottom!, top!], 1);
    expect(lines.map((line) => line.text)).toEqual(["Topo", "Base"]);
  });

  it("trata coordenadas invalidas de forma controlada", () => {
    const normalized = normalizePdfTextItem({ str: "Texto", width: 10, height: 10, transform: [1, 0, 0, 1, Number.NaN, 20] }, {
      width: 200,
      height: 200,
      rotation: 0,
      transform: [1, 0, 0, 1, 0, 0],
    });

    expect(normalized).toBeNull();
  });

  it("detecta somente introducao real restritiva", () => {
    expect(detectPdfBodyStart([page(["1 INTRODUÇÃO"])]).found).toBe(true);
    expect(detectPdfBodyStart([page(["1. INTRODUCAO"])]).matchType).toBe("numbered-introduction");
    expect(detectPdfBodyStart([page(["INTRODUÇÃO"])]).matchType).toBe("unnumbered-introduction");
    expect(detectPdfBodyStart([page(["1 INTRODUÇÃO ........ 16"])]).found).toBe(false);
    expect(detectPdfBodyStart([page(["1 INTRODUÇÃO 16"])]).found).toBe(false);
    expect(detectPdfBodyStart([page(["RESUMO", "AGRADECIMENTOS"])]).found).toBe(false);
  });
});
