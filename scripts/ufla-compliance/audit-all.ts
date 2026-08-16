import { auditPretextual } from "./audit-pretextual";
import { auditTextual } from "./audit-textual";
import { auditPosttextual } from "./audit-posttextual";
import { auditReferences } from "./audit-references";
import { auditCitations } from "./audit-citations";
import { auditFigures } from "./audit-figures";
import { auditSections } from "./audit-sections";
import { validatePageLayout } from "./validate-page-layout";
import { validateTypography } from "./validate-page-layout";
import { validateCatalogCard } from "./validate-catalog-toc";
import { validateToc } from "./validate-catalog-toc";
import { validateOMML } from "./validate-omml";
import { validateCitations, validateReferences } from "./validate-citations-references";
import { validateTables } from "./validate-sections-figures-tables";
import { validateDocumentStructure } from "./validate-document-structure";
import { writeHtmlReport } from "./report";

import type { DocumentType } from "./document-type-matrix";

export interface UnifiedAuditResult {
  documentType: string;
  passed: boolean;
  score: number;
  sections: {
    pretextual: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    textual: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    posttextual: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    references: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    citations: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    figures: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    sections: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    layout: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    typography: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    catalogCard: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    toc: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    omml: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    documentStructure: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
  };
  technical: {
    pages: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
    tables: { passed: boolean; gaps: Array<{ rule: string; severity: string; description: string; suggestion?: string }> };
  };
  gaps: Array<{ section: string; rule: string; severity: string; description: string; suggestion?: string }>;
}

function toGaps(items: Array<{ status: string; severity: string; message: string; suggestion?: string }>): Array<{ rule: string; severity: string; description: string; suggestion?: string }> {
  return items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      rule: item.message,
      severity: item.severity,
      description: item.message,
      suggestion: item.suggestion ?? "",
    }));
}

export async function runUnifiedAudit(docxPath: string, documentType: DocumentType = "dissertacao"): Promise<UnifiedAuditResult> {
  const [pretextual, textual, posttextual, referencesResult, citationsResult, figuresResult, sectionsResult, layoutResult, typographyResult, catalogCardResult, tocResult, ommlResult, documentStructureResult, tablesResult] = await Promise.all([
    auditPretextual(docxPath),
    auditTextual(docxPath),
    auditPosttextual(docxPath),
    auditReferences(docxPath),
    auditCitations(docxPath),
    auditFigures(docxPath),
    auditSections(docxPath),
    validatePageLayout(docxPath),
    validateTypography(docxPath),
    validateCatalogCard(docxPath),
    validateToc(docxPath),
    validateOMML(docxPath),
    validateDocumentStructure(docxPath, documentType),
    validateTables(docxPath),
  ]);

  const sections = {
    pretextual: { passed: pretextual.passed, gaps: pretextual.gaps.map((g) => ({ rule: g.rule, severity: g.severity, description: g.description, suggestion: g.suggestion })) },
    textual: { passed: textual.passed, gaps: textual.gaps.map((g) => ({ rule: g.rule, severity: g.severity, description: g.description, suggestion: g.suggestion })) },
    posttextual: { passed: posttextual.passed, gaps: posttextual.gaps.map((g) => ({ rule: g.rule, severity: g.severity, description: g.description, suggestion: g.suggestion })) },
    references: { passed: referencesResult.passed, gaps: toGaps(await validateReferences(docxPath)) },
    citations: { passed: citationsResult.passed, gaps: toGaps(await validateCitations(docxPath)) },
    figures: { passed: figuresResult.passed, gaps: figuresResult.gaps.map((g) => ({ rule: g.rule, severity: g.severity, description: g.description, suggestion: g.suggestion })) },
    sections: { passed: sectionsResult.passed, gaps: sectionsResult.gaps.map((g) => ({ rule: g.rule, severity: g.severity, description: g.description, suggestion: g.suggestion })) },
    layout: { passed: layoutResult.every((r) => r.status === "passed"), gaps: toGaps(layoutResult) },
    typography: { passed: typographyResult.every((r) => r.status === "passed"), gaps: toGaps(typographyResult) },
    catalogCard: { passed: catalogCardResult.every((r) => r.status === "passed"), gaps: toGaps(catalogCardResult) },
    toc: { passed: tocResult.every((r) => r.status === "passed"), gaps: toGaps(tocResult) },
    omml: { passed: ommlResult.every((r) => r.status === "passed"), gaps: toGaps(ommlResult) },
    documentStructure: { passed: documentStructureResult.every((r) => r.status === "passed"), gaps: toGaps(documentStructureResult) },
  };

  const technical = {
    pages: { passed: true, gaps: [] as Array<{ rule: string; severity: string; description: string; suggestion?: string }> },
    tables: { passed: tablesResult.every((r) => r.status === "passed"), gaps: toGaps(tablesResult) },
  };

  const gaps = [
    ...sections.pretextual.gaps.map((g) => ({ ...g, section: "Pré-textual" })),
    ...sections.textual.gaps.map((g) => ({ ...g, section: "Textual" })),
    ...sections.posttextual.gaps.map((g) => ({ ...g, section: "Pós-textual" })),
    ...sections.references.gaps.map((g) => ({ ...g, section: "Referências" })),
    ...sections.citations.gaps.map((g) => ({ ...g, section: "Citações" })),
    ...sections.figures.gaps.map((g) => ({ ...g, section: "Figuras" })),
    ...sections.sections.gaps.map((g) => ({ ...g, section: "Seções" })),
    ...sections.layout.gaps.map((g) => ({ ...g, section: "Layout" })),
    ...sections.typography.gaps.map((g) => ({ ...g, section: "Tipografia" })),
    ...sections.catalogCard.gaps.map((g) => ({ ...g, section: "Ficha Catalográfica" })),
    ...sections.toc.gaps.map((g) => ({ ...g, section: "Sumário" })),
    ...sections.omml.gaps.map((g) => ({ ...g, section: "OMML" })),
    ...sections.documentStructure.gaps.map((g) => ({ ...g, section: "Estrutura" })),
    ...technical.pages.gaps.map((g) => ({ ...g, section: "Páginas" })),
    ...technical.tables.gaps.map((g) => ({ ...g, section: "Tabelas" })),
  ];

  const passed = gaps.length === 0;
  const score = gaps.length === 0 ? 100 : Math.max(0, 100 - gaps.length * 10);

  const result: UnifiedAuditResult = {
    documentType,
    passed,
    score,
    sections,
    technical,
    gaps,
  };

  try {
    writeHtmlReport(result, "artifacts/ufla-compliance/unified-audit-report.html");
  } catch {
    // non-blocking
  }

  return result;
}
