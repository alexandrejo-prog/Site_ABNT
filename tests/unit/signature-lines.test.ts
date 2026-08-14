import { describe, it, expect, beforeAll } from "vitest";
import { baselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { generateDocxBlob } from "../../src/export-docx";
import { loadDocxParts } from ".././test-utils/ooxml";
import { emptyAcademicFields } from "../../src/ufla-rules";

/**
 * Linhas de assinatura e folha de aprovação: nomes, titulação, instituições,
 * orientador, membros da banca, posição, ordem e linhas de assinatura.
 * Decisão automática (sem revisão manual); falha se faltar qualquer item.
 */

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function paragraphTexts(documentXml: string): string[] {
  return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
    .map((p) => [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("").trim())
    .filter(Boolean);
}

const indexOf = (paras: string[], needle: string) =>
  paras.findIndex((p) => fold(p).includes(fold(needle)));

describe("acceptance: folha de aprovacao e linhas de assinatura", () => {
  let paras: string[];

  beforeAll(async () => {
    const rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);
    paras = paragraphTexts(parts.documentXml);
  });

  it("membros da banca com nome, titulacao, instituicao e papel, em ordem", () => {
    const valeria = indexOf(paras, "Valéria da Glória Pereira Brito");
    const vinicius = indexOf(paras, "Vinícius Medina Kern");
    const patricia = indexOf(paras, "Patrícia Aparecida Ferreira — Orientadora");

    for (const [name, idx] of [
      ["Valéria", valeria],
      ["Vinícius", vinicius],
      ["Patrícia (orientadora)", patricia],
    ] as const) {
      expect(idx, `membro da banca ausente: ${name}`).toBeGreaterThanOrEqual(0);
    }
    expect(vinicius).toBeGreaterThan(valeria);
    expect(patricia).toBeGreaterThan(vinicius);
  });

  it("instituicoes e titulacoes da banca preservadas", () => {
    expect(indexOf(paras, "Profa. Dra. Valéria da Glória Pereira Brito")).toBeGreaterThanOrEqual(0);
    expect(indexOf(paras, "— UFLA")).toBeGreaterThanOrEqual(0);
    expect(indexOf(paras, "— UFSC")).toBeGreaterThanOrEqual(0);
    expect(indexOf(paras, "— Orientadora")).toBeGreaterThanOrEqual(0);
  });

  it("orientador com titulo, nome e rotulo no documento gerado", () => {
    expect(indexOf(paras, "Profª Dra Patrícia Aparecida Ferreira")).toBeGreaterThanOrEqual(0);
    expect(indexOf(paras, "Orientador(a) - UFLA")).toBeGreaterThanOrEqual(0);
  });

  it("data de aprovacao real do baseline preservada", () => {
    expect(indexOf(paras, "APROVADO EM: 24 de julho de 2013.")).toBeGreaterThanOrEqual(0);
  });

  it("sem membros informados, emite linhas de assinatura (tracos)", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Titulo da dissertacao",
      program: "Programa de Pos-Graduacao",
      advisor: "Prof. Dr. Joao Santos",
      resumo: "Resumo.",
      palavrasChave: "teste",
      year: "2026",
    };
    const blob = await generateDocxBlob({ fields, editorText: "" });
    const parts = await loadDocxParts(blob);
    const texts = paragraphTexts(parts.documentXml);

    expect(indexOf(texts, "APROVADO EM: ____ de ____________________ de ______.")).toBeGreaterThanOrEqual(0);
    expect(indexOf(texts, "Prof.(a) Dr.(a) ______________________________")).toBeGreaterThanOrEqual(0);
    expect(indexOf(texts, "Instituição: ________________________________")).toBeGreaterThanOrEqual(0);
  });

  it("artigo nao emite folha de aprovacao (nao aplicavel)", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "artigo" as const,
      author: "MARIA SILVA",
      title: "Titulo do artigo",
      resumo: "Resumo.",
      palavrasChave: "teste",
      referencias: "SILVA, M. Titulo. Revista, 2024.",
    };
    const blob = await generateDocxBlob({ fields, editorText: "" });
    const parts = await loadDocxParts(blob);
    const texts = paragraphTexts(parts.documentXml);

    expect(indexOf(texts, "APROVADO EM")).toBe(-1);
    expect(indexOf(texts, "Orientador(a) - UFLA")).toBe(-1);
  });
});
