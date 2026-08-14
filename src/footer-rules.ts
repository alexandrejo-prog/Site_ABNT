import type { WorkType } from "./ufla-rules";

/**
 * Regras de rodapé extraídas do Manual de Normalização UFLA (6. ed., 2025 —
 * MANUAL_NORMALIZACAO_2024.md / MANUAL_DE_NORMALIZACAO_2024.md) e da NBR
 * 10520 (2023) adotada pelo Manual.
 *
 * O rodapé de página NÃO é obrigatório de forma incondicional para nenhum tipo
 * de trabalho: a exigência é determinada por tipo de trabalho, seção, elemento
 * textual, tipo de citação, nota, fonte de imagem/tabela e regra específica do
 * Manual (aplicabilidade condicional). A paginação fica no cabeçalho (canto
 * superior direito, §3.2.7), nunca no rodapé.
 */

export type FooterSeverity = "low" | "medium" | "high" | "critical";

export interface FooterRule {
  id: string;
  rule: string;
  appliesToWorkTypes: string[];
  appliesToSections: string[];
  requiredWhen: string;
  font: string;
  size: string;
  spacing: string;
  alignment: string;
  position: string;
  severity: FooterSeverity;
  source: string;
}

export const FOOTER_RULES: FooterRule[] = [
  {
    id: "UFLA-FOOTER-001",
    rule:
      "Notas (indicações, observações ou aditamentos ao texto, NBR 10520/2023) podem ser localizadas no rodapé da página, nas margens da mancha gráfica ou no final do artigo, da seção ou do documento. São indicadas no texto por números arábicos sequenciais; a partir da segunda linha da mesma nota o alinhamento deve ficar abaixo da primeira letra da primeira palavra, destacando o expoente, sem espaço entre elas e com fonte menor.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["todas as seções textuais (com notas)"],
    requiredWhen: "quando o autor utilizar notas no texto",
    font: "Times ou similar",
    size: "11 pt (notas, §3.2.1)",
    spacing: "espaço simples (§3.2.3)",
    alignment: "segunda linha da mesma nota abaixo da primeira letra da primeira palavra",
    position: "rodapé da página (ou margens / fim de artigo, seção ou documento)",
    severity: "medium",
    source: "MANUAL_NORMALIZACAO_2024.md §4.6 Notas; §3.2.1 Formato; §3.2.3 Espaçamento",
  },
  {
    id: "UFLA-FOOTER-002",
    rule:
      "Notas de referência (NBR 10520/2023) devem ter numeração única e consecutiva para cada seção ou parte; a numeração não pode ser iniciada a cada página. Citações subsequentes da mesma fonte podem usar forma abreviada (referência anterior em letras maiúsculas; idem, ibidem, opus, passim, apud etc.).",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["seções textuais com notas de referência"],
    requiredWhen: "quando houver notas de referência (citação de fonte consultada)",
    font: "Times ou similar",
    size: "11 pt (notas, §3.2.1)",
    spacing: "espaço simples",
    alignment: "segunda linha da mesma nota abaixo da primeira letra da primeira palavra",
    position: "rodapé da página (ou margens / fim de seção)",
    severity: "medium",
    source: "MANUAL_NORMALIZACAO_2024.md §4.6.1.1 Notas de referência",
  },
  {
    id: "UFLA-FOOTER-003",
    rule:
      "As referências de Anexo, se houver, devem constar no próprio elemento em nota de rodapé ou constituir lista específica.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["anexos"],
    requiredWhen: "quando o anexo contiver referências",
    font: "Times ou similar",
    size: "11 pt (notas, §3.2.1)",
    spacing: "espaço simples",
    alignment: "à esquerda; segunda linha abaixo da primeira letra da primeira palavra",
    position: "nota de rodapé no próprio anexo, ou lista específica no elemento",
    severity: "low",
    source: "MANUAL_NORMALIZACAO_2024.md §3.1.2.4.1 Referências (anexo)",
  },
  {
    id: "UFLA-FOOTER-004",
    rule:
      "As referências podem ser dispostas no rodapé (opção a de disposição, alternativa à lista de referências). Quando aparecem no rodapé da página: alinhadas à margem esquerda, segunda linha abaixo da primeira letra da primeira palavra, destacando o expoente e sem espaço entre elas.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["referências (disposição alternativa no rodapé)"],
    requiredWhen: "quando o autor optar pela disposição das referências no rodapé",
    font: "Times ou similar",
    size: "11 pt (notas, §3.2.1)",
    spacing: "espaço simples, sem espaço entre referências",
    alignment: "à margem esquerda; segunda linha abaixo da primeira letra da primeira palavra",
    position: "rodapé da página",
    severity: "low",
    source: "MANUAL_NORMALIZACAO_2024.md §5.1 (disposição das referências)",
  },
  {
    id: "UFLA-FOOTER-005",
    rule:
      "A numeração é colocada a partir da primeira página do primeiro elemento textual (Introdução), em algarismos arábicos, no canto superior direito da folha. O rodapé de página não é usado para paginação.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["elemento textual (a partir da Introdução)"],
    requiredWhen: "sempre (paginação do trabalho)",
    font: "Times ou similar",
    size: "11 pt (paginação, §3.2.1)",
    spacing: "—",
    alignment: "canto superior direito da folha",
    position: "cabeçalho (header), não no rodapé",
    severity: "high",
    source: "MANUAL_NORMALIZACAO_2024.md §3.2.7 Paginação",
  },
  {
    id: "UFLA-FOOTER-006",
    rule:
      "A nota e a fonte da tabela são colocadas na parte inferior da tabela, em letra tamanho 11 e espaçamento entre linhas simples. A fonte é elemento obrigatório, mesmo que seja produção do próprio autor ('elaborada pelo próprio autor' ou expressão equivalente, conforme ABNT NBR 10520).",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["tabelas"],
    requiredWhen: "toda tabela (fonte obrigatória); nota quando houver informação adicional explicando a tabela",
    font: "Times ou similar",
    size: "11 pt",
    spacing: "espaço simples",
    alignment: "parte inferior da tabela",
    position: "abaixo da tabela (no corpo, não no rodapé de página)",
    severity: "medium",
    source: "MANUAL_NORMALIZACAO_2024.md §3.2.10 (tabelas)",
  },
  {
    id: "UFLA-FOOTER-007",
    rule:
      "A legenda e a fonte da ilustração são colocadas na parte inferior da ilustração, em letra tamanho 11 e espaçamento entre linhas simples. A fonte é elemento obrigatório, mesmo que seja produção do próprio autor.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["ilustrações (figuras, gráficos, quadros)"],
    requiredWhen: "toda ilustração (fonte obrigatória; legenda quando houver)",
    font: "Times ou similar",
    size: "11 pt",
    spacing: "espaço simples",
    alignment: "parte inferior da ilustração",
    position: "abaixo da ilustração (no corpo, não no rodapé de página)",
    severity: "medium",
    source: "MANUAL_NORMALIZACAO_2024.md §3.2.9 (ilustrações)",
  },
  {
    id: "UFLA-FOOTER-008",
    rule:
      "Formatação da página que delimita a área do rodapé: margens superior e esquerda de 3 cm e margens inferior e direita de 2 cm; cabeçalho a 2 cm. Notas em espaço simples, sem espaço entre elas.",
    appliesToWorkTypes: ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"],
    appliesToSections: ["todas"],
    requiredWhen: "sempre (formatação da página)",
    font: "—",
    size: "—",
    spacing: "notas em espaço simples",
    alignment: "—",
    position: "margem inferior de 2 cm (área do rodapé); cabeçalho a 2 cm",
    severity: "low",
    source: "MANUAL_NORMALIZACAO_2024.md §3.2.2 Margens; §3.2.3 Espaçamento",
  },
];

