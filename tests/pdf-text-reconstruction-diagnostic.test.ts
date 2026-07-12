import { describe, expect, it } from "vitest";
import { detectPdfBodyStartContextual, reconstructPdfParagraphBlocks } from "../src/pdf-text-reconstruction-diagnostic";
import type { PdfLineDiagnostic, PdfPageDiagnostic } from "../src/imported-pdf-diagnostic";

function line(text: string, index: number, options: Partial<PdfLineDiagnostic> = {}): PdfLineDiagnostic {
  const top = options.top ?? 80 + index * 18;
  const height = options.height ?? 12;
  return {
    pageNumber: options.pageNumber ?? 1,
    text,
    items: options.items ?? [{ text, x: options.left ?? 72, y: top, width: Math.max(10, text.length * 5), height }],
    left: options.left ?? 72,
    right: options.right ?? (options.left ?? 72) + Math.max(10, text.length * 5),
    top,
    bottom: top + height,
    height,
  };
}

function page(pageNumber: number, texts: string[], overrides: Record<number, Partial<PdfLineDiagnostic>> = {}): PdfPageDiagnostic {
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

describe("reconstrucao textual diagnostica de PDF", () => {
  it("remove numero de pagina isolado no topo quando pertence a sequencia e preserva numeros legitimos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(16, ["15", "1 INTRODUÇÃO", "Este parágrafo inicial possui texto corrido suficiente para ser aceito."], { 0: { top: 20 } }),
      page(17, ["16", "2025 aparece dentro de uma referência e deve permanecer no texto."], { 0: { top: 20 } }),
      page(18, ["17", "75", "1 INTRODUÇÃO"], { 0: { top: 20 }, 1: { top: 400 } }),
    ]);

    expect(result.ignoredLines.some((entry) => entry.text === "16" && entry.role === "page-number")).toBe(true);
    expect(result.blocks.map((block) => block.text).join(" ")).toContain("2025");
    expect(result.blocks.map((block) => block.text).join(" ")).toContain("75");
    expect(result.blocks.some((block) => block.text === "1 INTRODUÇÃO")).toBe(true);
  });

  it("reconhece numeracao romana pre-textual recorrente em rodape", () => {
    const result = reconstructPdfParagraphBlocks([
      page(1, ["RESUMO", "i"], { 1: { top: 790 } }),
      page(2, ["ABSTRACT", "ii"], { 1: { top: 790 } }),
      page(3, ["SUMÁRIO", "iii"], { 1: { top: 790 } }),
    ]);

    expect(result.statistics.removedPageNumberCount).toBeGreaterThan(0);
  });

  it("remove cabecalho e rodape repetidos, mas preserva frase igual no corpo", () => {
    const pages = [1, 2, 3, 4, 5].map((pageNumber) => page(pageNumber, [
      "UNIVERSIDADE FEDERAL DE LAVRAS",
      `Texto do corpo repetido na página ${pageNumber}.`,
      "Frase comum no corpo",
      `Rodapé institucional ${pageNumber}`,
    ], { 0: { top: 20 }, 3: { top: 790 } }));

    const result = reconstructPdfParagraphBlocks(pages);
    const text = result.blocks.map((block) => block.text).join(" ");

    expect(result.statistics.removedHeaderCount).toBe(5);
    expect(result.statistics.removedFooterCount).toBe(5);
    expect(text).toContain("Frase comum no corpo");
  });

  it("ignora introducao em sumario dividido e aceita introducao seguida por paragrafo longo", () => {
    const sumario = page(8, ["SUMÁRIO", "1 INTRODUÇÃO", "16"]);
    const intro = page(17, ["16", "1 INTRODUÇÃO", "Este é um parágrafo longo de corpo textual que confirma o início real do texto."], { 0: { top: 20 } });
    const result = detectPdfBodyStartContextual([sumario, intro]);

    expect(result.found).toBe(true);
    expect(result.pageNumber).toBe(17);
    expect(detectPdfBodyStartContextual([page(1, ["1 INTRODUÇÃO ........ 16"])]).found).toBe(false);
    expect(detectPdfBodyStartContextual([page(1, ["RESUMO", "AGRADECIMENTOS"])]).found).toBe(false);
  });

  it("marca layout sensivel como unresolved e preserva legenda e fonte separadas", () => {
    const result = reconstructPdfParagraphBlocks([
      page(25, [
        "Quadro 1 – Pontos críticos do teletrabalho.",
        "Organização Pontos Críticos Autores",
        "Mudanças na estrutura Goulart (2009)",
        "Queda de produção na fase inicial",
        "Fonte: elaboração própria.",
        "Depois do quadro, este parágrafo volta a ser texto corrido normal.",
      ], { 1: { left: 72 }, 2: { left: 180 }, 3: { left: 300 } }),
    ]);

    expect(result.blocks.some((block) => block.type === "caption" && block.text.includes("Quadro 1"))).toBe(true);
    expect(result.blocks.some((block) => block.type === "source" && block.text.startsWith("Fonte:"))).toBe(true);
    expect(result.blocks.some((block) => block.type === "unresolved" && block.text.includes("Organização"))).toBe(true);
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("Depois do quadro"))).toBe(true);
  });

  it("reconstroi paragrafos, trata hifenizacao conservadora e preserva compostos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A administra-",
        "ção pública adotou o regime técnico-administrativo no período 2020-2024.",
        "Novo parágrafo começa após um intervalo maior.",
      ], { 3: { top: 180 } }),
    ]);

    const paragraphs = result.blocks.filter((block) => block.type === "paragraph");
    expect(paragraphs[0].text).toContain("administração pública");
    expect(paragraphs[0].text).toContain("técnico-administrativo");
    expect(paragraphs[0].text).toContain("2020-2024");
    expect(paragraphs).toHaveLength(2);
  });

  it("une primeira linha recuada ao corpo sem colar linha encerrada por ponto", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÃ‡ÃƒO",
        "O teletrabalho na administraÃ§Ã£o pÃºblica federal",
        "tem evoluÃ­do significativamente nos Ãºltimos anos e exige acompanhamento constante.",
        "Esta linha jÃ¡ termina um parÃ¡grafo.",
        "Novo parÃ¡grafo permanece separado.",
      ], { 1: { left: 112 }, 2: { left: 72 }, 3: { top: 150, left: 112 }, 4: { top: 168, left: 72 } }),
    ]);

    const paragraphs = result.blocks.filter((block) => block.type === "paragraph");
    expect(paragraphs.some((paragraph) => paragraph.text.includes("federal tem evoluÃ­do"))).toBe(true);
    expect(paragraphs.some((paragraph) => paragraph.text === "Esta linha jÃ¡ termina um parÃ¡grafo.")).toBe(true);
    expect(paragraphs.some((paragraph) => paragraph.text === "Novo parÃ¡grafo permanece separado.")).toBe(true);
  });

  it("une paragrafo entre paginas quando nao ha encerramento e bloqueia quando a pagina seguinte comeca por heading ou lista", () => {
    const joined = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Este parágrafo começa no fim da página"], { 1: { top: 760 } }),
      page(18, ["17", "e continua na página seguinte sem quebra estrutural."], { 0: { top: 20 } }),
    ]);
    const blocked = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Texto encerrado."]),
      page(18, ["2 REFERENCIAL TEÓRICO", "a) item de lista"]),
    ]);

    expect(joined.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(true);
    expect(blocked.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(false);
  });
});
