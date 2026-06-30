import { describe, expect, it } from "vitest";
import { normalizeReference, type NormalizedReference } from "../src/references-normalizer";

function boldRunFor(reference: NormalizedReference, text: string) {
  return reference.runs.find((run) => run.text === text && run.bold);
}

function runContaining(reference: NormalizedReference, text: string) {
  return reference.runs.find((run) => run.text.includes(text));
}

function expectDetectedBold(referenceText: string, type: NormalizedReference["detectedType"], highlight: string) {
  const normalized = normalizeReference(referenceText);
  expect(normalized.detectedType).toBe(type);
  expect(normalized.detectedHighlight).toBe(highlight);
  expect(boldRunFor(normalized, highlight)).toBeTruthy();
  expect(runContaining(normalized, referenceText.split(".")[0])?.bold).not.toBe(true);
  return normalized;
}

describe("references normalizer", () => {
  it("detecta livro de Saviani e destaca titulo com subtitulo", () => {
    expectDetectedBold(
      "SAVIANI, Dermeval. Pedagogia histórico-crítica: primeiras aproximações. Campinas, SP: Autores Associados, 2007.",
      "livro",
      "Pedagogia histórico-crítica: primeiras aproximações",
    );
  });

  it("detecta livro de Seligmann-Silva e preserva subtitulo", () => {
    expectDetectedBold(
      "SELIGMANN-SILVA, Edith. Trabalho e desgaste mental: o direito de ser dono de si mesmo. São Paulo: Cortez, 2011.",
      "livro",
      "Trabalho e desgaste mental: o direito de ser dono de si mesmo",
    );
  });

  it("detecta livro com autor Junior sem confundir autoria com titulo", () => {
    expectDetectedBold(
      "SGUISSARDI, Valdemar; SILVA JÚNIOR, João dos Reis. Trabalho intensificado nas federais: pós-graduação e produtivismo acadêmico. São Paulo: Xamã, 2009.",
      "livro",
      "Trabalho intensificado nas federais: pós-graduação e produtivismo acadêmico",
    );
  });

  it("detecta tese ou dissertacao e destaca titulo antes do ano e paginacao", () => {
    expectDetectedBold(
      "SOUSA, Jennifer Caroline de. A Biologia do Conhecer na Educação: interlocuções com a Pedagogia Libertadora. 2023. 257 p. Tese (Doutorado em Educação) - Faculdade de Educação, Universidade de São Paulo, São Paulo, 2023.",
      "tese-dissertacao",
      "A Biologia do Conhecer na Educação: interlocuções com a Pedagogia Libertadora",
    );
  });

  it("detecta artigo e destaca periodico com sigla pontuada", () => {
    expectDetectedBold(
      "TESSARINI JUNIOR, Geraldo; SALTORATO, Patrícia. Organização do trabalho dos servidores técnico-administrativos em uma instituição federal de ensino: uma abordagem sobre carreira, tarefas e relações interpessoais. Cadernos EBAPE.BR, Rio de Janeiro, v. 19, n. esp., p. 811-823, 2021.",
      "artigo",
      "Cadernos EBAPE.BR",
    );
  });

  it("detecta artigo e destaca nome do periodico", () => {
    expectDetectedBold(
      "TOZONI-REIS, Marília Freitas de Campos. Temas ambientais como temas geradores: contribuições para uma metodologia educativa ambiental crítica, transformadora e emancipatória. Educar em Revista, Curitiba, n. 27, p. 93-110, 2006.",
      "artigo",
      "Educar em Revista",
    );
  });

  it("preserva legislacao sem destaque automatico quando ha baixa confianca", () => {
    const normalized = normalizeReference(
      "BRASIL. Lei nº 9.394, de 20 de dezembro de 1996. Estabelece as diretrizes e bases da educação nacional. Brasília, DF, 1996.",
    );
    expect(normalized.detectedType).toBe("legislacao");
    expect(normalized.detectedHighlight).toBeUndefined();
    expect(normalized.runs.some((run) => run.bold)).toBe(false);
    expect(normalized.warnings.some((warning) => warning.includes("normativa preservada"))).toBe(true);
  });

  it("preserva marcacao manual em negrito sem aplicar destaque conflitante", () => {
    const normalized = normalizeReference("SILVA, M. **Titulo manual**. Lavras: UFLA, 2024.");
    expect(normalized.text).toBe("SILVA, M. Titulo manual. Lavras: UFLA, 2024.");
    expect(normalized.detectedHighlight).toBe("Titulo manual");
    expect(boldRunFor(normalized, "Titulo manual")).toBeTruthy();
    expect(runContaining(normalized, "SILVA, M.")?.bold).not.toBe(true);
  });

  it("preserva marcacao manual em italico", () => {
    const normalized = normalizeReference("SILVA, M. *Revista Manual*. Lavras: UFLA, 2024.");
    const manualRun = normalized.runs.find((run) => run.text === "Revista Manual");
    expect(manualRun?.italics).toBe(true);
    expect(manualRun?.bold).not.toBe(true);
  });

  it("aplica italico em et al. automaticamente", () => {
    const normalized = normalizeReference("SILVA, M. et al. Pesquisa coletiva. Lavras: UFLA, 2024.");
    const etAlRun = normalized.runs.find((run) => run.text.toLowerCase() === "et al.");
    expect(etAlRun?.italics).toBe(true);
    expect(normalized.detectedHighlight).toBe("Pesquisa coletiva");
  });

  it("preserva DOI, URL e Acesso em", () => {
    const normalized = normalizeReference(
      "SILVA, M. Artigo com DOI. Revista Aberta, Lavras, v. 1, n. 2, p. 1-9, 2024. DOI: 10.1234/exemplo. Disponivel em: https://exemplo.test/artigo. Acesso em: 10 jan. 2026.",
    );
    expect(normalized.text).toContain("DOI: 10.1234/exemplo");
    expect(normalized.text).toContain("https://exemplo.test/artigo");
    expect(normalized.text).toContain("Acesso em: 10 jan. 2026");
  });
});
