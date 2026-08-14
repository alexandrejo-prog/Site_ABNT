import { describe, expect, it } from "vitest";
import { editorMarkupToTiptapHtml, tiptapHtmlToEditorMarkup } from "../../src/tiptap-markup";

describe("Tiptap roundtrip", () => {
  it("preserva estrutura academica principal", () => {
    const markup = [
      "# INTRODUÇÃO",
      "## Objetivos",
      "Texto comum com **negrito** e *itálico*.",
      "> Citação longa",
      "[REF] AUTOR. Título.",
    ].join("\n");

    expect(tiptapHtmlToEditorMarkup(editorMarkupToTiptapHtml(markup))).toBe(markup);
  });

  it("ignora paragrafo vazio e preserva br como quebra", () => {
    expect(tiptapHtmlToEditorMarkup("<p><br></p><p>Linha 1<br>Linha 2</p>")).toBe("Linha 1\nLinha 2");
  });

  it("preserva espacos internos do texto", () => {
    expect(tiptapHtmlToEditorMarkup("<p>Texto  com  espaços</p>")).toBe("Texto  com  espaços");
  });
});
