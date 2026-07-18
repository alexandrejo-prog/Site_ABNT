import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importDocumentFile, blockText } from "../src/import-docx";
import { generateDocxBlob } from "../src/export-docx";
import { buildFigureAudit, generateFigureReportMarkdown } from "../src/figure-audit";

const TMP_DIR = join(process.cwd(), "tmp");

function listRealPdfs(): string[] {
  try {
    return readdirSync(TMP_DIR).filter(
      (name) => name.toLowerCase().endsWith(".pdf") && !name.startsWith("~$") && !name.startsWith("bench_"),
    );
  } catch {
    return [];
  }
}

async function countDrawingsAndMedia(blob: Blob): Promise<{ drawings: number; media: number }> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const drawings = documentXml ? (documentXml.match(/<w:drawing/g) || []).length : 0;
  const mediaFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/media/") && !zip.files[name].dir,
  );
  return { drawings, media: mediaFiles.length };
}

class FilePolyfill {
  constructor(private buf: Uint8Array, public name: string, public type = "application/pdf") {}
  async arrayBuffer() {
    return this.buf.slice(0);
  }
}

describe("R14 — auditoria e preservação de figuras", () => {
  const pdfs = listRealPdfs();
  it("encontra ao menos um PDF real de benchmark em tmp/", () => {
    expect(pdfs.length).toBeGreaterThan(0);
  });

  for (const fileName of pdfs) {
    it(`processa "${fileName}" e valida consistência de figuras no DOCX gerado`, async () => {
      const path = join(TMP_DIR, fileName);
      const buf = new Uint8Array(readFileSync(path));
      const file = new FilePolyfill(buf, fileName) as unknown as File;

      const result = await importDocumentFile(file);
      const images = result.importedImages || [];
      const audit = result.figureAudit ?? buildFigureAudit(images, result.pdfDiagnostic!);

      // 1) O relatório reflete exatamente o que aconteceu (não regiões candidatas).
      const inserted = audit.inserted;
      const lost = audit.lost;
      const confirmed = audit.confirmedFigures;

      expect(confirmed).toBeGreaterThanOrEqual(inserted);
      // Nenhuma figura válida desaparece silenciosamente: inseridas == rasterizadas.
      expect(inserted).toBe(audit.rasterized);

      // 2) Gera o DOCX e valida drawings/media contra figuras inseridas.
      const blob = await generateDocxBlob({
        fields: result.fields,
        editorText: (result.blocks || []).map((b) => blockText(b)).join("\n"),
        importedImages: images,
        importedTables: result.importedTables,
      });
      const { drawings, media } = await countDrawingsAndMedia(blob);

      // O número de figuras inseridas deve coincidir exatamente com:
      // - <w:drawing> no document.xml
      // - arquivos em word/media
      expect(drawings).toBe(inserted);
      expect(media).toBe(inserted);

      // 3) O aviso (banner) usa apenas figuras realmente perdidas/preservadas.
      const warning = result.fields.imageWarnings || "";
      // Nunca deve basear perda em "regiões candidatas detectadas".
      expect(warning).not.toMatch(/regi[õo]es candidatas/i);
      if (inserted > 0 && lost === 0) {
        expect(warning).toMatch(/IMAGENS PRESERVADAS/i);
      }
      // Nunca deve alegar perda de figuras confirmadas quando não há nenhuma confirmada.
      if (confirmed === 0) {
        expect(warning).not.toMatch(/IMAGENS NÃO PRESERVADAS/i);
      }

      // 4) Escreve o relatório detalhado para inspeção (R14-4).
      const reportDir = TMP_DIR;
      if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
      const md = generateFigureReportMarkdown(audit, {
        fileName,
        source: "Conversão PDF → DOCX (Site_ABNT) — teste automatizado",
        generatedAt: new Date().toISOString(),
      });
      writeFileSync(join(reportDir, "RELATORIO_FIGURAS.md"), md, "utf8");

      // Sanidade do relatório: contempla resumo e tabela por figura.
      expect(md).toContain("## Resumo");
      expect(md).toContain("| Página | Legenda | Tipo |");
      // O relatório não deve tratar região candidata como perda.
      expect(md).toContain("Região candidata");
    }, 180000);
  }
});
