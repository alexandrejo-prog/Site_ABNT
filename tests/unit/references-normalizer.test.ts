import { describe, expect, it } from "vitest";
import { normalizeReference, normalizeReferences, normalizeReferencesText, type NormalizedReference } from "../../src/references-normalizer";
import { UFLA_MANUAL_REFERENCE } from "../../src/ufla-rules";

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

  it("normaliza separador de tese/dissertacao para travessao", () => {
    const normalized = normalizeReference(
      "SOUSA, Jennifer Caroline de. A Biologia do Conhecer na Educação: interlocuções com a Pedagogia Libertadora. 2023. 257 p. Tese (Doutorado em Educação) - Faculdade de Educação, Universidade de São Paulo, São Paulo, 2023.",
    );
    expect(normalized.text).toContain("Tese (Doutorado em Educação) – Faculdade de Educação");
    expect(normalized.text).not.toContain("Tese (Doutorado em Educação) - Faculdade de Educação");
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

  it("detecta capitulo e destaca titulo da obra apos In", () => {
    expectDetectedBold(
      "FREIRE, Paulo. Educação e mudança. In: GADOTTI, Moacir. Educação popular e transformação social. São Paulo: Cortez, 2019. p. 10-25.",
      "capitulo",
      "Educação popular e transformação social",
    );
  });

  it("detecta legislacao e destaca o ato normativo", () => {
    expectDetectedBold(
      "BRASIL. Lei nº 9.394, de 20 de dezembro de 1996. Estabelece as diretrizes e bases da educação nacional. Brasília, DF, 1996.",
      "legislacao",
      "Lei nº 9.394, de 20 de dezembro de 1996",
    );
  });

  it("preserva inicio de referencia normativa quebrada antes do ano", () => {
    const [normalized] = normalizeReferencesText(
      "BRASIL. Decreto nº 1.590, de 10 de agosto de\n1995. Seção 1. Dispõe sobre a jornada de trabalho.",
    );

    expect(normalized.text).toContain("BRASIL. Decreto nº 1.590");
    expect(normalized.text.indexOf("BRASIL.")).toBeLessThan(normalized.text.indexOf("1995. Seção 1."));
  });

  it("nao deixa fragmento de ano iniciar referencias quando ato normativo vem na linha seguinte", () => {
    const normalized = normalizeReferencesText(
      "1995. Secao 1.\nBRASIL. Decreto n. 1.590, de 10 de agosto de\nSILVA, M. Livro comum. Lavras: UFLA, 2024.",
    );

    expect(normalized[0].text).toBe("BRASIL. Decreto n. 1.590, de 10 de agosto de 1995. Secao 1.");
    expect(normalized[0].text).not.toMatch(/^1995\. Secao 1\./);
    expect(normalized[0].text.indexOf("BRASIL.")).toBeLessThan(normalized[0].text.indexOf("1995"));
    expect(normalized[1].text).toBe("SILVA, M. Livro comum. Lavras: UFLA, 2024.");
  });

  it("mantem referencias normais com autores pessoais", () => {
    const normalized = normalizeReferencesText(
      "SILVA, M. Livro comum. Lavras: UFLA, 2024.\nSOUZA, A. Outro livro. Sao Paulo: Exemplo, 2020.",
    );

    expect(normalized.map((reference) => reference.text)).toEqual([
      "SILVA, M. Livro comum. Lavras: UFLA, 2024.",
      "SOUZA, A. Outro livro. Sao Paulo: Exemplo, 2020.",
    ]);
  });

  it("descarta fragmento orfao iniciado por ano", () => {
    const normalized = normalizeReferencesText(
      "1995. Secao 1.\nSILVA, M. Livro comum. Lavras: UFLA, 2024.",
    );

    expect(normalized.map((reference) => reference.text)).toEqual([
      "SILVA, M. Livro comum. Lavras: UFLA, 2024.",
    ]);
  });

  it("mescla fragmento de ano mesmo quando referencias chegam em paragrafos separados", () => {
    const normalized = normalizeReferences([
      "BRASIL. Decreto n. 1.590, de 10 de agosto de",
      "1995. Secao 1.",
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].text).toBe("BRASIL. Decreto n. 1.590, de 10 de agosto de 1995. Secao 1.");
  });

  it("detecta legislacao com orgao intermediario e destaca a resolucao", () => {
    expectDetectedBold(
      "BRASIL. Conselho Nacional de Saúde. Resolução nº 510, de 7 de abril de 2016. Dispõe sobre as normas aplicáveis a pesquisas em Ciências Humanas e Sociais. Brasília, DF: Conselho Nacional de Saúde, 2016.",
      "legislacao",
      "Resolução nº 510, de 7 de abril de 2016",
    );
  });

  it("detecta instrucao normativa conjunta e destaca o ato normativo", () => {
    expectDetectedBold(
      "BRASIL. Instrução Normativa Conjunta SGP-SRT-SEGES/MGI nº 24, de 28 de julho de 2023. Estabelece orientações a serem observadas pelos órgãos e entidades integrantes do SIPEC e do SIORG relativas à implementação e execução do Programa de Gestão e Desempenho. Brasília, DF, 2023.",
      "legislacao",
      "Instrução Normativa Conjunta SGP-SRT-SEGES/MGI nº 24, de 28 de julho de 2023",
    );
  });

  it("detecta documento institucional e destaca titulo apos autor institucional", () => {
    expectDetectedBold(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Programa de Pós-Graduação em Educação Científica e Ambiental. Lavras: UFLA, 2026.",
      "documento-institucional",
      "Programa de Pós-Graduação em Educação Científica e Ambiental",
    );
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
    expect(normalized.text).toContain("Disponível em: https://exemplo.test/artigo");
    expect(normalized.text).toContain("Acesso em: 10 jan. 2026");
  });

  it("normaliza DOI com URL doi.org para DOI limpo", () => {
    const normalized = normalizeReference(
      "SILVA, M. Artigo com DOI. Revista Aberta, Lavras, v. 1, n. 2, p. 1-9, 2024. DOI: https://doi.org/10.1234/exemplo.",
    );
    expect(normalized.text).toContain("DOI: 10.1234/exemplo");
    expect(normalized.text).not.toContain("doi.org/10.1234/exemplo");
  });

  it("normaliza URL em markdown para Disponível em", () => {
    const normalized = normalizeReference(
      "SILVA, M. Página institucional. Lavras: UFLA, 2024. [https://ufla.br/pagina](https://ufla.br/pagina). Acesso em: 10 jan. 2026.",
    );
    expect(normalized.text).toContain("Disponível em: https://ufla.br/pagina");
    expect(normalized.text).not.toContain("[");
    expect(normalized.text).not.toContain("](");
  });

  it("normaliza URL bruta entre sinais para Disponível em", () => {
    const normalized = normalizeReference(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Página institucional. Lavras: UFLA, 2024. <https://ufla.br/pagina>. Acesso em: 10 jan. 2026.",
    );
    expect(normalized.text).toContain("Disponível em: https://ufla.br/pagina");
    expect(normalized.text).not.toContain("<https://ufla.br/pagina>");
  });

  it("referencia canonica do Manual UFLA esta na 6. ed. rev., atual. e ampl. (2025)", () => {
    expect(UFLA_MANUAL_REFERENCE).toContain("Manual de normalização e estrutura de trabalhos acadêmicos");
    expect(UFLA_MANUAL_REFERENCE).toContain("6. ed. rev., atual. e ampl.");
    expect(UFLA_MANUAL_REFERENCE).toContain("Lavras: UFLA, 2025.");
  });

  it("normaliza a referencia do Manual UFLA com destaque de titulo", () => {
    const normalized = normalizeReference(UFLA_MANUAL_REFERENCE);
    expect(normalized.text).toContain("UNIVERSIDADE FEDERAL DE LAVRAS");
    expect(normalized.text).toContain("Lavras: UFLA, 2025.");
    expect(normalized.detectedHighlight).toBeTruthy();
    const highlightRun = normalized.runs.find((run) => run.text === normalized.detectedHighlight);
    expect(highlightRun?.bold).toBe(true);
  });

  it("normaliza referencia do Manual UFLA de 2024 para 6. ed. 2025", () => {
    const normalized = normalizeReference("Manual de normalização e estrutura de trabalhos acadêmicos. Lavras: UFLA, 2024.");
    expect(normalized.text).toContain("Lavras: UFLA, 2025.");
    expect(normalized.text).toContain("6. ed. rev., atual. e ampl.");
    expect(normalized.detectedHighlight).toContain("Manual de normalização e estrutura de trabalhos acadêmicos");
    expect(normalized.text).not.toContain("Lavras: UFLA, 2024.");
  });

  it("nao altera referencia comum que mencione UFLA e 2024", () => {
    const normalized = normalizeReference("SILVA, M. Livro comum. Lavras: UFLA, 2024.");
    expect(normalized.text).toContain("Lavras: UFLA, 2024.");
    expect(normalized.text).not.toContain("6. ed. rev., atual. e ampl.");
  });

  it("normaliza DOI cru para forma limpa", () => {
    const normalized = normalizeReference("SILVA, M. Artigo. Revista Aberta, Lavras, v. 1, n. 2, p. 1-9, 2024. DOI: https://doi.org/10.1234/exemplo.");
    expect(normalized.text).toContain("DOI: 10.1234/exemplo");
    expect(normalized.text).not.toContain("doi.org/10.1234/exemplo");
  });

  it("limpa URL em markdown para Disponivel em", () => {
    const normalized = normalizeReference("SILVA, M. Página institucional. Lavras: UFLA, 2024. [https://ufla.br/pagina](https://ufla.br/pagina). Acesso em: 10 jan. 2026.");
    expect(normalized.text).toContain("Disponível em: https://ufla.br/pagina");
    expect(normalized.text).not.toContain("[");
    expect(normalized.text).not.toContain("](");
  });

  it("preserva autor institucional em caixa alta", () => {
    const normalized = normalizeReference("UNIVERSIDADE FEDERAL DE LAVRAS. Programa de Pós-Graduação em Educação Científica e Ambiental. Lavras: UFLA, 2026.");
    expect(normalized.text).toContain("UNIVERSIDADE FEDERAL DE LAVRAS");
    expect(normalized.detectedType).toBe("documento-institucional");
  });

  it("detecta trabalho apresentado em evento (anais de congresso)", () => {
    expectDetectedBold(
      "SOUZA, A. B. Impactos da IA na educação. In: SIMPÓSIO NACIONAL DE TECNOLOGIA EDUCACIONAL, 12., 2026, Lavras. Anais... Lavras: UFLA, 2026. p. 88-92.",
      "evento",
      "SIMPÓSIO NACIONAL DE TECNOLOGIA EDUCACIONAL",
    );
  });
});