export type FooterRequirementLabel = "Sim" | "Não" | "Condicional";
export type FooterImplementationLabel = "Sim" | "Parcial" | "Não";

export interface FooterApplicabilityRow {
  workType: WorkType;
  applicationCase: string;
  footerRequired: FooterRequirementLabel;
  implemented: FooterImplementationLabel;
  test: string;
  evidence: string;
}

/**
 * Matriz de aplicabilidade por tipo de trabalho. Nenhum tipo tem rodapé de
 * página obrigatório de forma incondicional: os casos são condicionais (notas
 * quando utilizadas; referências de anexo em nota; disposição de referências
 * no rodapé) e a paginação fica no cabeçalho.
 */
export const FOOTER_APPLICABILITY_MATRIX: FooterApplicabilityRow[] = [
  {
    workType: "monografia",
    applicationCase:
      "notas no rodapé quando utilizadas (NBR 10520/2023); referências de anexo em nota de rodapé; referências no rodapé (opcional); paginação no cabeçalho (canto superior direito)",
    footerRequired: "Condicional",
    implemented: "Parcial",
    test: "tests/footer-requirements.test.ts; tests/acceptance/footer-by-work-type.test.ts; tests/regression/footer-regression.test.ts; tests/footnotes-roundtrip.test.ts",
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json; artifacts/ufla-audit/traceability/coverage-checklist.json; word/footnotes.xml no DOCX gerado",
  },
  {
    workType: "dissertacao",
    applicationCase:
      "notas no rodapé quando utilizadas (NBR 10520/2023); referências de anexo em nota de rodapé; referências no rodapé (opcional); paginação no cabeçalho (canto superior direito)",
    footerRequired: "Condicional",
    implemented: "Parcial",
    test: "tests/footer-requirements.test.ts; tests/acceptance/footer-by-work-type.test.ts; tests/regression/footer-regression.test.ts; tests/footnotes-roundtrip.test.ts",
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json; artifacts/ufla-audit/traceability/coverage-checklist.json; word/footnotes.xml no DOCX gerado",
  },
  {
    workType: "tese",
    applicationCase:
      "notas no rodapé quando utilizadas (NBR 10520/2023); referências de anexo em nota de rodapé; referências no rodapé (opcional); paginação no cabeçalho (canto superior direito)",
    footerRequired: "Condicional",
    implemented: "Parcial",
    test: "tests/footer-requirements.test.ts; tests/acceptance/footer-by-work-type.test.ts; tests/regression/footer-regression.test.ts; tests/footnotes-roundtrip.test.ts",
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json; artifacts/ufla-audit/traceability/coverage-checklist.json; word/footnotes.xml no DOCX gerado",
  },
  {
    workType: "artigo",
    applicationCase:
      "notas no rodapé quando utilizadas (NBR 10520/2023); referências de anexo em nota de rodapé; referências no rodapé (opcional); paginação no cabeçalho (canto superior direito)",
    footerRequired: "Condicional",
    implemented: "Parcial",
    test: "tests/footer-requirements.test.ts; tests/acceptance/footer-by-work-type.test.ts; tests/regression/footer-regression.test.ts; tests/footnotes-roundtrip.test.ts",
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json; artifacts/ufla-audit/traceability/coverage-checklist.json; word/footnotes.xml no DOCX gerado",
  },
  {
    workType: "projeto_pesquisa",
    applicationCase:
      "notas no rodapé quando utilizadas (NBR 10520/2023); referências de anexo em nota de rodapé; referências no rodapé (opcional); paginação no cabeçalho (canto superior direito)",
    footerRequired: "Condicional",
    implemented: "Parcial",
    test: "tests/footer-requirements.test.ts; tests/acceptance/footer-by-work-type.test.ts; tests/regression/footer-regression.test.ts; tests/footnotes-roundtrip.test.ts",
    evidence: "artifacts/ufla-audit/traceability/traceability-matrix.json; artifacts/ufla-audit/traceability/coverage-checklist.json; word/footnotes.xml no DOCX gerado",
  },
];

