import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface WordValidationResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputDirectory: string;
  reportPath: string;
  approved: boolean;
  pdfExported: boolean;
  pages: number | null;
  wordOpened: boolean;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function fileSize(target: string): Promise<number> {
  return (await stat(target)).size;
}

function parseJson(content: string): unknown {
  const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return JSON.parse(cleaned);
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolveCommand) => {
    const child = spawn(command, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      windowsHide: true,
      stdio: "ignore",
    });
    child.once("error", () => resolveCommand(false));
    child.once("exit", (code) => resolveCommand(code === 0));
  });
}

export async function findPowerShell(): Promise<string | null> {
  for (const candidate of ["pwsh", "powershell.exe", "powershell"]) {
    if (await commandExists(candidate)) return candidate;
  }
  return null;
}

async function findAcceptanceReport(outputDirectory: string, explicitPath?: string): Promise<string> {
  if (explicitPath && (await pathExists(explicitPath))) return explicitPath;

  const entries = await import("node:fs/promises").then((m) => m.readdir(outputDirectory, { withFileTypes: true }));
  const runDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
    .map((entry) => join(outputDirectory, entry.name));

  let newest: { path: string; mtimeMs: number } | null = null;
  for (const runDirectory of runDirectories) {
    const candidate = join(runDirectory, "acceptance-report.json");
    if (!(await pathExists(candidate))) continue;
    const candidateStat = await stat(candidate);
    if (!newest || candidateStat.mtimeMs > newest.mtimeMs) {
      newest = { path: candidate, mtimeMs: candidateStat.mtimeMs };
    }
  }

  if (!newest) {
    throw new Error(`acceptance-report.json nao encontrado em ${outputDirectory}`);
  }
  return newest.path;
}

export async function runWordValidation(options: {
  powerShell: string;
  docxPath: string;
  outputDirectory: string;
  timeoutMs?: number;
}): Promise<WordValidationResult> {
  if (!options.powerShell) {
    throw new Error("PowerShell nao encontrado; validacao Word requer Windows com PowerShell.");
  }

  const scriptPath = resolve(process.cwd(), "scripts/acceptance/run-docx-acceptance.ps1");
  if (!(await pathExists(scriptPath))) {
    throw new Error(`Script de aceite Word nao localizado: ${scriptPath}`);
  }

  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-DocxPath",
    options.docxPath,
    "-OutputDirectory",
    options.outputDirectory,
    "-Profile",
    "pdf-text-draft",
    "-UpdateFields",
    "-UpdateToc",
  ];

  const timeoutMs = options.timeoutMs ?? 360_000;
  const result = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolveRun, rejectRun) => {
    const child = spawn(options.powerShell, args, { windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`Pipeline PowerShell excedeu ${timeoutMs}ms e foi encerrado.`));
    }, timeoutMs);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once("exit", (exitCode) => {
      clearTimeout(timeout);
      resolveRun({ exitCode, stdout, stderr });
    });
  });

  const reportPath = await findAcceptanceReport(options.outputDirectory);
  const report = parseJson(await readFile(reportPath, "utf8")) as Record<string, unknown>;

  const pagesValue = report.pagesAfterToc ?? report.pagesAfterFields ?? report.pagesBeforeFields;

  let wordOpened = false;
  try {
    const runDirectory = join(reportPath, "..");
    const wordManifestPath = join(runDirectory, "docx-word-manifest.json");
    if (await pathExists(wordManifestPath)) {
      const wordManifest = parseJson(await readFile(wordManifestPath, "utf8")) as Record<string, unknown>;
      const wordPid = wordManifest.wordPid;
      wordOpened = typeof wordPid === "number" && wordPid > 0;
    }
  } catch {
    wordOpened = false;
  }

  return {
    command: options.powerShell,
    args,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    outputDirectory: options.outputDirectory,
    reportPath,
    approved: Boolean(report.approved),
    pdfExported: Boolean(report.pdfExported),
    pages: typeof pagesValue === "number" ? pagesValue : null,
    wordOpened,
  };
}
