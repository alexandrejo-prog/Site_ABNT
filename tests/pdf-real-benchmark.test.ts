import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { generateDocxBlob, type DocxGenerationInput } from "../src/export-docx";

const TMP_DIR = join(process.cwd(), "tmp");

function listRealPdfs(): string[] {
  try {
    return readdirSync(TMP_DIR).filter((name) => name.toLowerCase().endsWith(".pdf"));
  } catch {
    return [];
  }
}

const ACCEPTABLE_CONFIDENCE = new Set(["alta", "media"]);

describe("benchmark de PDFs reais da UFLA em tmp/", () => {
  const pdfs = listRealPdfs();

  it("encontra os PDFs reais de benchmark no diretorio tmp/", () => {
    expect(pdfs.length).toBeGreaterThan(0);
  });

  for (const fileName of pdfs) {
    it(`processa "${fileName}" com referencias, conclusao e DOCX acessivel`, async () => {
      const buffer = readFileSync(join(TMP_DIR, fileName));
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], fileName, { type: "application/pdf" });

      const result = await importDocumentFile(file);
      expect(result.sourceKind).toBe("pdf");
      expect(result.fields.referencias.trim().length).toBeGreaterThan(0);
      expect(result.fields.conclusao.trim().length).toBeGreaterThan(0);

      const refConf = result.confidence.referencias;
      const conclConf = result.confidence.conclusao;
      expect(ACCEPTABLE_CONFIDENCE.has(refConf)).toBe(true);
      expect(ACCEPTABLE_CONFIDENCE.has(conclConf)).toBe(true);

      const input: DocxGenerationInput = {
        fields: result.fields,
        editorText: result.editorText,
        importedImages: result.importedImages,
        importedTables: result.importedTables,
      };
      const blob = await generateDocxBlob(input);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());

      const documentXml = await zip.file("word/document.xml")?.async("string");
      expect(documentXml).toBeDefined();
      expect(documentXml).toContain("REFER");

      const conclusaoContent = result.fields.conclusao
        .replace(/^\s*#+\s*/, "")
        .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      const conclusaoSample = conclusaoContent.slice(0, 20).toUpperCase();
      expect(conclusaoSample.length).toBeGreaterThan(0);
      expect(documentXml?.toUpperCase()).toContain(conclusaoSample.slice(0, 10));

      const stylesXml = await zip.file("word/styles.xml")?.async("string");
      expect(stylesXml).toContain('w:lang');

      const coreXml = await zip.file("docProps/core.xml")?.async("string");
      expect(coreXml).toContain("dc:title");
      expect(coreXml).toContain("dc:creator");
      expect(coreXml).toContain("dc:subject");

      const referencesContent = result.fields.referencias;
      const sample = referencesContent
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40)
        .toUpperCase();
      expect(documentXml?.toUpperCase()).toContain(sample.slice(0, 10));
    }, 120_000);
  }
});
