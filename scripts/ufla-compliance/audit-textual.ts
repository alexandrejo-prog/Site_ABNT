import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type {
  AuditGap,
  SectionAuditResult,
  TextualAuditResult,
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
    section: "textual",
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

function extractHeadings(paragraphs: string[]): string[] {
  const headings: string[] = [];
  for (const p of paragraphs) {
    const styleMatch = p.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    const text = p.replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const style = (styleMatch?.[1] ?? "").toLowerCase();
    if (
      style.includes("heading") ||
      style.includes("título") ||
      style.includes("titulo") ||
      /^(\d+(\.\d+)*)\s+/.test(text)
    ) {
      headings.push(text);
    }
  }
  return headings;
}

export async function auditTextual(docxPath: string): Promise<TextualAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);
  const headings = extractHeadings(paragraphs);

  const introduction = sectionResult({
    passed: containsText(paragraphs, /introdução|introducao/i),
    itemsFound: containsText(paragraphs, /introdução|introducao/i) ? ["introdução"] : [],
    itemsMissing: !containsText(paragraphs, /introdução|introducao/i) ? ["introdução"] : [],
    gaps: !containsText(paragraphs, /introdução|introducao/i)
      ? [
          gap({
            section: "introdução",
            rule: "UFLA-021",
            severity: "critical",
            description: "Introdução ausente.",
            suggestion: "Inserir seção de introdução.",
          }),
        ]
      : [],
  });

  const chapters = sectionResult({
    passed: headings.length >= 1,
    itemsFound: headings.length >= 1 ? headings.slice(0, 10) : [],
    itemsMissing: headings.length === 0 ? ["desenvolvimento/capítulos"] : [],
    gaps: headings.length === 0
      ? [
          gap({
            section: "desenvolvimento",
            rule: "UFLA-022",
            severity: "critical",
            description: "Nenhum capítulo/seção textual identificado.",
            suggestion: "Estruturar o desenvolvimento em capítulos/seções.",
          }),
        ]
      : [],
  });

  const conclusion = sectionResult({
    passed: containsText(paragraphs, /conclusão|conclusao|considerações finais|consideracoes finais/i),
    itemsFound: containsText(paragraphs, /conclusão|conclusao|considerações finais|consideracoes finais/i)
      ? ["conclusão"]
      : [],
    itemsMissing: !containsText(paragraphs, /conclusão|conclusao|considerações finais|consideracoes finais/i)
      ? ["conclusão"]
      : [],
    gaps: !containsText(paragraphs, /conclusão|conclusao|considerações finais|consideracoes finais/i)
      ? [
          gap({
            section: "conclusão",
            rule: "UFLA-023",
            severity: "major",
            description: "Conclusão ausente.",
            suggestion: "Inserir seção de conclusão.",
          }),
        ]
      : [],
  });

  const numbering = sectionResult({
    passed: /^(\d+(\.\d+)*)\s+/.test(headings.join("\n")) || headings.length === 0,
    itemsFound: headings.length > 0 ? ["numeração detectada"] : [],
    itemsMissing: headings.length > 0 && !/^(\d+(\.\d+)*)\s+/.test(headings.join("\n")) ? ["numeração progressiva"] : [],
    gaps:
      headings.length > 0 && !/^(\d+(\.\d+)*)\s+/.test(headings.join("\n"))
        ? [
            gap({
              section: "numeração progressiva",
              rule: "ABNT-NBR-6024",
              severity: "major",
              description: "Numeração progressiva não detectada nos títulos.",
              suggestion: "Aplicar numeração 1, 1.1, 1.1.1 nos títulos.",
            }),
          ]
        : [],
  });

  const allGaps = [...introduction.gaps, ...chapters.gaps, ...conclusion.gaps, ...numbering.gaps];
  const passed = allGaps.filter((g) => g.severity === "critical").length === 0;
  const score = allGaps.length === 0 ? 100 : Math.max(0, 100 - allGaps.length * 10);

  return {
    passed,
    score,
    itemsFound: [...introduction.itemsFound, ...chapters.itemsFound, ...conclusion.itemsFound, ...numbering.itemsFound],
    itemsMissing: [...introduction.itemsMissing, ...chapters.itemsMissing, ...conclusion.itemsMissing, ...numbering.itemsMissing],
    gaps: allGaps,
    introduction,
    chapters,
    conclusion,
    numbering,
  };
}
