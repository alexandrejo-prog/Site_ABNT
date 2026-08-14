import { describe, it, expect, beforeAll } from "vitest";
import { baselineRoundTrip, type BaselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { loadDocxParts } from ".././test-utils/ooxml";

/**
 * Capa literal: não basta "existe uma capa". Valida conteúdo real (autor,
 * título, subtítulo, instituição, local, ano), ordem dos elementos, acentuação,
 * texto completo, centralização, negrito e fonte no DOCX gerado vivo.
 */

interface CoverParagraph {
  text: string;
  center: boolean;
  bold: boolean;
  font: string;
}

function coverParagraphs(documentXml: string): CoverParagraph[] {
  const out: CoverParagraph[] = [];
  for (const p of documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    const text = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
    if (!text.trim()) continue;
    out.push({
      text: text.trim(),
      center: /<w:jc w:val="center"\/>/.test(p),
      bold: /<w:b\/>|<w:b w:val="true"\/>/.test(p),
      font: /w:ascii="([^"]+)"/.exec(p)?.[1] ?? "",
    });
  }
  return out;
}

describe("acceptance: capa literal (conteudo real, ordem e estilo)", () => {
  let rt: BaselineRoundTrip;
  let paras: CoverParagraph[];

  beforeAll(async () => {
    rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);
    paras = coverParagraphs(parts.documentXml);
  });

  const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  const indexOf = (text: string) => {
    const folded = fold(text);
    return paras.findIndex((p) => fold(p.text).includes(folded));
  };

  const indexOfExact = (text: string) => {
    const folded = fold(text);
    return paras.findIndex((p) => fold(p.text) === folded);
  };

  it("ordem dos elementos da capa: instituicao, autor, titulo, local, ano", () => {
    const institution = indexOf("UNIVERSIDADE FEDERAL DE LAVRAS");
    const author = indexOf(rt.input.fields.author);
    const title = indexOf((rt.input.fields.title ?? "").slice(0, 40));
    const location = indexOf("LAVRAS - MG");
    const year = indexOfExact(rt.input.fields.year ?? "2013");

    for (const [name, idx] of [
      ["instituicao", institution],
      ["autor", author],
      ["titulo", title],
      ["local", location],
      ["ano", year],
    ] as const) {
      expect(idx, `capa sem ${name} no DOCX gerado`).toBeGreaterThanOrEqual(0);
    }
    expect(author).toBeGreaterThan(institution);
    expect(title).toBeGreaterThan(author);
    expect(location).toBeGreaterThan(title);
    expect(year).toBeGreaterThan(location);
  });

  it("instituicao, autor e titulo em negrito, centralizados e em Times New Roman", () => {
    const institution = paras[indexOf("UNIVERSIDADE FEDERAL DE LAVRAS")];
    const author = paras[indexOf(rt.input.fields.author)];
    const title = paras[indexOf((rt.input.fields.title ?? "").slice(0, 40))];

    for (const [name, p] of [
      ["instituicao", institution],
      ["autor", author],
      ["titulo", title],
    ] as const) {
      expect(p, `${name} ausente`).toBeDefined();
      expect(p.center, `${name} nao centralizado`).toBe(true);
      expect(p.bold, `${name} nao em negrito`).toBe(true);
      expect(p.font, `${name} com fonte errada`).toMatch(/Times New Roman/i);
    }
  });

  it("acentuacao preservada no titulo (nao e uma versao sem acentos)", () => {
    const raw = paras.map((p) => p.text).join(" ");
    const title = rt.input.fields.title ?? "";
    const accents = [...new Set(title.match(/[À-ÿ]/g) ?? [])];
    expect(accents.length, `titulo do baseline sem acentos para testar: ${title.slice(0, 40)}`).toBeGreaterThan(0);
    for (const accent of accents) {
      expect(raw, `acento '${accent}' perdido no titulo da capa`).toContain(accent);
    }
  });

  it("subtitulo (apos os dois-pontos do titulo) presente na capa", () => {
    const title = rt.input.fields.title ?? "";
    const colonIndex = title.indexOf(":");
    if (colonIndex < 0) return; // sem subtitulo no baseline
    const subtitle = title.slice(colonIndex + 1).trim();
    expect(subtitle.length).toBeGreaterThan(3);
    const found = paras.some((p) =>
      p.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes(
        subtitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().slice(0, 30),
      ),
    );
    expect(found, `subtitulo ausente na capa: ${subtitle.slice(0, 40)}`).toBe(true);
  });

  it("local e ano do baseline presentes na capa", () => {
    expect(indexOf("LAVRAS - MG")).toBeGreaterThanOrEqual(0);
    expect(indexOfExact(rt.input.fields.year ?? "2013")).toBeGreaterThanOrEqual(0);
  });
});
