import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "../../src/preview-html";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";

type WorkTypeId = "monografia" | "dissertacao" | "tese" | "artigo" | "resumo_cpg" | "resumo_expandido_cpg" | "artigo_completo_cpg" | "projeto_pesquisa";

function baseFields(workType: WorkTypeId): AcademicFields {
  const common = {
    ...emptyAcademicFields(),
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
  };
  if (workType === "monografia") {
    return { ...common, workType, course: "Bacharelado em Biologia", advisor: "Prof. Dr. Joao Silva" };
  }
  if (workType === "dissertacao" || workType === "tese") {
    return {
      ...common,
      workType,
      program: "Ciencia do Solo",
      advisor: "Prof. Dr. Joao Silva",
      indicadoresImpacto: "Impacto social: informado.",
      impactIndicators: "Social impact text.",
    };
  }
  return { ...common, workType };
}

const EDITOR_WITH_HEADINGS = "# 1 Introducao\nTexto.\n# 2 Metodologia\nTexto.\n";

describe("Matriz de pré-visualização por tipo de trabalho", () => {
  it.each<WorkTypeId>(["monografia", "dissertacao", "tese"])("%s tem capa, folha de rosto, resumo, abstract e sumário", (workType) => {
    const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
    expect(html).toContain("preview-cover");
    expect(html).toContain("preview-title-page");
    expect(html).toContain(">RESUMO<");
    expect(html).toContain(">ABSTRACT<");
    expect(html).toContain("SUMÁRIO");
    expect(html).toContain("preview-reference");
  });

  it.each<WorkTypeId>(["dissertacao", "tese"])("%s tem indicadores de impacto", (workType) => {
    const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
    expect(html).toContain("INDICADORES DE IMPACTO");
    expect(html).toContain("IMPACT INDICATORS");
  });

  it.each<WorkTypeId>(["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"])(
    "%s NÃO tem capa, folha de rosto nem sumário",
    (workType) => {
      const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
      expect(html).not.toContain("preview-cover");
      expect(html).not.toContain("preview-title-page");
      expect(html).not.toContain("SUMÁRIO");
    },
  );

  it.each<WorkTypeId>(["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"])(
    "%s inclui título, autor, resumo e referências",
    (workType) => {
      const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
      expect(html).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
      expect(html).toContain("MARIA SILVA");
      expect(html).toContain("Resumo do trabalho.");
      expect(html).toContain("preview-reference");
    },
  );

  it("projeto_pesquisa tem capa, folha de rosto, resumo, abstract e sumário", () => {
    const html = buildPreviewHtml({
      fields: { ...baseFields("projeto_pesquisa"), program: "Ciencia da Computacao" },
      editorText: "# 1 TEMA\nTexto do tema.\n",
    });
    expect(html).toContain("preview-cover");
    expect(html).toContain("preview-title-page");
    expect(html).toContain(">RESUMO<");
    expect(html).toContain(">ABSTRACT<");
    expect(html).toContain("SUMÁRIO");
    expect(html).toContain("preview-reference");
  });

  it("Todos os templates usam data-first-line-cm com recuo de 1,25cm quando aplicável", () => {
    for (const workType of ["monografia", "artigo", "projeto_pesquisa"] as const) {
      const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
      expect(html).toContain("data-first-line-cm=\"1.25\"");
    }
  });

  it.each<WorkTypeId>(["dissertacao", "tese"])("%s renderiza pré-textuais completas (ficha, aprovacao, indicadores, lista)", (workType) => {
    const html = buildPreviewHtml({
      fields: baseFields(workType),
      editorText: `${EDITOR_WITH_HEADINGS}Figura 1 - Grafico do crescimento.\n`,
    });
    expect(html).toContain("Ficha catalográfica");
    expect(html).toContain("Folha de aprovação");
    expect(html).toContain("INDICADORES DE IMPACTO");
    expect(html).toContain("LISTA DE ILUSTRAÇÕES");
  });

  it("monografia renderiza folha de aprovação no preview", () => {
    const html = buildPreviewHtml({ fields: baseFields("monografia"), editorText: EDITOR_WITH_HEADINGS });
    expect(html).toContain("Folha de aprovação");
  });

  it.each<WorkTypeId>(["artigo", "resumo_cpg", "resumo_expandido_cpg"])(
    "%s não renderiza ficha catalográfica nem folha de aprovação",
    (workType) => {
      const html = buildPreviewHtml({ fields: baseFields(workType), editorText: EDITOR_WITH_HEADINGS });
      expect(html).not.toContain("Ficha catalográfica");
      expect(html).not.toContain("Folha de aprovação");
    },
  );
});
