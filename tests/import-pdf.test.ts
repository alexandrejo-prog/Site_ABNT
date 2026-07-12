import { describe, expect, it } from "vitest";
import type { PdfTextItem } from "../src/imported-pdf";
import type { PdfTextLine } from "../src/import-pdf-text";
import {
  buildPageNormalizedText,
  classifyPdfLine,
  detectPdfBlockCandidates,
  groupPdfTextIntoLines,
  normalizePdfTextItems,
} from "../src/import-pdf-text";

function item(text: string, x: number, y: number, pageNumber = 1, width = text.length * 5): PdfTextItem {
  return { text, pageNumber, x, y, width, height: 10 };
}

describe("normalizePdfTextItems", () => {
  it("remove itens vazios e normaliza espacos", () => {
    const items = normalizePdfTextItems([
      item("  texto  ", 0, 10),
      item("   ", 0, 20),
      item("linha", 0, 30),
    ]);
    expect(items.map((i) => i.text)).toEqual(["texto", "linha"]);
  });
});

describe("groupPdfTextIntoLines", () => {
  it("ordena itens fora de ordem por linha (y) e dentro da linha por x", () => {
    const items = [
      item("exemplo", 60, 20),
      item("de", 40, 20),
      item("Texto", 10, 20),
      item("Primeira", 10, 10),
    ];
    const lines = groupPdfTextIntoLines(items);
    expect(lines.map((l) => l.text)).toEqual(["Primeira", "Texto de exemplo"]);
  });

  it("junta texto da mesma linha em um unico trecho", () => {
    const items = [item("um", 10, 10), item("dois", 40, 10), item("tres", 70, 10)];
    const lines = groupPdfTextIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("um dois tres");
  });

  it("separa linhas por salto vertical", () => {
    const items = [item("topo", 10, 10), item("base", 10, 80)];
    const lines = groupPdfTextIntoLines(items);
    expect(lines).toHaveLength(2);
  });
});

describe("buildPageNormalizedText", () => {
  it("junta linhas com quebra de linha", () => {
    const items = [item("linha um", 10, 10), item("linha dois", 10, 40)];
    expect(buildPageNormalizedText(items)).toBe("linha um\nlinha dois");
  });
});

describe("classifyPdfLine / detectPdfBlockCandidates", () => {
  function linesFromTexts(texts: string[]): PdfTextLine[] {
    return texts.map((text, i) => ({
      pageNumber: 1,
      y: (i + 1) * 20,
      x: 10,
      width: text.length * 5,
      height: 10,
      text,
      items: [],
    }));
  }

  it("Quadro 1 vira caption", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["Quadro 1 – Vantagens do teletrabalho."]));
    expect(block.kind).toBe("caption");
  });

  it("Tabela 2 vira caption", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["Tabela 2 – Resultados."]));
    expect(block.kind).toBe("caption");
  });

  it("Fonte: vira source", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["Fonte: Alves (2020, p. 60)."]));
    expect(block.kind).toBe("source");
  });

  it("INTRODUÇÃO em caixa alta vira heading", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["INTRODUÇÃO"]));
    expect(block.kind).toBe("heading");
  });

  it("RESULTADOS E DISCUSSÃO vira heading", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["RESULTADOS E DISCUSSÃO"]));
    expect(block.kind).toBe("heading");
  });

  it("linha com padrao tabular vira table-candidate", () => {
    const [block] = detectPdfBlockCandidates(
      linesFromTexts(["Nome    Idade    Cidade    João    20    SP"]),
    );
    expect(block.kind).toBe("table-candidate");
    expect(block.warnings?.length).toBeGreaterThan(0);
  });

  it("Figura vira image-candidate", () => {
    const [block] = detectPdfBlockCandidates(linesFromTexts(["Figura 3 – Fluxograma do processo."]));
    expect(block.kind).toBe("image-candidate");
  });

  it("texto comum permanece como text", () => {
    const [block] = detectPdfBlockCandidates(
      linesFromTexts(["Este parágrafo descreve a metodologia adotada na pesquisa."]),
    );
    expect(block.kind).toBe("text");
  });

  it("estrutura visual (table-candidate) sinaliza necessidade de revisao manual", () => {
    const lines = linesFromTexts([
      "Quadro 1 – Dados",
      "Categoria    Valor    Percentual",
      "A    10    20%",
      "B    30    60%",
      "Fonte: Autor (2025).",
    ]);
    const blocks = detectPdfBlockCandidates(lines);
    const visual = blocks.filter((b) => b.kind === "table-candidate" || b.kind === "image-candidate");
    expect(visual.length).toBeGreaterThan(0);
    expect(visual.every((b) => (b.warnings?.length ?? 0) > 0)).toBe(true);
  });

  it("classifyPdfLine reconhece tabular por presenca de colunas", () => {
    expect(classifyPdfLine("1.1    Fase A    Descrição")).toBe("table-candidate");
    expect(classifyPdfLine("Texto normal com palavras")).toBe("text");
  });
});
