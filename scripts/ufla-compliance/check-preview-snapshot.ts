/**
 * Snapshot de paginação da pré-visualização (regressões entre releases).
 *
 * A parte do preview NÃO depende do Word: para cada template, reconstrói o
 * HTML (buildPreviewHtml) e extrai a paginação real — número de páginas,
 * numeração visível por página (aria-label="Página N") e assinatura de texto
 * por página (sha256 do texto normalizado).
 *
 * O snapshot commitado (scripts/ufla-compliance/snapshots/preview-docx-snapshot.json)
 * é gerado/atualizado localmente pelo regenerate-official-artifacts (que roda o
 * compare-preview-docx com Word). No CI (sem Word), este checker valida a parte
 * do preview contra o snapshot: qualquer mudança de paginação ou de conteúdo por
 * página entre releases falha o gate.
 *
 * Gate do lado PDF (referência do Word): o regenerate compara a renderização
 * atual (páginas, numeração visível, assinaturas por página) com a referência
 * COMMITADA. Se o PDF divergir SEM mudança de preview/digest do DOCX, é uma
 * regressão (versão do Word, fontes, pipeline) e o gate FALHA preservando a
 * referência; se divergir JUNTO com preview/digest, é mudança intencional e a
 * referência é atualizada.
 *
 * Uso: npx tsx scripts/ufla-compliance/check-preview-snapshot.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { buildPreviewHtml } from "../../src/preview-html.js";
import type { DocxGenerationInput } from "../../src/export-docx.js";
import { TEMPLATES } from "./compare-preview-docx.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "snapshots", "preview-docx-snapshot.json");

function normalizeText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

interface PageInfo {
  number: number | null;
  signature: string;
}

export interface PreviewSnapshotTemplate {
  previewPages: number;
  pageNumbers: Array<number | null>;
  signatures: string[];
  /** Digest do DOCX gerado (sem Word): normalizado p/ bookmarks — verificável no CI. */
  docxDigest: string | null;
  /** Referência do Word (não re-verificável no CI — revisão via diff do snapshot). */
  pdfPages: number | null;
  pdfSignatures: Array<string> | null;
  pdfPageNumbers: Array<number | null> | null;
  similarity: number | null;
  pageDelta: number | null;
}

export type PreviewSnapshot = Record<string, PreviewSnapshotTemplate>;

/** Digest determinístico do DOCX gerado (Word-free): normaliza w:id de bookmarks
 *  (aleatórios por geração) e exclui docProps (timestamps). Qualquer mudança no
 *  documento gerado que possa afetar a renderização altera o digest. */
export async function docxDigestFor(input: DocxGenerationInput, generate: (i: DocxGenerationInput) => Promise<Blob>): Promise<string> {
  const blob = await generate(input);
  const zip = new AdmZip(Buffer.from(await blob.arrayBuffer()));
  const parts = zip
    .getEntries()
    .map((e) => e.entryName)
    .filter((n) => !n.startsWith("docProps/"))
    .sort()
    .map((n) => {
      const buf = zip.readFile(n);
      if (!buf) return `${n}::<missing>`;
      let xml = buf.toString("utf8");
      if (n === "word/document.xml") {
        // w:id de bookmarks é aleatório por geração; o nome carrega a identidade.
        xml = xml.replace(/(<w:bookmark(?:Start|End)[^>]*w:id=")\d+(")/g, "$10$2");
      }
      return `${n}::${xml}`;
    })
    .join("\n");
  return createHash("sha256").update(parts).digest("hex").slice(0, 16);
}

/** Reconstrói o preview de cada template e gera o DOCX, extraindo a paginação real (sem Word). */
export async function buildPreviewSnapshot(): Promise<PreviewSnapshot> {
  const snapshot: PreviewSnapshot = {};
  for (const tpl of TEMPLATES) {
    const html = buildPreviewHtml(tpl.input);
    const pageRe = /<section class="preview-page[^"]*"[^>]*>([\s\S]*?)<\/section>/g;
    const pages: PageInfo[] = [];
    let m: RegExpExecArray | null;
    while ((m = pageRe.exec(html)) !== null) {
      const numMatch = m[1].match(/aria-label="Página (\d+)"/);
      pages.push({
        number: numMatch ? parseInt(numMatch[1], 10) : null,
        signature: sha256(normalizeText(m[1])),
      });
    }
    let digest: string | null = null;
    try {
      digest = await docxDigestFor(tpl.input, tpl.generate);
    } catch (err) {
      digest = null;
    }
    snapshot[tpl.id] = {
      previewPages: pages.length,
      pageNumbers: pages.map((p) => p.number),
      signatures: pages.map((p) => p.signature),
      docxDigest: digest,
      pdfPages: null,
      pdfSignatures: null,
      pdfPageNumbers: null,
      similarity: null,
      pageDelta: null,
    };
  }
  return snapshot;
}

