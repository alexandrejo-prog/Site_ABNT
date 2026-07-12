import { describe, expect, it } from "vitest";
import type { ImportedPdfDocument, PdfTextItem } from "../src/imported-pdf";
import type { PdfTextLine } from "../src/import-pdf-text";
import {
  buildPageNormalizedText,
  classifyPdfLine,
  detectPdfBlockCandidates,
  groupPdfTextIntoLines,
  normalizePdfTextItems,
} from "../src/import-pdf-text";
import { detectPdfVisualRegionCandidates } from "../src/pdf-region-renderer";

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
  it("ordena itens de cima para baixo (Y decrescente) e dentro da linha por x", () => {
    const items = [
      item("exemplo", 60, 20),
      item("de", 40, 20),
      item("Texto", 10, 20),
      item("Primeira", 10, 10),
    ];
    const lines = groupPdfTextIntoLines(items);
    // y=20 é o topo (maior Y no espaço PDF), y=10 é a base.
    expect(lines.map((l) => l.text)).toEqual(["Texto de exemplo", "Primeira"]);
  });

  it("não duplica fragmentos de texto sobrepostos idênticos", () => {
    const items = [
      item("Texto repetido", 10, 50),
      item("Texto repetido", 10, 50),
      item("Outro", 40, 50),
    ];
    const lines = groupPdfTextIntoLines(items);
    expect(lines.map((l) => l.text)).toEqual(["Texto repetido Outro"]);
  });

  it("junta texto da mesma linha em um unico trecho", () => {
    const items = [item("um", 10, 10), item("dois", 40, 10), item("tres", 70, 10)];
    const lines = groupPdfTextIntoLines(items);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("um dois tres");
  });

  it("ordena itens da mesma linha por x crescente", () => {
    const items = [item("dir", 80, 100), item("esq", 10, 100), item("meio", 45, 100)];
    const lines = groupPdfTextIntoLines(items);
    expect(lines[0].text).toBe("esq meio dir");
  });

  it("capa simples com autor/título/local/ano não sai invertida", () => {
    const items = [
      item("AUTOR EXEMPLO", 10, 800),
      item("TÍTULO DO TRABALHO", 10, 650),
      item("Lavras - MG", 10, 500),
      item("2026", 10, 400),
    ];
    const lines = groupPdfTextIntoLines(items);
    expect(lines.map((l) => l.text)).toEqual([
      "AUTOR EXEMPLO",
      "TÍTULO DO TRABALHO",
      "Lavras - MG",
      "2026",
    ]);
  });

  it("separa linhas por salto vertical", () => {
    const items = [item("topo", 10, 10), item("base", 10, 80)];
    const lines = groupPdfTextIntoLines(items);
    expect(lines).toHaveLength(2);
  });
});

describe("buildPageNormalizedText", () => {
  it("junta linhas com quebra de linha (topo primeiro)", () => {
    const items = [item("linha um", 10, 10), item("linha dois", 10, 40)];
    // y=40 é o topo no espaço PDF; a ordenação é de cima para baixo.
    expect(buildPageNormalizedText(items)).toBe("linha dois\nlinha um");
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

describe("pipeline de regiões visuais (funções puras)", () => {
  function documentFromTexts(texts: string[]): ImportedPdfDocument {
    const lines = texts.map((text, i) => ({
      pageNumber: 1,
      y: (texts.length - i) * 20,
      x: 10,
      width: text.length * 5,
      height: 10,
      text,
      items: [],
    }));
    const blocks = detectPdfBlockCandidates(lines);
    return {
      source: { fileName: "exemplo.pdf", pageCount: 1 },
      pages: [{ pageNumber: 1, width: 800, height: 1000, items: [], normalizedText: texts.join("\n") }],
      blocks,
      diagnostics: [],
      quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
    };
  }

  it("gera região visual a partir de legenda + fonte detectadas", () => {
    const document = documentFromTexts([
      "Quadro 1 – Dados de pesquisa.",
      "Categoria    Valor    Percentual",
      "A    10    20%",
      "B    30    60%",
      "Fonte: Autor (2025).",
    ]);
    const regions = detectPdfVisualRegionCandidates(document);
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(regions[0].kind).toBe("table-visual");
    expect(regions[0].source).toContain("Fonte:");
  });

  it("não gera região quando só há texto comum", () => {
    const document = documentFromTexts([
      "Este parágrafo descreve a metodologia adotada na pesquisa.", "Outro parágrafo de exemplo.",
    ]);
    expect(detectPdfVisualRegionCandidates(document)).toHaveLength(0);
  });
});
