import { describe, it, expect } from "vitest";
import { detectPdfPretextual } from "../src/pdf-pretextual-diagnostic";
import type { PdfPageDiagnostic, PdfLineDiagnostic } from "../src/imported-pdf-diagnostic";

const PAGE_WIDTH = 595;

interface LineSpec {
  text: string;
  centered?: boolean;
}

function buildPage(pageNumber: number, specs: LineSpec[]): PdfPageDiagnostic {
  const lines: PdfLineDiagnostic[] = specs.map((spec, index) => {
    const approxWidth = Math.max(20, spec.text.length * 5);
    const left = spec.centered ? PAGE_WIDTH / 2 - approxWidth / 2 : 60;
    return {
      pageNumber,
      text: spec.text,
      items: [],
      left,
      right: left + approxWidth,
      top: 120 + index * 14,
      bottom: 120 + index * 14 + 11,
      height: 11,
    };
  });
  return {
    pageNumber,
    width: PAGE_WIDTH,
    height: 842,
    rotation: 0,
    rawText: specs.map((spec) => spec.text).join(" "),
    textItemCount: specs.length,
    items: [],
    lines,
  };
}

function titlePage(...specs: LineSpec[]): PdfPageDiagnostic[] {
  return [buildPage(2, specs)];
}

function combined(pre: ReturnType<typeof detectPdfPretextual>["titlePage"]): string {
  return [pre?.natureText, pre?.program, pre?.advisor].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

describe("diagnóstico pretextual: folha de rosto sem duplicação de natureza/orientador", () => {
  it("não repete a natureza nem anexa o orientador ao programa (caso Andrade)", () => {
    const pages = titlePage(
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
    );

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.natureText).toContain("Dissertação apresentada à Universidade Federal de Lavras");
    expect(pre?.natureText).toContain("para a obtenção do título de Mestre.");
    expect(pre?.natureText).not.toContain("Prof. Dr. Dany Flavio Tonelli");
    expect(pre?.advisor).toBe("Prof. Dr. Dany Flavio Tonelli");
    expect(pre?.advisor).not.toContain("Orientador");
    // O nome do orientador aparece uma única vez (no campo advisor), não anexado à natureza/programa.
    expect((combined(pre).match(/Prof\.\s*Dr\.\s*Dany Flavio Tonelli/g) ?? []).length).toBe(1);
    if (pre?.program) {
      expect(pre.program).not.toContain("Prof. Dr. Dany Flavio Tonelli");
      expect(pre.program).not.toContain("Orientador");
    }
    expect(pre?.city).toBe("LAVRAS-MG");
    expect(pre?.year).toBe("2025");
  });

  it("orientador em linha própria ANTES do rótulo é capturado sem o rótulo", () => {
    const pages = titlePage(
      { text: "AUTOR TESTE", centered: true },
      { text: "TÍTULO DO TRABALHO", centered: true },
      { text: "Dissertação apresentada à Universidade, para a obtenção do título de Mestre." },
      { text: "do Programa de Pós-Graduação em Administração." },
      { text: "Prof. Dr. Maria Souza" },
      { text: "Orientadora" },
      { text: "LAVRAS-MG", centered: true },
      { text: "2024", centered: true },
    );

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toBe("Prof. Dr. Maria Souza");
    expect(pre?.advisor).not.toContain("Orientador");
    expect(pre?.natureText).not.toContain("Prof. Dr. Maria Souza");
    // O programa, se presente, não deve conter o nome do orientador.
    if (pre?.program) {
      expect(pre.program).not.toContain("Prof. Dr. Maria Souza");
      expect(pre.program).not.toContain("Orientador");
    }
  });

  it("orientador DEPOIS do rótulo na mesma linha (Orientador: Nome) tem o rótulo removido", () => {
    const pages = titlePage(
      { text: "AUTOR TESTE", centered: true },
      { text: "TÍTULO DO TRABALHO", centered: true },
      { text: "Dissertação apresentada à Universidade, para a obtenção do título de Mestre." },
      { text: "Programa de Pós-Graduação em Engenharia." },
      { text: "Área de Concentração: Recursos Hídricos." },
      { text: "Orientador: Prof. Dr. João Silva" },
      { text: "Cidade", centered: true },
      { text: "2024", centered: true },
    );

    const pre = detectPdfPretextual(pages).titlePage;
    const text = combined(pre);

    expect(pre?.advisor).toBe("Prof. Dr. João Silva");
    expect(pre?.advisor).not.toContain("Orientador");
    expect(pre?.natureText).not.toContain("Prof. Dr. João Silva");
    // O programa legítimo aparece uma única vez (na natureza ou no programa) e o orientador não se repete.
    expect(text).toContain("Programa de Pós-Graduação em Engenharia");
    expect(text).toContain("Área de Concentração: Recursos Hídricos");
    expect((text.match(/Prof\.\s*Dr\.\s*João Silva/g) ?? []).length).toBe(1);
  });

  it("programa legítimo distinto da natureza é preservado sem repetir o orientador", () => {
    const pages = titlePage(
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Tese apresentada à Universidade, para obtenção do título de Doutor." },
      { text: "Programa de Pós-Graduação em Ciência da Computação." },
      { text: "Orientador: Prof. Dr. Carlos Lima" },
      { text: "Cidade", centered: true },
      { text: "2023", centered: true },
    );

    const pre = detectPdfPretextual(pages).titlePage;
    const text = combined(pre);

    expect(pre?.advisor).toBe("Prof. Dr. Carlos Lima");
    expect(pre?.advisor).not.toContain("Orientador");
    expect(text).toContain("Programa de Pós-Graduação em Ciência da Computação");
    expect((text.match(/Prof\.\s*Dr\.\s*Carlos Lima/g) ?? []).length).toBe(1);
  });

  it("cidade e ano não entram na natureza nem no orientador", () => {
    const pages = titlePage(
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade, para obtenção do título de Mestre." },
      { text: "Prof. Dr. Ana Costa" },
      { text: "Orientadora" },
      { text: "BELO HORIZONTE-MG", centered: true },
      { text: "2022", centered: true },
    );

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.natureText).not.toContain("BELO HORIZONTE");
    expect(pre?.natureText).not.toContain("2022");
    expect(pre?.advisor).not.toContain("BELO HORIZONTE");
    expect(pre?.advisor).not.toContain("2022");
    expect(pre?.city).toBe("BELO HORIZONTE-MG");
    expect(pre?.year).toBe("2022");
  });

  it("nome do orientador aparece uma única vez (no campo advisor, não na natureza)", () => {
    const pages = titlePage(
      { text: "AUTOR", centered: true },
      { text: "TÍTULO", centered: true },
      { text: "Dissertação apresentada à Universidade, para obtenção do título de Mestre." },
      { text: "Prof. Dr. Pedro Alves" },
      { text: "Orientador" },
      { text: "Cidade", centered: true },
      { text: "2021", centered: true },
    );

    const pre = detectPdfPretextual(pages).titlePage;

    expect(pre?.advisor).toBe("Prof. Dr. Pedro Alves");
    const occurrences = (combined(pre).match(/Prof\.\s*Dr\.\s*Pedro Alves/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
