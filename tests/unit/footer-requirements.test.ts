import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOOTER_RULES,
  FOOTER_APPLICABILITY_MATRIX,
  FOOTER_SPECIFIC_ITEMS,
  FOOTER_STATUS,
  classifyFooterUsage,
} from "../../src/footer-rules";
import {
  buildCoverageChecklist,
  buildCoverageMarkdown,
  buildOpenFindings,
  buildTraceabilityMatrix,
} from "../../src/footer-reporting";
import { testEvidenceDir } from ".././test-utils/test-evidence";

/**
 * Regras de rodapé extraídas do Manual UFLA (MANUAL_NORMALIZACAO_2024.md) e da
 * NBR 10520/2023 adotada pelo Manual. Valida o schema de cada regra
 * (UFLA-FOOTER-001..008), a matriz de aplicabilidade por tipo de trabalho e a
 * decisão condicional (nunca global). Gera automaticamente (em diretório
 * temporário de evidências, sem sobrescrever artefatos oficiais):
 *   traceability-matrix.json / coverage-checklist.json / .md / open-findings.json
 * Nenhuma categoria "revisão manual"; nenhum item classificado como
 * "não aplicável" de forma global.
 */

const traceDir = join(testEvidenceDir(), "traceability");
const findingsDir = join(testEvidenceDir(), "findings");

const REQUIRED_FIELDS: (keyof (typeof FOOTER_RULES)[number])[] = [
  "id",
  "rule",
  "appliesToWorkTypes",
  "appliesToSections",
  "requiredWhen",
  "font",
  "size",
  "spacing",
  "alignment",
  "position",
  "severity",
  "source",
];

const EXPECTED_WORK_TYPES = ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"];

const CATEGORIES = ["covered", "partial", "not-covered", "not-implemented", "rendering", "not-applicable"] as const;

describe("rodapé: regras extraídas do Manual UFLA (schema e IDs)", () => {
  it("IDs UFLA-FOOTER-001..008 únicos, sequenciais e no formato exigido", () => {
    expect(FOOTER_RULES.length).toBeGreaterThanOrEqual(8);
    const ids = FOOTER_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id, index) => {
      expect(id).toMatch(/^UFLA-FOOTER-\d{3}$/);
      expect(id).toBe(`UFLA-FOOTER-${String(index + 1).padStart(3, "0")}`);
    });
  });

  it("cada regra preenche todo o schema (incluindo fonte, tamanho, espaçamento, alinhamento, posição)", () => {
    for (const rule of FOOTER_RULES) {
      for (const field of REQUIRED_FIELDS) {
        const value = rule[field];
        if (typeof value === "string") {
          expect(value.trim().length, `regra ${rule.id}: campo '${field}' vazio`).toBeGreaterThan(0);
        } else {
          expect(value, `regra ${rule.id}: campo '${field}' vazio`).toBeDefined();
          expect((value as unknown[]).length, `regra ${rule.id}: campo '${field}' vazio`).toBeGreaterThan(0);
        }
      }
      expect(["low", "medium", "high", "critical"]).toContain(rule.severity);
      expect(rule.appliesToWorkTypes.length).toBeGreaterThan(0);
      expect(rule.appliesToSections.length).toBeGreaterThan(0);
    }
  });

  it("cada regra declara tipos de trabalho válidos e fonte do Manual", () => {
    for (const rule of FOOTER_RULES) {
      for (const workType of rule.appliesToWorkTypes) {
        expect(EXPECTED_WORK_TYPES, `regra ${rule.id} cita tipo inválido: ${workType}`).toContain(workType);
      }
      expect(rule.source).toMatch(/MANUAL_NORMALIZACAO_2024\.md|NBR 10520/);
    }
  });

  it("as regras cobrem os tópicos exigidos (notas, anexo, referências em rodapé, paginação, tabelas, ilustrações, distância)", () => {
    const rules = FOOTER_RULES.map((r) => r.rule.toLowerCase());
    const topics = ["nota", "anexo", "rodapé", "paginação", "tabela", "ilustração", "margem"];
    for (const topic of topics) {
      expect(rules.some((r) => r.includes(topic)), `nenhuma regra cobre o tópico '${topic}'`).toBe(true);
    }
  });
});

