import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { analyzeDocx } from "./docx-analyzer";
import { checkCompliance } from "./checklist-checker";
import { generateReport, generateJsonReport } from "./report-generator";
import { suggestFixes } from "./fix-suggester";
import type { ComplianceReport } from "./types";

export type { ComplianceReport, ChecklistItem, DocxAnalysis, FixSuggestion } from "./types";
export { analyzeDocx } from "./docx-analyzer";
export { checkCompliance } from "./checklist-checker";
export { generateReport } from "./report-generator";
export { suggestFixes } from "./fix-suggester";

export async function validateDocx(
  filePath: string,
  options?: { json?: boolean; output?: string; verbose?: boolean; workType?: string },
): Promise<ComplianceReport> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
  }

  const analysis = await analyzeDocx(resolvedPath);
  const items = checkCompliance(analysis, options?.workType);

  const ok = items.filter((i) => i.status === "ok").length;
  const fail = items.filter((i) => i.status === "fail").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const unchecked = items.filter((i) => i.status === "unchecked").length;
  const nonOk = items.filter((i) => i.status !== "ok" && i.status !== "unchecked");
  const grave = nonOk.filter((i) => i.severity === "grave").length;
  const medio = nonOk.filter((i) => i.severity === "medio").length;
  const baixo = nonOk.filter((i) => i.severity === "baixo").length;

  const report: ComplianceReport = {
    timestamp: new Date().toISOString(),
    fileAnalyzed: resolvedPath,
    analysis,
    items,
    summary: {
      total: items.length,
      ok,
      fail,
      partial,
      unchecked,
      grave,
      medio,
      baixo,
    },
    passed: fail === 0 && partial === 0 && grave === 0,
  };

  if (options?.output) {
    const outputContent = options.json
      ? generateJsonReport(report)
      : generateReport(report);
    fs.writeFileSync(path.resolve(options.output), outputContent, "utf-8");
  }

  if (options?.verbose) {
    const fixes = suggestFixes(items);
    if (fixes.length > 0) {
      console.log("\n=== Sugestões de Correção ===");
      for (const fix of fixes) {
        console.log(`\n[${fix.severity.toUpperCase()}] ${fix.description}`);
        if (fix.codeFile) console.log(`  Arquivo: ${fix.codeFile}${fix.codeLine ? `:${fix.codeLine}` : ""}`);
        if (fix.codeSnippet) console.log(`  Código: ${fix.codeSnippet}`);
        console.log(`  Passos manuais:`);
        fix.manualSteps.forEach((step, i) => console.log(`    ${i + 1}. ${step}`));
      }
    }
  }

  return report;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith("--"));
  const jsonFlag = args.includes("--json");
  const verboseFlag = args.includes("--verbose");
  const typeFlag = args.find((a) => a.startsWith("--type="));
  const workType = typeFlag?.split("=")[1];
  const outputFlag = args.find((a) => a.startsWith("--report="));
  const outputFile = outputFlag?.split("=")[1];

  if (!fileArg) {
    console.error("Uso: npx tsx src/index.ts <arquivo.docx> [--json] [--verbose] [--type=dissertacao|tese|monografia|artigo|resumo_cpg|resumo_expandido_cpg|artigo_completo_cpg|projeto_pesquisa] [--report=saida.md]");
    process.exit(1);
  }

  try {
    const report = await validateDocx(fileArg, {
      json: jsonFlag,
      verbose: verboseFlag,
      output: outputFile,
      workType,
    });

    if (jsonFlag && !outputFile) {
      console.log(generateJsonReport(report));
    } else if (!outputFile) {
      console.log(generateReport(report));
    }

    if (outputFile) {
      console.log(`Relatório salvo em: ${path.resolve(outputFile)}`);
    }

    process.exit(report.passed ? 0 : 1);
  } catch (error) {
    console.error("Erro:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const isMainModule = (): boolean => {
  try {
    const expectedPath = path.resolve(process.argv[1] || "");
    const actualPath = path.resolve(fileURLToPath(import.meta.url));
    return expectedPath === actualPath;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main();
}
