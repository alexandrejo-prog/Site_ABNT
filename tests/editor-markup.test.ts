import { describe, expect, it } from "vitest";
import { editorHtmlToMarkup, editorMarkupToHtml } from "../src/editor-markup";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type FakeNode = {
  nodeType: number;
  tagName?: string;
  textContent?: string;
  dataset?: Record<string, string>;
  childNodes?: FakeNode[];
};

function text(value: string): FakeNode {
  return { nodeType: TEXT_NODE, textContent: value };
}

function element(tagName: string, childNodes: FakeNode[], dataset: Record<string, string> = {}): FakeNode {
  return { nodeType: ELEMENT_NODE, tagName, childNodes, dataset };
}

function root(childNodes: FakeNode[]): HTMLElement {
  return { childNodes } as unknown as HTMLElement;
}

describe("editor-markup", () => {
  it("converte titulos em h1, h2 e h3", () => {
    expect(editorMarkupToHtml("# Titulo")).toBe("<h1>Titulo</h1>");
    expect(editorMarkupToHtml("## Titulo")).toBe("<h2>Titulo</h2>");
    expect(editorMarkupToHtml("### Titulo")).toBe("<h3>Titulo</h3>");
  });

  it("converte referencia marcada em paragrafo de referencia", () => {
    expect(editorMarkupToHtml("[REF] AUTOR. Titulo.")).toBe('<p data-reference="true">AUTOR. Titulo.</p>');
  });

  it("converte negrito e italico para HTML", () => {
    expect(editorMarkupToHtml("Texto **negrito** e *italico*.")).toBe("<p>Texto <strong>negrito</strong> e <em>italico</em>.</p>");
  });

  it("preserva citacao longa", () => {
    expect(editorMarkupToHtml("> Trecho citado")).toBe("<blockquote>Trecho citado</blockquote>");
  });

  it("preserva paragrafo comum", () => {
    expect(editorMarkupToHtml("Paragrafo comum")).toBe("<p>Paragrafo comum</p>");
  });

  it("converte HTML do editor de volta para markup", () => {
    globalThis.Node = { TEXT_NODE, ELEMENT_NODE } as typeof Node;

    const markup = editorHtmlToMarkup(
      root([
        element("H1", [text("Titulo")]),
        element("P", [text("Texto "), element("STRONG", [text("negrito")]), text(" e "), element("EM", [text("italico")]), text(".")]),
        element("BLOCKQUOTE", [text("Trecho citado")]),
        element("P", [text("AUTOR. Titulo.")], { reference: "true" }),
      ]),
    );

    expect(markup).toBe("# Titulo\nTexto **negrito** e *italico*.\n> Trecho citado\n[REF] AUTOR. Titulo.");
  });
});
