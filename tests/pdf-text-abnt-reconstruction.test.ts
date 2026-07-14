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

  it("preserva COVID-19-19 reconstruído no corpo e emite alerta", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A pandemia de COVID-19-19 mudou o trabalho público federal.",
      ]),
    ]);
    const text = paragraphTexts(result).join(" ");
    expect(text).toContain("COVID-19-19");
    expect(text).not.toContain("COVID-19.");
    expect(result.alerts.some((a) => a.includes("COVID-19-19"))).toBe(true);
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
    expect(result.alerts.some((a) => a.includes("servidorpesquisador"))).toBe(true);
  });

  it("preserva COVID-19-19 dentro da seção REFERÊNCIAS e emite alerta", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, ["REFERÊNCIAS"]),
      page(111, ["SILVA, J. Impactos da COVID-19-19 na gestão pública. Editora, 2021."]),
    ]);
    const ref = paragraphTexts(result).find((t) => t.includes("SILVA, J."));
    expect(ref).toContain("COVID-19-19");
    expect(ref).not.toContain("COVID-19.");
    expect(result.alerts.some((a) => a.includes("COVID-19-19"))).toBe(true);
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

  it("separa referencias fundidas no fluxo real do pdf", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, [
        "REFERÊNCIAS",
        "ALVES, A. C. Teletrabalho na Administração Pública: estudo de caso na",
        "Controladoria Geral da União. Dissertação (Mestrado Profissional em",
        "Administração Pública) - Universidade de Brasília, Brasília, 2020.",
        "ALVES LEITE, B. W.; BENEVIDES DE PINHO, M. A. O programa",
        "de gestão e desempenho nas universidades públicas brasileiras.",
        "Encontro Internacional de Gestão, Desenvolvimento e Inovação,",
        "v. 7, n. 1, 15 maio 2024.",
      ]),
    ]);
    const refBlocks = result.blocks.filter((block) => block.type === "paragraph");
    expect(refBlocks.length).toBe(2);
    expect(refBlocks[0].text.startsWith("ALVES, A. C.")).toBe(true);
    expect(refBlocks[1].text.startsWith("ALVES LEITE, B. W.")).toBe(true);
    expect(refBlocks[0].text).not.toContain("ALVES LEITE");
    expect(refBlocks[1].text).not.toContain("ALVES, A. C.");
  });

  it("desativa separacao de referencias ao encontrar APENDICE", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, [
        "REFERÊNCIAS",
        "ALVES, A. C. Teletrabalho na Administração Pública. Editora, 2020.",
        "ALVES LEITE, B. W. O programa de gestão. Editora, 2024.",
      ]),
      page(130, [
        "APÊNDICE A",
        "ALVES, A. C. Material complementar. Editora, 2020.",
        "BRASIL. Ministério da Educação. Relatório, 2021.",
      ]),
    ]);
    const refBefore = result.blocks.filter((block) => block.type === "paragraph" && block.pageStart === 110).length;
    const refAfter = result.blocks.filter((block) => block.type === "paragraph" && block.pageStart === 130).length;
    expect(refBefore).toBe(2);
    expect(refAfter).toBe(1);
  });

  it("preserva pandemia de COVID-19-19 em referencia e emite alerta unico", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, ["REFERÊNCIAS"]),
      page(111, ["SILVA, J. pandemia de COVID-19-19 na gestão pública. Editora, 2021."]),
    ]);
    const ref = paragraphTexts(result).find((text) => text.includes("SILVA, J."));
    expect(ref).toContain("pandemia de COVID-19-19");
    expect(ref).not.toContain("COVID-19.");
    expect(result.alerts.some((a) => a.includes("COVID-19-19"))).toBe(true);
  });

  it("deduplica alerta de COVID-19-19 quando ha varias ocorrencias", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, ["REFERÊNCIAS"]),
      page(111, ["SILVA, A. pandemia de COVID-19-19 na saude. Editora, 2020."]),
      page(112, ["SOUZA, B. impactos da COVID-19-19 no trabalho. Editora, 2021."]),
      page(113, ["COSTA, C. efeitos da COVID-19-19 em servidores. Editora, 2022."]),
    ]);
    const covidAlerts = result.alerts.filter((a) => a.includes("Possível duplicação textual presente no documento original: COVID-19-19"));
    expect(covidAlerts.length).toBe(1);
    expect(covidAlerts[0]).toContain("(3 ocorrências).");
  });

  it("reconhece referencias institucionais e autorias variadas no fluxo real", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, [
        "REFERÊNCIAS",
        "ALVES LEITE, B. W.; BENEVIDES DE PINHO, M. A. O programa de gestao e",
        "desempenho nas universidades publicas brasileiras. Encontro Internacional de Gestao,",
        "Desenvolvimento e Inovacao (EIGEDIN), v. 7, n. 1, 15 maio 2024.",
        "ARAUJO T.M. DE, LUA I. O trabalho mudou-se para casa: trabalho remoto no contexto",
        "da pandemia de COVID-19-19. Revista Brasileira de Saude Ocupacional, v. 46,",
        "p. e27, 2021.",
        "BRASIL. Decreto nº 1.590, de 10 de agosto de 1995. Dispoe sobre a jornada de trabalho dos",
        "servidores da Administracao Publica Federal direta, das autarquias e das fundacoes publicas",
        "federais, e da outras providencias. Diario Oficial da Uniao, Brasilia, DF,",
        "n. 154, 11 ago. 1995. Secao 1.",
        "BRASIL. Lei nº 11.091, de 12 de janeiro de 2005. Dispoe sobre a estruturacao do Plano de",
        "Carreira dos Cargos Tecnico-Administrativos em Educacao.",
      ]),
    ]);
    const refBlocks = result.blocks.filter((block) => block.type === "paragraph");
    expect(refBlocks.length).toBe(4);
    expect(refBlocks[0].text.startsWith("ALVES LEITE, B. W.")).toBe(true);
    expect(refBlocks[1].text.startsWith("ARAUJO T.M. DE, LUA I.")).toBe(true);
    expect(refBlocks[2].text.startsWith("BRASIL. Decreto")).toBe(true);
    expect(refBlocks[3].text.startsWith("BRASIL. Lei")).toBe(true);
    expect(refBlocks[0].text).not.toContain("ARAUJO T.M. DE");
    expect(refBlocks[1].text).not.toContain("BRASIL. Decreto");
    expect(refBlocks[2].text).not.toContain("BRASIL. Lei");
    expect(refBlocks[1].text).toContain("COVID-19-19");
    expect(refBlocks[1].text).not.toContain("COVID-19.");
    expect(refBlocks[0].text).toContain("Encontro Internacional de Gestao, Desenvolvimento e Inovacao (EIGEDIN), v. 7, n. 1, 15 maio 2024.");
    expect(refBlocks[1].text).toContain("Revista Brasileira de Saude Ocupacional, v. 46, p. e27, 2021.");
    expect(refBlocks[2].text).toContain("Brasilia, DF, n. 154, 11 ago. 1995. Secao 1.");
    expect(refBlocks[3].text).toContain("Carreira dos Cargos Tecnico-Administrativos em Educacao.");
  });

  it("mantem continuacoes ancoradas no inicio e inicia autoria com v. na mesma linha", () => {
    const result = reconstructPdfParagraphBlocks([
      page(110, [
        "REFERÊNCIAS",
        "SILVA, A. B. Artigo sobre gestao publica. Revista Exemplo, v. 7, n. 1, 2024.",
        "SOUZA, C. Trabalho remoto. Brasilia: Universidade de Brasilia, 2020.",
        "COSTA, D. Estudo. Disponivel em: https://exemplo.org/artigo",
        "LIMA, E. Pesquisa. Acesso em: 15 maio 2025.",
      ]),
    ]);
    const refBlocks = result.blocks.filter((block) => block.type === "paragraph");
    expect(refBlocks.length).toBe(4);
    const silva = refBlocks.find((block) => block.text.startsWith("SILVA, A. B."))!;
    expect(silva.text).toContain("Revista Exemplo, v. 7, n. 1, 2024.");
    const souza = refBlocks.find((block) => block.text.startsWith("SOUZA, C."))!;
    expect(souza.text).toContain("Brasilia: Universidade de Brasilia, 2020.");
    const costa = refBlocks.find((block) => block.text.startsWith("COSTA, D."))!;
    expect(costa.text).toContain("Disponivel em: https://exemplo.org/artigo");
    const lima = refBlocks.find((block) => block.text.startsWith("LIMA, E."))!;
    expect(lima.text).toContain("Acesso em: 15 maio 2025.");
  });
});
