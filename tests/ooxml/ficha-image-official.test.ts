/**
 * B2 (checklist-15): ficha catalográfica em IMAGEM no DOCX final.
 *
 * Cutter/CDU não são validáveis por texto numa imagem; a evidência de ficha
 * OFICIAL da Biblioteca Universitária da UFLA fica no texto alternativo do
 * docPr (ficha-image-official no OOXML) + aviso não-bloqueante na UI
 * (ficha-image-confirm). Critério: DOCX com ficha-imagem não bloqueia sem
 * evidência de ficha oficial, e a regra fica documentada no checker.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";
import type { AcademicFields } from "../../src/ufla-rules";
import { loadDocxPartsFromBytes, runOoxmlChecks } from "../../scripts/ufla-compliance/ooxml-checks";

const LOGO = new Uint8Array(readFileSync("public/assets/ufla-logo.jpeg"));

async function buildDocx(altDesc?: string): Promise<{ blob: Blob; documentXml: string }> {
  const blob = await generateDocxBlob({
    fields: {
      ...emptyAcademicFields(),
      workType: "dissertacao",
      author: "MARIA SILVA",
      title: "Titulo da pesquisa",
      program: "Programa de Pos-Graduacao",
      advisor: "Prof. Dr. Joao Santos",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "teste",
    },
    editorText: "# 1 INTRODUCAO\nTexto do corpo.",
    fichaCatalograficaImage: { data: LOGO, width: 460, height: 300 },
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  let documentXml = await zip.file("word/document.xml")!.async("string");
  if (altDesc !== undefined) {
    documentXml = documentXml.replace(
      /<wp:docPr\b[^>]*name="ficha-catalografica"[^>]*>/,
      `<wp:docPr id="1" name="ficha-catalografica" descr="${altDesc}" title="Ficha catalografica"/>`,
    );
    zip.file("word/document.xml", documentXml);
    const patched = await zip.generateAsync({ type: "uint8array" });
    return { blob: new Blob([patched as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), documentXml };
  }
  return { blob, documentXml };
}

describe("B2 — ficha catalografica em IMAGEM: alt-text oficial (OOXML) + aviso na UI", () => {
  it("DOCX com ficha-imagem com descricao oficial passa no runOoxmlChecks", async () => {
    const { blob } = await buildDocx();
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const issues = runOoxmlChecks(parts);
    expect(issues.filter((i) => i.code === "ficha-image-official")).toEqual([]);
  });

  it("alt-text sem 'oficial'/'Biblioteca' gera ficha-image-official (erro estrutural)", async () => {
    const { blob } = await buildDocx("Imagem qualquer da ficha");
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const issues = runOoxmlChecks(parts);
    const err = issues.find((i) => i.code === "ficha-image-official");
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
  });

  it("sem imagem de ficha nao dispara ficha-image-official (sem falso positivo)", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao",
        author: "MARIA SILVA",
        title: "Titulo",
        program: "P",
        advisor: "A",
        location: "Lavras",
        year: "2026",
        resumo: "R",
        palavrasChave: "k",
        fichaCatalografica: "S586f CDU 001.4:004",
      },
      editorText: "# 1 INTRODUCAO\nTexto.",
    });
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const issues = runOoxmlChecks(parts);
    expect(issues.filter((i) => i.code === "ficha-image-official")).toEqual([]);
  });

  it("UI: ficha-imagem anexada gera aviso NAO-bloqueante (ficha-image-confirm)", () => {
    const fields: AcademicFields = { ...emptyAcademicFields(), workType: "dissertacao", author: "MARIA SILVA", title: "Titulo", resumo: "R", palavrasChave: "k", year: "2026" };
    const issues = validateWork(fields, "# 1 INTRODUCAO\nTexto.", { fichaImageProvided: true });
    const warn = issues.find((i) => i.code === "ficha-image-confirm");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warning");
    expect(issues.filter((i) => i.code === "ficha-image-confirm")).toHaveLength(1);
  });

  it("UI: sem imagem nao gera ficha-image-confirm", () => {
    const fields: AcademicFields = { ...emptyAcademicFields(), workType: "dissertacao", author: "MARIA SILVA", title: "Titulo", resumo: "R", palavrasChave: "k", year: "2026" };
    const issues = validateWork(fields, "# 1 INTRODUCAO\nTexto.");
    expect(issues.some((i) => i.code === "ficha-image-confirm")).toBe(false);
  });
});
