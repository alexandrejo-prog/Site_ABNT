import { describe, expect, it } from "vitest";
import {
  classifyHeadingParagraphs,
  headingParagraphsAtLevel,
  resolveHeadingStyleLevel,
} from "../../src/docx-heading-semantics";

function para(styleId: string | null, outlineLvl?: number): string {
  const pPr = `<w:pPr>${styleId ? `<w:pStyle w:val="${styleId}"/>` : ""}${
    outlineLvl !== undefined ? `<w:outlineLvl w:val="${outlineLvl}"/>` : ""
  }</w:pPr>`;
  return `<w:p>${pPr}<w:r><w:t>Texto</w:t></w:r></w:p>`;
}

function stylesXmlWith(
  defs: Record<string, { outline?: number; basedOn?: string }>,
): string {
  const styles = Object.entries(defs)
    .map(([id, d]) => {
      const outline = d.outline !== undefined ? `<w:outlineLvl w:val="${d.outline}"/>` : "";
      const basedOn = d.basedOn ? `<w:basedOn w:val="${d.basedOn}"/>` : "";
      return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/>${basedOn}${outline}</w:style>`;
    })
    .join("");
  return `<w:styles>${styles}</w:styles>`;
}

const UFLA_STYLES = stylesXmlWith({
  ufla_titulo_primario: { outline: 0 },
  ufla_titulo_secundario: { outline: 1 },
  ufla_titulo_terciario: { outline: 2 },
  ufla_titulo_sem_indicativo: { outline: 0 },
});

describe("docx-heading-semantics (Estratégia B)", () => {
  it("reconhece ufla_titulo_primario/secundario/terciario como níveis 1/2/3", () => {
    expect(resolveHeadingStyleLevel(para("ufla_titulo_primario"), UFLA_STYLES).level).toBe(1);
    expect(resolveHeadingStyleLevel(para("ufla_titulo_secundario"), UFLA_STYLES).level).toBe(2);
    expect(resolveHeadingStyleLevel(para("ufla_titulo_terciario"), UFLA_STYLES).level).toBe(3);
  });

  it("reconhece ufla_titulo_sem_indicativo como nível 1 sem erros", () => {
    const r = resolveHeadingStyleLevel(para("ufla_titulo_sem_indicativo"), UFLA_STYLES);
    expect(r.level).toBe(1);
    expect(r.errors).toEqual([]);
  });

  it("preserva compatibilidade legada Heading1/2/3 pelo nome", () => {
    expect(resolveHeadingStyleLevel(para("Heading1"), UFLA_STYLES).level).toBe(1);
    expect(resolveHeadingStyleLevel(para("Heading2"), UFLA_STYLES).level).toBe(2);
    expect(resolveHeadingStyleLevel(para("Heading3"), UFLA_STYLES).level).toBe(3);
  });

  it("aceita outlineLvl direto no parágrafo (sem estilo)", () => {
    expect(resolveHeadingStyleLevel(para(null, 1), UFLA_STYLES).level).toBe(2);
  });

  it("rejeita estilo ufla referenciado mas inexistente em styles.xml", () => {
    const r = resolveHeadingStyleLevel(para("ufla_titulo_primario"), stylesXmlWith({}));
    expect(r.level).toBeNull();
    expect(r.errors.join(" ")).toContain("inexistente");
  });

  it("rejeita estilo próprio sem w:outlineLvl em styles.xml", () => {
    const r = resolveHeadingStyleLevel(
      para("ufla_titulo_primario"),
      stylesXmlWith({ ufla_titulo_primario: {} }),
    );
    expect(r.level).toBeNull();
    expect(r.errors.join(" ")).toContain("outlineLvl");
  });

  it("rejeita outlineLvl divergente do esperado para o estilo", () => {
    const r = resolveHeadingStyleLevel(
      para("ufla_titulo_primario"),
      stylesXmlWith({ ufla_titulo_primario: { outline: 1 } }),
    );
    expect(r.level).toBeNull();
    expect(r.errors.join(" ")).toContain("esperado 0");
  });

  it("rejeita outlineLvl fora da faixa de títulos (0-2)", () => {
    const r = resolveHeadingStyleLevel(para(null, 5), UFLA_STYLES);
    expect(r.level).toBeNull();
    expect(r.errors.join(" ")).toContain("fora da faixa");
  });

  it("estilo arbitrário (não título) não gera nível nem erro", () => {
    const r = resolveHeadingStyleLevel(para("ufla_corpo_texto"), UFLA_STYLES);
    expect(r.level).toBeNull();
    expect(r.errors).toEqual([]);
  });

  it("parágrafo sem estilo e sem outlineLvl não é título", () => {
    expect(resolveHeadingStyleLevel(para(null), UFLA_STYLES).level).toBeNull();
  });

  it("headingParagraphsAtLevel classifica somente o nível pedido", () => {
    const doc =
      para("ufla_titulo_primario") +
      para("ufla_corpo_texto") +
      para("ufla_titulo_secundario") +
      para("ufla_titulo_terciario");
    expect(headingParagraphsAtLevel(doc, UFLA_STYLES, 1)).toHaveLength(1);
    expect(headingParagraphsAtLevel(doc, UFLA_STYLES, 2)).toHaveLength(1);
    expect(headingParagraphsAtLevel(doc, UFLA_STYLES, 3)).toHaveLength(1);
  });

  it("classifyHeadingParagraphs expõe styleId, outlineLevel e origem legada", () => {
    const [classified] = classifyHeadingParagraphs(para("Heading2"), UFLA_STYLES);
    expect(classified.styleId).toBe("Heading2");
    expect(classified.outlineLevel).toBe(1);
    expect(classified.legacy).toBe(true);
    expect(classified.errors).toEqual([]);
  });
});
