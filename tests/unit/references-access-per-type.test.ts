/**
 * A6 (checklist-15): "Acesso em" obrigatório para referência online por tipo.
 *
 * O validador (validateReferencesText → reference-access-missing) é agnóstico
 * de tipo, mas o critério de aceite exige uma MATRIZ por tipo provando que
 * NENHUM tipo gera DOCX com referência online sem acesso em: cada um dos 4
 * exportadores principais deve (a) bloquear (severity error) sem "Acesso em:"
 * e (b) não gerar falso positivo com a data presente; e o round-trip vivo
 * prova que o texto "Acesso em:" sobrevive à exportação de cada tipo.
 */
import { describe, it, expect } from "vitest";
import { validateWork } from "../../src/validators";
import { importDocumentFile } from "../../src/import-docx";
import { PER_TYPE_FIELDS, PER_TYPE_EDITOR_TEXT } from "../../scripts/ufla-compliance/per-type-fixtures";
import { generateDocxBlob } from "../../src/export-docx";
import { generateArticleDocxBlob } from "../../src/export-article-docx";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";

const ONLINE_WITHOUT_ACCESS =
  "SILVA, M. Política de acesso aberto. 2024. Disponível em: https://exemplo.test/artigo.pdf.";
const ONLINE_WITH_ACCESS =
  "SILVA, M. Política de acesso aberto. 2024. Disponível em: https://exemplo.test/artigo.pdf. Acesso em: 10 jan. 2026.";

/** Tipos principais × exportador correspondente (matriz A6). */
const MATRIX = [
  { formatId: "artigo", label: "Artigo academico", generate: (f: Parameters<typeof generateArticleDocxBlob>[0]) => generateArticleDocxBlob(f) },
  { formatId: "tcc", label: "Monografia/TCC", generate: (f: Parameters<typeof generateDocxBlob>[0]) => generateDocxBlob(f) },
  { formatId: "resumo_expandido_cpg", label: "Resumo expandido CPG", generate: (f: Parameters<typeof generateCpgDocxBlob>[0]) => generateCpgDocxBlob(f) },
  { formatId: "projeto_pesquisa", label: "Projeto de pesquisa", generate: (f: Parameters<typeof generateResearchProjectDocxBlob>[0]) => generateResearchProjectDocxBlob(f) },
] as const;

describe("A6 — 'Acesso em' obrigatorio por tipo (matriz 4 exportadores)", () => {
  for (const spec of MATRIX) {
    describe(spec.label, () => {
      it("referencia online SEM 'Acesso em:' BLOQUEIA a versao final", () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId], referencias: ONLINE_WITHOUT_ACCESS };
        const issues = validateWork(fields, PER_TYPE_EDITOR_TEXT);
        const access = issues.find((i) => i.code === "reference-access-missing");
        expect(access, `tipo ${spec.formatId} deve acusar reference-access-missing`).toBeDefined();
        expect(access!.severity).toBe("error");
        expect(access!.message).toMatch(/bloqueia/);
      });

      it("referencia online COM 'Acesso em:' nao gera falso positivo", () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId], referencias: ONLINE_WITH_ACCESS };
        const issues = validateWork(fields, PER_TYPE_EDITOR_TEXT);
        expect(issues.some((i) => i.code === "reference-access-missing")).toBe(false);
      });

      it("round-trip vivo: exportacao preserva 'Acesso em:' no DOCX gerado", async () => {
        const fields = { ...PER_TYPE_FIELDS[spec.formatId], referencias: ONLINE_WITH_ACCESS };
        const blob = await spec.generate({ fields, editorText: PER_TYPE_EDITOR_TEXT });
        const reimported = await importDocumentFile(
          new File([await blob.arrayBuffer()], `${spec.formatId}.docx`, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
        const text = (reimported.fields.referencias || "").replace(/\s+/g, " ").trim();
        expect(text).toContain("https://exemplo.test/artigo.pdf");
        expect(text).toContain("Acesso em: 10 jan. 2026.");
      });
    });
  }
});
