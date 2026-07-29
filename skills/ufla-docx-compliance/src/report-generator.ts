import type { ComplianceReport, ChecklistItem } from "./types";

function statusIcon(status: ChecklistItem["status"]): string {
  switch (status) {
    case "ok":
      return "✅";
    case "fail":
      return "❌";
    case "partial":
      return "⚠️";
    case "unchecked":
      return "🔍";
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "grave":
      return "🔴 GRAVE";
    case "medio":
      return "🟡 MÉDIO";
    case "baixo":
      return "🟢 BAIXO";
    default:
      return severity;
  }
}

export function generateReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push("# Relatório de Conformidade UFLA");
  lines.push("");
  lines.push(`**Arquivo:** \`${report.fileAnalyzed}\``);
  lines.push(`**Data:** ${report.timestamp}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(`| Status | Quantidade |`);
  lines.push(`|--------|-----------:|`);
  lines.push(`| ✅ OK | ${report.summary.ok} |`);
  lines.push(`| ❌ Não conforme | ${report.summary.fail} |`);
  lines.push(`| ⚠️ Parcial | ${report.summary.partial} |`);
  lines.push(`| 🔍 Não verificado | ${report.summary.unchecked} |`);
  lines.push(`| **Total** | **${report.summary.total}** |`);
  lines.push("");
  lines.push(`**Resultado:** ${report.passed ? "✅ APROVADO" : "❌ REPROVADO — contém não conformidades"}`);
  lines.push("");

  // Por prioridade
  const bySeverity: Record<string, ChecklistItem[]> = {};
  for (const item of report.items) {
    if (item.status === "fail" || item.status === "partial") {
      (bySeverity[item.severity] ||= []).push(item);
    }
  }

  if (bySeverity.grave?.length) {
    lines.push("## 🔴 Pendências GRAVES");
    lines.push("");
    for (const item of bySeverity.grave) {
      lines.push(`- **${item.description}** — \`${item.location}\``);
      lines.push(`  - Sugestão: ${item.suggestion}`);
    }
    lines.push("");
  }

  if (bySeverity.medio?.length) {
    lines.push("## 🟡 Pendências MÉDIAS");
    lines.push("");
    for (const item of bySeverity.medio) {
      lines.push(`- **${item.description}** — \`${item.location}\``);
      lines.push(`  - Sugestão: ${item.suggestion}`);
    }
    lines.push("");
  }

  if (bySeverity.baixo?.length) {
    lines.push("## 🟢 Pendências BAIXAS");
    lines.push("");
    for (const item of bySeverity.baixo) {
      lines.push(`- **${item.description}** — \`${item.location}\``);
      lines.push(`  - Sugestão: ${item.suggestion}`);
    }
    lines.push("");
  }

  // Tabela por seção
  lines.push("## Detalhamento por Seção");
  lines.push("");

  const sections = [...new Set(report.items.map((i) => i.section))];
  for (const section of sections) {
    const sectionItems = report.items.filter((i) => i.section === section);
    const okCount = sectionItems.filter((i) => i.status === "ok").length;
    const failCount = sectionItems.filter((i) => i.status === "fail").length;
    const partialCount = sectionItems.filter((i) => i.status === "partial").length;

    lines.push(`### ${section}`);
    lines.push("");
    lines.push(`| Status | Item | Severidade | Local |`);
    lines.push(`|--------|------|-----------|-------|`);
    for (const item of sectionItems) {
      lines.push(
        `| ${statusIcon(item.status)} | ${item.description} | ${severityLabel(item.severity)} | \`${item.location}\` |`,
      );
    }
    lines.push("");
  }

  // Sugestões de correção
  const fixableItems = report.items.filter(
    (i) => (i.status === "fail" || i.status === "partial") && i.fixType !== "none",
  );
  if (fixableItems.length > 0) {
    lines.push("## Sugestões de Correção");
    lines.push("");
    for (const item of fixableItems) {
      lines.push(`### ${item.id}. ${item.description}`);
      lines.push("");
      lines.push(`- **Severidade:** ${severityLabel(item.severity)}`);
      if (item.fixFile) lines.push(`- **Arquivo:** \`${item.fixFile}\``);
      if (item.fixLine) lines.push(`- **Linha:** ${item.fixLine}`);
      lines.push(`- **Tipo:** ${item.fixType === "code" ? "🧑‍💻 Correção no código" : "📝 Correção manual"}`);
      if (item.fixInstruction) lines.push(`- **Instrução:** ${item.fixInstruction}`);
      lines.push(`- **Sugestão:** ${item.suggestion}`);
      lines.push("");
    }
  }

  // Propriedades do documento
  lines.push("## Propriedades do Documento");
  lines.push("");
  lines.push(`| Propriedade | Valor |`);
  lines.push(`|------------|-------|`);
  lines.push(`| Papel | ${analysisProp(report.analysis.page.widthTwip, "11906")} × ${analysisProp(report.analysis.page.heightTwip, "16838")} twip |`);
  lines.push(`| Margem superior | ${report.analysis.page.marginTopCm} cm |`);
  lines.push(`| Margem inferior | ${report.analysis.page.marginBottomCm} cm |`);
  lines.push(`| Margem esquerda | ${report.analysis.page.marginLeftCm} cm |`);
  lines.push(`| Margem direita | ${report.analysis.page.marginRightCm} cm |`);
  lines.push(`| Fonte padrão | ${report.analysis.fonts.defaultFont} ${report.analysis.fonts.defaultSize}pt |`);
  lines.push(`| Parágrafos | ${report.analysis.paragraphCount} |`);
  lines.push(`| Tabelas | ${report.analysis.tables.count} |`);
  lines.push(`| Referências | ${report.analysis.references.entryCount} entradas |`);
  lines.push(`| Imagens | ${report.analysis.images.count} |`);
  lines.push(`| Sumário (TOC) | ${report.analysis.toc.exists ? "Sim" : "Não"} |`);
  lines.push(`| Numeração de página | ${report.analysis.pagination.usesWordField ? "Campo Word" : "Inexistente"} |`);

  return lines.join("\n");
}

function analysisProp(value: number, expected: string): string {
  return value.toString() + (String(value) === expected ? " ✅" : ` ❌ (esperado: ${expected})`);
}

export function generateJsonReport(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}