export type FooterElement =
  | "nota"
  | "referencia-anexo"
  | "referencia-rodape"
  | "pagina"
  | "tabela"
  | "ilustracao"
  | "nenhum";

export interface FooterUsageDecision {
  workType: WorkType;
  section: string;
  element: FooterElement;
  pageFooterRequired: boolean;
  reason: string;
  ruleIds: string[];
}

/**
 * Decisão de aplicabilidade condicional do rodapé. Nunca global: depende do
 * tipo de trabalho, da seção e do elemento textual analisado.
 */
export function classifyFooterUsage(
  workType: WorkType,
  section: string,
  element: FooterElement = "nenhum",
): FooterUsageDecision {
  const base = { workType, section, element };
  switch (element) {
    case "nota":
      return {
        ...base,
        pageFooterRequired: true,
        reason:
          "Manual permite notas no rodapé (NBR 10520/2023 §4.6); gerador implementa notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples e recuo da segunda linha (UFLA-FOOTER-001/002)",
        ruleIds: ["UFLA-FOOTER-001", "UFLA-FOOTER-002"],
      };
    case "referencia-anexo":
      return {
        ...base,
        pageFooterRequired: true,
        reason:
          "referências de anexo podem constar em nota de rodapé ou em lista específica no próprio elemento (§3.1.2.4.1) — nota de rodapé é uma das opções válidas",
        ruleIds: ["UFLA-FOOTER-003"],
      };
    case "referencia-rodape":
      return {
        ...base,
        pageFooterRequired: true,
        reason:
          "disposição das referências no rodapé é opção do autor (alternativa à lista); quando usada, segue regras de alinhamento próprias (§5.1)",
        ruleIds: ["UFLA-FOOTER-004"],
      };
    case "pagina":
      return {
        ...base,
        pageFooterRequired: false,
        reason:
          "paginação no canto superior direito da folha (cabeçalho), a partir da Introdução — rodapé de página não é usado para paginação (§3.2.7)",
        ruleIds: ["UFLA-FOOTER-005"],
      };
    case "tabela":
      return {
        ...base,
        pageFooterRequired: false,
        reason:
          "nota e fonte da tabela ficam na parte inferior da tabela (no corpo), tamanho 11, espaço simples; fonte obrigatória — não é rodapé de página (§3.2.10)",
        ruleIds: ["UFLA-FOOTER-006"],
      };
    case "ilustracao":
      return {
        ...base,
        pageFooterRequired: false,
        reason:
          "legenda e fonte da ilustração ficam na parte inferior da ilustração (no corpo), tamanho 11, espaço simples; fonte obrigatória — não é rodapé de página (§3.2.9)",
        ruleIds: ["UFLA-FOOTER-007"],
      };
    default:
      return {
        ...base,
        pageFooterRequired: false,
        reason:
          "sem elemento de rodapé no caso analisado; margem inferior de 2 cm delimita a área do rodapé (§3.2.2)",
        ruleIds: ["UFLA-FOOTER-008"],
      };
  }
}

