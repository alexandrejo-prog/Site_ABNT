/**
 * A2/A3 (checklist-15): física por tipo — capa e folha de rosto no PDF.
 *
 * A2: a página 1 (capa) deve conter institucional → autor → título → local/ano
 * na ordem vertical, com o logo presente (o gate per-type físico roda no
 * ufla:audit com Word; aqui testamos a verificação pura).
 * A3: folha de rosto (página 2) sem número visível e Introdução com o valor
 * contado (validado via validatePagination no gate — coberto por per-type).
 */
import { describe, it, expect } from "vitest";
import { verifyCoverPhysical, COVER_TYPES, COUNTED_TYPES, fixtureFieldsFor } from "../../scripts/ufla-compliance/analyze-per-type-pdfs";

const EXPECTED = { author: "Maria Silva", title: "Qualidade do cafe no sul de Minas" };

const validLines = [
  { text: "UNIVERSIDADE FEDERAL DE LAVRAS", y: 97 },
  { text: "MARIA SILVA", y: 181 },
  { text: "QUALIDADE DO CAFE NO SUL DE MINAS", y: 295 },
  { text: "LAVRAS - MG", y: 511 },
  { text: "2026", y: 535 },
];

describe("A2 — capa física (página 1)", () => {
  it("capa válida: institucional → autor → título → local/ano em ordem + logo", () => {
    const cover = verifyCoverPhysical(validLines, 1, EXPECTED);
    expect(cover.passed).toBe(true);
    expect(cover.ordered).toBe(true);
    expect(cover.logo).toBe(true);
    expect(cover.reasons).toEqual([]);
  });

  it("falha sem o institucional", () => {
    const cover = verifyCoverPhysical(validLines.slice(1), 1, EXPECTED);
    expect(cover.passed).toBe(false);
    expect(cover.institutional).toBe(false);
  });

  it("falha com ordem vertical trocada (título acima do autor na página)", () => {
    const reordered = [
      { text: "UNIVERSIDADE FEDERAL DE LAVRAS", y: 97 },
      { text: "QUALIDADE DO CAFE NO SUL DE MINAS", y: 120 },
      { text: "MARIA SILVA", y: 295 },
      { text: "LAVRAS - MG", y: 511 },
      { text: "2026", y: 535 },
    ];
    const cover = verifyCoverPhysical(reordered, 1, EXPECTED);
    expect(cover.passed).toBe(false);
    expect(cover.reasons.join("; ")).toMatch(/ordem vertical/);
  });

  it("falha sem o logo (imagem) na capa", () => {
    const cover = verifyCoverPhysical(validLines, 0, EXPECTED);
    expect(cover.passed).toBe(false);
    expect(cover.reasons.join("; ")).toMatch(/logo/);
  });

  it("falha com autor divergente da fixture", () => {
    const cover = verifyCoverPhysical([{ text: "OUTRO AUTOR", y: 181 }, ...validLines.filter((l) => l.text !== "MARIA SILVA")], 1, EXPECTED);
    expect(cover.passed).toBe(false);
    expect(cover.author).toBe(false);
  });

  it("mapeia arquivo → fixture (author/title) para os tipos de capa", () => {
    expect(fixtureFieldsFor("tcc.docx")).toEqual(EXPECTED);
    expect(fixtureFieldsFor("monografia-draft.docx")).toEqual(EXPECTED);
    expect(fixtureFieldsFor("projeto-pesquisa.docx")).toEqual(EXPECTED);
    expect(fixtureFieldsFor("artigo.docx")).toEqual(EXPECTED);
  });
});

describe("A3 — folha de rosto e contagem", () => {
  it("tipos com capa/folha de rosto são os pré-textuais esperados", () => {
    expect(COVER_TYPES.has("tcc")).toBe(true);
    expect(COVER_TYPES.has("monografia")).toBe(true);
    expect(COVER_TYPES.has("dissertacao")).toBe(true);
    expect(COVER_TYPES.has("tese")).toBe(true);
    expect(COVER_TYPES.has("projeto_pesquisa")).toBe(true);
    expect(COVER_TYPES.has("artigo")).toBe(false);
    expect(COVER_TYPES.has("resumo_expandido_cpg")).toBe(false);
  });

  it("contagem contínua (Introdução ≥ 2) vale para os tipos contados", () => {
    expect(COUNTED_TYPES.has("tcc")).toBe(true);
    expect(COUNTED_TYPES.has("monografia")).toBe(true);
    expect(COUNTED_TYPES.has("dissertacao")).toBe(true);
    expect(COUNTED_TYPES.has("tese")).toBe(true);
    // projeto/artigo/CPG iniciam a numeração na 1ª folha textual (matriz).
    expect(COUNTED_TYPES.has("projeto_pesquisa")).toBe(false);
    expect(COUNTED_TYPES.has("artigo")).toBe(false);
  });
});
