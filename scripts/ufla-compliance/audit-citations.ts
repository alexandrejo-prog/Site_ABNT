import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type { AuditGap, CitationValidationResult, SectionAuditResult } from "./audit-types.js";

async function extractParagraphs(docxPath: string): Promise<string[]> {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
}

function gap(overrides: Partial<AuditGap>): AuditGap {
  return {
    section: "citações",
    rule: "ABNT-NBR-10520",
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

const CITATION_PATTERN = /\(([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\.-]+?)(?:;\s*[A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\.-]+?)*,\s*(?:[12]\d{3})/g;

export async function auditCitations(docxPath: string): Promise<SectionAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);
  const citations: CitationValidationResult[] = [];
  const issues: AuditGap[] = [];

  for (const p of paragraphs) {
    const text = extractText(p);
    const matches = [...text.matchAll(CITATION_PATTERN)];
    for (const m of matches) {
      const authorsText = m[1];
      const authors = authorsText.split(/;/).map((a) => a.trim()).filter(Boolean);
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch?.[0] ?? "";
      const pageMatch = text.match(/p\.\s*\d+/i);
      const page = pageMatch?.[0] ?? undefined;

      const entryIssues: string[] = [];
      if (!authors.length) entryIssues.push("Autor(es) não identificados");
      if (!year) entryIssues.push("Ano não identificado");

      citations.push({
        raw: text,
        authors,
        year,
        page,
        valid: entryIssues.length === 0,
        issues: entryIssues,
      });

      if (entryIssues.length > 0) {
        issues.push(
          gap({
            section: "citações",
            rule: "ABNT-NBR-10520",
            severity: "major",
            description: `Citação inválida: ${entryIssues.join("; ")}`,
            suggestion: "Corrigir formato para (AUTOR, ano, p. X) conforme NBR 10520.",
            autoFixable: false,
          }),
        );
      }
    }
  }

  const passed = issues.filter((i) => i.severity === "critical").length === 0;
  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10);

  return {
    passed,
    score,
    itemsFound: citations.map((c) => `${c.authors.join("; ")} ${c.year}`),
    itemsMissing: [],
    gaps: issues,
  };
}