export function snapshotPath(): string {
  return SNAPSHOT_PATH;
}

export function writePreviewSnapshot(snapshot: PreviewSnapshot, extra: Record<string, unknown> = {}): void {
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(
    SNAPSHOT_PATH,
    JSON.stringify({ schema: "ufla-audit/preview-snapshot/v1", generatedAt: new Date().toISOString(), ...extra, templates: snapshot }, null, 2) + "\n",
    "utf8",
  );
}

/** Compara dois snapshots e retorna as divergências (regressões). */
export function compareSnapshots(committed: PreviewSnapshot, current: PreviewSnapshot): string[] {
  const failures: string[] = [];
  const allIds = [...new Set([...Object.keys(committed), ...Object.keys(current)])];
  for (const id of allIds) {
    if (!committed[id]) {
      failures.push(`template novo sem snapshot: ${id} — rode o regenerate local para atualizar o snapshot.`);
      continue;
    }
    if (!current[id]) {
      failures.push(`template removido do snapshot: ${id}.`);
      continue;
    }
    const exp = committed[id];
    const got = current[id];
    if (exp.previewPages !== got.previewPages) {
      failures.push(`REGRESSÃO DE PAGINAÇÃO ${id}: preview ${exp.previewPages} páginas → ${got.previewPages} (snapshot exige ${exp.previewPages}).`);
      continue;
    }
    for (let i = 0; i < exp.previewPages; i++) {
      if (exp.pageNumbers[i] !== got.pageNumbers[i]) {
        failures.push(`REGRESSÃO DE NUMERAÇÃO ${id} página ${i + 1}: ${exp.pageNumbers[i] ?? "sem número"} → ${got.pageNumbers[i] ?? "sem número"}.`);
      }
      if (exp.signatures[i] !== got.signatures[i]) {
        failures.push(`REGRESSÃO DE CONTEÚDO ${id} página ${i + 1}: texto da página mudou (assinatura ${exp.signatures[i]} → ${got.signatures[i]}).`);
      }
    }
    if (exp.docxDigest !== got.docxDigest) {
      failures.push(`REGRESSÃO DO DOCX ${id}: digest do documento gerado mudou (${exp.docxDigest ?? "sem digest"} → ${got.docxDigest ?? "sem digest"}) — o DOCX gerado mudou e pode alterar a renderização/paginação.`);
    }
  }
  return failures;
}

/** Compara o lado PDF (referência do Word renderizado) entre dois snapshots. */
export function comparePdfReference(committed: PreviewSnapshot, current: PreviewSnapshot): string[] {
  const failures: string[] = [];
  const allIds = [...new Set([...Object.keys(committed), ...Object.keys(current)])];
  for (const id of allIds) {
    const exp = committed[id];
    const got = current[id];
    if (!exp || !got) continue; // template novo/removido é coberto por compareSnapshots
    // Sem referência commitada ou sem renderização atual (CI/sem Word): nada a comparar.
    if (exp.pdfPages === null || got.pdfPages === null) continue;
    if (exp.pdfPages !== got.pdfPages) {
      failures.push(`REGRESSÃO PDF ${id}: páginas renderizadas pelo Word ${exp.pdfPages} → ${got.pdfPages} (referência commitada exige ${exp.pdfPages}).`);
      continue;
    }
    for (let i = 0; i < exp.pdfPages; i++) {
      if (exp.pdfPageNumbers?.[i] !== got.pdfPageNumbers?.[i]) {
        failures.push(`REGRESSÃO PDF ${id} página ${i + 1}: numeração visível ${exp.pdfPageNumbers?.[i] ?? "sem número"} → ${got.pdfPageNumbers?.[i] ?? "sem número"}.`);
      }
      if (exp.pdfSignatures?.[i] !== got.pdfSignatures?.[i]) {
        failures.push(`REGRESSÃO PDF ${id} página ${i + 1}: conteúdo renderizado pelo Word mudou (assinatura ${exp.pdfSignatures?.[i]} → ${got.pdfSignatures?.[i]}).`);
      }
    }
  }
  return failures;
}

