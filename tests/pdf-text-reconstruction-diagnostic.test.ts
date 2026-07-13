import { describe, expect, it } from "vitest";
import { detectPdfBodyStartContextual, reconstructPdfParagraphBlocks } from "../src/pdf-text-reconstruction-diagnostic";
import type { PdfLineDiagnostic, PdfPageDiagnostic, PdfTextItemDiagnostic } from "../src/imported-pdf-diagnostic";

function line(text: string, index: number, options: Partial<PdfLineDiagnostic> & { fontName?: string } = {}): PdfLineDiagnostic {
  const top = options.top ?? 80 + index * 18;
  const height = options.height ?? 12;
  const left = options.left ?? 72;
  const item: PdfTextItemDiagnostic = {
    text,
    x: left,
    y: top,
    width: Math.max(10, text.length * 5),
    height,
    fontName: options.fontName,
  };
  return {
    pageNumber: options.pageNumber ?? 1,
    text,
    items: options.items ?? [item],
    left,
    right: options.right ?? left + Math.max(10, text.length * 5),
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

const bodyA = "Este parágrafo possui texto corrido suficiente para representar corpo acadêmico normal.";
const bodyB = "A linha seguinte mantém a margem do corpo e confirma a continuidade textual do parágrafo.";

describe("reconstrucao textual diagnostica de PDF", () => {
  it("remove numero de pagina isolado e preserva numeros legitimos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(16, ["15", "1 INTRODUÇÃO", bodyA], { 0: { top: 20 } }),
      page(17, ["16", "2025 aparece dentro de uma referência e deve permanecer no texto."], { 0: { top: 20 } }),
      page(18, ["17", "75", "1 INTRODUÇÃO"], { 0: { top: 20 }, 1: { top: 400 } }),
    ]);

    expect(result.ignoredLines.some((entry) => entry.text === "16" && entry.role === "page-number")).toBe(true);
    expect(result.blocks.map((block) => block.text).join(" ")).toContain("2025");
    expect(result.blocks.map((block) => block.text).join(" ")).toContain("75");
    expect(result.blocks.some((block) => block.text === "1 INTRODUÇÃO")).toBe(true);
  });

  it("calcula metricas robustas do corpo e ignora titulo, tabela e extremos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        bodyA,
        bodyB,
        "Teletrabalho",
        "Este texto vem depois do título e permite confirmar o contexto de corpo.",
        "Quadro 1 – Síntese.",
        "1 1995 Decreto nº 1.590/1995",
        "Fonte: elaboração própria.",
        "Outra linha de corpo com comprimento suficiente para apoiar a métrica global.",
        "Linha extrema que não deve deslocar a mediana de altura do corpo.",
      ], {
        1: { left: 72, right: 500, height: 12 },
        2: { left: 72, right: 498, height: 12 },
        3: { left: 210, right: 330, height: 16, fontName: "Helvetica-Bold" },
        6: { left: 250, right: 410 },
        8: { left: 72, right: 505, height: 12 },
        9: { left: 72, right: 900, height: 40 },
      }),
    ]);

    expect(result.bodyLayoutMetrics.dominantLeft).toBe(72);
    expect(result.bodyLayoutMetrics.probableBodyFontHeight).toBe(12);
    expect(result.statistics.layoutRegionCount).toBe(1);
    expect(result.blocks.some((block) => block.type === "heading" && block.text === "Teletrabalho")).toBe(true);
  });

  it("identifica recuo provável de primeira linha diferente da margem normal", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "Primeira linha recuada de um parágrafo acadêmico suficientemente longo",
        bodyB,
        "Outra primeira linha recuada para sustentar a moda de indentação",
        "continuação com margem normal e texto suficiente para o corpo.",
      ], { 1: { left: 108 }, 2: { left: 72 }, 3: { left: 108 }, 4: { left: 72 } }),
    ]);

    expect(result.bodyLayoutMetrics.dominantLeft).toBe(72);
    expect(result.bodyLayoutMetrics.probableFirstLineIndent).toBeGreaterThanOrEqual(32);
  });

  it("aceita introducao real e ignora entrada de sumario", () => {
    const sumario = page(8, ["SUMÁRIO", "1 INTRODUÇÃO ........ 16", "Teletrabalho ........ 21"]);
    const intro = page(17, ["16", "1 INTRODUÇÃO", bodyA], { 0: { top: 20 } });
    const result = detectPdfBodyStartContextual([sumario, intro]);

    expect(result.found).toBe(true);
    expect(result.pageNumber).toBe(17);
    expect(reconstructPdfParagraphBlocks([sumario]).blocks.some((block) => block.type === "heading" && block.text.includes("Teletrabalho"))).toBe(false);
  });

  it("detecta titulos em caixa mista por geometria sem lista fixa", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        bodyA,
        "Teletrabalho",
        bodyB,
        "Implementação do teletrabalho",
        "Este trecho inicia uma nova subseção e possui aparência clara de corpo textual.",
        "2.1 Objetivo geral",
        "Este objetivo é descrito em texto corrido após título numerado.",
      ], {
        2: { top: 160, left: 72, height: 15, fontName: "Times-Bold" },
        4: { top: 230, left: 72, height: 15, fontName: "Times-Bold" },
        6: { top: 300, left: 72, height: 15 },
      }),
    ]);
    const headings = result.blocks.filter((block) => block.type === "heading").map((block) => block.text);

    expect(headings).toContain("Teletrabalho");
    expect(headings).toContain("Implementação do teletrabalho");
    expect(headings).toContain("2.1 Objetivo geral");
    expect(result.statistics.mixedCaseHeadingCount).toBeGreaterThanOrEqual(2);
  });

  it("nao promove frase curta comum, linha de quadro, legenda, fonte ou norma iniciada por ano", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "Esta frase curta fica no meio",
        "do mesmo parágrafo e não representa título estrutural.",
        "Quadro 1 – Histórico legislativo.",
        "1 1995 Decreto nº 1.590/1995",
        "Fonte: Brasil (1995).",
        "1995 Decreto nº 1.590/1995",
        bodyA,
      ], { 1: { left: 72 }, 2: { left: 72 }, 4: { left: 220 } }),
    ]);
    const headings = result.blocks.filter((block) => block.type === "heading").map((block) => block.text);

    expect(headings).not.toContain("Esta frase curta fica no meio");
    expect(headings).not.toContain("1 1995 Decreto nº 1.590/1995");
    expect(headings).not.toContain("1995 Decreto nº 1.590/1995");
  });

  it("combina titulo multilinha e nao combina titulos distintos nem absorve paragrafo", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        bodyA,
        "A IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO",
        "E O TELETRABALHO NA",
        "ADMINISTRAÇÃO PÚBLICA FEDERAL",
        "Este parágrafo começa logo após o título multilinha e deve permanecer separado.",
        "Objetivo geral",
        "Objetivos específicos",
        "Este trecho de corpo vem depois dos dois títulos separados.",
      ], {
        2: { top: 160, height: 15, fontName: "Times-Bold" },
        3: { top: 178, height: 15, fontName: "Times-Bold" },
        4: { top: 196, height: 15, fontName: "Times-Bold" },
        6: { top: 300, height: 15, fontName: "Times-Bold" },
        7: { top: 350, height: 15, fontName: "Times-Bold" },
      }),
    ]);
    const combined = result.blocks.find((block) => block.type === "heading" && block.text.includes("PROGRAMA DE GESTÃO"));

    expect(combined?.sourceLines).toHaveLength(3);
    expect(combined?.text).not.toContain("Este parágrafo começa");
    expect(result.blocks.filter((block) => block.type === "heading" && /Objetivo/.test(block.text))).toHaveLength(2);
    expect(result.statistics.combinedHeadingCount).toBeGreaterThanOrEqual(1);
  });

  it("legenda quebrada permanece fora de heading e vira regiao visual", () => {
    const result = reconstructPdfParagraphBlocks([
      page(25, [
        "Quadro 1 – Pontos críticos do teletrabalho",
        "na administração pública federal.",
        "Organização Pontos Críticos Autores",
        "Fonte: Alves (2020).",
        bodyA,
      ]),
    ]);

    expect(result.blocks.some((block) => block.type === "heading" && block.text.includes("Pontos críticos"))).toBe(false);
    expect(result.layoutRegions).toHaveLength(1);
  });

  it("gera regioes separadas para dois quadros e preserva texto posterior como paragrafo", () => {
    const result = reconstructPdfParagraphBlocks([
      page(25, [
        "1 INTRODUÇÃO",
        bodyA,
        "Quadro 1 – Primeiro quadro.",
        "Organização Pontos Críticos Autores",
        "Fonte: Autor (2025).",
        "Texto normal depois do primeiro quadro com corpo suficiente para virar parágrafo.",
        "Quadro 2 – Segundo quadro.",
        "Etapa Responsável Resultado",
        "Fonte: Autor (2025).",
        "Texto posterior ao segundo quadro permanece elegível como parágrafo normal.",
      ]),
    ]);

    expect(result.layoutRegions.filter((region) => region.kind === "quadro")).toHaveLength(2);
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("depois do primeiro quadro"))).toBe(true);
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("posterior ao segundo quadro"))).toBe(true);
  });

  it("quadro sem fonte termina antes do proximo paragrafo normal", () => {
    const result = reconstructPdfParagraphBlocks([
      page(25, [
        "Quadro 1 – Síntese sem fonte.",
        "Indicador Resultado Autor",
        "Tempo Redução Oliveira",
        "Este parágrafo normal depois do quadro não pode ser absorvido pela região visual.",
      ]),
    ]);

    expect(result.layoutRegions[0].endLineIndex).toBe(2);
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("não pode ser absorvido"))).toBe(true);
  });

  it("grafico e quadro na mesma pagina ficam separados e pagina sem visual nao vira layout-sensitive", () => {
    const withVisuals = reconstructPdfParagraphBlocks([
      page(30, [
        "Figura 1 – Fluxo de análise.",
        "Entrada Saída",
        "Fonte: Autor.",
        "Quadro 1 – Síntese.",
        "Coluna A Coluna B",
        "Fonte: Autor.",
      ]),
    ]);
    const withoutVisuals = reconstructPdfParagraphBlocks([page(31, ["1 INTRODUÇÃO", bodyA, bodyB])]);

    expect(withVisuals.layoutRegions.map((region) => region.kind)).toEqual(["figura", "quadro"]);
    expect(withoutVisuals.statistics.layoutRegionCount).toBe(0);
  });

  it("linhas multicoluna sem legenda geram regiao de baixa confianca", () => {
    const result = reconstructPdfParagraphBlocks([
      page(31, ["A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3"], {
        0: { left: 72 }, 1: { left: 190 }, 2: { left: 310 }, 3: { left: 72 },
        4: { left: 190 }, 5: { left: 310 }, 6: { left: 72 }, 7: { left: 190 },
      }),
    ]);

    expect(result.layoutRegions[0].kind).toBe("multicolumn");
    expect(result.layoutRegions[0].confidence).toBe("low");
  });

  it("relaciona quadro em continuacao e conclusao sem duplicar fonte", () => {
    const result = reconstructPdfParagraphBlocks([
      page(36, ["Quadro 3 – Etapas do programa (continua).", "Etapa Resultado Autor"]),
      page(37, ["Quadro 3 – Etapas do programa (conclusão).", "Etapa final Resultado", "Fonte: Autor (2025).", bodyA]),
    ]);

    expect(result.layoutRegions).toHaveLength(2);
    expect(result.layoutRegions[0].logicalVisualId).toBe(result.layoutRegions[1].logicalVisualId);
    expect(result.layoutRegions[0].source).toBeUndefined();
    expect(result.layoutRegions[1].source).toContain("Fonte:");
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("Este parágrafo"))).toBe(true);
  });

  it("separa e une paragrafos usando metricas de corpo", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "Primeira linha recuada de um parágrafo acadêmico suficientemente longo",
        "continua na margem normal mesmo após ponto. A geometria demonstra continuidade.",
        "Novo parágrafo recuado permanece separado do anterior.",
        "continuação do novo parágrafo na margem normal.",
        "Parágrafo sem recuo aparece após intervalo vertical maior.",
        "segunda linha desse parágrafo sem recuo mantém continuidade.",
      ], {
        1: { left: 108 },
        2: { left: 72 },
        3: { top: 150, left: 108 },
        4: { top: 168, left: 72 },
        5: { top: 230, left: 72 },
        6: { top: 248, left: 72 },
      }),
    ]);
    const paragraphs = result.blocks.filter((block) => block.type === "paragraph");

    expect(paragraphs.some((paragraph) => paragraph.text.includes("longo continua na margem"))).toBe(true);
    expect(paragraphs.some((paragraph) => paragraph.text.includes("Novo parágrafo recuado permanece separado"))).toBe(true);
    expect(paragraphs.some((paragraph) => paragraph.text.includes("após intervalo vertical maior. segunda linha"))).toBe(true);
    expect(result.blocks.flatMap((block) => block.reasons).join(" ")).toContain("Separado por intervalo vertical ampliado");
  });

  it("nao junta citacao longa recuada ao corpo e nao divide referencia por linha", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        bodyA,
        "Esta citação longa possui recuo próprio e não deve ser juntada ao corpo textual.",
        "SILVA, João. Título da obra acadêmica: subtítulo explicativo.",
        "Lavras: Editora Acadêmica, 2025.",
      ], { 2: { left: 150 }, 3: { top: 180, left: 72 }, 4: { top: 198, left: 72 } }),
    ]);

    expect(result.blocks.some((block) => block.type === "paragraph" && block.text === "Esta citação longa possui recuo próprio e não deve ser juntada ao corpo textual.")).toBe(true);
    expect(result.blocks.some((block) => block.type === "paragraph" && block.text.includes("SILVA, João") && block.text.includes("Lavras:"))).toBe(true);
  });

  it("controla continuidade entre paginas por posicao, estrutura e coluna", () => {
    const joined = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Este parágrafo começa no fim da página"], { 1: { top: 760 } }),
      page(18, ["17", "e continua na página seguinte sem quebra estrutural."], { 0: { top: 20 }, 1: { top: 80 } }),
    ]);
    const farFromFooter = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Texto termina longe do rodapé"], { 1: { top: 300 } }),
      page(18, ["continuação não deve ocorrer porque a posição não confirma."]),
    ]);
    const withHeading = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Texto no fim da página"], { 1: { top: 760 } }),
      page(18, ["2 REFERENCIAL TEÓRICO", bodyA]),
    ]);
    const withVisual = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Texto no fim da página"], { 1: { top: 760 } }),
      page(18, ["Quadro 1 – Síntese.", "A B C", "Fonte: Autor."]),
    ]);
    const changedColumn = reconstructPdfParagraphBlocks([
      page(17, ["1 INTRODUÇÃO", "Texto no fim da página"], { 1: { top: 760, left: 72 } }),
      page(18, ["continuação deslocada em outra coluna."], { 0: { top: 80, left: 220 } }),
    ]);

    expect(joined.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(true);
    expect(farFromFooter.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(false);
    expect(withHeading.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(false);
    expect(withVisual.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(false);
    expect(changedColumn.blocks.some((block) => block.type === "paragraph" && block.pageStart === 17 && block.pageEnd === 18)).toBe(false);
  });

  it("registra acoes de hifenizacao e preserva casos incertos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "A administra-",
        "ção pública adotou novas práticas no período recente.",
        "O pós-",
        "pandemia exige cautela diagnóstica.",
        "O técnico-",
        "administrativo foi preservado.",
        "O item 75-",
        "A permanece com hífen.",
        "A forma inter-",
        "institucional foi preservada por incerteza.",
      ]),
    ]);
    const text = result.blocks.map((block) => block.text).join(" ");

    expect(text).toContain("administração pública");
    expect(text).toContain("pós-pandemia");
    expect(text).toContain("técnico-administrativo");
    expect(text).toContain("75-A");
    expect(text).toContain("inter-institucional");
    expect(result.hyphenation.some((entry) => entry.action === "joined-without-hyphen")).toBe(true);
    expect(result.hyphenation.some((entry) => entry.action === "preserved-hyphen")).toBe(true);
    expect(result.hyphenation.some((entry) => entry.action === "uncertain")).toBe(true);
    expect(result.statistics.uncertainHyphenationCount).toBeGreaterThan(0);
  });

  it("gera indicadores de qualidade e alertas diagnosticos", () => {
    const result = reconstructPdfParagraphBlocks([
      page(17, [
        "1 INTRODUÇÃO",
        "Curto 1.",
        "Curto 2.",
        "Curto 3.",
        "Quadro 1 – Região extensa.",
        ...Array.from({ length: 48 }, (_, index) => `Linha visual ${index + 1}`),
      ]),
    ]);

    expect(result.statistics.averageLinesPerParagraph).toBeGreaterThanOrEqual(1);
    expect(result.statistics.lowConfidenceBlockCount).toBeGreaterThan(0);
    expect(result.statistics.layoutRegionCount).toBeGreaterThan(0);
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it("linhas dentro de quadro nao viram paragrafo mesmo quando parecem prosa", () => {
    const result = reconstructPdfParagraphBlocks([
      page(27, [
        "Quadro 4 – Indicadores de desempenho.",
        "Soares (1995) Flexibilidade de horários melhora a produtividade.",
        "Tremblay (2002) aponta correlação positiva com engajamento.",
        "1 funciona, funcionou, tem funcionado muito bem.",
        "Fonte: elaboração própria.",
        "Texto normal depois do quadro com corpo suficiente para parágrafo.",
      ]),
    ]);

    const paragraphs = result.blocks.filter((b) => b.type === "paragraph").map((b) => b.text);
    expect(paragraphs.filter((t) => t.includes("Soares (1995)"))).toHaveLength(0);
    expect(paragraphs.filter((t) => t.includes("Tremblay (2002)"))).toHaveLength(0);
    expect(paragraphs.filter((t) => t.includes("1 funciona, funcionou"))).toHaveLength(0);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("depois do quadro"))).toBe(true);
  });

  it("linhas dentro de quadro nao viram heading mesmo com aparencia de titulo", () => {
    const result = reconstructPdfParagraphBlocks([
      page(28, [
        "Quadro 5 – Critérios.",
        "1 CRITÉRIO DE INCLUSÃO",
        "4.2 descreve os resultados obtidos através da análise dos dados",
        "RESULTADOS PARCIAIS",
        "Fonte: Autor.",
        "1 INTRODUÇÃO",
        bodyA,
      ]),
    ]);

    const headings = result.blocks.filter((b) => b.type === "heading").map((b) => b.text);
    expect(headings).not.toContain("1 CRITÉRIO DE INCLUSÃO");
    expect(headings).not.toContain("4.2 descreve os resultados");
    expect(headings).not.toContain("RESULTADOS PARCIAIS");
    expect(headings).toContain("1 INTRODUÇÃO");
  });

  it("quadro em duas paginas gera regiao ponte na pagina intermediaria", () => {
    const result = reconstructPdfParagraphBlocks([
      page(25, ["Quadro 1 – Síntese (continua).", "Linha A", "Linha B"]),
      page(26, ["Texto intermediário que nao pode virar paragrafo."]),
      page(27, ["Quadro 1 – Síntese (conclusão).", "Linha C", "Fonte: Autor.", bodyA]),
    ]);

    const bridgeId = `layout-26-bridge-quadro-1`;
    const regionIds = result.layoutRegions.map((r) => r.id);
    expect(result.layoutRegions.length, `found ${result.layoutRegions.length} regions: ${regionIds.join(", ")}`).toBeGreaterThan(2);
    expect(result.layoutRegions.filter((r) => r.id === bridgeId).length, `bridge id ${bridgeId} not in [${regionIds.join(", ")}]`).toBe(1);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("intermediário")), `block texts: ${result.blocks.map(b => `[${b.type}]${b.text.substring(0,40)}`).join(" ")}`).toBe(false);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("corpo"))).toBe(true);
  });

  it("regiao ponte cobre todas as linhas da pagina intermediaria", () => {
    const result = reconstructPdfParagraphBlocks([
      page(30, ["Quadro 2 – Dados.", "Valor 1"]),
      page(31, [
        "Soares (1995) citação dentro do quadro não deve vazar.",
        "1 TÍTULO APARENTE DENTRO DO QUADRO",
        "Texto longo o bastante para ser parágrafo mas está dentro do quadro.",
      ]),
      page(32, ["Quadro 2 – Conclusão.", "Valor final", "Fonte: Autor.", bodyA]),
    ]);

    expect(result.statistics.layoutRegionCount).toBeGreaterThanOrEqual(3);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("Soares"))).toBe(false);
    expect(result.blocks.some((b) => b.type === "heading" && b.text.includes("TÍTULO APARENTE"))).toBe(false);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("parágrafo mas está dentro"))).toBe(false);
    expect(result.blocks.some((b) => b.type === "paragraph" && b.text.includes("corpo"))).toBe(true);
  });

  it("grafico com legenda e fonte, sem texto interno, gera regiao", () => {
    const result = reconstructPdfParagraphBlocks([
      page(40, ["Gráfico 1 – Vendas.", "Fonte: Autor.", bodyA]),
    ]);
    expect(result.statistics.layoutRegionCount).toBe(1);
    const region = result.layoutRegions[0];
    expect(region.kind).toBe("grafico");
    const caption = result.blocks.find((b) => b.type === "caption");
    expect(caption).toBeDefined();
    expect(caption).toHaveProperty("layoutRegionId", region.id);
    const source = result.blocks.find((b) => b.type === "source");
    expect(source).toBeDefined();
    expect(source).toHaveProperty("layoutRegionId", region.id);
  });

  it("grafico sem fonte gera regiao medium", () => {
    const result = reconstructPdfParagraphBlocks([
      page(41, ["Gráfico 2 – Tendências.", bodyA]),
    ]);
    expect(result.statistics.layoutRegionCount).toBe(1);
    expect(result.layoutRegions[0].kind).toBe("grafico");
    expect(result.layoutRegions[0].confidence).toBe("medium");
  });

  it("figura com legenda e fonte gera regiao sem texto interno", () => {
    const result = reconstructPdfParagraphBlocks([
      page(42, ["Figura 1 – Diagrama.", "Fonte: Autor.", bodyA]),
    ]);
    expect(result.statistics.layoutRegionCount).toBe(1);
    expect(result.layoutRegions[0].kind).toBe("figura");
    const caption = result.blocks.find((b) => b.type === "caption");
    expect(caption).toBeDefined();
    expect(caption).toHaveProperty("layoutRegionId", result.layoutRegions[0].id);
  });

  it("dois graficos geram duas regioes", () => {
    const result = reconstructPdfParagraphBlocks([
      page(43, ["Gráfico 1 – Um.", "Fonte: Autor.", bodyA]),
      page(44, ["Gráfico 2 – Dois.", "Fonte: Autor.", bodyA]),
    ]);
    expect(result.statistics.layoutRegionCount).toBe(2);
  });

  it("caption e source de grafico recebem layoutRegionId", () => {
    const result = reconstructPdfParagraphBlocks([
      page(45, ["Gráfico 3 – Dados.", "Fonte: Elaboração própria.", bodyA]),
    ]);
    const caption = result.blocks.find((b) => b.type === "caption");
    const source = result.blocks.find((b) => b.type === "source");
    expect(caption?.layoutRegionId).toBeTruthy();
    expect(source?.layoutRegionId).toBeTruthy();
    expect(caption?.layoutRegionId).toBe(source?.layoutRegionId);
  });
});
