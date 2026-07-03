import { describe, expect, it } from "vitest";
import { WORK_TYPES, WORK_TYPE_LABELS, isResearchProject, emptyAcademicFields } from "../src/ufla-rules";
import { validateWork, hasBlockingErrors } from "../src/validators";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { ADHERENCE_CATEGORIES } from "../src/validators";
import { normalizePlainAcademicText } from "../src/import-normalizer";

describe("Projeto de pesquisa (NBR 15287:2025)", () => {
  describe("A. Tipo de trabalho", () => {
    it("projeto_pesquisa existe na lista de tipos", () => {
      expect(WORK_TYPES).toContain("projeto_pesquisa");
    });

    it("rótulo do tipo está definido", () => {
      expect(WORK_TYPE_LABELS.projeto_pesquisa).toBeDefined();
      expect(WORK_TYPE_LABELS.projeto_pesquisa).toContain("Projeto de pesquisa");
    });

    it("isResearchProject identifica corretamente o tipo", () => {
      expect(isResearchProject("projeto_pesquisa")).toBe(true);
      expect(isResearchProject("monografia")).toBe(false);
      expect(isResearchProject("artigo")).toBe(false);
    });
  });

  describe("B. Validação", () => {
    it("projeto incompleto gera erros coerentes", () => {
      const fields = { ...emptyAcademicFields(), workType: "projeto_pesquisa" as const, title: "", author: "" };
      const issues = validateWork(fields, "");

      const blockingErrors = issues.filter((i) => i.severity === "error");
      expect(blockingErrors.length).toBeGreaterThan(0);

      const errorCodes = blockingErrors.map((i) => i.code);
      expect(errorCodes).toContain("title-required");
      expect(errorCodes).toContain("author-required");
      expect(errorCodes).toContain("research-problem-required");
      expect(errorCodes).toContain("research-goal-required");
      expect(errorCodes).toContain("research-justification-required");
      expect(errorCodes).toContain("research-methodology-required");
      expect(errorCodes).toContain("research-schedule-required");
      expect(errorCodes).toContain("research-references-required");
    });

    it("projeto com seções no editor não gera erro bloqueante para conteúdo", () => {
      const editorContent = `# INTRODUÇÃO
Texto da introdução.

# PROBLEMA DE PESQUISA
Descrição do problema.

# OBJETIVO GERAL
Objetivo principal.

# JUSTIFICATIVA
Justificativa da pesquisa.

# METODOLOGIA
Metodologia a ser usada.

# CRONOGRAMA
Planejamento das atividades.

# REFERÊNCIAS
SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.
`;

      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Maria Silva",
        location: "Lavras - MG",
        year: "2026",
      };

      const issues = validateWork(fields, editorContent);
      const blockingErrors = issues.filter((i) => i.severity === "error");

      // Should have warning but no blocking error for sections
      expect(issues.some((i) => i.code === "research-project-partial")).toBe(true);
      expect(hasBlockingErrors(issues)).toBe(false);
    });

    it("validações possuem campos what, why e action", () => {
      const fields = { ...emptyAcademicFields(), workType: "projeto_pesquisa" as const };
      const issues = validateWork(fields, "");

      for (const issue of issues) {
        if (issue.severity === "error" || issue.code === "research-project-partial") {
          expect(issue.what).toBeTruthy();
          expect(issue.why).toBeTruthy();
          expect(issue.action).toBeTruthy();
        }
      }
    });
  });

  describe("C. Exportação DOCX", () => {
    it("gera Blob válido para projeto de pesquisa", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto de Pesquisa",
        author: "Maria Silva",
        location: "Lavras - MG",
        year: "2026",
        referencias: "SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.",
      };

      const editorText = `# INTRODUÇÃO
Texto da introdução do projeto.

# PROBLEMA DE PESQUISA
Descrição do problema investigado.

# OBJETIVO GERAL
Objetivo principal da pesquisa.
`;

      const blob = await generateResearchProjectDocxBlob({ fields, editorText });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toMatch(/^application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)/);
    });
  });

  describe("D. Painel de aderência", () => {
    it("indica suporte parcial para Projeto de pesquisa / NBR 15287", () => {
      const researchCategory = ADHERENCE_CATEGORIES.find((cat) => cat.key === "research-project");
      expect(researchCategory).toBeDefined();
      expect(researchCategory?.status).toBe("partial");
      expect(researchCategory?.statusLabel).toBe("Parcial");
      expect(researchCategory?.note).toContain("Suporte inicial");
    });
  });

  describe("E. Detecção de seções no importador", () => {
    it("detecta cabeçalhos essenciais de projeto de pesquisa", () => {
      const text = `# PROBLEMA DE PESQUISA
Descrição do problema.

# OBJETIVO GERAL
Objetivo principal.

# JUSTIFICATIVA
Justificativa.

# METODOLOGIA
Metodologia.

# CRONOGRAMA
Planejamento.

# REFERÊNCIAS
Referências bibliográficas.
`;

      const result = normalizePlainAcademicText(text);

      // Should have blocks without throwing
      expect(result.structure.blocks.length).toBeGreaterThan(0);
      expect(result.text).toContain("PROBLEMA DE PESQUISA");
    });
  });
});