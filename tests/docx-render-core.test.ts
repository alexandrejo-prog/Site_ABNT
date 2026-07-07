import { describe, expect, it } from "vitest";
import {
  cleanMojibakeText,
  splitParagraphs,
  hasText,
  textRunsFromMarkup,
  buildSimpleParagraphs,
  detectCaption,
  captionParagraph,
  tokenizeMarkup,
} from "../src/docx-render-core";

describe("docx-render-core", () => {
  describe("cleanMojibakeText", () => {
    it("corrige mojibake basico", () => {
      expect(cleanMojibakeText("cafÃ©")).toBe("café");
      expect(cleanMojibakeText("Ãºnico")).toBe("único");
      expect(cleanMojibakeText("Ã§Ã£o")).toBe("ção");
      expect(cleanMojibakeText("PÃ³s-GraduaÃ§Ã£o")).toBe("Pós-Graduação");
    });

    it("nao altera acentos corretos", () => {
      expect(cleanMojibakeText("café")).toBe("café");
      expect(cleanMojibakeText("mação")).toBe("mação");
      expect(cleanMojibakeText("único")).toBe("único");
      expect(cleanMojibakeText("Pós-Graduação")).toBe("Pós-Graduação");
      expect(cleanMojibakeText("Águas")).toBe("Águas");
    });

    it("remove caracteres invisiveis e de controle", () => {
      expect(cleanMojibakeText("texto\ufffecom\uffff")).toBe("texto-com");
      expect(cleanMojibakeText("texto\u00adcom")).toBe("texto-com");
      expect(cleanMojibakeText("texto\u0000com")).toBe("textocom");
    });
  });

  describe("splitParagraphs", () => {
    it("divide por quebras de linha e remove vazios", () => {
      expect(splitParagraphs("linha1\n\nlinha2\n\n")).toEqual(["linha1", "linha2"]);
    });

    it("retorna array vazio para string vazia", () => {
      expect(splitParagraphs("")).toEqual([]);
    });
  });

  describe("hasText", () => {
    it("retorna true para texto com conteudo", () => {
      expect(hasText(" texto ")).toBe(true);
    });

    it("retorna false para string vazia ou so espacos", () => {
      expect(hasText("")).toBe(false);
      expect(hasText("   ")).toBe(false);
    });
  });

  describe("textRunsFromMarkup", () => {
    it("parseia negrito e italico", () => {
      const runs = tokenizeMarkup("texto **negrito** e *italico*");
      expect(runs.length).toBeGreaterThan(0);
      const texts = runs.map((run) => run.text).join("");
      expect(texts).toBe("texto negrito e italico");
      expect(runs.some((run) => run.bold)).toBe(true);
      expect(runs.some((run) => run.italics)).toBe(true);
    });

    it("retorna run vazio para string vazia", () => {
      const runs = textRunsFromMarkup("");
      expect(runs.length).toBeGreaterThan(0);
    });
  });

  describe("buildSimpleParagraphs", () => {
    it("gera paragrafos simples para cada linha", () => {
      const paragraphs = buildSimpleParagraphs("linha1\nlinha2");
      expect(paragraphs.length).toBe(2);
    });
  });

  describe("detectCaption", () => {
    it("reconhece Figura", () => {
      const result = detectCaption("Figura 1 - Título da figura");
      expect(result).toEqual({ kind: "illustration", number: "1", label: "- Título da figura" });
    });

    it("reconhece Quadro", () => {
      const result = detectCaption("Quadro 2 Cronograma");
      expect(result).toEqual({ kind: "illustration", number: "2", label: "Cronograma" });
    });

    it("reconhece Gráfico", () => {
      const result = detectCaption("Gráfico 3 Resultados");
      expect(result).toEqual({ kind: "illustration", number: "3", label: "Resultados" });
    });

    it("reconhece Mapa", () => {
      const result = detectCaption("Mapa 4 Localização");
      expect(result).toEqual({ kind: "illustration", number: "4", label: "Localização" });
    });

    it("reconhece Imagem", () => {
      const result = detectCaption("Imagem 5 Foto");
      expect(result).toEqual({ kind: "illustration", number: "5", label: "Foto" });
    });

    it("reconhece Ilustração", () => {
      const result = detectCaption("Ilustração 6 Desenho");
      expect(result).toEqual({ kind: "illustration", number: "6", label: "Desenho" });
    });

    it("reconhece Tabela", () => {
      const result = detectCaption("Tabela 7 Dados");
      expect(result).toEqual({ kind: "table", number: "7", label: "Dados" });
    });

    it("retorna null para texto sem legenda", () => {
      expect(detectCaption("Texto comum")).toBeNull();
    });
  });

  describe("captionParagraph", () => {
    it("gera paragrafo centralizado com texto", () => {
      const paragraph = captionParagraph("Figura 1 - Título");
      expect(paragraph).toBeDefined();
    });
  });
});
