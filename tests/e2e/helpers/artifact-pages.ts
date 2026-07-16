import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

// Fase 2D: regressao ESTRUTURAL (nao visual de pixels) do artefato DOCX exportado.
// Analisa a assinatura OOXML (Quadros=tabelas, Graficos=desenhos, paginacao via
// quebras de pagina/secao) e compara com um baseline SHA-256 opcional.
// A rasterizacao real do PDF final (regressao visual de paginas) fica no hook
// rasterizePdfPages, ativado apenas quando um rasterizador (pdftoppm) existir.

export interface DocxArtifactAnalysis {
  tables: number;
  drawings: number;
  pageBreaks: number;
  sections: number;
  estimatedPages: number;
  fingerprintHash: string;
  rawLength: number;
}

export interface ArtifactCheck {
  name: string;
  analysis: DocxArtifactAnalysis;
  baselineHash: string | null;
  matchesBaseline: boolean | null;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readDocxDocumentXml(docxPath: string): Promise<string> {
  const JSZipMod = await import("jszip");
  const JSZip: any = (JSZipMod as any).default ?? JSZipMod;
  const buffer = await readFile(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error(`word/document.xml ausente em ${docxPath}`);
  return entry.async("string");
}

export async function analyzeDocx(docxPath: string): Promise<DocxArtifactAnalysis> {
  const docXml = await readDocxDocumentXml(docxPath);
  const tables = (docXml.match(/<w:tbl>/g) || []).length;
  const drawings = (docXml.match(/<w:drawing>/g) || []).length;
  const pageBreaks = (docXml.match(/<w:br w:type="page"\s*\/?>/g) || []).length;
  const sections = (docXml.match(/<w:sectPr/g) || []).length;
  const estimatedPages = sections + pageBreaks;

  const fingerprint = [tables, drawings, pageBreaks, sections].join("|") + "::" + docXml.length;
  return {
    tables,
    drawings,
    pageBreaks,
    sections,
    estimatedPages,
    fingerprintHash: sha256(fingerprint),
    rawLength: docXml.length,
  };
}

async function pdfRasterizer(): Promise<string | null> {
  return new Promise((resolveRaster) => {
    const child = spawn("pdftoppm", ["-v"], { stdio: "ignore" });
    child.once("error", () => resolveRaster(null));
    child.once("exit", (code) => resolveRaster(code === 0 ? "pdftoppm" : null));
  });
}

export interface RasterizedPage {
  page: number;
  path: string;
  hash: string;
}

export async function rasterizePdfPages(
  pdfPath: string,
  pageIndices: number[],
  outputDir: string
): Promise<RasterizedPage[]> {
  const rasterizer = await pdfRasterizer();
  if (rasterizer !== "pdftoppm") {
    throw new Error("Rasterizador de PDF indisponivel (pdftoppm nao encontrado).");
  }
  await mkdir(outputDir, { recursive: true });
  const results: RasterizedPage[] = [];
  for (const page of pageIndices) {
    const out = join(outputDir, `page-${page}`);
    await new Promise<void>((resolveRender, rejectRender) => {
      const child = spawn("pdftoppm", ["-f", String(page), "-l", String(page), "-png", "-r", "110", pdfPath, out], {
        stdio: "ignore",
      });
      child.once("error", rejectRender);
      child.once("exit", (code) => (code === 0 ? resolveRender() : rejectRender(new Error(`pdftoppm falhou p/ pagina ${page}`))));
    });
    const pngPath = `${out}.png`;
    const buf = await readFile(pngPath);
    results.push({ page, path: pngPath, hash: sha256(buf.toString("binary")) });
  }
  return results;
}

export async function readBaselineHash(baselinePath: string): Promise<string | null> {
  try {
    await access(baselinePath);
    return (await readFile(baselinePath, "utf8")).trim();
  } catch {
    return null;
  }
}

export async function writeBaselineHash(baselinePath: string, hash: string): Promise<void> {
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${hash}\n`, "utf8");
}

export function baselineFileName(name: string): string {
  return `${name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-80)}.sha256`;
}

export async function checkArtifact(
  name: string,
  analysis: DocxArtifactAnalysis,
  baselineDirectory: string
): Promise<ArtifactCheck> {
  const baselinePath = join(baselineDirectory, baselineFileName(name));
  const baselineHash = await readBaselineHash(baselinePath);
  return {
    name,
    analysis,
    baselineHash,
    matchesBaseline: baselineHash === null ? null : baselineHash === analysis.fingerprintHash,
  };
}

export function summarizeArtifactChecks(checks: ArtifactCheck[]): string {
  return checks
    .map((c) => {
      const base =
        c.baselineHash === null
          ? "sem baseline"
          : c.matchesBaseline
            ? "baseline ok"
            : "BASELINE DIVERGENTE";
      return `- ${c.name}: tabelas=${c.analysis.tables} desenhos=${c.analysis.drawings} pagQuebras=${c.analysis.pageBreaks} pagEstim=${c.analysis.estimatedPages}; ${base} [${c.analysis.fingerprintHash.slice(0, 12)}]`;
    })
    .join("\n");
}

export function assertArtifactChecks(
  checks: ArtifactCheck[],
  updateBaseline: boolean,
  baselineDirectory: string,
  expectation: { minDrawings?: number; minEstimatedPages?: number }
): void {
  for (const check of checks) {
    if (expectation.minDrawings !== undefined && check.analysis.drawings < expectation.minDrawings) {
      throw new Error(
        `Artefato '${check.name}': poucos elementos graficos (desenhos=${check.analysis.drawings}, minimo=${expectation.minDrawings}).`
      );
    }
    if (expectation.minEstimatedPages !== undefined && check.analysis.estimatedPages < expectation.minEstimatedPages) {
      throw new Error(
        `Artefato '${check.name}': poucas paginas estimadas (${check.analysis.estimatedPages}, minimo=${expectation.minEstimatedPages}).`
      );
    }
    if (check.baselineHash !== null && check.matchesBaseline === false && !updateBaseline) {
      throw new Error(
        `Regressao de artefato em '${check.name}': hash ${check.analysis.fingerprintHash.slice(0, 12)} difere do baseline ${check.baselineHash.slice(0, 12)}.`
      );
    }
    if (updateBaseline && check.baselineHash !== check.analysis.fingerprintHash) {
      void writeBaselineHash(join(baselineDirectory, baselineFileName(check.name)), check.analysis.fingerprintHash);
    }
  }
}