export interface PdfDivergence {
  /** Divergências específicas do lado PDF (páginas, numeração, assinaturas). */
  pdfFailures: string[];
  /** true se o preview OU o digest do DOCX também mudou (mudança intencional). */
  previewOrDocxChanged: boolean;
  /** Decisão: "match" (em sincronia), "update" (intencional — atualizar referência) ou "fail" (regressão). */
  action: "match" | "update" | "fail";
}

/** Classifica uma divergência do lado PDF: atualização intencional vs regressão. */
export function classifyPdfChange(committed: PreviewSnapshot, current: PreviewSnapshot): PdfDivergence {
  const pdfFailures = comparePdfReference(committed, current);
  const previewOrDocxChanged = Object.keys(current).some((id) => {
    const exp = committed[id];
    const got = current[id];
    if (!exp || !got) return false;
    return (
      exp.previewPages !== got.previewPages ||
      exp.docxDigest !== got.docxDigest ||
      (exp.pageNumbers ?? []).some((n, i) => got.pageNumbers?.[i] !== n) ||
      (exp.signatures ?? []).some((s, i) => got.signatures?.[i] !== s)
    );
  });
  return {
    pdfFailures,
    previewOrDocxChanged,
    action: pdfFailures.length === 0 ? "match" : previewOrDocxChanged ? "update" : "fail",
  };
}

/** Lê o snapshot commitado do disco (null se ainda não existe ou é inválido). */
export function readCommittedPreviewSnapshot(): PreviewSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")).templates as PreviewSnapshot;
  } catch {
    return null;
  }
}

/**
 * Coerência OOXML↔PDF da referência commitada (Word-free): gera o DOCX de cada
 * template e valida que o `w:pgNumType w:start` da seção textual (DECISION-010:
 * folha de rosto=1, numeração visível inicia com o valor contado) coincide com o
 * PRIMEIRO número visível registrado na referência do PDF do Word. Se o código
 * mudou o w:start (ou o start foi removido) sem atualizar o snapshot, falha.
 */
export async function validateSnapshotOoxmlCoherence(snapshot: PreviewSnapshot): Promise<string[]> {
  const failures: string[] = [];
  for (const tpl of TEMPLATES) {
    const entry = snapshot[tpl.id];
    if (!entry || entry.pdfPageNumbers == null) continue; // sem referência do Word (CI/primeira rodada)
    const visible = entry.pdfPageNumbers.filter((n): n is number => n !== null);
    let start: number | null = null;
    try {
      const blob = await tpl.generate(tpl.input);
      const zip = new AdmZip(Buffer.from(await blob.arrayBuffer()));
      const xml = zip.readAsText("word/document.xml");
      for (const m of xml.matchAll(/<w:pgNumType[^>]*w:start="(\d+)"/g)) {
        start = parseInt(m[1], 10);
        break;
      }
    } catch {
      start = null;
    }
    if (start === null) continue; // sem declaração explícita — coberto pelo digest
    if (visible.length === 0) continue;
    const firstVisible = visible[0];
    if (firstVisible !== start) {
      failures.push(
        `Coerência OOXML↔PDF ${tpl.id}: pgNumType w:start=${start} no DOCX gerado, mas a referência do PDF mostra o primeiro número visível ${firstVisible} — o snapshot está desatualizado ou o w:start regrediu (DECISION-010).`, 
      );
    }
  }
  return failures;
}

/** Valida o preview atual contra o snapshot commitado. Sem Word: só o lado preview. */
export async function runPreviewSnapshotCheck(): Promise<{ passed: boolean; failures: string[] }> {
  if (!existsSync(SNAPSHOT_PATH)) {
    return { passed: false, failures: ["Snapshot de preview não encontrado (scripts/ufla-compliance/snapshots/preview-docx-snapshot.json) — rode o regenerate localmente para criá-lo."] };
  }
  const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")).templates as PreviewSnapshot;
  const current = await buildPreviewSnapshot();
  const failures = compareSnapshots(committed, current);
  return { passed: failures.length === 0, failures };
}

async function main(): Promise<void> {
  const { passed, failures } = await runPreviewSnapshotCheck();
  if (failures.length > 0) console.log("Snapshot de preview: FALHOU\n  - " + failures.join("\n  - "));
  else console.log("Snapshot de preview: PASSED (paginação e conteúdo por página estáveis).");
  process.exit(passed ? 0 : 1);
}

if (basename(process.argv[1] ?? "") === "check-preview-snapshot.ts") {
  void main();
}
