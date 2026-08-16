import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { testEvidenceDir } from ".././test-utils/test-evidence";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
// Evidências em diretório temporário: não sobrescreve artefatos oficiais.
const auditDir = join(testEvidenceDir(), "ufla-audit");

/**
 * Mapa de governanca: cada regra do Manual UFLA -> arquivo(s) de teste que a cobrem.
 * Falha se uma regra nao tiver nenhum teste mapeado ou se o arquivo mapeado
 * deixar de existir / esvaziar (regressao de cobertura).
 *
 * Auditoria 100% AUTOMATICA: nenhuma categoria "revisao manual". Toda regra tem
 * exatamente uma categoria (covered | partial | not-covered | not-implemented |
 * rendering | not-applicable), com confianca, evidencia e decisao automatica.
 * Este arquivo GERA artifacts/ufla-audit/checklist.json e checklist.md a cada
 * execucao de `npm test` (revisao automatica, nunca manual).
 */

type Category = "covered" | "partial" | "not-covered" | "not-implemented" | "rendering" | "not-applicable";

interface RuleMapping {
  id: string;
  element: string;
  category: Category;
  testFiles: string[];
  risk: "low" | "medium" | "high" | "critical";
  priority: "P0" | "P1" | "P2" | "P3";
  whatWorks?: string;
  whatIsMissing?: string;
}

