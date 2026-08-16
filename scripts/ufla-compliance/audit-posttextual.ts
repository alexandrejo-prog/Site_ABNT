import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type {
  AuditGap,
  PosttextualAuditResult,
  SectionAuditResult,
} from "./audit-types.js";

async function extractParagraphs(docxPath: string): Promise<string[]> {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
}

function sectionResult(overrides: Partial<SectionAuditResult> = {}): SectionAuditResult {
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
    section: "posttextual",
    rule: "",
    severity: "major",
    description: "",
    suggestion: "",
    autoFixable: false,
    ...overrides,
  };
}

function containsText(paragraphs: string[], keyword: RegExp | string): boolean {
  const re = typeof keyword === "string" ? new RegExp(keyword, "i") : keyword;
  return paragraphs.some((p) => re.test(p));
}

export async function auditPosttextual(docxPath: string): Promise<PosttextualAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);

  const references = sectionResult({
    passed: containsText(paragraphs, /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i),
    itemsFound: containsText(paragraphs, /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i)
      ? ["referências"]
      : [],
    itemsMissing: !containsText(paragraphs, /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i)
      ? ["referências"]
      : [],
    gaps: !containsText(paragraphs, /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i)
      ? [
          gap({
            section: "referências",
            rule: "ABNT-NBR-6023",
            severity: "critical",
            description: "Seção de referências ausente.",
            suggestion: "Inserir seção de referências bibliográficas.",
          }),
        ]
      : [],
  });

  const glossary = sectionResult({
    passed: containsText(paragraphs, /glossário|glossario/i),
    itemsFound: containsText(paragraphs, /glossário|glossario/i) ? ["glossário"] : [],
    itemsMissing: !containsText(paragraphs, /glossário|glossario/i) ? ["glossário"] : [],
    gaps: !containsText(paragraphs, /glossário|glossario/i)
      ? [
          gap({
            section: "glossário",
            rule: "UFLA-025",
            severity: "minor",
            description: "Glossário ausente.",
            suggestion: "Inserir glossário quando necessário.",
          }),
        ]
      : [],
  });

  const appendices = sectionResult({
    passed: containsText(paragraphs, /apêndice|apendice/i),
    itemsFound: containsText(paragraphs, /apêndice|apendice/i) ? ["apêndices"] : [],
    itemsMissing: !containsText(paragraphs, /apêndice|apendice/i) ? ["apêndices"] : [],
    gaps: !containsText(paragraphs, /apêndice|apendice/i)
      ? [
          gap({
            section: "apêndices",
            rule: "UFLA-026",
            severity: "minor",
            description: "Apêndices ausentes.",
            suggestion: "Inserir apêndices quando houver material complementar.",
          }),
        ]
      : [],
  });

  const annexes = sectionResult({
    passed: containsText(paragraphs, /anexo/i),
    itemsFound: containsText(paragraphs, /anexo/i) ? ["anexos"] : [],
    itemsMissing: !containsText(paragraphs, /anexo/i) ? ["anexos"] : [],
    gaps: !containsText(paragraphs, /anexo/i)
      ? [
          gap({
            section: "anexos",
            rule: "UFLA-027",
            severity: "minor",
            description: "Anexos ausentes.",
            suggestion: "Inserir anexos quando houver documentos complementares.",
          }),
        ]
      : [],
  });

  const allGaps = [...references.gaps, ...glossary.gaps, ...appendices.gaps, ...annexes.gaps];
  const passed = allGaps.filter((g) => g.severity === "critical").length === 0;
  const score = allGaps.length === 0 ? 100 : Math.max(0, 100 - allGaps.length * 10);

  return {
    passed,
    score,
    itemsFound: [...references.itemsFound, ...glossary.itemsFound, ...appendices.itemsFound, ...annexes.itemsFound],
    itemsMissing: [...references.itemsMissing, ...glossary.itemsMissing, ...appendices.itemsMissing, ...annexes.itemsMissing],
    gaps: allGaps,
    references,
    glossary,
    appendices,
    annexes,
  };
}
