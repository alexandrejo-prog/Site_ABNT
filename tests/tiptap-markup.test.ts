import { describe, expect, it } from "vitest";
import { editorMarkupToTiptapHtml, tiptapHtmlToEditorMarkup } from "../src/tiptap-markup";

describe("tiptap markup bridge", () => {
  it("converte titulo 1 para h1", () => {
    expect(editorMarkupToTiptapHtml("# INTRODUÇÃO")).toContain("<h1>INTRODUÇÃO</h1>");
  });

  it("converte titulo 2 para h2", () => {
    expect(editorMarkupToTiptapHtml("## Subtítulo")).toContain("<h2>Subtítulo</h2>");
  });

  it("converte citacao longa para blockquote", () => {
    expect(editorMarkupToTiptapHtml("> Citação")).toContain("<blockquote>Citação</blockquote>");
  });

  it("converte referencia bibliografica para paragrafo marcado", () => {
    expect(editorMarkupToTiptapHtml("[REF] AUTOR. Título.")).toContain('<p data-reference="true">AUTOR. Título.</p>');
  });

  it("converte negrito e italico para HTML", () => {
    const html = editorMarkupToTiptapHtml("Texto **forte** e *ênfase*.");
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain("<em>ênfase</em>");
  });

  it("converte HTML Tiptap de volta para markup interno", () => {
    const markup = tiptapHtmlToEditorMarkup("<h1>INTRODUÇÃO</h1><h2>Subtítulo</h2><p>Texto <strong>forte</strong> e <em>ênfase</em>.</p><blockquote>Citação</blockquote>");
    expect(markup).toBe("# INTRODUÇÃO\n## Subtítulo\nTexto **forte** e *ênfase*.\n> Citação");
  });

  it("converte referencia marcada de volta para [REF]", () => {
    expect(tiptapHtmlToEditorMarkup('<p data-reference="true">AUTOR. Título.</p>')).toBe("[REF] AUTOR. Título.");
  });

  it("preserva texto de tags nao suportadas", () => {
    expect(tiptapHtmlToEditorMarkup("<section><custom>Texto limpo</custom></section>")).toBe("Texto limpo");
  });

  it("converte itens de lista em linhas iniciadas por hifen", () => {
    expect(tiptapHtmlToEditorMarkup("<ul><li>Primeiro</li><li>Segundo</li></ul>")).toBe("- Primeiro\n- Segundo");
  });
});
