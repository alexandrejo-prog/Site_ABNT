import { describe, expect, it } from "vitest";
import {
  detectProgramConflict,
  detectAbstractTopicConflict,
  detectCpgForbiddenStructures,
  detectPlaceholderText,
  detectControlledPlaceholder,
  normalizeTextForMatch,
} from "../src/academic-guardrails";
import { validateWork, hasBlockingErrors } from "../src/validators";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";
import { consolidateImpactIndicators, hasSufficientImpactIndicators } from "../src/impact-indicators";
import { normalizeReferencesText } from "../src/references-normalizer";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { generateDocxBlob } from "../src/export-docx";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";

function ppgecaBase(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "resumo_expandido_cpg",
    author: "Ana Souza",
    title: "Práxis no estágio de docência: formação teórico-reflexiva e observação de práticas pedagógicas na formação de professores de Ciências e Biologia",
    program: "Programa de Pós-Graduação em Educação Científica e Ambiental",
    resumo: "Este trabalho aborda o estágio de docência e a formação de professores, com base na Pedagogia Histórico-Crítica, na formação de professores de Ciências e Biologia.",
    palavrasChave: "estágio; docência; ciências e biologia",
    abstractText: "This study addresses the teaching internship and teacher education based on the Historic-Critical Pedagogy, in the education of Science and Biology teachers.",
    keywords: "internship; teaching; science and biology",
    ...overrides,
  };
}

describe("PF1 - conflito PPGECA x Biologia", () => {
  it("PPGECA + título/resumo com Ciências e Biologia NÃO gera program-conflict", () => {
    expect(detectProgramConflict(ppgecaBase())).toBe(false);
    const issues = validateWork(ppgecaBase());
    expect(issues.find((i) => i.code === "program-conflict")).toBeUndefined();
  });

  it("PPGECA + resumo formação de professores de Ciências e Biologia sem program-conflict em validateWork", () => {
    const fields = ppgecaBase({ resumo: "Pesquisa a formação de professores de Ciências e Biologia no estágio de docência." });
    expect(detectProgramConflict(fields)).toBe(false);
  });

  it("PPGECA + workNature com Engenharia de Controle e Automação gera program-conflict", () => {
    const fields = ppgecaBase({ workType: "dissertacao", workNature: "Vinculado ao programa de Engenharia de Controle e Automacao." });
    expect(detectProgramConflict(fields)).toBe(true);
    expect(validateWork(fields).find((i) => i.code === "program-conflict")).toBeTruthy();
  });

  it("Programa de Engenharia de Controle e Automação + texto central de PPGECA gera program-conflict", () => {
    const fields: AcademicFields = {
      ...emptyAcademicFields(),
      workType: "dissertacao",
      program: "Programa de Pós-Graduação em Engenharia de Controle e Automação",
      resumo: "Estudo sobre estágio de docência e formação de professores de Ciências e Biologia.",
      title: "Educação Científica e Ambiental na práxis docente",
    };
    expect(detectProgramConflict(fields)).toBe(true);
  });

  it("Uso genérico de engenharia didática NÃO gera program-conflict", () => {
    const fields = ppgecaBase({ resumo: "Propõe uma engenharia didática para a formação de professores." });
    expect(detectProgramConflict(fields)).toBe(false);
  });

  it("editorText com Engenharia de Controle e Automação conta na análise", () => {
    const fields = ppgecaBase();
    expect(detectProgramConflict(fields, "Texto sobre Engenharia de Controle e Automação.")).toBe(true);
  });
});

