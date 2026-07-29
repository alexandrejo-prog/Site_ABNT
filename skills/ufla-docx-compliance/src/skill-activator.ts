/**
 * Skill activator — interface para ativação via chat (@ufla-docx-compliance)
 *
 * Uso no chat:
 *   @ufla-docx-compliance validar teste-final.docx
 *   @ufla-docx-compliance validar --json --report=relatorio.md teste-final.docx
 */
import { validateDocx } from "./index";
import type { ComplianceReport } from "./types";

export interface SkillCommand {
  action: string;
  filePath: string;
  options: {
    json?: boolean;
    output?: string;
    verbose?: boolean;
  };
}

export function parseCommand(input: string): SkillCommand {
  const trimmed = input.trim();

  // Remove @mention prefix
  const withoutMention = trimmed.replace(/^@ufla-docx-compliance\s*/i, "");

  // Expect: "validar [opções] <arquivo>"
  const parts = withoutMention.split(/\s+/);
  const action = parts[0]?.toLowerCase() || "validar";

  const jsonFlag = parts.includes("--json");
  const verboseFlag = parts.includes("--verbose");
  const outputIndex = parts.findIndex((p) => p.startsWith("--report="));
  const output = outputIndex >= 0 ? parts[outputIndex].split("=")[1] : undefined;

  const filePath = [...parts]
    .filter((p) => !p.startsWith("--"))
    .slice(1)
    .join(" ");

  return { action, filePath, options: { json: jsonFlag, output, verbose: verboseFlag } };
}

export async function executeCommand(command: SkillCommand): Promise<{
  report: ComplianceReport;
  markdown: string;
}> {
  if (!command.filePath) {
    throw new Error(
      "Arquivo não especificado. Use: @ufla-docx-compliance validar <arquivo.docx>",
    );
  }

  const { generateReport } = await import("./report-generator");
  const report = await validateDocx(command.filePath, command.options);
  const markdown = generateReport(report);

  return { report, markdown };
}
