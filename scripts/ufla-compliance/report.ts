import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

/**
 * Estrutura mínima aceita pelo gerador de relatório HTML. Tanto
 * ExpandedAuditResult (gate) quanto UnifiedAuditResult (audit-all) são
 * aceitos; campos ausentes são tratados de forma defensiva.
 */
export interface AuditReportInput {
  documentType: string;
  compliant?: boolean;
  score?: number;
  preTextual?: { gaps?: unknown[] };
  textual?: { gaps?: unknown[] };
  postTextual?: { gaps?: unknown[] };
  technical?: Record<string, unknown>;
  gaps?: unknown[];
}

interface ReportGap {
  section?: string;
  rule?: string;
  severity?: string;
  description?: string;
  suggestion?: string;
}

function gapRows(section: string, gaps?: unknown[]): ReportGap[] {
  return (gaps ?? [])
    .filter((g): g is ReportGap => typeof g === "object" && g !== null)
    .map((g) => ({
      section: typeof g.section === "string" ? g.section : section,
      rule: typeof g.rule === "string" ? g.rule : "",
      severity: typeof g.severity === "string" ? g.severity : "",
      description: typeof g.description === "string" ? g.description : "",
      suggestion: typeof g.suggestion === "string" ? g.suggestion : "",
    }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function writeHtmlReport(result: AuditReportInput, outputPath: string): void {
  const compliant = result.compliant === true;
  const score = typeof result.score === "number" ? result.score : 0;
  const statusColor = compliant ? "#16a34a" : "#dc2626";
  const statusLabel = compliant ? "CONFORME" : "NÃO CONFORME";

  const rows = [
    ...gapRows("Pré-textual", result.preTextual?.gaps),
    ...gapRows("Textual", result.textual?.gaps),
    ...gapRows("Pós-textual", result.postTextual?.gaps),
    ...gapRows("Geral", result.gaps),
  ];

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.section ?? "")}</td>
        <td>${escapeHtml(r.rule ?? "")}</td>
        <td>${escapeHtml(r.severity ?? "")}</td>
        <td>${escapeHtml(r.description ?? "")}</td>
        <td>${escapeHtml(r.suggestion ?? "")}</td>
      </tr>
    `,
    )
    .join("");

  const technical = result.technical ?? {};
  const technicalRows = Object.entries(technical)
    .filter(([key]) => typeof technical[key] === "boolean")
    .map(
      ([key, value]) =>
        `<li>${escapeHtml(key)}: ${value ? "PASSED" : "FAILED"}</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Auditoria UFLA</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; }
    .badge { color: ${statusColor}; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    .score { font-size: 18px; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>Relatório de Auditoria UFLA</h1>
  <p><strong>Tipo:</strong> ${escapeHtml(result.documentType)}</p>
  <p><strong>Status:</strong> <span class="badge">${statusLabel}</span></p>
  <p class="score"><strong>Score:</strong> ${score}/100</p>

  <h2>Gaps</h2>
  <table>
    <thead>
      <tr>
        <th>Seção</th>
        <th>Regra</th>
        <th>Severidade</th>
        <th>Descrição</th>
        <th>Sugestão</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || "<tr><td colspan='5'>Sem gaps</td></tr>"}
    </tbody>
  </table>

  <h2>Status Técnico</h2>
  <ul>
    ${technicalRows || "<li>Sem status técnico informado</li>"}
  </ul>
</body>
</html>
`;

  const fullPath = join(root, outputPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  if (existsSync(fullPath)) {
    writeFileSync(fullPath, html, "utf-8");
  } else {
    writeFileSync(fullPath, html, "utf-8");
  }
}
