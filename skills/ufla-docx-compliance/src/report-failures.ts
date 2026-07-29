import type { ComplianceReport, ChecklistItem } from "./types";

function statusIcon(status: ChecklistItem["status"]): string {
  switch (status) {
    case "ok": return "✅";
    case "fail": return "❌";
    case "partial": return "⚠️";
    case "unchecked": return "🔍";
  }
}

function severityLabel(severity: string): string {
  const labels: Record<string, string> = { grave: "🔴 GRAVE", medio: "🟡 MÉDIO", baixo: "🟢 BAIXO" };
  return labels[severity] || severity;
}

export function generateFailuresReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push("# ❌ Relatório de Não Conformidades — UFLA DOCX");
  lines.push("");
  lines.push(`**Arquivo:** \`${report.fileAnalyzed}\``);
  lines.push(`**Data:** ${report.timestamp}`);
  lines.push("");

  // === Resumo ===
  const graveFails = report.items.filter(i => i.severity === "grave" && i.status === "fail");
  const medioFails = report.items.filter(i => i.severity === "medio" && i.status === "fail");
  const baixoFails = report.items.filter(i => i.severity === "baixo" && i.status === "fail");
  const partials = report.items.filter(i => i.status === "partial");

  lines.push("## 1. Resumo");
  lines.push("");
  lines.push(`| Status | Quantidade |`);
  lines.push(`|--------|-----------:|`);
  lines.push(`| ✅ OK | ${report.summary.ok} |`);
  lines.push(`| ❌ GRAVE | ${graveFails.length} |`);
  lines.push(`| ❌ MÉDIO | ${medioFails.length} |`);
  lines.push(`| ❌ BAIXO | ${baixoFails.length} |`);
  lines.push(`| ⚠️ Parcial | ${partials.length} |`);
  lines.push(`| **Total** | **${report.summary.total}** |`);
  lines.push("");

  if (graveFails.length === 0 && medioFails.length === 0 && baixoFails.length === 0) {
    lines.push("### ✅ Nenhuma não conformidade encontrada.");
    lines.push("");
  }

  // === 2. Apenas GRAVES ===
  if (graveFails.length > 0) {
    lines.push("---");
    lines.push("## 2. 🔴 Pendências GRAVES");
    lines.push("");
    for (const item of graveFails) {
      lines.push(`### ${item.id}. ❌ ${item.description}`);
      lines.push(`- **Seção:** ${item.section}`);
      lines.push(`- **Local:** \`${item.location}\``);
      lines.push(`- **Sugestão:** ${item.suggestion}`);
      if (item.fixFile) lines.push(`- **Arquivo:** \`${item.fixFile}\`${item.fixLine ? `:${item.fixLine}` : ""}`);
      if (item.fixInstruction) lines.push(`- **Instrução:** ${item.fixInstruction}`);
      lines.push("");
    }
  }

  // === 3. MÉDIOS ===
  if (medioFails.length > 0) {
    lines.push("---");
    lines.push("## 3. 🟡 Pendências MÉDIAS");
    lines.push("");
    for (const item of medioFails) {
      lines.push(`### ${item.id}. ❌ ${item.description}`);
      lines.push(`- **Seção:** ${item.section}`);
      lines.push(`- **Local:** \`${item.location}\``);
      lines.push(`- **Sugestão:** ${item.suggestion}`);
      if (item.fixFile) lines.push(`- **Arquivo:** \`${item.fixFile}\`${item.fixLine ? `:${item.fixLine}` : ""}`);
      if (item.fixInstruction) lines.push(`- **Instrução:** ${item.fixInstruction}`);
      lines.push("");
    }
  }

  // === 4. BAIXOS ===
  if (baixoFails.length > 0) {
    lines.push("---");
    lines.push("## 4. 🟢 Pendências BAIXAS");
    lines.push("");
    for (const item of baixoFails) {
      lines.push(`### ${item.id}. ❌ ${item.description}`);
      lines.push(`- **Seção:** ${item.section}`);
      lines.push(`- **Local:** \`${item.location}\``);
      lines.push(`- **Sugestão:** ${item.suggestion}`);
      lines.push("");
    }
  }

  // === 5. Checklist completo (56 itens) ===
  lines.push("---");
  lines.push("## 5. Checklist Completo (56 itens)");
  lines.push("");

  const sections = [...new Set(report.items.map(i => i.section))];
  for (const section of sections) {
    const sectionItems = report.items.filter(i => i.section === section);
    lines.push(`### ${section}`);
    lines.push("");
    lines.push(`| # | Status | Item | Severidade | Local |`);
    lines.push(`|---|--------|------|-----------|-------|`);
    for (const item of sectionItems) {
      lines.push(`| ${item.id} | ${statusIcon(item.status)} | ${item.description} | ${severityLabel(item.severity)} | \`${item.location}\` |`);
    }
    lines.push("");
  }

  // === 6. Propriedades do documento ===
  lines.push("---");
  lines.push("## 6. Propriedades do Documento");
  lines.push("");
  lines.push(`| Propriedade | Valor |`);
  lines.push(`|------------|-------|`);
  lines.push(`| Papel | ${report.analysis.page.widthTwip} × ${report.analysis.page.heightTwip} twip |`);
  lines.push(`| Margens | T:${report.analysis.page.marginTopCm}cm B:${report.analysis.page.marginBottomCm}cm L:${report.analysis.page.marginLeftCm}cm R:${report.analysis.page.marginRightCm}cm |`);
  lines.push(`| Fonte padrão | ${report.analysis.fonts.defaultFont} ${report.analysis.fonts.defaultSize}pt |`);
  lines.push(`| Parágrafos | ${report.analysis.paragraphCount} |`);
  lines.push(`| Tabelas | ${report.analysis.tables.count} |`);
  lines.push(`| Referências | ${report.analysis.references.entryCount} entradas |`);
  lines.push(`| Imagens | ${report.analysis.images.count} |`);
  lines.push(`| Sumário (TOC) | ${report.analysis.toc.exists ? "✅ Sim" : "❌ Não"} |`);
  lines.push(`| Numeração de página | ${report.analysis.pagination.usesWordField ? "✅ Campo Word" : "❌ Ausente"} |`);

  return lines.join("\n") + "\n";
}
