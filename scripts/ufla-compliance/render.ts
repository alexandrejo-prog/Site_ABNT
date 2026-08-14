import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderedManifest } from "./types";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VALIDATE_WORD = join(REPO_ROOT, "scripts", "acceptance", "validate-word.ps1");
const WINWORD = "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE";

export function wordAvailable(): boolean {
  return existsSync(WINWORD) || existsSync("C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE");
}

export interface RenderResult {
  manifest: RenderedManifest;
  pdfPath: string;
  ok: boolean;
  error?: string;
}

export function renderWithWord(
  docxPath: string,
  workDir: string,
  timeoutSeconds = 240,
): RenderResult {
  const absDocx = resolve(docxPath);
  if (!existsSync(absDocx)) {
    return { manifest: null as never, pdfPath: "", ok: false, error: `DOCX não encontrado: ${absDocx}` };
  }
  mkdirSync(workDir, { recursive: true });
  const pdfOut = join(workDir, "document.pdf");
  const manifestOut = join(workDir, "word-manifest.json");

  const script = join(REPO_ROOT, "scripts", "acceptance", "validate-word.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-DocxPath",
    absDocx,
    "-PdfOutput",
    pdfOut,
    "-ManifestOutput",
    manifestOut,
    "-UpdateFields",
    "-UpdateToc",
    "-TimeoutSeconds",
    String(timeoutSeconds),
  ];

  const res = spawnSync("powershell.exe", args, { encoding: "utf8", timeout: (timeoutSeconds + 60) * 1000, cwd: REPO_ROOT });
  let manifest: RenderedManifest | null = null;
  if (existsSync(manifestOut)) {
    // PowerShell Set-Content -Encoding UTF8 grava BOM; remover antes do JSON.parse.
    const raw = readFileSync(manifestOut, "utf8").replace(/^\uFEFF/, "");
    manifest = JSON.parse(raw) as RenderedManifest;
  }
  const ok = res.status === 0 && manifest?.approved === true;

  return {
    manifest: manifest ?? {
      approved: false,
      openedByRepair: false,
      openedReadOnly: false,
      pagesBeforeFields: null,
      pagesAfterFields: null,
      pagesAfterToc: null,
      pdfExported: false,
      pdfSizeBytes: null,
      wordVersion: null,
      warnings: [],
      failures: res.status !== 0 ? [{ code: "WORD_EXIT", message: res.stderr?.slice(0, 400) || `exit ${res.status}` }] : [],
      exitCode: res.status ?? 1,
    },
    pdfPath: pdfOut,
    ok,
    error: ok ? undefined : res.stderr?.slice(0, 800),
  };
}

export function validateWordScriptPath(): string {
  return VALIDATE_WORD;
}