describe("PF2 - placeholders bloqueiam o DOCX final", () => {
  it("detecta marcadores controlados [PREENCHER: ...]", () => {
    expect(detectControlledPlaceholder("[PREENCHER: metodologia]")).toBe(true);
    expect(detectControlledPlaceholder("[PREENCHER: indicadores de impacto]")).toBe(true);
    expect(detectControlledPlaceholder("[preencher: referências]")).toBe(true);
    expect(detectControlledPlaceholder("[INSERIR: introdução]")).toBe(true);
    expect(detectControlledPlaceholder("{{titulo}}")).toBe(false);
    expect(detectControlledPlaceholder("Texto real de impacto.")).toBe(false);
  });

  it("editorText com [PREENCHER: metodologia] gera error bloqueante", () => {
    const issues = validateWork(ppgecaBase(), "# 1 Introdução\nTexto.\n[PREENCHER: metodologia]");
    const error = issues.find((i) => i.code === "draft-placeholder-detected");
    expect(error).toBeTruthy();
    expect(error?.severity).toBe("error");
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it("editorText com [PREENCHER: referências] gera error", () => {
    const issues = validateWork(ppgecaBase(), "[PREENCHER: referências]");
    expect(issues.find((i) => i.code === "draft-placeholder-detected")).toBeTruthy();
  });

  it("campo auxiliar com texto real não gera erro de placeholder", () => {
    const issues = validateWork(ppgecaBase({ introducao: "Introdução real com conteúdo." }));
    expect(issues.find((i) => i.code === "draft-placeholder-detected")).toBeUndefined();
  });
});

describe("PF4 - indicadores de impacto com campos específicos", () => {
  function dissertacao(overrides: Partial<AcademicFields> = {}): AcademicFields {
    return {
      ...emptyAcademicFields(),
      workType: "dissertacao",
      author: "Maria Silva",
      title: "Título da pesquisa",
      advisor: "Prof. João Souza",
      resumo: "Resumo do trabalho.",
      palavrasChave: "a; b",
      abstractText: "Abstract text.",
      keywords: "a; b",
      introducao: "Introdução.",
      referencias: "SILVA, M. Livro. UFLA, 2024.",
      ...overrides,
    };
  }

  it("consolida texto a partir de campos específicos quando indicadoresImpacto vazio", () => {
    const fields = dissertacao({ impactoSocial: "Beneficia escolas públicas.", impactoCientifico: "Avança a pedagogia." });
    const consolidated = consolidateImpactIndicators(fields);
    expect(consolidated).toContain("Impacto social: Beneficia escolas públicas.");
    expect(consolidated).toContain("Impacto científico: Avança a pedagogia.");
  });

  it("dissertação com indicadoresImpacto vazio mas impactoSocial + impactoCientifico não gera impact-indicators-missing", () => {
    const issues = validateWork(dissertacao({ impactoSocial: "Beneficia escolas públicas.", impactoCientifico: "Avança a pedagogia." }));
    expect(issues.find((i) => i.code === "impact-indicators-missing")).toBeUndefined();
    expect(hasSufficientImpactIndicators(dissertacao({ impactoSocial: "x", impactoCientifico: "y" }))).toBe(true);
  });

  it("dissertação sem nenhum indicador gera impact-indicators-missing", () => {
    const issues = validateWork(dissertacao());
    expect(issues.find((i) => i.code === "impact-indicators-missing")?.severity).toBe("error");
    expect(hasSufficientImpactIndicators(dissertacao())).toBe(false);
  });

  it("monografia sem indicadores não gera erro", () => {
    const issues = validateWork(dissertacao({ workType: "monografia", indicadoresImpacto: "" }));
    expect(issues.find((i) => i.code === "impact-indicators-missing")).toBeUndefined();
  });

  it("DOCX contém impactoSocial e impactoCientifico e não contém [PREENCHER: indicadores de impacto]", async () => {
    const fields = dissertacao({ impactoSocial: "Beneficia escolas públicas.", impactoCientifico: "Avança a pedagogia." });
    const blob = await generateDocxBlob({ fields, editorText: "# 1 Introdução\nTexto." });
    const xml = extractCpgOrDocx(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("Beneficia escolas públicas.");
    expect(xml).toContain("Avança a pedagogia.");
    expect(xml).not.toContain("[PREENCHER: indicadores de impacto]");
  });
});

describe("PF5 - abstract incoerente também para CPG", () => {
  it("resumo_expandido_cpg com resumo de docência e abstract de agricultura gera abstract-topic-conflict", () => {
    const fields = ppgecaBase({ abstractText: "This study analyzes the transformative role of artificial intelligence in modern agriculture and crop farming." });
    const conflict = detectAbstractTopicConflict(fields);
    expect(conflict.conflict).toBe(true);
    const issues = validateWork(fields);
    expect(issues.find((i) => i.code === "abstract-topic-conflict")).toBeTruthy();
  });

  it("resumo_cpg com abstract coerente não gera abstract-topic-conflict", () => {
    const fields = { ...ppgecaBase(), workType: "resumo_cpg" as const };
    expect(detectAbstractTopicConflict(fields).conflict).toBe(false);
  });
});

describe("PF6 - CPG não aceita pré-textuais escondidos", () => {
  it("# SUMÁRIO em CPG gera cpg-forbidden-structure", () => {
    expect(detectCpgForbiddenStructures("# SUMÁRIO")).toContain("SUMÁRIO");
  });
  it("FICHA CATALOGRÁFICA: em CPG gera cpg-forbidden-structure", () => {
    expect(detectCpgForbiddenStructures("FICHA CATALOGRÁFICA:")).toContain("FICHA CATALOGRÁFICA");
  });
  it("2 SUMÁRIO e [SUMÁRIO] também detectam", () => {
    expect(detectCpgForbiddenStructures("2 SUMÁRIO")).toContain("SUMÁRIO");
    expect(detectCpgForbiddenStructures("[SUMÁRIO]")).toContain("SUMÁRIO");
  });
  it("frase comum com 'sumário dos resultados' não bloqueia", () => {
    expect(detectCpgForbiddenStructures("O sumário dos resultados indica crescimento.")).not.toContain("SUMÁRIO");
  });
});

describe("PF7 - referências com títulos soltos e acentos", () => {
  it("ignore variantes de título de referência", () => {
    const variants = [
      "REFERÊNCIAS",
      "REFERENCIAS",
      "BIBLIOGRÁFICAS",
      "BIBLIOGRAFICAS",
      "REFERÊNCIAS BIBLIOGRÁFICAS",
      "REFERENCIAS BIBLIOGRAFICAS",
      "Referências bibliográficas",
      "REFERÊNCIAS:",
      "BIBLIOGRÁFICAS:",
      "# REFERÊNCIAS",
    ];
    for (const v of variants) {
      const result = normalizeReferencesText(`${v}\nSILVA, M. Livro de teste. Lavras: UFLA, 2024.`);
      expect(result, `variante: ${v}`).toHaveLength(1);
      expect(result[0].text).toContain("SILVA, M. Livro de teste");
    }
  });
});

describe("PF8 - normalização de acentos e regex", () => {
  it("normaliza corretamente sem corromper", () => {
    expect(normalizeTextForMatch("Educação Científica e Ambiental")).toBe("educacao cientifica e ambiental");
    expect(normalizeTextForMatch("Ciências e Biologia")).toBe("ciencias e biologia");
    expect(normalizeTextForMatch("Pós-Graduação")).toBe("pos-graduacao");
  });
  it("detectPlaceholderText usa regex explícita sem corromper", () => {
    expect(detectPlaceholderText("Texto real.")).toBe(false);
  });
});

describe("PF13 - regressão com caso real de resumo expandido", () => {
  it("caso real coerente passa sem conflitos e gera DOCX na ordem Resumo/Palavras-chave/Abstract/Keywords", async () => {
    const issues = validateWork(ppgecaBase());
    expect(issues.find((i) => i.code === "program-conflict")).toBeUndefined();
    expect(issues.find((i) => i.code === "abstract-topic-conflict")).toBeUndefined();
    expect(issues.find((i) => i.code === "cpg-forbidden-structure")).toBeUndefined();

    const blob = await generateCpgDocxBlob({ fields: ppgecaBase(), editorText: "# 1 Introdução\nTexto.\n# 4 Conclusão\nConclusão." });
    const xml = extractCpgOrDocx(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain("FICHA CATALOGR");
    expect(xml).not.toContain("FOLHA DE ROSTO");
    expect(xml).not.toContain("SUMÁRIO");
    const r = xml.indexOf("Resumo");
    const pk = xml.indexOf("Palavras-chave");
    const a = xml.indexOf("Abstract");
    const k = xml.indexOf("Keywords");
    expect(r).toBeGreaterThan(-1);
    expect(pk).toBeGreaterThan(r);
    expect(a).toBeGreaterThan(pk);
    expect(k).toBeGreaterThan(a);
  });

  it("mesmo título/resumo mas abstract sobre agriculture gera abstract-topic-conflict", () => {
    const fields = ppgecaBase({ abstractText: "This paper studies crop farming, agriculture yields and soil management in modern agriculture." });
    expect(validateWork(fields).find((i) => i.code === "abstract-topic-conflict")).toBeTruthy();
  });
});

describe("PF3 - campos guiados não poluem a tela (teste estático)", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const sidebarSource = readFileSync(new URL("../src/components/ValidationSidebar.tsx", import.meta.url), "utf8");
  const source = `${appSource}\n${sidebarSource}`;
  it("App contém o título correto e aviso de rascunho editável", () => {
    expect(source).toContain("Assistente de estruturação e normalização acadêmica");
    expect(source).toContain("O DOCX é rascunho técnico");
    expect(source).toContain("devem ser conferidos no Word/LibreOffice");
  });
  it("assistedMode controla exibição dos campos guiados", () => {
    expect(source).toMatch(/assistedMode && ASSISTED_FIELD_KEYS\.includes\(key\)/);
  });
  it("campos específicos de indicador não aparecem na listagem geral (visível apenas no mini-formulário)", () => {
    expect(source).toMatch(/indicatorSpecificKeys\.includes\(key\)[\s\S]*?return false;/);
    expect(source).toContain('"impactoSocial", "impactoCientifico", "impactoEducacional", "impactoAmbiental", "impactoTecnologico", "publicoBeneficiado", "aderenciaOds"');
  });
  it("não usa 'Gerar mesmo assim' sem qualificação", () => {
    expect(source).toContain("Gerar rascunho mesmo com pendências");
    expect(source).not.toMatch(/>Gerar mesmo assim</);
  });
});

// Utilitário compartilhado de extração de ZIP (DOCX).
function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}
function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}
function extractCpgOrDocx(buffer: Buffer, fileName: string): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (readUInt32(buffer, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === fileName) {
      const data = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compactacao nao suportada: ${compression}.`);
    }
    offset = dataEnd;
  }
  throw new Error(`Arquivo nao encontrado no DOCX: ${fileName}.`);
}
