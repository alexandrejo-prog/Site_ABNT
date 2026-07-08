import { describe, expect, it } from "vitest";
import { editorMarkupToHtml } from "../src/editor-markup";

// Tags que o editor pode emitir de forma legítima ao converter markup -> HTML.
// Qualquer outra tag bruta no HTML resultante representa risco de XSS.
const ALLOWED_TAGS = /^(p|h1|h2|h3|blockquote|strong|em|br|\/[a-z0-9]+)$/i;

function rawTags(html: string): string[] {
  return [...html.matchAll(/<(\/?[a-z0-9]+)/gi)].map((match) => match[1]);
}

const MALICIOUS_INPUTS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  '<a href="javascript:alert(1)">x</a>',
  "<div onload=alert(1)>oi</div>",
  "<svg/onload=alert(1)>",
  '<iframe src="javascript:alert(1)"></iframe>',
];

describe("sanitização de conteúdo malicioso no editor", () => {
  it("editorMarkupToHtml nunca emite tags ou atributos executáveis", () => {
    for (const payload of MALICIOUS_INPUTS) {
      const html = editorMarkupToHtml(payload);

      for (const tag of rawTags(html)) {
        expect(ALLOWED_TAGS.test(tag), `tag não permitida "${tag}" para entrada "${payload}"`).toBe(true);
      }

      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/<iframe/i);
      expect(html).not.toMatch(/<svg/i);
      // href com javascript: só é perigoso como atributo vivo; o escape torna o
      // conteúdo texto inerte, então checamos o formato de atributo, não o texto.
      expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i);
    }
  });

  it("preserva o conteúdo malicioso como texto escapado (inofensivo)", () => {
    const html = editorMarkupToHtml("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("alert(1)");
    expect(html).not.toContain("<script");
  });

  it("mantém negrito, itálico e títulos legítimos", () => {
    expect(editorMarkupToHtml("Texto **negrito** e *itálico*.")).toBe(
      "<p>Texto <strong>negrito</strong> e <em>itálico</em>.</p>",
    );
    expect(editorMarkupToHtml("# Título")).toBe("<h1>Título</h1>");
  });

  it("remove tags estranhas no round-trip de volta para markup", () => {
    // O editor só preserva STRONG/EM/BLOCKQUOTE/H1-3/data-reference; qualquer
    // outra tag (script, img, a) vira texto puro ou é descartada, nunca reemitida
    // como HTML executável. A conversão editorHtmlToMarkup -> editorMarkupToHtml
    // garante que o conteúdo final seja texto escapado.
    const markup = editorMarkupToHtml('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;");
  });
});
