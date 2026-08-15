import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { validatePagination } from "../../scripts/ufla-compliance/validate-pagination";
import { generateDocxBlob } from "../../src/export-docx";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { PER_TYPE_EDITOR_TEXT, PER_TYPE_FIELDS } from "../../scripts/ufla-compliance/per-type-fixtures";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

async function writeTempDocx(blob: Blob): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ufla-pag-"));
  const path = join(dir, "doc.docx");
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
  return path;
}

describeWithArtifacts(
  "rendering: paginação física (DECISION-010 — contagem contínua a partir da folha de rosto)",
  ["ufla-compliance/normalized-dissertacao.docx", "ufla-compliance/rendered/normalized-dissertacao.pdf"],
  () => {
    const docx = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
    const pdf = join(root, "artifacts", "ufla-compliance", "rendered", "normalized-dissertacao.pdf");

    it("dissertação: declaração OOXML coincide com o que o Word renderizou (pgNumType start=13 ↔ folha 18 = 13)", async () => {
      const r = await validatePagination(docx, pdf, "dissertacao");
      expect(r.isValid).toBe(true);
      expect(r.errors).toEqual([]);
      expect(r.declaredStart).toBe(13);
      expect(r.firstVisiblePage).toBe(18);
      expect(r.firstVisibleValue).toBe(13);
      expect(r.totalPages).toBeGreaterThan(100);
      expect(r.preTextualPages).toBe(17);
    });

    it("nenhuma pré-textual exibe número e a sequência é contínua até o fim", async () => {
      const r = await validatePagination(docx, pdf, "dissertacao");
      expect(r.isValid).toBe(true);
      expect(r.warnings.some((w) => w.includes("contínua"))).toBe(true);
    });

    it("reporta erro quando o DOCX não existe (contrato do validador)", async () => {
      const r = await validatePagination(join(root, "artifacts", "ufla-compliance", "nao-existe.docx"), undefined, "dissertacao");
      expect(r.isValid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    });
  },
);

describe("ooxml: regra de paginação por tipo (DECISION-010)", () => {
  it("dissertação com parte pré-textual declara pgNumType start=9 e é válida (OOXML, sem PDF)", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Maria Silva",
      title: "Qualidade do cafe no sul de Minas",
      location: "Lavras - MG",
      year: "2026",
      program: "Educação Científica e Ambiental",
      advisor: "Prof. Dr. João Silva",
      resumo: "Resumo do trabalho.",
      palavrasChave: "cafe; qualidade",
      abstractText: "Abstract text.",
      keywords: "coffee; quality",
      referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
      indicadoresImpacto: "Impacto social: informado.",
    };
    const editorText = [
      "# 1 INTRODUCAO",
      "Texto.",
      "Figura 1 - Modelo conceitual",
      "Fonte: elaborado pelo autor (2026).",
      "Tabela 1 - Dados coletados",
      "Fonte: elaborado pelo autor (2026).",
      "# 2 METODOLOGIA",
      "Texto.",
    ].join("\n");
    const path = await writeTempDocx(await generateDocxBlob({ fields, editorText }));
    const r = await validatePagination(path, undefined, "dissertacao");
    expect(r.isValid).toBe(true);
    expect(r.declaredStart).toBe(9);
  });

  it("projeto de pesquisa (sem pré-textuais) inicia em 1 e é válido", async () => {
    const blob = await generateResearchProjectDocxBlob({ fields: PER_TYPE_FIELDS.projeto_pesquisa, editorText: PER_TYPE_EDITOR_TEXT });
    const path = await writeTempDocx(blob);
    const r = await validatePagination(path, undefined, "projeto_pesquisa");
    expect(r.isValid).toBe(true);
    expect(r.declaredStart).toBe(1);
  });

  it("o mesmo DOCX de projeto, validado como dissertação, reporta o reinício em 1", async () => {
    const blob = await generateResearchProjectDocxBlob({ fields: PER_TYPE_FIELDS.projeto_pesquisa, editorText: PER_TYPE_EDITOR_TEXT });
    const path = await writeTempDocx(blob);
    const r = await validatePagination(path, undefined, "dissertacao");
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.includes("reinicia a numeração em 1"))).toBe(true);
  });
});
