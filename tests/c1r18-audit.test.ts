import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { buildPdfCopyDocxBlob } from "../src/pdf-to-copy-docx";
import { generateDocxBlob } from "../src/export-docx";
import { buildFigureAudit, generateFigureReportMarkdown } from "../src/figure-audit";
import { detectPdfFigureRegions } from "../src/pdf-figure-extractor";
import { getRasterLog } from "../src/figure-rasterizer";

const TMP = join(process.cwd(), "tmp");
const OUT = join(TMP, "auditoria-C1R18");
mkdirSync(OUT, { recursive: true });

function listPdfs(): string[] {
  return readdirSync(TMP).filter((n) => n.toLowerCase().endsWith(".pdf") && !n.startsWith("~$"));
}

function filePolyfill(buffer: Uint8Array, name: string): File {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new File([ab], name, { type: "application/pdf" });
}

async function docxMetrics(blob: Blob): Promise<{ drawings: number; media: number; size: number }> {
  const ab = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const media = Object.keys(zip.files).filter((f) => f.startsWith("word/media/") && !zip.files[f].dir).length;
  const drawings = (documentXml.match(/<w:drawing>/g) || []).length;
  return { drawings, media, size: ab.byteLength };
}

function words(text: string): Set<string> {
  return new Set(
    (text || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((w) => w.length >= 4),
  );
}

function textPreservationPercent(sourceText: string, targetText: string): number {
  const sw = words(sourceText);
  if (sw.size === 0) return 100;
  const tw = words(targetText);
  let hit = 0;
  for (const w of sw) if (tw.has(w)) hit += 1;
  return Math.round((hit / sw.size) * 1000) / 10;
}

interface PdfEvidence {
  fileName: string;
  pageCount: number;
  candidateRegions: number;
  old: {
    confirmedFigures: number;
    rasterized: number;
    inserted: number;
    lost: number;
    figureDrawings: number;
    figureMedia: number;
    tablesDetected: number;
    tablesPreserved: number;
    textPreservation: number;
    docxSize: number;
    timeMs: number;
  };
  copy: {
    copyFigures: number;
    copyTables: number;
    reimportFigures: number;
    reimportTables: number;
    reimportConfirmedFigures: number;
    reimportLost: number;
    abntDrawings: number;
    abntMedia: number;
    abntTables: number;
    textPreservation: number;
    docxSize: number;
    buildMs: number;
    reimportMs: number;
    abntMs: number;
  };
  rasterLog: unknown;
  notes: string[];
}

const evidence: PdfEvidence[] = [];

describe("C1R18 — auditoria completa (FASE 1-6)", () => {
  const pdfs = listPdfs();
  it(`processa ${pdfs.length} PDFs de benchmark`, async () => {
    for (const fileName of pdfs) {
      const buffer = new Uint8Array(readFileSync(join(TMP, fileName)));
      const notes: string[] = [];
      const t0 = Date.now();

      const oldResult = await importDocumentFile(filePolyfill(buffer, fileName));
      const regions = detectPdfFigureRegions(oldResult.pdfDiagnostic!);
      const audit = buildFigureAudit(oldResult.importedImages, oldResult.pdfDiagnostic!, undefined);
      const oldAbnt = await generateDocxBlob({
        fields: oldResult.fields,
        editorText: oldResult.editorText,
        importedImages: oldResult.importedImages,
        importedTables: oldResult.importedTables,
      });
      const oldMetrics = await docxMetrics(oldAbnt);
      const oldTextPres = textPreservationPercent(
        oldResult.pdfDiagnostic!.reconstruction.blocks.map((b) => b.text).join("\n"),
        oldResult.editorText,
      );

      const tBuild = Date.now();
      const copy = await buildPdfCopyDocxBlob({
        editorText: oldResult.editorText,
        importedImages: oldResult.importedImages,
        importedTables: oldResult.importedTables,
        fileName,
      });
      const buildMs = Date.now() - tBuild;
      const copyBuffer = new Uint8Array(await copy.blob.arrayBuffer());

      const tReimport = Date.now();
      const reimport = await importDocumentFile(filePolyfill(copyBuffer, fileName.replace(/\.pdf$/i, "-copia.docx")));
      const reimportMs = Date.now() - tReimport;
      const reAudit = buildFigureAudit(reimport.importedImages, oldResult.pdfDiagnostic!, undefined);

      const tAbnt = Date.now();
      const newAbnt = await generateDocxBlob({
        fields: reimport.fields,
        editorText: reimport.editorText,
        importedImages: reimport.importedImages,
        importedTables: reimport.importedTables,
      });
      const abntMs = Date.now() - tAbnt;
      const newMetrics = await docxMetrics(newAbnt);
      const newTextPres = textPreservationPercent(
        oldResult.pdfDiagnostic!.reconstruction.blocks.map((b) => b.text).join("\n"),
        reimport.editorText,
      );

      const oldTables = oldResult.importedTables.filter((t) => t.rows.length > 0);
      const newTables = reimport.importedTables.filter((t) => t.rows.length > 0);

      const ev: PdfEvidence = {
        fileName,
        pageCount: oldResult.pdfDiagnostic!.pageCount,
        candidateRegions: regions.length,
        old: {
          confirmedFigures: audit.confirmedFigures,
          rasterized: audit.rasterized,
          inserted: audit.inserted,
          lost: audit.lost,
          figureDrawings: oldMetrics.drawings,
          figureMedia: oldMetrics.media,
          tablesDetected: oldTables.length,
          tablesPreserved: oldTables.filter((t) => t.status === "preserved" || t.status === "preserved-with-layout-warning").length,
          textPreservation: oldTextPres,
          docxSize: oldMetrics.size,
          timeMs: Date.now() - t0,
        },
        copy: {
          copyFigures: copy.figureCount,
          copyTables: copy.tableCount,
          reimportFigures: reimport.importedImages.filter((i) => i.data && i.data.byteLength).length,
          reimportTables: newTables.length,
          reimportConfirmedFigures: reAudit.confirmedFigures,
          reimportLost: reAudit.lost,
          abntDrawings: newMetrics.drawings,
          abntMedia: newMetrics.media,
          abntTables: newTables.filter((t) => t.status === "preserved" || t.status === "preserved-with-layout-warning").length,
          textPreservation: newTextPres,
          docxSize: newMetrics.size,
          buildMs,
          reimportMs,
          abntMs,
        },
        rasterLog: getRasterLog(),
        notes,
      };
      evidence.push(ev);

      const md = generateFigureReportMarkdown(audit, {
        fileName,
        source: "C1R18 fluxo-antigo",
        generatedAt: new Date().toISOString(),
      });
      writeFileSync(join(OUT, `figuras-${fileName.replace(/[^\w.-]/g, "_")}.md`), md);

      const oldConsistent = oldMetrics.drawings === oldMetrics.media && oldMetrics.media === audit.inserted;
      notes.push(`FASE1 old drawings=${oldMetrics.drawings} media=${oldMetrics.media} inserted=${audit.inserted} consistente=${oldConsistent}`);
      const newConsistent = newMetrics.drawings === newMetrics.media && newMetrics.media === reAudit.inserted;
      notes.push(`FASE1 new drawings=${newMetrics.drawings} media=${newMetrics.media} inserted=${reAudit.inserted} consistente=${newConsistent}`);

      writeFileSync(join(OUT, fileName.replace(/[^\w.-]/g, "_") + ".copia.docx"), copyBuffer);
      const newAbntBuf = Buffer.from(await newAbnt.arrayBuffer());
      writeFileSync(join(OUT, fileName.replace(/[^\w.-]/g, "_") + ".abnt-novo.docx"), newAbntBuf);
      const oldAbntBuf = Buffer.from(await oldAbnt.arrayBuffer());
      writeFileSync(join(OUT, fileName.replace(/[^\w.-]/g, "_") + ".abnt-antigo.docx"), oldAbntBuf);

      console.log(
        `${fileName} | pag=${ev.pageCount} | cand=${ev.candidateRegions} | OLD: figIn=${audit.inserted}/${audit.confirmedFigures} tbl=${ev.old.tablesPreserved}/${ev.old.tablesDetected} txt=${ev.old.textPreservation}% | NEW: reimpFig=${reAudit.inserted}/${reAudit.confirmedFigures} tbl=${ev.copy.abntTables}/${ev.copy.reimportTables} txt=${ev.copy.textPreservation}%`,
      );
    }

    writeFileSync(join(OUT, "evidencia.json"), JSON.stringify(evidence, null, 2));
    const totalCand = evidence.reduce((s, e) => s + e.candidateRegions, 0);
    const totalOldIn = evidence.reduce((s, e) => s + e.old.inserted, 0);
    console.log(`TOTAL candidatas=${totalCand} oldInseridas=${totalOldIn} newInseridas=${evidence.reduce((s, e) => s + e.copy.abntDrawings, 0)}`);
  }, 600000);
});
