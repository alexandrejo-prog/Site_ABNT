import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type { AuditGap, SectionAuditResult } from "./audit-types.js";

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
    section: "seções",
    rule: "ABNT-NBR-6024",
    severity: "major",
    description: "",
    suggestion: "",
    autoFixable: false,
    ...overrides,
  };
}

function extractText(paragraphXml: string): string {
  return paragraphXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractHeadings(paragraphs: string[]): string[] {
  const headings: string[] = [];
  for (const p of paragraphs) {
    const styleMatch = p.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    const text = extractText(p);
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

export async function auditSections(docxPath: string): Promise<SectionAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);
  const headings = extractHeadings(paragraphs);
  const issues: AuditGap[] = [];

  const numberingRegex = /^(\d+(\.\d+)*)\s+/;
  const hasNumbering = headings.some((h) => numberingRegex.test(h));

  if (!hasNumbering) {
    issues.push(
      gap({
        section: "numeração progressiva",
        rule: "ABNT-NBR-6024",
        severity: "major",
        description: "Nenhuma numeração progressiva detectada nos títulos.",
        suggestion: "Aplicar numeração 1, 1.1, 1.1.1 conforme ABNT NBR 6024.",
        autoFixable: false,
      }),
    );
  }

  for (const heading of headings) {
    if (!numberingRegex.test(heading)) {
      issues.push(
        gap({
          section: "seções",
          rule: "ABNT-NBR-6024",
          severity: "minor",
          description: `Título sem numeração: "${heading.substring(0, 60)}"`,
          suggestion: "Adicionar numeração progressiva ao título.",
          autoFixable: false,
        }),
      );
    }
  }

  const passed = issues.filter((i) => i.severity === "critical").length === 0;
  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10);

  return {
    passed,
    score,
    itemsFound: headings,
    itemsMissing: [],
    gaps: issues,
  };
}
