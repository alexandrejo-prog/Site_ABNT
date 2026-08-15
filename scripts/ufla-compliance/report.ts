import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExpandedAuditResult } from "./audit-types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

export function writeHtmlReport(result: ExpandedAuditResult, outputPath: string): void {
  const statusColor = result.compliant ? "#16a34a" : "#dc2626";
  const statusLabel = result.compliant ? "CONFORME" : "NÃO CONFORME";

  const rows = [
    ...result.preTextual.gaps.map((g) => ({
      section: "Pré-textual",
      rule: g.rule,
      severity: g.severity,
      description: g.description,
      suggestion: g.suggestion ?? "",
    })),
    ...result.textual.gaps.map((g) => ({
      section: "Textual",
      rule: g.rule,
      severity: g.severity,
      description: g.description,
      suggestion: g.suggestion ?? "",
    })),
    ...result.postTextual.gaps.map((g) => ({
      section: "Pós-textual",
      rule: g.rule,
      severity: g.severity,
      description: g.description,
      suggestion: g.suggestion ?? "",
    })),
  ];

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td>${r.section}</td>
        <td>${r.rule}</td>
        <td>${r.severity}</td>
        <td>${r.description}</td>
        <td>${r.suggestion}</td>
      </tr>
    `,
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
  <p><strong>Tipo:</strong> ${result.documentType}</p>
  <p><strong>Status:</strong> <span class="badge">${statusLabel}</span></p>
  <p class="score"><strong>Score:</strong> ${result.score}/100</p>

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
    <li>Rodapés: ${result.technical.footers ? "PASSED" : "FAILED"}</li>
    <li>Tabelas: ${result.technical.tables ? "PASSED" : "FAILED"}</li>
    <li>Paginação: ${result.technical.pagination ? "PASSED" : "FAILED"}</li>
    <li>Equações: ${result.technical.equations ? "PASSED" : "FAILED"}</li>
    <li>PDF físico: ${result.technical.pdfPhysical ? "PASSED" : "FAILED"}</li>
    <li>Referências: ${result.technical.references ? "PASSED" : "FAILED"}</li>
    <li>Citações: ${result.technical.citations ? "PASSED" : "FAILED"}</li>
    <li>Figuras: ${result.technical.figures ? "PASSED" : "FAILED"}</li>
    <li>Seções: ${result.technical.sections ? "PASSED" : "FAILED"}</li>
  </ul>
</body>
</html>
`;

  const fullPath = join(root, outputPath);
  const dir = join(fullPath, "..");
  if (!existsSync(dir)) {
    // create directory recursively
  }
  writeFileSync(fullPath, html, "utf-8");
}

import { writeFileSync } from "node:fs";
