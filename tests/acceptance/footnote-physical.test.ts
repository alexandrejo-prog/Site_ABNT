/**
 * B1 (checklist-15): notas de rodapé FÍSICAS no PDF renderizado por Word.
 *
 * Critério de aceite: nota presente no DOCX (footnotes.xml) aparece no PDF
 * com fonte menor que o corpo; 0 notas perdidas (cobertura 100% — não apenas
 * "alguma nota encontrada"). O matching usa os fixtures com notas renderizados
 * por Word (artifacts/ufla-compliance/{fixtures,rendered/fixtures}); sem os
 * PDFs (ambiente sem Word) o bloco de fixtures é pulado (artifact-guard), mas
 * os helpers puros (similaridade/cobertura) são testados sempre.
 */
import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import {
  extractFootnotesFromDocx,
  normalizeForMatch,
  footnoteSimilarity,
  matchFootnotesToPdf,
  analyzeFixture,
  runFootnotePhysicalGate,
  type FootnoteEntry,
} from "../../scripts/ufla-compliance/detect-footer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = join(root, "artifacts", "ufla-compliance", "fixtures");

describe("B1 — helpers puros (similaridade e cobertura de notas)", () => {
  it("normalizeForMatch remove acentos, caixa e espaços", () => {
    expect(normalizeForMatch("Nota de rodapé do projeto.")).toBe("nota de rodape do projeto.");
    expect(normalizeForMatch("  AÇÕES  E   Resultados ")).toBe("acoes e resultados");
  });

  it("footnoteSimilarity: igual → 1; contido → 0.85; distinto → baixo", () => {
    expect(footnoteSimilarity("Nota de rodapé do projeto.", "Nota de rodapé do projeto.")).toBe(1);
    expect(footnoteSimilarity("projeto: Nota de rodapé do projeto.", "Nota de rodapé do projeto.")).toBeGreaterThan(0.8);
    expect(footnoteSimilarity("Referência bibliográfica qualquer.", "Nota de rodapé do projeto.")).toBeLessThan(0.6);
  });

  it("matchFootnotesToPdf: cobre TODAS as notas (0 perdidas) e marca ids", () => {
    const footnotes: FootnoteEntry[] = [
      { id: "1", text: "Nota de rodapé do projeto." },
      { id: "2", text: "Segunda nota explicativa." },
    ];
    const footer = [
      { page: 6, text: "Nota de rodapé do projeto.", y0: 50, y1: 62, x0: 70, x1: 300, fontSize: 11 },
      { page: 7, text: "Segunda nota explicativa.", y0: 45, y1: 57, x0: 70, x1: 280, fontSize: 11 },
    ];
    const { elements, matchedIds } = matchFootnotesToPdf(footnotes, footer);
    expect(matchedIds.size).toBe(2);
    expect(elements.filter((e) => e.matchesFootnote)).toHaveLength(2);
    expect(matchedIds.has("1") && matchedIds.has("2")).toBe(true);
  });

  it("matchFootnotesToPdf: nota ausente do PDF → não coberta", () => {
    const footnotes: FootnoteEntry[] = [{ id: "1", text: "Nota que sumiu no PDF." }];
    const footer = [{ page: 6, text: "Outro texto no rodapé.", y0: 50, y1: 62, x0: 70, x1: 300, fontSize: 11 }];
    const { matchedIds } = matchFootnotesToPdf(footnotes, footer);
    expect(matchedIds.size).toBe(0);
  });
});

describeWithArtifacts(
  "B1 — notas físicas nos fixtures renderizados por Word",
  ["ufla-compliance/fixtures/fixture-projeto-notas.docx", "ufla-compliance/rendered/fixtures/fixture-projeto-notas.pdf"],
  () => {
    it("fixture-projeto-notas: OOXML tem a nota e o PDF a renderiza 1/1 com fonte menor", async () => {
      const notes = await extractFootnotesFromDocx(join(FIXTURES, "fixture-projeto-notas.docx"));
      expect(notes.length).toBeGreaterThanOrEqual(1);

      const report = await analyzeFixture("fixture-projeto-notas");
      expect(report.docxHasFootnotes).toBe(true);
      expect(report.footnotesMatched).toBe(report.footnotesTotal);
      expect(report.coverageRatio).toBe(1);
      expect(report.fontSizeSmallerThanBody).toBe(true);
      expect(report.bodyFontSize).not.toBeNull();
      if (report.bodyFontSize !== null && report.footnotesMatched > 0) {
        const matched = report.footerRegionElements.filter((e) => e.matchesFootnote && e.fontSize !== null);
        for (const el of matched) expect(el.fontSize!).toBeLessThan(report.bodyFontSize!);
      }
      expect(report.status).toBe("passed");
    });

    it("gate B1: nenhuma nota perdida em nenhum fixture com notas", async () => {
      const gate = await runFootnotePhysicalGate();
      expect(gate.passed, gate.failures.join("; ")).toBe(true);
      expect(gate.wordAvailable).toBe(true);
      for (const r of gate.fixtures.filter((f) => f.docxHasFootnotes)) {
        expect(r.coverageRatio, `${r.fixture} deve cobrir 100% das notas`).toBe(1);
      }
    });
  },
);
