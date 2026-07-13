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

const PAGE_WIDTH = 595;

interface LineSpec {
  text: string;
  centered?: boolean;
}

function buildTitlePage(specs: LineSpec[]): PdfPageDiagnostic[] {
  const lines: PdfLineDiagnostic[] = specs.map((spec, index) => {
    const approxWidth = Math.max(20, spec.text.length * 5);
    const left = spec.centered ? PAGE_WIDTH / 2 - approxWidth / 2 : 60;
    return {
      pageNumber: 2,
      text: spec.text,
      items: [],
      left,
      right: left + approxWidth,
      top: 120 + index * 14,
      bottom: 120 + index * 14 + 11,
      height: 11,
    };
  });
  return [{
    pageNumber: 2,
    width: PAGE_WIDTH,
    height: 842,
    rotation: 0,
    rawText: specs.map((spec) => spec.text).join(" "),
    textItemCount: specs.length,
    items: [],
    lines,
  }];
}

function combined(pre: ReturnType<typeof detectPdfPretextual>["titlePage"]): string {
  return [pre?.natureText, pre?.program, pre?.advisor].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

describe("diagnóstico pretextual: folha de rosto sem duplicação de natureza/orientador", () => {
  it("não repete a natureza nem anexa o orientador ao programa (caso Andrade)", () => {
    const pages = buildTitlePage([
      { text: "MARIANA RAQUEL DE OLIVEIRA ANDRADE", centered: true },
      { text: "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM", centered: true },
      { text: "UMA UNIVERSIDADE FEDERAL NO ESTADO DE MINAS GERAIS", centered: true },
      { text: "Dissertação apresentada à Universidade" },
      { text: "Federal de Lavras, como parte das exigências" },
      { text: "do Programa de Pós-Graduação em" },
      { text: "Administração Pública, área de concentração" },
      { text: "em Gestão Pública, Tecnologias e Inovação," },
      { text: "para a obtenção do título de Mestre." },
      { text: "Prof. Dr. Dany Flavio Tonelli" },
      { text: "Orientador" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toBe("Orientador: Prof. Dr. Dany Flavio Tonelli");
    expect(pre?.natureText).toContain("Dissertação apresentada à Universidade Federal de Lavras");
    expect(pre?.natureText).toContain("para a obtenção do título de Mestre.");
    expect(pre?.natureText).not.toContain("Prof. Dr. Dany Flavio Tonelli");
    // O nome do orientador aparece uma única vez (no campo advisor), não anexado à natureza/programa.
    expect((combined(pre).match(/Prof\.\s*Dr\.\s*Dany Flavio Tonelli/g) ?? []).length).toBe(1);
    if (pre?.program) {
      expect(pre.program).not.toContain("Prof. Dr. Dany Flavio Tonelli");
      expect(pre.program).not.toContain("Orientador");
    }
    expect(pre?.city).toBe("LAVRAS-MG");
    expect(pre?.year).toBe("2025");
  });

  it("orientador em linha própria ANTES do rótulo preserva o rótulo", () => {
    const pages = buildTitlePage([
      { text: "AUTOR TESTE", centered: true },
      { text: "TÍTULO DO TRABALHO", centered: true },
      { text: "Dissertação apresentada à Universidade, para a obtenção do título de Mestre." },
      { text: "do Programa de Pós-Graduação em Administração." },
      { text: "Prof. Dr. Maria Souza" },
      { text: "Orientadora" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2024", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toMatch(/^Orientadora?:/);
    expect(pre?.advisor).toContain("Prof. Dr. Maria Souza");
    expect(pre?.natureText).not.toContain("Prof. Dr. Maria Souza");
    expect((combined(pre).match(/Prof\.\s*Dr\.\s*Maria Souza/g) ?? []).length).toBe(1);
    if (pre?.program) {
      expect(pre.program).not.toContain("Prof. Dr. Maria Souza");
    }
  });

  it("orientador DEPOIS do rótulo na mesma linha (Orientador: Nome) mantém o rótulo", () => {
    const pages = buildTitlePage([
      { text: "AUTOR TESTE", centered: true },
      { text: "TÍTULO DO TRABALHO", centered: true },
      { text: "Dissertação apresentada à Universidade, para a obtenção do título de Mestre." },
      { text: "Programa de Pós-Graduação em Engenharia." },
      { text: "Área de Concentração: Recursos Hídricos." },
      { text: "Orientador: Prof. Dr. João Silva" },
      { text: "Cidade", centered: true },
      { text: "2024", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;
    const text = combined(pre);

    expect(pre?.advisor).toMatch(/^Orientador:/);
    expect(pre?.advisor).toContain("Prof. Dr. João Silva");
    expect(pre?.natureText).not.toContain("Prof. Dr. João Silva");
    expect(text).toContain("Programa de Pós-Graduação em Engenharia");
    expect(text).toContain("Área de Concentração: Recursos Hídricos");
    expect((text.match(/Prof\.\s*Dr\.\s*João Silva/g) ?? []).length).toBe(1);
  });

  it("programa legítimo distinto da natureza é preservado sem repetir o orientador", () => {
    const pages = buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Tese apresentada à Universidade, para obtenção do título de Doutor." },
      { text: "Programa de Pós-Graduação em Ciência da Computação." },
      { text: "Orientador: Prof. Dr. Carlos Lima" },
      { text: "Cidade", centered: true },
      { text: "2023", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;
    const text = combined(pre);

    expect(pre?.advisor).toMatch(/^Orientador:/);
    expect(pre?.advisor).toContain("Prof. Dr. Carlos Lima");
    expect(text).toContain("Programa de Pós-Graduação em Ciência da Computação");
    expect((text.match(/Prof\.\s*Dr\.\s*Carlos Lima/g) ?? []).length).toBe(1);
  });

  it("cidade e ano não entram na natureza nem no orientador", () => {
    const pages = buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade, para obtenção do título de Mestre." },
      { text: "Prof. Dr. Ana Costa" },
      { text: "Orientadora" },
      { text: "BELO HORIZONTE-MG", centered: true },
      { text: "2022", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toMatch(/^Orientadora?:/);
    expect(pre?.advisor).toContain("Prof. Dr. Ana Costa");
    expect(pre?.natureText).not.toContain("BELO HORIZONTE");
    expect(pre?.natureText).not.toContain("2022");
    expect(pre?.advisor).not.toContain("BELO HORIZONTE");
    expect(pre?.advisor).not.toContain("2022");
    expect(pre?.city).toBe("BELO HORIZONTE-MG");
    expect(pre?.year).toBe("2022");
  });

  it("nome do orientador aparece uma única vez (no campo advisor, não na natureza)", () => {
    const pages = buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade, para obtenção do título de Mestre." },
      { text: "Prof. Dr. Pedro Alves" },
      { text: "Orientador" },
      { text: "Cidade", centered: true },
      { text: "2021", centered: true },
    ]);

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toMatch(/^Orientador:/);
    expect(pre?.advisor).toContain("Prof. Dr. Pedro Alves");
    const occurrences = (combined(pre).match(/Prof\.\s*Dr\.\s*Pedro Alves/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

describe("diagnóstico pretextual: instituição não duplicada na folha de rosto", () => {
  it("instituição completa já presente em natureText fica undefined", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBeUndefined();
    expect(pre?.natureText).toContain("Universidade Federal de Lavras");
  });

  it("diferença de caixa não impede a deduplicação", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "dissertação apresentada à universidade federal de lavras, como parte das exigências do título de mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBeUndefined();
  });

  it("diferença de pontuação e acentuação não impede a deduplicação", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras; como parte das exigências do título de Mestre." },
      { text: "UNIVERSIDADE. FEDERAL. DE. LAVRAS." },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBeUndefined();
  });

  it("correspondência apenas parcial não remove institution", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal, para obtenção do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBe("UNIVERSIDADE FEDERAL DE LAVRAS");
    expect(pre?.natureText).toContain("Universidade Federal");
  });

  it("instituição ausente da natureza é preservada", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada para obtenção do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBe("UNIVERSIDADE FEDERAL DE LAVRAS");
  });

  it("instituição com informação adicional é preservada", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS — ESCOLA DE ENGENHARIA" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBe("UNIVERSIDADE FEDERAL DE LAVRAS — ESCOLA DE ENGENHARIA");
    expect(pre?.natureText).toContain("Universidade Federal de Lavras");
  });

  it("título contendo INSTITUTO FEDERAL não vira instituição", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "GESTÃO DE PESSOAS NO INSTITUTO FEDERAL DO SUL DE MINAS", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBeUndefined();
    expect(pre?.title).toBe("GESTÃO DE PESSOAS NO INSTITUTO FEDERAL DO SUL DE MINAS");
    expect(pre?.natureText).toContain("Universidade Federal de Lavras");
  });

  it("advisor continua com o rótulo Orientador:", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, para obtenção do título de Mestre." },
      { text: "Prof. Dr. Dany Flavio Tonelli" },
      { text: "Orientador" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.advisor).toMatch(/^Orientador:/);
    expect(pre?.advisor).toContain("Prof. Dr. Dany Flavio Tonelli");
    expect(pre?.natureText).not.toContain("Prof. Dr. Dany Flavio Tonelli");
  });

  it("cidade e ano continuam separados da natureza e do orientador", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, para obtenção do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS" },
      { text: "Prof. Dr. Ana Costa" },
      { text: "Orientadora" },
      { text: "BELO HORIZONTE-MG", centered: true },
      { text: "2022", centered: true },
    ])).titlePage;

    expect(pre?.institution).toBeUndefined();
    expect(pre?.advisor).toMatch(/^Orientadora:/);
    expect(pre?.natureText).not.toContain("BELO HORIZONTE");
    expect(pre?.natureText).not.toContain("2022");
    expect(pre?.city).toBe("BELO HORIZONTE-MG");
    expect(pre?.year).toBe("2022");
  });

  it("título contendo UNIVERSIDADE FEDERAL DE LAVRAS não vira institution", () => {
    const pre = detectPdfPretextual(buildTitlePage([
      { text: "AUTOR", centered: true },
      { text: "GESTÃO DO PROGRAMA DE DESEMPENHO NA UNIVERSIDADE FEDERAL DE LAVRAS", centered: true },
      { text: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre." },
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS — CAMPUS CENTRAL" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2025", centered: true },
    ])).titlePage;

    expect(pre?.title).toBe("GESTÃO DO PROGRAMA DE DESEMPENHO NA UNIVERSIDADE FEDERAL DE LAVRAS");
    expect(pre?.institution).toBe("UNIVERSIDADE FEDERAL DE LAVRAS — CAMPUS CENTRAL");
    expect(pre?.natureText).toContain("Universidade Federal de Lavras");
  });
});

describe("recuperação do título truncado da capa a partir da folha de rosto", () => {
  const FULL = "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE FEDERAL NO ESTADO DE MINAS GERAIS";
  const TRUNCATED = "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE";
  const AUTHOR = "MARIANA RAQUEL DE OLIVEIRA ANDRADE";

  it("capa com título truncado que é prefixo da folha de rosto recebe o título completo", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        TRUNCATED,
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(FULL);
  });

  it("mesmo caso com título dividido em várias linhas na capa recupera o completo", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E",
        "DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(FULL);
  });

  it("capa e folha de rosto já iguais permanecem inalterados", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        FULL,
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(FULL);
  });

  it("títulos parcialmente semelhantes mas semanticamente diferentes não são substituídos", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "A IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "O PROGRAMA DE GESTÃO E DESEMPENHO EM HOSPITAIS",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("A IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO");
  });

  it("autores diferentes não substituem a capa", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        "JOÃO CARLOS DE SOUZA",
        TRUNCATED,
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(TRUNCATED);
    expect(result.cover?.author).toBe("JOÃO CARLOS DE SOUZA");
  });

  it("anos diferentes não substituem a capa", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        TRUNCATED,
        "LAVRAS-MG",
        "2024",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(TRUNCATED);
    expect(result.cover?.year).toBe("2024");
  });

  it("ausência de folha de rosto mantém a capa como detectada", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        TRUNCATED,
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(TRUNCATED);
    expect(result.titlePage).toBeUndefined();
  });

  it("título contendo UNIVERSIDADE FEDERAL DE LAVRAS não vira institution e é recuperado", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "GESTÃO NA UNIVERSIDADE FEDERAL DE LAVRAS",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "GESTÃO NA UNIVERSIDADE FEDERAL DE LAVRAS CAMPUS CENTRAL",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("GESTÃO NA UNIVERSIDADE FEDERAL DE LAVRAS CAMPUS CENTRAL");
    expect(result.titlePage?.institution).toBeUndefined();
  });

  it("caso real sintético do Andrade recupera o título completo sem alterar advisor ou natureza", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        TRUNCATED,
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        FULL,
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe(FULL);
    expect(result.titlePage?.title).toBe(FULL);
    expect(result.titlePage?.advisor).toBe("Orientador: Prof. Dr. Dany Flavio Tonelli");
    expect(result.titlePage?.natureText).toContain("Universidade Federal de Lavras");
  });
});

