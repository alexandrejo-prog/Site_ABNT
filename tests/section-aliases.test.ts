import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromText } from "../src/field-detector";
import { normalizeSectionTitle, getSectionKeyFromTitle, isEquivalentSectionTitle } from "../src/section-aliases";

describe("section-aliases", () => {
  describe("normalizeSectionTitle", () => {
    it("remove prefixos numericos", () => {
      expect(normalizeSectionTitle("1. INTRODUÇÃO")).toBe("INTRODUCAO");
      expect(normalizeSectionTitle("1.3.2 OBJETIVOS ESPECÍFICOS")).toBe("OBJETIVOS ESPECIFICOS");
    });

    it("remove acentos", () => {
      expect(normalizeSectionTitle("Considerações Finais")).toBe("CONSIDERACOES FINAIS");
    });
  });

  describe("getSectionKeyFromTitle", () => {
    it("mapeia conclusao e consideracoes finais", () => {
      expect(getSectionKeyFromTitle("CONCLUSAO")).toBe("conclusao");
      expect(getSectionKeyFromTitle("CONSIDERACOES FINAIS")).toBe("conclusao");
    });

    it("mapeia referencias", () => {
      expect(getSectionKeyFromTitle("REFERENCIAS")).toBe("referencias");
      expect(getSectionKeyFromTitle("REFERÊNCIAS")).toBe("referencias");
      expect(getSectionKeyFromTitle("REFERENCIAS BIBLIOGRAFICAS")).toBe("referencias");
    });

    it("mapeia referencial teorico", () => {
      expect(getSectionKeyFromTitle("REFERENCIAL TEORICO")).toBe("referencialTeorico");
      expect(getSectionKeyFromTitle("FUNDAMENTACAO TEORICA")).toBe("referencialTeorico");
      expect(getSectionKeyFromTitle("REVISAO BIBLIOGRAFICA")).toBe("referencialTeorico");
    });

    it("mapeia metodologia", () => {
      expect(getSectionKeyFromTitle("METODOLOGIA")).toBe("metodologia");
      expect(getSectionKeyFromTitle("PROCEDIMENTOS METODOLICOS")).toBe("metodologia");
      expect(getSectionKeyFromTitle("MATERIAL E METODOS")).toBe("metodologia");
      expect(getSectionKeyFromTitle("MATERIAIS E METODOS")).toBe("metodologia");
    });

    it("mapeia objetivo geral e especificos", () => {
      expect(getSectionKeyFromTitle("OBJETIVO GERAL")).toBe("objetivoGeral");
      expect(getSectionKeyFromTitle("OBJETIVOS ESPECÍFICOS")).toBe("objetivosEspecificos");
    });

    it("retorna undefined para titulo desconhecido", () => {
      expect(getSectionKeyFromTitle("INTRODUCAO")).toBeUndefined();
    });
  });

  describe("isEquivalentSectionTitle", () => {
    it("reconhece consideracoes finais como conclusao", () => {
      expect(isEquivalentSectionTitle("CONSIDERACOES FINAIS", "conclusao")).toBe(true);
      expect(isEquivalentSectionTitle("CONCLUSAO", "conclusao")).toBe(true);
    });

    it("reconhece referencias bibliograficas como referencias", () => {
      expect(isEquivalentSectionTitle("REFERENCIAS BIBLIOGRAFICAS", "referencias")).toBe(true);
    });
  });

  describe("integracao com detector", () => {
    it("detecta secoes importadas por aliases academicos", () => {
      const detected = detectAcademicFieldsFromText(`1 INTRODUCAO
Texto introdutorio.

OBJETIVOS ESPECIFICOS
Mapear normas.

FUNDAMENTACAO TEORICA
Base teorica.

MATERIAL E METODOS
Procedimentos.

CONSIDERACOES FINAIS
Fechamento.

REFERENCIAS BIBLIOGRAFICAS
SILVA, M. Texto. Lavras: UFLA, 2024.`);

      expect(detected.fields.objetivosEspecificos).toContain("Mapear normas");
      expect(detected.fields.referencialTeorico).toContain("Base teorica");
      expect(detected.fields.metodologia).toContain("Procedimentos");
      expect(detected.fields.conclusao).toContain("Fechamento");
      expect(detected.fields.referencias).toContain("SILVA");
    });
  });
});
