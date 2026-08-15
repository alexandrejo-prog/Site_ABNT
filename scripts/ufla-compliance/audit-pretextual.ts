import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type {
  AuditGap,
  PretextualAuditResult,
  SectionAuditResult,
  WorkType,
} from "./audit-types.js";

async function extractParagraphs(docxPath: string): Promise<string[]> {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
}

function containsText(paragraphs: string[], keyword: RegExp | string): boolean {
  const re = typeof keyword === "string" ? new RegExp(keyword, "i") : keyword;
  return paragraphs.some((p) => re.test(p));
}

function normalizeWorkType(docxPath: string): WorkType {
  const name = docxPath.toLowerCase();
  if (name.includes("tese")) return "tese";
  if (name.includes("artigo")) return "artigo";
  if (name.includes("tcc") || name.includes("monografia")) return "tcc";
  if (name.includes("resumo-expandido") || name.includes("resumo_expandido")) return "resumo_expandido_cpg";
  if (name.includes("resumo") && name.includes("cpg")) return "resumo_cpg";
  if (name.includes("projeto")) return "projeto_pesquisa";
  return "dissertacao";
}

function sectionResult(
  overrides: Partial<SectionAuditResult> = {},
): SectionAuditResult {
  return {
    passed: true,
    score: 100,
    itemsFound: [],
    itemsMissing: [],
    gaps: [],
    ...overrides,
  };
}

function gap(overrides: Partial<AuditGap>): AuditGap {
  return {
    section: "pretextual",
    rule: "",
    severity: "major",
    description: "",
    suggestion: "",
    autoFixable: false,
    ...overrides,
  };
}

