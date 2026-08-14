import { describe, expect, it } from "vitest";
import {
  detectAbstractTopicConflict,
  detectCpgForbiddenStructures,
  detectGenericAiLikeText,
  detectNaturalPlaceholder,
  detectPlaceholderText,
  detectProgramConflict,
} from "../../src/academic-guardrails";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { UFLA_PPG_PROGRAMS } from "../../src/ufla-ppg-programs";

describe("academic guardrails - texto generico de IA", () => {
  it("'É importante ressaltar que' sozinho não dispara generic-ai-like-text", () => {
    const text =
      "É importante ressaltar que a educação ambiental crítica contribui para a formação cidadã dos estudantes.";
    expect(detectGenericAiLikeText(text)).toBe(false);
  });

  it("texto com múltiplos clichês ainda dispara generic-ai-like-text", () => {
    const text =
      "No mundo atual, este estudo aborda diversos aspectos e busca contribuir significativamente para a área.";
    expect(detectGenericAiLikeText(text)).toBe(true);
  });
});

describe("academic guardrails - placeholder natural", () => {
  it("detecta 'grau acadêmico correspondente'", () => {
    expect(detectNaturalPlaceholder("Monografia com grau acadêmico correspondente.")).toBe(true);
  });

  it("detecta 'informado pelo usuário'", () => {
    expect(detectNaturalPlaceholder("curso de graduação informado pelo usuário")).toBe(true);
  });

  it("detecta 'Programa de Pós-Graduação informado pelo usuário'", () => {
    expect(detectNaturalPlaceholder("Programa de Pós-Graduação informado pelo usuário")).toBe(true);
  });

  it("texto normal não detecta placeholder natural", () => {
    expect(detectNaturalPlaceholder("Programa de Pós-Graduação em Educação Científica e Ambiental")).toBe(false);
  });
});

describe("academic guardrails - placeholder explícito", () => {
  it("detecta marcadores controlados", () => {
    expect(detectPlaceholderText("[PREENCHER: título]")).toBe(true);
    expect(detectPlaceholderText("{{preencher}}")).toBe(true);
    expect(detectPlaceholderText("<preencher>")).toBe(true);
    expect(detectPlaceholderText("lorem ipsum")).toBe(true);
  });
});

describe("academic guardrails - conflito de programa", () => {
  it("PPGECA + Ciências e Biologia não gera conflito", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(detectProgramConflict(fields, "Este trabalho aborda ciências e biologia.")).toBe(false);
  });

  it("PPGECA + Engenharia de Controle e Automação gera conflito", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(detectProgramConflict(fields, "Comparado com a Engenharia de Controle e Automação.")).toBe(true);
  });

  it("reconhece programa real da lista UFLA com contexto institucional", () => {
    const fields = { ...emptyAcademicFields(), program: "Ciência do Solo" };
    expect(detectProgramConflict(fields, "Texto vinculado ao Programa de Pós-Graduação em Educação Física.")).toBe(true);
  });

  it("nao trata programa maior como conflito com programa menor de nome sobreposto", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(
      detectProgramConflict(
        fields,
        "Pesquisa vinculada ao Programa de Pós-Graduação em Educação Científica e Ambiental e à linha Educação, Cultura, Ciência e Ambiente.",
      ),
    ).toBe(false);
  });

  it("nao trata nome real de programa como prefixo de outro programa institucional", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(
      detectProgramConflict(
        fields,
        "O estudo situa-se no Programa de Pós-Graduação em Educação Científica e Ambiental da UFLA.",
      ),
    ).toBe(false);
  });

  it("nao trata mencao tematica comum como outro programa", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(detectProgramConflict(fields, "A revisao discute conceitos de ciencia do solo no ensino de ciencias.")).toBe(false);
  });

  it("'engenharia didática' não gera conflito", () => {
    const fields = { ...emptyAcademicFields(), program: "Educação Científica e Ambiental" };
    expect(detectProgramConflict(fields, "Abordamos a engenharia didática em sala de aula.")).toBe(false);
  });

  it("reconhece programa real de UFLA_PPG_PROGRAMS com contexto institucional", () => {
    const source = UFLA_PPG_PROGRAMS.find((program) => program.name === "Ciência do Solo") ?? UFLA_PPG_PROGRAMS[0];
    const target = UFLA_PPG_PROGRAMS.find((program) => program.name === "Física") ?? UFLA_PPG_PROGRAMS[1];
    const fields = { ...emptyAcademicFields(), program: source.name };
    expect(detectProgramConflict(fields, `Texto vinculado ao Programa de Pós-Graduação em ${target.name}.`)).toBe(true);
  });

  it("nao trata nome real de programa sem contexto institucional como conflito", () => {
    const source = UFLA_PPG_PROGRAMS.find((program) => program.name === "Ciência do Solo") ?? UFLA_PPG_PROGRAMS[0];
    const target = UFLA_PPG_PROGRAMS.find((program) => program.name === "Física") ?? UFLA_PPG_PROGRAMS[1];
    const fields = { ...emptyAcademicFields(), program: source.name };
    expect(detectProgramConflict(fields, `A pesquisa utiliza conceitos de ${target.name} no referencial.`)).toBe(false);
  });
});

describe("academic guardrails - abstract topic conflict", () => {
  it("resumo PGD/TAE + abstract agricultura gera conflito", () => {
    const fields = {
      ...emptyAcademicFields(),
      title: "PGD e TAEs na UFLA",
      resumo: "Este estudo aborda o PGD e os TAEs na universidade pública, com servidores técnico-administrativos em educação.",
      abstractText: "This study analyzes agriculture, soil and plant yield in cropping systems.",
    };
    expect(detectAbstractTopicConflict(fields).conflict).toBe(true);
  });

  it("resumo e abstract coerentes não geram conflito", () => {
    const fields = {
      ...emptyAcademicFields(),
      title: "Qualidade do café",
      resumo: "Qualidade do café no sul de Minas.",
      abstractText: "Coffee quality in southern Minas.",
    };
    expect(detectAbstractTopicConflict(fields).conflict).toBe(false);
  });
});

describe("academic guardrails - CPG proibido", () => {
  it("'# SUMÁRIO' é bloqueado em CPG", () => {
    expect(detectCpgForbiddenStructures("# SUMÁRIO\nTexto.")).toContain("SUMÁRIO");
  });

  it("'FICHA CATALOGRÁFICA' é bloqueado em CPG", () => {
    expect(detectCpgForbiddenStructures("FICHA CATALOGRÁFICA")).toContain("FICHA CATALOGRÁFICA");
  });

  it("frase comum contendo 'sumário' não bloqueia", () => {
    expect(detectCpgForbiddenStructures("O sumário da obra está disponível.")).not.toContain("SUMÁRIO");
  });
});
