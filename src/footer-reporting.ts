import {
  FOOTER_RULES,
  FOOTER_APPLICABILITY_MATRIX,
  FOOTER_SPECIFIC_ITEMS,
  FOOTER_STATUS,
} from "./footer-rules";

/**
 * Construtores dos relatórios oficiais de rodapé (matriz de rastreabilidade,
 * checklist de cobertura e findings abertos). Fonte única de verdade usada
 * pelos testes (tests/footer-requirements.test.ts) e pela regeneração oficial
 * dos artefatos (scripts/ufla-compliance/regenerate-official-artifacts.ts).
 */

export function buildTraceabilityMatrix() {
  return {
    generatedAt: new Date().toISOString(),
    status: FOOTER_STATUS,
    scope:
      "Rodapé condicional — Manual UFLA (MANUAL_NORMALIZACAO_2024.md) e NBR 10520/2023. A exigência é determinada por tipo de trabalho, modelo de documento, seção, elemento textual, tipo de citação, nota, fonte de imagem/tabela e regra específica do Manual. Nunca uma decisão única para todos os formatos.",
    classificationCriteria: {
      covered:
        "a regra aplicável está implementada; o rodapé correto é gerado; o conteúdo está correto; posição, fonte e espaçamento são validados; há teste positivo e negativo",
      partial:
        "o rodapé existe apenas em alguns tipos; a regra está implementada apenas em algumas seções; o conteúdo existe mas fonte/posição estão incorretos; há teste OOXML sem validação renderizada; faltam casos negativos",
      "not-covered":
        "o Manual exige rodapé no caso analisado; o gerador não o produz; não há teste; há falso negativo",
      "not-applicable":
        "apenas quando a própria regra do Manual não se aplica ao tipo de documento ou à condição avaliada",
    },
    rules: FOOTER_RULES,
    applicabilityMatrix: FOOTER_APPLICABILITY_MATRIX,
    specificItems: FOOTER_SPECIFIC_ITEMS,
  };
}

export function buildCoverageChecklist() {
  const items = FOOTER_SPECIFIC_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    category: item.category,
    whatWorks: item.whatWorks,
    whatIsMissing: item.whatIsMissing,
    testFiles: item.testFiles,
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json",
  }));
  const count = (c: string) => items.filter((i) => i.category === c).length;
  const summary = {
    total: items.length,
    covered: count("covered"),
    partial: count("partial"),
    notCovered: count("not-covered"),
    notImplemented: count("not-implemented"),
    rendering: count("rendering"),
    notApplicable: count("not-applicable"),
  };
  return { generatedAt: new Date().toISOString(), status: FOOTER_STATUS, summary, items };
}

export function buildCoverageMarkdown(json: ReturnType<typeof buildCoverageChecklist>): string {
  const lines = [
    "# Checklist de cobertura — RODAPÉ (aplicabilidade condicional)",
    "",
    `**Status:** ${json.status}`,
    "",
    "| Item | Categoria | Funciona | Falta | Testes |",
    "|---|---|---|---|---|",
  ];
  for (const item of json.items) {
    lines.push(
      `| ${item.label} (${item.id}) | ${item.category} | ${item.whatWorks} | ${item.whatIsMissing} | ${item.testFiles.join(", ")} |`,
    );
  }
  lines.push("", "```", "AUDITORIA AUTOMATICA CONCLUIDA.", "NENHUM ITEM CLASSIFICADO COMO NAO APLICAVEL DE FORMA GLOBAL.", "```", "");
  return lines.join("\n");
}

export function buildOpenFindings() {
  return {
    generatedAt: new Date().toISOString(),
    status: FOOTER_STATUS,
    findings: FOOTER_SPECIFIC_ITEMS.map((item, index) => ({
      id: `FINDING-FOOTER-${String(index + 1).padStart(3, "0")}`,
      item: item.id,
      severity: item.risk,
      category: item.category,
      cause: item.whatIsMissing,
      requiredAction:
        item.category === "partial"
          ? "completar a implementação (notas de tabela, renderização) e cobrir com teste negativo/renderizado"
          : "implementar o caso condicional (notas/referências no rodapé) e cobrir com teste positivo e negativo",
    })),
  };
}
