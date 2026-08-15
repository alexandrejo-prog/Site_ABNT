import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type {
  AuditGap,
  ReferenceValidationResult,
  SectionAuditResult,
} from "./audit-types.js";

async function extractParagraphs(docxPath: string): Promise<string[]> {
  if (!existsSync(docxPath)) return [];
  const buffer = readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
}

function gap(overrides: Partial<AuditGap>): AuditGap {
  return {
    section: "referências",
    rule: "ABNT-NBR-6023",
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

function looksLikeReferenceEntry(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const yearMatch = t.match(/\b(19|20)\d{2}\b/);
  const hasAuthorCapitalized = /^[A-ZÀ-Ÿ]{2,}/.test(t);
  return Boolean(yearMatch && hasAuthorCapitalized);
}

export async function auditReferences(docxPath: string): Promise<SectionAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);
  const referenceParagraphs = paragraphs
    .map(extractText)
    .filter((t) => looksLikeReferenceEntry(t));

  const issues: AuditGap[] = [];
  const validated: ReferenceValidationResult[] = [];

  for (const raw of referenceParagraphs) {
    const authorsMatch = raw.match(/^([A-ZÀ-Ÿ\s.,;-]+?)(?:\s*\.\s*|\s*,\s*\d{4})/);
    const authors = authorsMatch
      ? authorsMatch[1].split(/[,;]/).map((a) => a.trim()).filter(Boolean)
      : [];

    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch?.[0] ?? "";

    const entryIssues: string[] = [];
    if (!authors.length) entryIssues.push("Autor(es) não identificados");
    if (!year) entryIssues.push("Ano não identificado");

    const titleMatch = raw.match(/\b(19|20)\d{2}\b\.\s*(.+?)(?:\.\s*(?:Local|Editora)|$)/s);
    const title = titleMatch?.[2]?.trim() ?? "";

    const locationMatch = raw.match(/([A-ZÀ-Ÿ][a-zà-ÿ\s]+):\s*([A-ZÀ-Ÿ][a-zà-ÿ\s]+)/);
    const location = locationMatch?.[1]?.trim() ?? "";
    const publisher = locationMatch?.[2]?.trim() ?? "";

    const doiMatch = raw.match(/doi:\s*\S+/i);
    const urlMatch = raw.match(/https?:\/\/\S+/i);

    const valid = entryIssues.length === 0;
    validated.push({
      raw,
      authors,
      title,
      edition: undefined,
      location,
      publisher,
      year,
      doi: doiMatch?.[0],
      url: urlMatch?.[0],
      valid,
      issues: entryIssues,
    });

    if (!valid) {
      issues.push(
        gap({
          section: "referências",
          rule: "ABNT-NBR-6023",
          severity: "major",
          description: `Referência inválida: ${entryIssues.join("; ")}`,
          suggestion: "Corrigir entrada para formato ABNT NBR 6023.",
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
    itemsFound: referenceParagraphs.map((t) => t.substring(0, 60)),
    itemsMissing: [],
    gaps: issues,
  };
}
