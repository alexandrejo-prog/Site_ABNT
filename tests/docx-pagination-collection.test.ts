import { describe, expect, it } from "vitest";
import { calculateTextualStartPage } from "../src/export-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { validateWork } from "../src/validators";

describe("paginação centralizada (UFLA_RULES.structure)", () => {
  it("mantém o cálculo da página textual inicial para monografia com sumário", () => {
    const fields = { ...emptyAcademicFields(), workType: "monografia" as const };
    // folha de rosto(1) + aprovação(1) + resumo + abstract + sumário + 1 = 6
    expect(calculateTextualStartPage(fields, true)).toBe(6);
  });

  it("monografia sem sumário inicia na página 5", () => {
    const fields = { ...emptyAcademicFields(), workType: "monografia" as const };
    // folha de rosto(1) + aprovação(1) + resumo + abstract + 1 = 5
    expect(calculateTextualStartPage(fields, false)).toBe(5);
  });

  it("tese com indicadores de impacto e sumário soma pré-textuais", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "tese" as const,
      indicadoresImpacto: "Fator de impacto X.",
      impactIndicators: "Indicador Y.",
    };
    // folha de rosto(1) + aprovação(1) + indicadores(1) + impact(1) +
    // resumo + abstract + sumário + 1 = 8
    expect(calculateTextualStartPage(fields, true)).toBe(8);
  });
});

describe("aviso forte de seções ausentes da Coleção UFLA", () => {
  it("emite aviso quando faltam seções obrigatórias do perfil", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo_cientifico_ufla" as const,
      title: "Artigo",
      author: "Autor",
    };
    const editorText = "# 1 Introducao\nTexto.\n# 2 Conclusao\nTexto.";
    const issues = validateWork(fields, editorText);
    const warn = issues.find((i) => i.code === "ufla-collection-sections-missing");
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe("warning");
  });

  it("não emite aviso quando todas as seções obrigatórias estão presentes", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo_cientifico_ufla" as const,
      title: "Artigo",
      author: "Autor",
    };
    const editorText = [
      "# 1 Introducao",
      "# 2 Metodologia",
      "# 3 Resultados e discussao",
      "# 4 Conclusao",
      "# 5 Referencias",
    ].join("\n");
    const issues = validateWork(fields, editorText);
    expect(issues.some((i) => i.code === "ufla-collection-sections-missing")).toBe(false);
  });
});
