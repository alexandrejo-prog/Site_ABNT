import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../src/ufla-rules";
import { validateWork } from "../src/validators";
import { detectPlaceholderText, detectProgramConflict, detectAbstractTopicConflict, detectCpgForbiddenStructures } from "../src/academic-guardrails";
import { normalizeReferencesText } from "../src/references-normalizer";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Ensino de biologia no ensino médio",
    location: "Lavras - MG",
    year: "2026",
    advisor: "Prof. João Souza",
    resumo: "Este trabalho investiga a docência de biologia e avalia práticas pedagógicas em escolas.",
    palavrasChave: "biologia; ensino; docência",
    abstractText: "This study investigates biology teaching and evaluates pedagogical practices in schools.",
    keywords: "biology; teaching; pedagogy",
    introducao: "Texto da introdução.",
    referencias: "SILVA, M. Livro de teste. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("Rodada 1 - detecção de placeholders", () => {
  it("detecta placeholder em valor", () => {
    expect(detectPlaceholderText("[nome do orientador]")).toBe(true);
    expect(detectPlaceholderText("[preencher]")).toBe(true);
    expect(detectPlaceholderText("[insira aqui]")).toBe(true);
    expect(detectPlaceholderText("{{titulo}}")).toBe(true);
    expect(detectPlaceholderText("{{autor}}")).toBe(true);
    expect(detectPlaceholderText("<preencher>")).toBe(true);
    expect(detectPlaceholderText("lorem ipsum")).toBe(true);
    expect(detectPlaceholderText("O relato dos impactos deve ser inserido")).toBe(true);
    expect(detectPlaceholderText("Texto a ser preenchido")).toBe(true);
    expect(detectPlaceholderText("Insira o texto")).toBe(true);
    expect(detectPlaceholderText("Digite aqui")).toBe(true);
  });

  it("não detecta placeholder em texto real", () => {
    expect(detectPlaceholderText("Maria Silva de Oliveira")).toBe(false);
    expect(detectPlaceholderText("")).toBe(false);
  });

  it("validator gera error de placeholder em campo crítico", () => {
    const issues = validateWork(baseFields({ title: "[preencher título]" }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "placeholder-detected" }));
  });

  it("validator gera warning de placeholder em campo auxiliar", () => {
    const issues = validateWork(baseFields({ agradecimentos: "Digite aqui seus agradecimentos" }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "placeholder-detected" }));
  });
});

describe("Rodada 1 - conflito de programa/área", () => {
  it("detecta conflito entre programa e texto", () => {
    expect(
      detectProgramConflict(
        baseFields({ program: "PPGECA", resumo: "Trabalho sobre Engenharia de Controle e Automação." }),
      ),
    ).toBe(true);
  });

  it("não detecta conflito quando consistente", () => {
    expect(
      detectProgramConflict(
        baseFields({ program: "PPGECA", title: "Educação ambiental em Lavras", resumo: "Trabalho sobre Educação Científica e Ambiental." }),
      ),
    ).toBe(false);
  });

  it("validator gera error program-conflict", () => {
    const issues = validateWork(baseFields({ program: "PPGECA", resumo: "Pesquisa em Engenharia de Controle e Automação." }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "program-conflict" }));
  });
});

describe("Rodada 1 - abstract incompatível", () => {
  it("detecta caso gritante de abstract de agricultura em trabalho de docência", () => {
    const result = detectAbstractTopicConflict(
      baseFields({
        title: "Docência de biologia no ensino médio",
        resumo: "Este trabalho investiga a docência de biologia e avalia práticas pedagógicas em escolas de ensino médio.",
        abstractText: "This study analyzes the transformative role of artificial intelligence in modern agriculture and crop farming yields.",
      }),
    );
    expect(result.conflict).toBe(true);
    expect(result.severity).toBe("error");
  });

  it("não detecta conflito quando abstract corresponde ao resumo", () => {
    const result = detectAbstractTopicConflict(baseFields());
    expect(result.conflict).toBe(false);
  });

  it("validator gera abstract-topic-conflict em caso gritante", () => {
    const issues = validateWork(
      baseFields({
        title: "Docência de biologia no ensino médio",
        resumo: "Este trabalho investiga a docência de biologia e avalia práticas pedagógicas em escolas de ensino médio.",
        abstractText: "This study analyzes the transformative role of artificial intelligence in modern agriculture and crop farming yields.",
      }),
    );
    expect(issues).toContainEqual(expect.objectContaining({ code: "abstract-topic-conflict" }));
  });
});

describe("Rodada 1 - referências ignoram títulos soltos", () => {
  it("ignora REFERÊNCIAS, BIBLIOGRÁFICAS e variações", () => {
    const normalized = normalizeReferencesText(
      [
        "REFERÊNCIAS",
        "BIBLIOGRÁFICAS",
        "REFERENCIAS BIBLIOGRAFICAS",
        "SILVA, M. Livro de teste. Lavras: UFLA, 2024.",
      ].join("\n"),
    );
    expect(normalized).toHaveLength(1);
    expect(normalized[0].text).toContain("SILVA, M. Livro de teste");
  });

  it("não gera alerta de referência curta/sem ano para título solto", () => {
    const normalized = normalizeReferencesText("BIBLIOGRAFICAS\nSILVA, M. Livro de teste. Lavras: UFLA, 2024.");
    expect(normalized).toHaveLength(1);
    expect(normalized[0].warnings).not.toContain("missing year");
  });
});

describe("Rodada 1 - CPG bloqueia estruturas indevidas", () => {
  it("detecta capa, sumário e ficha no editor CPG", () => {
    const found = detectCpgForbiddenStructures("SUMÁRIO\nFICHA CATALOGRÁFICA\nTexto.");
    expect(found.length).toBeGreaterThan(0);
  });

  it("validator gera error cpg-forbidden-structure", () => {
    const issues = validateWork(baseFields({ workType: "resumo_expandido_cpg" }), "SUMÁRIO\nTexto do resumo expandido aqui.");
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "cpg-forbidden-structure" }));
  });
});

describe("Rodada 1 - troca de workType remove issue work-type-required", () => {
  it("validateWork não emite work-type-required quando há tipo", () => {
    const issues = validateWork(baseFields({ workType: "monografia" }));
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "work-type-required" }));
  });

  it("validateWork emite work-type-required quando vazio", () => {
    const issues = validateWork(baseFields({ workType: "" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "work-type-required" }));
  });
});
