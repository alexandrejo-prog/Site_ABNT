import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../src/ufla-rules";
import { buildDraftFromFields, buildCpgDraft, buildImpactIndicatorsText, hasUnfilledPlaceholders } from "../src/draft-builder";
import { detectPlaceholderText } from "../src/academic-guardrails";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return { ...emptyAcademicFields(), workType: "monografia", author: "Maria Silva", title: "Título", ...overrides };
}

describe("Rodada 3 - montagem de rascunho", () => {
  it("montar rascunho não inventa programa ou orientador", () => {
    const draft = buildDraftFromFields(baseFields({ tema: "Ensino de biologia", problemaPesquisa: "Falta de recursos", objetivoGeral: "Analisar" }));
    expect(draft).not.toContain("Orientador");
    expect(draft).not.toContain("Programa de Pós-Graduação");
  });

  it("campos vazios geram [PREENCHER: ...]", () => {
    const draft = buildDraftFromFields(baseFields({ tema: "Ensino de biologia" }));
    expect(draft).toContain("[PREENCHER: problema de pesquisa]");
    expect(draft).toContain("[PREENCHER: metodologia]");
    expect(hasUnfilledPlaceholders(draft)).toBe(true);
  });

  it("campos preenchidos não geram placeholder", () => {
    const draft = buildDraftFromFields(baseFields({
      tema: "Ensino de biologia",
      problemaPesquisa: "Falta de recursos",
      objetivoGeral: "Analisar prática",
      objetivosEspecificos: "Mapear",
      justificativa: "Relevância",
      referencialTeorico: "Autores",
      corpusDados: "Entrevistas",
      contextoInstitucional: "UFLA",
      metodologia: "Qualitativa",
      resultadosEsperados: "Melhora",
      conclusaoProvisoria: "Eficaz",
      contribuicoesImpactos: "Social",
      introducao: "Introdução",
    }));
    expect(hasUnfilledPlaceholders(draft)).toBe(false);
  });

  it("placeholders do rascunho são detectados como placeholder", () => {
    const draft = buildDraftFromFields(baseFields({ tema: "Ensino de biologia" }));
    expect(detectPlaceholderText(draft)).toBe(true);
  });

  it("CPG gera seções esperadas (agradecimentos omitido quando vazio)", () => {
    const draft = buildCpgDraft(baseFields({ workType: "resumo_expandido_cpg" }));
    expect(draft).toContain("1 INTRODUÇÃO");
    expect(draft).toContain("2 MATERIAIS E MÉTODOS");
    expect(draft).toContain("3 RESULTADOS E DISCUSSÃO");
    expect(draft).toContain("4 CONCLUSÃO");
    expect(draft).not.toContain("AGRADECIMENTOS");
    expect(draft).toContain("REFERÊNCIAS");
  });

  it("CPG gera AGRADECIMENTOS quando preenchido", () => {
    const draft = buildCpgDraft(baseFields({ workType: "resumo_expandido_cpg", agradecimentos: "Aos meus orientadores." }));
    expect(draft).toContain("AGRADECIMENTOS");
    expect(draft).toContain("Aos meus orientadores.");
  });

  it("dissertação/tese com indicadores vazios não gera texto", () => {
    const text = buildImpactIndicatorsText(baseFields({ workType: "dissertacao" }));
    expect(text).toBe("");
  });

  it("dissertação/tese com indicadores gera texto baseado nos campos", () => {
    const text = buildImpactIndicatorsText(baseFields({ workType: "tese", impactoSocial: "Fortalecimento comunitário", publicoBeneficiado: "Estudantes" }));
    expect(text).toContain("Fortalecimento comunitário");
    expect(text).toContain("Estudantes");
  });

  it("indicadores ignorados fora de dissertação/tese", () => {
    expect(buildImpactIndicatorsText(baseFields({ workType: "monografia", impactoSocial: "X" }))).toBe("");
  });
});