describe("rodapé: matriz de aplicabilidade por tipo de trabalho", () => {
  it("matriz cobre exatamente os cinco tipos exigidos", () => {
    const types = FOOTER_APPLICABILITY_MATRIX.map((row) => row.workType);
    expect([...types].sort()).toEqual([...EXPECTED_WORK_TYPES].sort());
    expect(new Set(types).size).toBe(5);
  });

  it("nenhum tipo usa decisão única 'Sim' incondicional; casos condicionais com justificativa", () => {
    for (const row of FOOTER_APPLICABILITY_MATRIX) {
      expect(["Sim", "Não", "Condicional"]).toContain(row.footerRequired);
      expect(["Sim", "Parcial", "Não"]).toContain(row.implemented);
      expect(row.footerRequired === "Sim" && row.implemented === "Não", `tipo ${row.workType} sem implementação e marcado como exigido`).toBe(false);
      expect(row.applicationCase.trim().length).toBeGreaterThan(0);
      expect(row.test.trim().length).toBeGreaterThan(0);
      expect(row.evidence.trim().length).toBeGreaterThan(0);
    }
  });

  it("paginação nunca é rodapé em nenhum tipo (UFLA-FOOTER-005)", () => {
    for (const workType of EXPECTED_WORK_TYPES) {
      const decision = classifyFooterUsage(workType as (typeof FOOTER_APPLICABILITY_MATRIX)[number]["workType"], "elemento textual", "pagina");
      expect(decision.pageFooterRequired, `paginação no rodapé em ${workType}`).toBe(false);
      expect(decision.ruleIds).toContain("UFLA-FOOTER-005");
    }
  });

  it("nota no rodapé é caso condicional exigido quando utilizada, em todos os tipos", () => {
    for (const workType of EXPECTED_WORK_TYPES) {
      const decision = classifyFooterUsage(workType as (typeof FOOTER_APPLICABILITY_MATRIX)[number]["workType"], "seção textual", "nota");
      expect(decision.pageFooterRequired, `nota sem rodapé em ${workType}`).toBe(true);
      expect(decision.ruleIds).toEqual(["UFLA-FOOTER-001", "UFLA-FOOTER-002"]);
    }
  });

  it("fonte/nota de tabela e ilustração ficam abaixo do elemento, não no rodapé de página", () => {
    const tabela = classifyFooterUsage("dissertacao", "tabelas", "tabela");
    expect(tabela.pageFooterRequired).toBe(false);
    expect(tabela.ruleIds).toContain("UFLA-FOOTER-006");
    const ilustracao = classifyFooterUsage("dissertacao", "ilustrações", "ilustracao");
    expect(ilustracao.pageFooterRequired).toBe(false);
    expect(ilustracao.ruleIds).toContain("UFLA-FOOTER-007");
  });

  it("anexo com referências pode usar nota de rodapé (UFLA-FOOTER-003)", () => {
    const decision = classifyFooterUsage("dissertacao", "anexos", "referencia-anexo");
    expect(decision.pageFooterRequired).toBe(true);
    expect(decision.ruleIds).toContain("UFLA-FOOTER-003");
  });
});

describe("rodapé: itens específicos e status", () => {
  it("itens específicos substituem o item genérico 'rodape'", () => {
    const ids = FOOTER_SPECIFIC_ITEMS.map((i) => i.id);
    expect(ids).not.toContain("rodape");
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of [
      "rodape-dissertacao",
      "rodape-tese",
      "rodape-monografia",
      "rodape-artigo",
      "rodape-notas",
      "rodape-fontes-legendas",
      "rodape-renderizacao",
    ]) {
      expect(ids, `item específico ausente: ${required}`).toContain(required);
    }
  });

  it("nenhum item de rodapé é 'não aplicável' de forma global", () => {
    for (const item of FOOTER_SPECIFIC_ITEMS) {
      expect(item.category, `item ${item.id} classificado como não aplicável globalmente`).not.toBe("not-applicable");
      expect(CATEGORIES).toContain(item.category);
    }
  });

  it("status declara cobertura parcial com aplicabilidade condicional ainda não validada", () => {
    expect(FOOTER_STATUS).toContain("COBERTURA PARCIAL");
    expect(FOOTER_STATUS).toContain("APLICABILIDADE CONDICIONAL");
    expect(FOOTER_STATUS).not.toContain("NAO APLICAVEL");
  });
});

describe("rodapé: relatórios de rastreabilidade gerados automaticamente", () => {
  it("gera traceability-matrix.json, coverage-checklist.json/.md e open-findings.json", () => {
    const matrix = buildTraceabilityMatrix();
    const checklist = buildCoverageChecklist();
    const markdown = buildCoverageMarkdown(checklist);
    const findings = buildOpenFindings();

    mkdirSync(traceDir, { recursive: true });
    mkdirSync(findingsDir, { recursive: true });
    writeFileSync(join(traceDir, "traceability-matrix.json"), JSON.stringify(matrix, null, 2), "utf8");
    writeFileSync(join(traceDir, "coverage-checklist.json"), JSON.stringify(checklist, null, 2), "utf8");
    writeFileSync(join(traceDir, "coverage-checklist.md"), markdown, "utf8");
    writeFileSync(join(findingsDir, "open-findings.json"), JSON.stringify(findings, null, 2), "utf8");

    expect(matrix.rules.length).toBe(FOOTER_RULES.length);
    expect(matrix.applicabilityMatrix.length).toBe(5);
    expect(checklist.summary.total).toBe(FOOTER_SPECIFIC_ITEMS.length);
    expect(checklist.summary.notApplicable).toBe(0);
    expect(checklist.summary.notCovered).toBeGreaterThan(0);
    expect(markdown).toContain("RODAPÉ — notas");
    expect(findings.findings.length).toBe(FOOTER_SPECIFIC_ITEMS.length);
    expect(findings.findings.every((f: { id: string }) => /^FINDING-FOOTER-\d{3}$/.test(f.id))).toBe(true);
  });
});