describe("reconciliação estrita do prefixo do título da capa", () => {
  const AUTHOR = "MARIANA RAQUEL DE OLIVEIRA ANDRADE";

  it("prefixo parcial de palavra não substitui a capa", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "GESTÃO DO PROJETO",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "GESTÃO DO PROJETOZINHO DE TRABALHO",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("GESTÃO DO PROJETO");
  });

  it("diferença apenas de pontuação não substitui a capa", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "GESTÃO: TRABALHO",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "GESTÃO - TRABALHO",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("GESTÃO: TRABALHO");
  });

  it("acréscimo de palavra completa continua recuperando o título", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "GESTÃO DO TRABALHO",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "GESTÃO DO TRABALHO REMOTO",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("GESTÃO DO TRABALHO REMOTO");
  });

  it("caso Andrade continua recuperando o título completo", () => {
    const result = detectPdfPretextual([
      page(1, [
        "UNIVERSIDADE FEDERAL DE LAVRAS",
        AUTHOR,
        "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE",
        "LAVRAS-MG",
        "2025",
      ]),
      page(2, [
        AUTHOR,
        "IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE FEDERAL NO ESTADO DE MINAS GERAIS",
        "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do título de Mestre.",
        "Orientador: Prof. Dr. Dany Flavio Tonelli",
        "LAVRAS-MG",
        "2025",
      ]),
    ], 3);

    expect(result.cover?.title).toBe("IMPLEMENTAÇÃO DO PROGRAMA DE GESTÃO E DESEMPENHO: ESTUDO EM UMA UNIVERSIDADE FEDERAL NO ESTADO DE MINAS GERAIS");
  });
});
