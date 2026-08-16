import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type {
  AuditGap,
  FigureValidationResult,
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
    section: "figuras",
    rule: "UFLA-029",
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

const FIGURE_PATTERN = /(Figura|Quadro|Gráfico|Mapa|Imagem|Ilustração|Tabela)\s*\d+\s*[:\-–]/i;

export async function auditFigures(docxPath: string): Promise<SectionAuditResult> {
  const paragraphs = await extractParagraphs(docxPath);
  const figureParagraphs = paragraphs.filter((p) => FIGURE_PATTERN.test(extractText(p)));
  const issues: AuditGap[] = [];
  const validated: FigureValidationResult[] = [];

  for (const p of figureParagraphs) {
    const text = extractText(p);
    const typeMatch = text.match(/^(Figura|Quadro|Gráfico|Mapa|Imagem|Ilustração|Tabela)/i);
    const numberMatch = text.match(/(\d+)/);
    const type = (typeMatch?.[1]?.toLowerCase() as FigureValidationResult["type"]) ?? "figura";
    const number = numberMatch?.[1] ?? "";

    const hasSource = /fonte:|fonte /i.test(text);
    const entryIssues: string[] = [];
    if (!number) entryIssues.push("Número da figura ausente");

    validated.push({
      type,
      number,
      caption: text,
      source: hasSource ? text : undefined,
      valid: entryIssues.length === 0,
      issues: entryIssues,
    });

    if (entryIssues.length > 0) {
      issues.push(
        gap({
          section: "figuras",
          rule: "UFLA-029",
          severity: "major",
          description: `Figura/ilustração inválida: ${entryIssues.join("; ")}`,
          suggestion: "Incluir numeração e fonte conforme Manual UFLA.",
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
    itemsFound: validated.map((v) => `${v.type} ${v.number}`),
    itemsMissing: [],
    gaps: issues,
  };
}
