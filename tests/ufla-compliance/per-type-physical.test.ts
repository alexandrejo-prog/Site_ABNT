import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { entryTypeFor } from "../../scripts/ufla-compliance/analyze-per-type-pdfs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

describe("ufla-compliance: mapeamento de tipo por arquivo (física PDF)", () => {
  it("longos (monografia/dissertação/tese) mapeiam para o tipo do draft", () => {
    expect(entryTypeFor("monografia-draft.docx")).toBe("monografia");
    expect(entryTypeFor("dissertacao-draft.docx")).toBe("dissertacao");
    expect(entryTypeFor("tese-draft.docx")).toBe("tese");
  });

  it("formatos da Coleção mapeiam para artigo (estrutura de artigo)", () => {
    for (const f of [
      "patente_ufla.docx",
      "revisao_sistematica_ufla.docx",
      "estudo_caso_ufla.docx",
      "software_aplicativo_ufla.docx",
      "cultivar_ufla.docx",
      "relatorio_estagio_ufla.docx",
      "proposta_intervencao_ufla.docx",
      "artigo_cientifico_ufla.docx",
    ]) {
      expect(entryTypeFor(f), f).toBe("artigo");
    }
  });

  it("demais tipos padrão", () => {
    expect(entryTypeFor("artigo.docx")).toBe("artigo");
    expect(entryTypeFor("tcc.docx")).toBe("tcc");
    expect(entryTypeFor("resumo-expandido-cpg.docx")).toBe("resumo_expandido_cpg");
    expect(entryTypeFor("projeto-pesquisa.docx")).toBe("projeto_pesquisa");
  });
});

describeWithArtifacts(
  "ufla-compliance: física PDF por tipo (DECISION-009/010 — render Word COM + A4 + paginação)",
  ["ufla-compliance/per-type-physical.json"],
  () => {
    const artifact = join(root, "artifacts", "ufla-compliance", "per-type-physical.json");

    function loadArtifact(): { rendered: Record<string, any>; wordAvailable: boolean; passed: boolean; failures: string[] } {
      return JSON.parse(readFileSync(artifact, "utf8"));
    }

    it("artefato presente, com 15 DOCX renderizados (4 padrão + 3 drafts + 8 Coleção)", () => {
      const a = loadArtifact();
      expect(Object.keys(a.rendered).length).toBe(15);
    });

    it("todo tipo renderizado tem A4 (595.32 × 841.92 pt) e paginação OOXML↔PDF alinhada", () => {
      const a = loadArtifact();
      for (const [file, entry] of Object.entries(a.rendered)) {
        const e = entry as any;
        expect(e.pages, file).toBeGreaterThan(0);
        expect(e.pageSize?.width, file).toBeCloseTo(595.32, 1);
        expect(e.pageSize?.height, file).toBeCloseTo(841.92, 1);
        expect(e.pagination?.passed, file).toBe(true);
        expect(e.pagination?.errors ?? [], file).toEqual([]);
      }
    });

    it("gate overall passed (ou skip-no-word em ambiente sem Word)", () => {
      const a = loadArtifact();
      if (a.wordAvailable) {
        expect(a.passed).toBe(true);
        expect(a.failures).toEqual([]);
      } else {
        // sem Word não há PDF para analisar — todos os tipos devem estar skipped-no-word
        expect(Object.values(a.rendered).every((e: any) => e.status === "skipped-no-word")).toBe(true);
      }
    });
  },
);
