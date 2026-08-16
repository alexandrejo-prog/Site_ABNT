import { describe, expect, it } from "vitest";
import {
  emptyAcademicFields,
  ACADEMIC_FIELD_KEYS,
} from "../../src/ufla-rules";
import { validateWork, hasBlockingErrors } from "../../src/validators";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";

describe("Campos específicos de Projeto de pesquisa", () => {
  describe("A. Definição do modelo", () => {
    it("campos específicos existem no modelo e começam vazios", () => {
      const fields = emptyAcademicFields();
      expect(fields.tema).toBe("");
      expect(fields.delimitacaoTema).toBe("");
      expect(fields.problemaPesquisa).toBe("");
      expect(fields.hipotese).toBe("");
      expect(fields.objetivoGeral).toBe("");
      expect(fields.objetivosEspecificos).toBe("");
      expect(fields.justificativa).toBe("");
      expect(fields.referencialTeorico).toBe("");
      expect(fields.metodologia).toBe("");
      expect(fields.cronograma).toBe("");
      expect(fields.recursosOrcamento).toBe("");
      expect(fields.resultadosEsperados).toBe("");
    });

    it("chaves dos campos específicos estão em ACADEMIC_FIELD_KEYS", () => {
      expect(ACADEMIC_FIELD_KEYS).toContain("tema");
      expect(ACADEMIC_FIELD_KEYS).toContain("delimitacaoTema");
      expect(ACADEMIC_FIELD_KEYS).toContain("problemaPesquisa");
      expect(ACADEMIC_FIELD_KEYS).toContain("hipotese");
      expect(ACADEMIC_FIELD_KEYS).toContain("objetivoGeral");
      expect(ACADEMIC_FIELD_KEYS).toContain("objetivosEspecificos");
      expect(ACADEMIC_FIELD_KEYS).toContain("justificativa");
      expect(ACADEMIC_FIELD_KEYS).toContain("referencialTeorico");
      expect(ACADEMIC_FIELD_KEYS).toContain("metodologia");
      expect(ACADEMIC_FIELD_KEYS).toContain("cronograma");
      expect(ACADEMIC_FIELD_KEYS).toContain("recursosOrcamento");
      expect(ACADEMIC_FIELD_KEYS).toContain("resultadosEsperados");
    });
  });

  describe("B. Validação com campos específicos", () => {
    it("projeto mínimo preenchido por campos específicos passa sem erros bloqueantes", () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Autor",
        resumo: "Resumo do projeto.",
        abstractText: "Abstract do projeto.",
        tema: "Tema da pesquisa",
        problemaPesquisa: "Problema investigado",
        objetivoGeral: "Objetivo geral da pesquisa",
        justificativa: "Justificativa completa",
        metodologia: "Metodologia descrita",
        cronograma: "Cronograma detalhado",
        referencias: "Referência válida.",
      };

      const issues = validateWork(fields, "");
      expect(hasBlockingErrors(issues)).toBe(false);
    });

    it("projeto com objetivosEspecificos preenchido, mas objetivoGeral vazio, gera erro de objetivo obrigatório", () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Autor",
        objetivosEspecificos: "Objetivo específico 1",
      };

      const issues = validateWork(fields, "");
      expect(issues.some((i) => i.code === "research-objective-mandatory")).toBe(true);
    });

    it("projeto com problemaPesquisa preenchido não gera erro de problema", () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Autor",
        problemaPesquisa: "Problema investigado",
        objetivoGeral: "Objetivo geral",
        justificativa: "Justificativa",
        metodologia: "Metodologia",
        cronograma: "Cronograma",
        referencias: "Referências",
      };

      const issues = validateWork(fields, "");
      expect(issues.some((i) => i.code === "research-problem-required")).toBe(false);
    });
  });

  describe("C. Exportação com campos específicos", () => {
    it("exportador usa campos específicos quando preenchidos", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Autor",
        problemaPesquisa: "Problema preenchido no campo específico",
        objetivoGeral: "Objetivo geral preenchido no campo específico",
        justificativa: "Justificativa preenchida no campo específico",
        metodologia: "Metodologia preenchida no campo específico",
        cronograma: "Cronograma preenchido no campo específico",
        referencias: "Referência 1.",
      };

      const blob = await generateResearchProjectDocxBlob({ fields, editorText: "" });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it("exportador continua funcionando com editor textual quando campos específicos vazios", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa" as const,
        title: "Título do Projeto",
        author: "Autor",
        referencias: "Referência 1.",
      };

      const editorText = `# PROBLEMA DE PESQUISA
Descrição do problema.

# OBJETIVO GERAL
Objetivo geral.

# JUSTIFICATIVA
Justificativa.

# METODOLOGIA
Metodologia.

# CRONOGRAMA
Cronograma.
`;

      const blob = await generateResearchProjectDocxBlob({ fields, editorText });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe("D. Compatibilidade com outros tipos", () => {
    it("artigo continua funcionando sem os campos específicos", () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "artigo" as const,
        title: "Título do Artigo",
        author: "Autor",
      };

      const issues = validateWork(fields, "");
      expect(issues.some((i) => i.code === "research-problem-required")).toBe(false);
    });

    it("monografia continua funcionando sem os campos específicos", () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        title: "Título da Monografia",
        author: "Autor",
        advisor: "Orientador",
      };

      const issues = validateWork(fields, "");
      expect(issues.some((i) => i.code === "research-problem-required")).toBe(false);
    });
  });
});