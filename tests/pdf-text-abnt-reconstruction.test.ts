import { describe, expect, it } from "vitest";
import { reconstructPdfParagraphBlocks } from "../src/pdf-text-reconstruction-diagnostic";
import type { PdfLineDiagnostic, PdfPageDiagnostic } from "../src/imported-pdf-diagnostic";

function line(text: string, index: number, options: Partial<PdfLineDiagnostic> & { fontName?: string; pageNumber?: number } = {}): PdfLineDiagnostic {
  const top = options.top ?? 80 + index * 18;
  const height = options.height ?? 12;
  const items = options.items ?? [{
    text,
    x: options.left ?? 72,
    y: top,
    width: Math.max(10, text.length * 5),
    height,
    fontName: options.fontName,
  }];
  const itemLeft = Math.min(...items.map((i) => i.x));
  const itemRight = Math.max(...items.map((i) => i.x + i.width));
  return {
    pageNumber: options.pageNumber ?? 1,
    text: options.text ?? (options.items ? text : items.map((i) => i.text).join(" ")),
    items,
    left: options.left ?? itemLeft,
    right: options.right ?? itemRight,
    top,
    bottom: top + height,
    height,
  };
}

function page(pageNumber: number, texts: string[], overrides: Record<number, Partial<PdfLineDiagnostic> & { fontName?: string }> = {}): PdfPageDiagnostic {
  const lines = texts.map((text, index) => line(text, index, { ...overrides[index], pageNumber }));
  return {
    pageNumber,
    width: 595,
    height: 842,
    rotation: 0,
    rawText: texts.join(" "),
    textItemCount: texts.length,
    items: [],
    lines,
  };
}

function paragraphTexts(result: ReturnType<typeof reconstructPdfParagraphBlocks>): string[] {
  return result.blocks.filter((block) => block.type === "paragraph").map((block) => block.text);
}

describe("reconstrucao de anomalias na fronteira real entre linhas", () => {
  it("corrige quali- + quantitativa na fronteira real entre duas linhas", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A pesquisa é de natureza quali-",
        "quantitativa, com aplicação de questionário.",
      ]),
    ]);
    const texts = paragraphTexts(result);
    expect(texts.some((text) => text.includes("quali-quantitativa"))).toBe(true);
    expect(texts.join(" ")).toContain("A pesquisa é de natureza quali-quantitativa, com aplicação de questionário.");
  });

  it("corrige servidor- + pesquisador quando a fronteira é evidenciada", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "O servidor-",
        "pesquisador atua na pesquisa pública.",
      ]),
    ]);
    expect(paragraphTexts(result).join(" ")).toContain("servidor-pesquisador");
  });

  it("corrige quando a segunda linha contém outras palavras", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A pesquisa é de natureza quali-",
        "quantitativa, com aplicação de questionário em campo.",
      ]),
    ]);
    expect(paragraphTexts(result).join(" ")).toBe(
      "A pesquisa é de natureza quali-quantitativa, com aplicação de questionário em campo.",
    );
  });

  it("nao altera texto correto (interdisciplinar, socioeconômico)", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A abordagem interdisciplinar e socioeconômica sustenta o estudo realizado.",
      ]),
    ]);
    const text = paragraphTexts(result).join(" ");
    expect(text).toContain("interdisciplinar");
    expect(text).toContain("socioeconômica");
    expect(text).not.toContain("inter-disciplinar");
  });

  it("reduz COVID-19-19 reconstruído no corpo", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A pandemia de COVID-19-19 mudou o trabalho público federal.",
      ]),
    ]);
    expect(paragraphTexts(result).join(" ")).toContain("COVID-19");
    expect(paragraphTexts(result).join(" ")).not.toContain("COVID-19-19");
  });

  it("preserva a fronteira quando a junção atravessa páginas", () => {
    const result = reconstructPdfParagraphBlocks([
      page(1, ["1 INTRODUÇÃO", "A pesquisa é de natureza quali-"], { 1: { top: 120, height: 12 } }),
      page(2, ["quantitativa, com aplicação de questionário."], { 0: { top: 760, height: 12 } }),
    ]);
    const texts = paragraphTexts(result);
    expect(texts.length).toBe(2);
    expect(texts.join(" ")).not.toContain("quali-quantitativa");
  });

  it("nao inventa separação lexical quando servidorpesquisador chega fundido em linha única", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "O servidorpesquisador atua na pesquisa pública federal.",
      ]),
    ]);
    const text = paragraphTexts(result).join(" ");
    expect(text).toContain("servidorpesquisador");
    expect(text).not.toContain("servidor-pesquisador");
  });

  it("e idempotente para a mesma entrada de PDF", () => {
    const input = [
      page(17, [
        "1 INTRODUÇÃO",
        "A pesquisa é de natureza quali-",
        "quantitativa, com aplicação de questionário.",
      ]),
    ];
    const first = reconstructPdfParagraphBlocks(input);
    const second = reconstructPdfParagraphBlocks(input);
    expect(first.blocks.map((b) => b.text)).toEqual(second.blocks.map((b) => b.text));
  });
});