export async function auditPretextual(docxPath: string): Promise<PretextualAuditResult> {
  const paragraphs = await extractParagraphs(docxPath).then((ps) => ps);
  void normalizeWorkType(docxPath);

  const cover = sectionResult({
    passed: containsText(paragraphs, /Universidade Federal de Lavras|UFLA/i),
    itemsFound: containsText(paragraphs, /Universidade Federal de Lavras|UFLA/i) ? ["capa"] : [],
    itemsMissing: !containsText(paragraphs, /Universidade Federal de Lavras|UFLA/i) ? ["capa"] : [],
    gaps: !containsText(paragraphs, /Universidade Federal de Lavras|UFLA/i)
      ? [
          gap({
            section: "capa",
            rule: "UFLA-010",
            severity: "critical",
            description: "Capa sem identificação institucional UFLA.",
            suggestion: "Incluir logo/nome da UFLA na capa.",
          }),
        ]
      : [],
  });

  const titlePage = sectionResult({
    passed: containsText(paragraphs, /folha de rosto|folha de rosto/i),
    itemsFound: containsText(paragraphs, /folha de rosto/i) ? ["folha de rosto"] : [],
    itemsMissing: !containsText(paragraphs, /folha de rosto/i) ? ["folha de rosto"] : [],
    gaps: !containsText(paragraphs, /folha de rosto/i)
      ? [
          gap({
            section: "folha de rosto",
            rule: "UFLA-011",
            severity: "critical",
            description: "Folha de rosto ausente.",
            suggestion: "Gerar folha de rosto conforme Manual UFLA.",
          }),
        ]
      : [],
  });

  const catalogCard = sectionResult({
    passed: containsText(paragraphs, /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i),
    itemsFound: containsText(paragraphs, /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i)
      ? ["ficha catalográfica"]
      : [],
    itemsMissing: !containsText(paragraphs, /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i)
      ? ["ficha catalográfica"]
      : [],
    gaps: !containsText(paragraphs, /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i)
      ? [
          gap({
            section: "ficha catalográfica",
            rule: "UFLA-012",
            severity: "major",
            description: "Ficha catalográfica ausente.",
            suggestion: "Inserir ficha catalográfica para dissertação/tese.",
          }),
        ]
      : [],
  });

  const approvalPage = sectionResult({
    passed: containsText(paragraphs, /folha de aprovação|folha de aprovacao/i),
    itemsFound: containsText(paragraphs, /folha de aprovação|folha de aprovacao/i)
      ? ["folha de aprovação"]
      : [],
    itemsMissing: !containsText(paragraphs, /folha de aprovação|folha de aprovacao/i)
      ? ["folha de aprovação"]
      : [],
    gaps: !containsText(paragraphs, /folha de aprovação|folha de aprovacao/i)
      ? [
          gap({
            section: "folha de aprovação",
            rule: "UFLA-013",
            severity: "major",
            description: "Folha de aprovação ausente.",
            suggestion: "Inserir folha de aprovação para dissertação/tese/TCC.",
          }),
        ]
      : [],
  });

  const abstractPortuguese = containsText(paragraphs, /resumo/i);
  const abstractEnglish = containsText(paragraphs, /abstract/i);
  const abstract = sectionResult({
    passed: abstractPortuguese && abstractEnglish,
    itemsFound: [
      ...(abstractPortuguese ? ["resumo"] : []),
      ...(abstractEnglish ? ["abstract"] : []),
    ],
    itemsMissing: [
      ...(!abstractPortuguese ? ["resumo"] : []),
      ...(!abstractEnglish ? ["abstract"] : []),
    ],
    gaps: [
      ...(!abstractPortuguese
        ? [
            gap({
              section: "resumo",
              rule: "UFLA-014",
              severity: "critical",
              description: "Resumo em português ausente.",
              suggestion: "Inserir resumo (150-500 palavras).",
            }),
          ]
        : []),
      ...(!abstractEnglish
        ? [
            gap({
              section: "abstract",
              rule: "UFLA-015",
              severity: "critical",
              description: "Abstract em inglês ausente.",
              suggestion: "Inserir abstract correspondente.",
            }),
          ]
        : []),
    ],
  });

  const hasIllustrations = containsText(paragraphs, /lista de ilustrações|lista de ilustracoes/i);
  const hasTables = containsText(paragraphs, /lista de tabelas/i);
  const hasAbbreviations = containsText(paragraphs, /lista de abreviaturas|lista de siglas/i);
  const hasSymbols = containsText(paragraphs, /lista de símbolos|lista de simbolos/i);
  const lists = sectionResult({
    passed: true,
    itemsFound: [
      ...(hasIllustrations ? ["lista de ilustrações"] : []),
      ...(hasTables ? ["lista de tabelas"] : []),
      ...(hasAbbreviations ? ["lista de abreviaturas/siglas"] : []),
      ...(hasSymbols ? ["lista de símbolos"] : []),
    ],
    itemsMissing: [
      ...(!hasIllustrations ? ["lista de ilustrações"] : []),
      ...(!hasTables ? ["lista de tabelas"] : []),
      ...(!hasAbbreviations ? ["lista de abreviaturas/siglas"] : []),
      ...(!hasSymbols ? ["lista de símbolos"] : []),
    ],
    gaps: [
      ...(!hasIllustrations
        ? [
            gap({
              section: "listas",
              rule: "UFLA-016",
              severity: "minor",
              description: "Lista de ilustrações ausente.",
              suggestion: "Inserir lista de ilustrações quando houver figuras/quadros.",
            }),
          ]
        : []),
      ...(!hasTables
        ? [
            gap({
              section: "listas",
              rule: "UFLA-017",
              severity: "minor",
              description: "Lista de tabelas ausente.",
              suggestion: "Inserir lista de tabelas quando houver tabelas.",
            }),
          ]
        : []),
    ],
  });

  const summary = sectionResult({
    passed: containsText(paragraphs, /sumário|SUMÁRIO/i),
    itemsFound: containsText(paragraphs, /sumário|SUMÁRIO/i) ? ["sumário"] : [],
    itemsMissing: !containsText(paragraphs, /sumário|SUMÁRIO/i) ? ["sumário"] : [],
    gaps: !containsText(paragraphs, /sumário|SUMÁRIO/i)
      ? [
          gap({
            section: "sumário",
            rule: "UFLA-018",
            severity: "critical",
            description: "Sumário ausente.",
            suggestion: "Inserir sumário com títulos e página.",
          }),
        ]
      : [],
  });

  const allGaps = [
    ...cover.gaps,
    ...titlePage.gaps,
    ...catalogCard.gaps,
    ...approvalPage.gaps,
    ...abstract.gaps,
    ...lists.gaps,
    ...summary.gaps,
  ];
  const passed = allGaps.filter((g) => g.severity === "critical").length === 0;
  const score = allGaps.length === 0 ? 100 : Math.max(0, 100 - allGaps.length * 10);

  return {
    passed,
    score,
    itemsFound: [
      ...cover.itemsFound,
      ...titlePage.itemsFound,
      ...catalogCard.itemsFound,
      ...approvalPage.itemsFound,
      ...abstract.itemsFound,
      ...lists.itemsFound,
      ...summary.itemsFound,
    ],
    itemsMissing: [
      ...cover.itemsMissing,
      ...titlePage.itemsMissing,
      ...catalogCard.itemsMissing,
      ...approvalPage.itemsMissing,
      ...abstract.itemsMissing,
      ...lists.itemsMissing,
      ...summary.itemsMissing,
    ],
    gaps: allGaps,
    cover,
    titlePage,
    catalogCard,
    approvalPage,
    abstract,
    lists,
    summary,
  };
}