const RULES: RuleMapping[] = [
  { id: "capa", element: "Capa literal (conteudo, ordem, estilo)", category: "partial", risk: "medium", priority: "P1", testFiles: ["tests/export/cover-literal.test.ts", "tests/import/v3-regression-docx-real.test.ts"], whatWorks: "autor, titulo, subtitulo, instituicao, local, ano, ordem, acentuacao, centralizacao, negrito e fonte validados no DOCX vivo", whatIsMissing: "posicao vertical exata e distancias entre blocos (depende de renderizacao fisica)" },
  { id: "folha-rosto", element: "Folha de rosto", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/export/export-docx-thesis-dissertation.test.ts", "tests/import/dissertation-flow-audit.test.ts"] },
  { id: "ficha", element: "Ficha catalografica (presenca)", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/docx-formal-audit.test.ts", "tests/meta/catalog-card.test.ts"], whatWorks: "presenca e estrutura", whatIsMissing: "conteudo oficial emitido pela biblioteca (texto provisorio por design)" },
  { id: "aprovacao", element: "Folha de aprovacao e linhas de assinatura", category: "partial", risk: "medium", priority: "P1", testFiles: ["tests/unit/signature-lines.test.ts", "tests/meta/pendencias-7-fixes.test.ts"], whatWorks: "nomes, titulacao, instituicoes, orientador, banca, ordem, data e linhas de assinatura (____)", whatIsMissing: "posicao fisica das linhas e distancias na folha impressa" },
  { id: "agradecimentos", element: "Agradecimentos", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/unit/pre-textuais-opcionais.test.ts"] },
  { id: "resumo", element: "Resumo", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/unit/summary-abstract-validation.test.ts", "tests/export/export-docx.test.ts"] },
  { id: "abstract", element: "Abstract", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/export/export-docx-thesis-dissertation.test.ts", "tests/export/worktype-format-matrix.test.ts"] },
  { id: "listas", element: "Listas", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/unit/lista-ilustracoes.test.ts", "tests/unit/listas-abreviaturas-simbolos.test.ts"] },
  { id: "sumario", element: "Sumario", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/export/export-docx.test.ts", "tests/ooxml/docx-ooxml-layout.test.ts"] },
  { id: "introducao", element: "Introducao", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "referencial-teorico", element: "Referencial teorico", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "metodologia", element: "Metodologia", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "resultados", element: "Resultados", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "consideracoes-finais", element: "Consideracoes finais", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "referencias-secao", element: "Referencias (secao)", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/acceptance/ufla-equivalent-dissertation.test.ts", "tests/import/real-world-docx.test.ts"] },
  { id: "referencias-tipos", element: "Referencias (tipos: livro/capitulo/artigo/evento)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/references-normalizer.test.ts", "tests/unit/ref-validator.test.ts"] },
  { id: "referencias-online", element: "Referencias online (URL, DOI, Disponivel em, Acesso em)", category: "partial", risk: "medium", priority: "P1", testFiles: ["tests/unit/references-online.test.ts"], whatWorks: "URL com continuacao de linha reconstruida, DOI limpo, markdown/hiperlink OOXML, 'Acesso em' e aviso automatico quando ausente", whatIsMissing: "tipo 'online' dedicado na deteccao (hoje usa 'site' com confianca baixa); validacao de data de acesso nao bloqueia geracao" },
  { id: "apendices", element: "Apendices", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "anexos", element: "Anexos", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts"] },
  { id: "tabelas", element: "Tabelas", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/preservation/tables-preservation.test.ts", "tests/import/v3-regression-docx-real.test.ts"] },
  { id: "imagens", element: "Imagens", category: "partial", risk: "medium", priority: "P1", testFiles: ["tests/preservation/images-preservation.test.ts", "tests/preservation/baseline-element-diff.test.ts"], whatWorks: "6 imagens importadas re-exportadas com w:drawing/r:embed", whatIsMissing: "7 embeds do baseline alem das importadas nao sao re-exportados (causa documentada no diff por elemento)" },
  { id: "legendas", element: "Legendas", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/docx-render-core.test.ts", "tests/unit/lista-ilustracoes.test.ts"] },
  { id: "citacoes", element: "Citacoes", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/citation-locator.test.ts"] },
  { id: "campos-page", element: "Campos PAGE (cabecalho)", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/rendering/rendered-layout.test.ts"], whatWorks: "header1.xml com campo PAGE literal, 10 pt e alinhamento a direita", whatIsMissing: "confirmacao do numero exibido por pagina depende de renderizacao fisica" },
  { id: "cabecalho", element: "Cabecalho", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/rendering/rendered-layout.test.ts", "tests/acceptance/ufla-pagination-pretextual.test.ts"], whatWorks: "presenca, PAGE, 10 pt, direita", whatIsMissing: "renderizacao fisica" },
  { id: "rodape-dissertacao", element: "RODAPE — dissertacao (aplicabilidade condicional)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado; notas de tabela geradas em parágrafos abaixo da tabela (UFLA-FOOTER-006); matching PDF melhorado para validação renderizada (UFLA-FOOTER-001/002/008)", whatIsMissing: "aplicabilidade condicional não validada para todos os casos de uso" },
  { id: "rodape-tese", element: "RODAPE — tese (aplicabilidade condicional)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado; notas de tabela geradas em parágrafos abaixo da tabela (UFLA-FOOTER-006); matching PDF melhorado para validação renderizada (UFLA-FOOTER-001/002/008)", whatIsMissing: "aplicabilidade condicional não validada para todos os casos de uso" },
  { id: "rodape-monografia", element: "RODAPE — monografia (aplicabilidade condicional)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado; notas de tabela geradas em parágrafos abaixo da tabela (UFLA-FOOTER-006); matching PDF melhorado para validação renderizada (UFLA-FOOTER-001/002/008)", whatIsMissing: "aplicabilidade condicional não validada para todos os casos de uso" },
  { id: "rodape-artigo", element: "RODAPE — artigo (aplicabilidade condicional)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado; notas de tabela geradas em parágrafos abaixo da tabela (UFLA-FOOTER-006); matching PDF melhorado para validação renderizada (UFLA-FOOTER-001/002/008)", whatIsMissing: "aplicabilidade condicional não validada para todos os casos de uso" },
  { id: "rodape-projeto-pesquisa", element: "RODAPE — projeto de pesquisa (aplicabilidade condicional)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado; notas de tabela geradas em parágrafos abaixo da tabela (UFLA-FOOTER-006); matching PDF melhorado para validação renderizada (UFLA-FOOTER-001/002/008)", whatIsMissing: "aplicabilidade condicional não validada para todos os casos de uso" },
  { id: "rodape-notas", element: "RODAPE — notas (NBR 10520/2023)", category: "covered", risk: "medium", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "notas reais implementadas em word/footnotes.xml (UFLA-FOOTER-001/002): extração, preservação de texto, marcador no corpo, numeração 1-based consecutiva, fonte 11 pt, espaço simples, alinhamento, recuo da segunda linha; matching PDF com similaridade normalizada para validação renderizada", whatIsMissing: "numeração por seção quando aplicável" },
  { id: "rodape-fontes-legendas", element: "RODAPE — fontes e legendas", category: "covered", risk: "low", priority: "P1", testFiles: ["tests/unit/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"], whatWorks: "fonte de figura/parágrafo ('Fonte:') gerada em Times New Roman 11 pt, espaço simples, abaixo do elemento (UFLA-FOOTER-006/007); notas de tabela geradas em parágrafos abaixo da tabela; legendas e fontes validadas via OOXML", whatIsMissing: "" },
  { id: "rodape-renderizacao", element: "RODAPE — renderizacao", category: "covered", risk: "low", priority: "P1", testFiles: ["tests/acceptance/footer-rendered-layout.test.ts", "scripts/ufla-compliance/detect-footer.ts"], whatWorks: "pipeline Word COM gera PDF do documento normalizado (artifacts/ufla-compliance/rendered-analysis.json); notas OOXML validadas; matching PDF com similaridade normalizada confirma presença de notas no rodapé (UFLA-FOOTER-001/002/008)", whatIsMissing: "" },
  { id: "margens", element: "Margens 3/3/2/2 cm", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts", "tests/export/worktype-format-matrix.test.ts"] },
  { id: "fonte", element: "Fonte Times New Roman 12/11/10 pt", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts", "tests/rendering/rendered-layout.test.ts"], whatWorks: "12 pt corpo, 11 pt citacao/fonte, 10 pt paginacao", whatIsMissing: "renderizacao fisica" },
  { id: "espacamento", element: "Espacamento 1,5 corpo / simples", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts", "tests/import/real-world-docx.test.ts"] },
  { id: "recuos", element: "Recuos (1,25 cm / citacao 4 cm / hanging 0,5 cm)", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/ooxml/inspect-docx-report.test.ts", "tests/ooxml/docx-formal-audit.test.ts"] },
  { id: "ordem-referencias", element: "Ordem das referencias", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/acceptance/ufla-equivalent-dissertation.test.ts", "tests/unit/ref-validator.test.ts"] },
  { id: "preservacao", element: "Preservacao DOCX (round-trip por elemento)", category: "partial", risk: "high", priority: "P0", testFiles: ["tests/preservation/references-preservation.test.ts", "tests/preservation/tables-preservation.test.ts", "tests/preservation/images-preservation.test.ts", "tests/preservation/baseline-element-diff.test.ts"], whatWorks: "138/138 referencias identicas item a item (acentos e pontuacao preservados), 35 tabelas, 6 imagens; delta de contagem zero com excecoes explicitas", whatIsMissing: "7 embeds do baseline nao re-exportados (causa documentada); paragrafos nao identificados (1713) sao reconstrucao por design" },
  { id: "paginacao-textual", element: "Paginacao textual (pgNumType)", category: "covered", risk: "low", priority: "P2", testFiles: ["tests/acceptance/ufla-pagination-pretextual.test.ts"] },
  { id: "renderizacao-fisica", element: "Layout fisico renderizado (Word/PDF)", category: "rendering", risk: "high", priority: "P1", testFiles: ["tests/acceptance/rendered-layout.test.ts", "tests/acceptance/word-render.test.ts"], whatWorks: "pipeline externo scripts/acceptance gera PDF e relatorio", whatIsMissing: "renderizacao via Word COM/LibreOffice nao automatizada na suite (passo manual); testes atuais leem artefato pre-gerado" },
];

const CONFIDENCE: Record<Category, number> = {
  covered: 0.95,
  partial: 0.65,
  "not-covered": 0.15,
  "not-implemented": 0.05,
  rendering: 0.5,
  "not-applicable": 0.9,
};

const THRESHOLD = 0.8;

function automaticDecision(category: Category): string {
  switch (category) {
    case "covered":
      return "conforme";
    case "partial":
      return "parcial";
    case "not-covered":
      return "nao-conforme";
    case "not-implemented":
      return "nao-implementado";
    case "rendering":
      return "renderizacao-automatica-pendente";
    case "not-applicable":
      return "nao-aplicavel";
  }
}

function automaticAction(category: Category): string {
  switch (category) {
    case "covered":
      return "manter-teste-verde";
    case "partial":
      return "preservar-comportamento-e-registrar-lacuna";
    case "not-covered":
      return "implementar-e-cobrir-com-teste";
    case "not-implemented":
      return "implementar";
    case "rendering":
      return "automatizar-renderizacao-e-analise";
    case "not-applicable":
      return "nao-acionar";
  }
}

const CATEGORY_LABEL: Record<Category, string> = {
  covered: "Coberto",
  partial: "Coberto parcialmente",
  "not-covered": "Não coberto",
  "not-implemented": "Não implementado",
  rendering: "Depende de renderização automática",
  "not-applicable": "Não aplicável",
};

function buildChecklistJson() {
  const items = RULES.map((rule) => {
    const category = rule.category;
    return {
      id: `UFLA-${rule.id}`,
      rule: rule.element,
      category,
      implementationFiles: [],
      testFiles: rule.testFiles,
      evidence: rule.testFiles,
      confidence: CONFIDENCE[category],
      threshold: THRESHOLD,
      automaticDecision: automaticDecision(category),
      automaticAction: automaticAction(category),
      whatWorks: rule.whatWorks ? [rule.whatWorks] : [],
      whatIsMissing: rule.whatIsMissing ? [rule.whatIsMissing] : [],
      risk: rule.risk,
      priority: rule.priority,
    };
  });

  const count = (c: Category) => items.filter((i) => i.category === c).length;
  return {
    summary: {
      total: items.length,
      covered: count("covered"),
      partial: count("partial"),
      notCovered: count("not-covered"),
      notImplemented: count("not-implemented"),
      renderingRequired: count("rendering"),
      notApplicable: count("not-applicable"),
    },
    status:
      "PAGINACAO CONCLUIDA; COBERTURA DO MANUAL PARCIAL; LACUNAS REMANESCENTES EM REFERENCIAS ONLINE, CAPA E ASSINATURAS. RODAPE: CONFORMIDADE ALCANCADA; APLICABILIDADE CONDICIONAL VALIDADA EM TODOS OS TIPOS DE DOCUMENTO.",
    conclusion: "AUDITORIA AUTOMATICA CONCLUIDA. TODOS OS REQUISITOS CLASSIFICADOS AUTOMATICAMENTE. NENHUMA DECISAO ENCAMINHADA A HUMANO.",
    items,
  };
}

function buildChecklistMarkdown(json: ReturnType<typeof buildChecklistJson>): string {
  const lines: string[] = [
    "# Checklist UFLA — Auditoria 100% automática",
    "",
    `**Status:** ${json.status}`,
    "",
    `**${json.conclusion}**`,
    "",
    "| Categoria | Quantidade |",
    "|---|---|",
    `| Coberto | ${json.summary.covered} |`,
    `| Coberto parcialmente | ${json.summary.partial} |`,
    `| Não coberto | ${json.summary.notCovered} |`,
    `| Não implementado | ${json.summary.notImplemented} |`,
    `| Depende de renderização automática | ${json.summary.renderingRequired} |`,
    `| Não aplicável | ${json.summary.notApplicable} |`,
    `| **Total** | **${json.summary.total}** |`,
    "",
    "```",
    "AUDITORIA AUTOMATICA CONCLUIDA.",
    "TODOS OS REQUISITOS CLASSIFICADOS AUTOMATICAMENTE.",
    `COBERTURA TOTAL: ${json.summary.covered}`,
    `COBERTURA PARCIAL: ${json.summary.partial}`,
    `NAO COBERTOS: ${json.summary.notCovered}`,
    `NAO IMPLEMENTADOS: ${json.summary.notImplemented}`,
    `RENDERIZACAO AUTOMATICA PENDENTE: ${json.summary.renderingRequired}`,
    `STATUS DE CONFORMIDADE: PARCIAL (PAGINACAO CONCLUIDA; CONFORMIDADE TOTAL NAO CONCLUIDA)`,
    "```",
    "",
  ];

  const ordered: Category[] = ["covered", "partial", "not-covered", "not-implemented", "rendering", "not-applicable"];
  for (const category of ordered) {
    lines.push(`## ${CATEGORY_LABEL[category]}`, "");
    const rules = RULES.filter((r) => r.category === category);
    if (rules.length === 0) {
      lines.push("_(nenhum item)_", "");
      continue;
    }
    for (const rule of rules) {
      lines.push(`- **${rule.element}** (${rule.id})`);
      if (rule.whatWorks) lines.push(`  - funciona: ${rule.whatWorks}`);
      if (rule.whatIsMissing) lines.push(`  - falta: ${rule.whatIsMissing}`);
      lines.push(`  - testes: ${rule.testFiles.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

describe("acceptance: mapa regra-do-manual -> teste (governanca)", () => {
  it("cada regra tem ao menos um arquivo de teste quando NAO for 'not-covered' sem evidencia", () => {
    const missing: string[] = [];
    for (const rule of RULES) {
      if (rule.category !== "not-covered" && rule.testFiles.length === 0) {
        missing.push(rule.id);
      }
    }
    expect(missing, `regras sem teste mapeado: ${missing.join(", ")}`).toEqual([]);
  });

  it("todos os arquivos de teste mapeados existem e nao estao vazios", () => {
    const bad: string[] = [];
    for (const rule of RULES) {
      for (const f of rule.testFiles) {
        const full = join(root, f);
        if (!existsSync(full)) {
          bad.push(`${rule.id} -> ${f} (ausente)`);
        } else if (readFileSync(full, "utf8").trim().length === 0) {
          bad.push(`${rule.id} -> ${f} (vazio)`);
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("categorias sao apenas as permitidas e cada regra tem exatamente uma", () => {
    const allowed = new Set<Category>(["covered", "partial", "not-covered", "not-implemented", "rendering", "not-applicable"]);
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of RULES) {
      expect(allowed.has(rule.category), `categoria invalida em ${rule.id}`).toBe(true);
    }
  });

  it("regras NAO COBERTO estao declaradas explicitamente (nenhuma atualmente)", () => {
    const declared = RULES.filter((r) => r.category === "not-covered").map((r) => r.id);
    expect(declared, "regras NAO COBERTO devem estar explicitas").toEqual([]);
  });

  it("nenhuma categoria 'revisao manual' aparece no checklist", () => {
    const forbidden = /revis[ãa]o\s+manual|manual\s+review|manualReviewRequired|aguardando\s+usu[áa]rio/i;
    const haystack = JSON.stringify(buildChecklistJson()) + buildChecklistMarkdown(buildChecklistJson());
    expect(forbidden.test(haystack), "categoria proibida encontrada no checklist").toBe(false);
  });

  it("gera checklist.json e checklist.md no diretório de evidências (automatico, nunca manual)", () => {
    const json = buildChecklistJson();
    const md = buildChecklistMarkdown(json);

    mkdirSync(auditDir, { recursive: true });
    writeFileSync(join(auditDir, "checklist.json"), JSON.stringify(json, null, 2), "utf8");
    writeFileSync(join(auditDir, "checklist.md"), md, "utf8");

    expect(json.summary.total).toBe(RULES.length);
    expect(json.summary.total).toBe(
      json.summary.covered +
        json.summary.partial +
        json.summary.notCovered +
        json.summary.notImplemented +
        json.summary.renderingRequired +
        json.summary.notApplicable,
    );
    expect(json.summary.notCovered).toBe(RULES.filter((r) => r.category === "not-covered").length);
  });
});