export type FooterCoverageCategory =
  | "covered"
  | "partial"
  | "not-covered"
  | "not-implemented"
  | "rendering"
  | "not-applicable";

export interface FooterCoverageItem {
  id: string;
  label: string;
  category: FooterCoverageCategory;
  testFiles: string[];
  whatWorks: string;
  whatIsMissing: string;
  risk: FooterSeverity;
  priority: "P0" | "P1" | "P2" | "P3";
}

/**
 * Itens específicos que substituem o item genérico "RODAPÉ: NÃO COBERTO".
 * Nenhum item é classificado como "não aplicável" de forma global: a
 * aplicabilidade é condicional e avaliada por tipo de trabalho.
 */
export const FOOTER_SPECIFIC_ITEMS: FooterCoverageItem[] = [
  {
    id: "rodape-dissertacao",
    label: "RODAPÉ — dissertação",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado",
    whatIsMissing: "validação renderizada de rodapé (pipeline Word COM não inspeciona rodapés); aplicabilidade condicional não validada para todos os casos de uso",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-tese",
    label: "RODAPÉ — tese",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado",
    whatIsMissing: "validação renderizada de rodapé (pipeline Word COM não inspeciona rodapés); aplicabilidade condicional não validada para todos os casos de uso",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-monografia",
    label: "RODAPÉ — monografia",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado",
    whatIsMissing: "validação renderizada de rodapé (pipeline Word COM não inspeciona rodapés); aplicabilidade condicional não validada para todos os casos de uso",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-artigo",
    label: "RODAPÉ — artigo",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado",
    whatIsMissing: "validação renderizada de rodapé (pipeline Word COM não inspeciona rodapés); aplicabilidade condicional não validada para todos os casos de uso",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-projeto-pesquisa",
    label: "RODAPÉ — projeto de pesquisa",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais em word/footnotes.xml com FootnoteReferenceRun no corpo, numeração 1-based, fonte 11 pt, espaço simples, recuo da segunda linha; paginação no cabeçalho (canto superior direito); ausência de rodapé de página quando não utilizado",
    whatIsMissing: "validação renderizada de rodapé (pipeline Word COM não inspeciona rodapés); aplicabilidade condicional não validada para todos os casos de uso",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-notas",
    label: "RODAPÉ — notas",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts", "tests/footnotes-roundtrip.test.ts"],
    whatWorks: "notas reais implementadas em word/footnotes.xml (UFLA-FOOTER-001/002): extração, preservação de texto, marcador no corpo, numeração 1-based consecutiva, fonte 11 pt, espaço simples, alinhamento, recuo da segunda linha",
    whatIsMissing: "numeração por seção quando aplicável; validação renderizada de rodapé",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-fontes-legendas",
    label: "RODAPÉ — fontes e legendas",
    category: "partial",
    testFiles: ["tests/footer-requirements.test.ts", "tests/acceptance/footer-by-work-type.test.ts", "tests/regression/footer-regression.test.ts"],
    whatWorks: "fonte de figura/parágrafo ('Fonte:') gerada em Times New Roman 11 pt, espaço simples, abaixo do elemento (UFLA-FOOTER-006/007); nota de tabela preservada no corpo",
    whatIsMissing: "notas de tabela não geradas; legendas e fontes sem validação renderizada (OOXML apenas)",
    risk: "medium",
    priority: "P1",
  },
  {
    id: "rodape-renderizacao",
    label: "RODAPÉ — renderização",
    category: "not-covered",
    testFiles: ["tests/acceptance/footer-rendered-layout.test.ts"],
    whatWorks: "pipeline Word COM gera PDF do documento normalizado (artifacts/ufla-compliance/rendered-analysis.json); notas OOXML validadas",
    whatIsMissing: "análise renderizada não inspeciona rodapés (limitação declarada no artefato); sem evidência de que notas/rodapé apareceriam no Word",
    risk: "high",
    priority: "P1",
  },
];

export const FOOTER_STATUS =
  "RODAPÉ: COBERTURA PARCIAL; NOTAS DE RODAPÉ IMPLEMENTADAS (word/footnotes.xml); FONTES DE TABELAS/ILUSTRAÇÕES PRESERVADAS; APLICABILIDADE CONDICIONAL POR TIPO/SEÇÃO/ELEMENTO; VALIDAÇÃO RENDERIZADA DE RODAPÉ PENDENTE.";
