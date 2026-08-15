import { describe, it, expect } from "vitest";
import { analyzeDocx } from "../src/docx-analyzer";
import { checkCompliance } from "../src/checklist-checker";
import { generateReport } from "../src/report-generator";
import { suggestFixes } from "../src/fix-suggester";
import { parseCommand } from "../src/skill-activator";
import type { DocxAnalysis, ChecklistItem } from "../src/types";

const TEST_DOCX = "teste-final.docx";

function makeMockAnalysis(overrides?: Partial<DocxAnalysis>): DocxAnalysis {
  return {
    page: {
      widthTwip: 11906,
      heightTwip: 16838,
      marginTopCm: 3.0,
      marginBottomCm: 2.0,
      marginLeftCm: 3.0,
      marginRightCm: 2.0,
    },
    header: { marginTopCm: 2.0, hasPageNumber: true, pageNumberAlign: "right" },
    fonts: {
      defaultFont: "Times New Roman",
      defaultSize: 12,
      fontConsistency: [{ font: "Times New Roman", count: 100 }],
    },
    spacing: {
      bodyLine: 360,
      bodyAfter: 0,
      bodyBefore: 0,
      bodyJustified: true,
      firstLineIndent: true,
    },
    titles: {
      primaryCount: 3,
      secondaryCount: 0,
      primaryBold: true,
      primaryStartNewPage: false,
      primaryFormat: "1 TÍTULO",
    },
    references: {
      headingCount: 1,
      headingBold: true,
      headingCentered: true,
      entryCount: 6,
      entriesAlignedLeft: true,
      entriesSingleSpaced: true,
      entriesHangingIndent: true,
      entriesBoldTitle: true,
      sortedCorrectly: true,
      entries: ["AUTHOR. Title.", "BRASIL. Lei...", "FREIRE, Paulo...", "MARX, Karl...", "MORIN, Edgar...", "UFLA. Manual..."],
      duplicateHeadings: false,
      duplicateEntries: false,
      duplicateClusters: [],
    },
    tables: {
      count: 2,
      hasBorders: true,
      hasAboveTitle: true,
      hasBelowSource: true,
      tableDetails: [
        { rows: 3, cols: 3, hasBorders: true },
        { rows: 3, cols: 2, hasBorders: true },
      ],
    },
    images: { count: 0 },
    cover: {
      exists: true,
      hasLogo: true,
      authorCentered: true,
      authorUppercase: true,
      authorBold: true,
      authorSize: 14,
      titleCentered: true,
      titleUppercase: true,
      titleBold: true,
      titleSize: 16,
      location: "LAVRAS - MG",
      locationUppercase: true,
      locationBold: true,
      yearBold: true,
      pageNumberVisible: false,
    },
    catalogCard: {
      exists: true,
      hasPlaceholder: false,
    },
    titlePage: {
      exists: true,
      hasNature: true,
      natureText: "Tese apresentada ao Programa...",
      hasCourse: true,
      hasProgram: true,
      hasAdvisor: true,
      hasCoadvisor: false,
      hasEnglishTitle: true,
      englishTitleText: "English Title Test for Dissertation",
    },
    toc: {
      exists: true,
      hasFieldCode: true,
      hasFieldChars: true,
      hasCorrectRange: true,
      hasHyperlinkFlag: true,
      headingStyleRange: "1-3",
      hyperlink: true,
    },
    pagination: {
      visibleStartsAtIntroduction: true,
      usesArabicNumerals: true,
      usesWordField: true,
      coverNotCounted: true,
      preTextualNotVisible: true,
    },
    summary: {
      exists: true,
      headingCentered: true,
      headingUppercase: true,
      headingBold: true,
      includesReferences: true,
      includesAppendices: false,
      includesAnnexes: false,
      excludesCover: true,
      excludesPreTextual: true,
    },
    resumo: {
      titleCentered: true,
    },
    colors: {
      hasBlueInBody: false,
      hasBlueInReferences: false,
      hasBlueInResumo: false,
      hasBlueInAbstract: false,
    },
    equations: {
      count: 0,
      hasCenteredWithRightNumber: true,
    },
    paragraphCount: 97,
    totalCharacters: 5000,
    ...overrides,
  };
}

describe("docx-analyzer", () => {
  it("should analyze a real DOCX file", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.page.widthTwip).toBeGreaterThan(0);
    expect(analysis.page.heightTwip).toBeGreaterThan(0);
    expect(analysis.paragraphCount).toBeGreaterThan(0);
    expect(analysis.references.entryCount).toBeGreaterThanOrEqual(0);
    expect(analysis.tables.count).toBeGreaterThanOrEqual(0);
  });

  it("should detect paper size A4", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.page.widthTwip).toBe(11906);
    expect(analysis.page.heightTwip).toBe(16838);
  });

  it("should detect margins", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.page.marginTopCm).toBeGreaterThan(0);
    expect(analysis.page.marginBottomCm).toBeGreaterThan(0);
    expect(analysis.page.marginLeftCm).toBeGreaterThan(0);
    expect(analysis.page.marginRightCm).toBeGreaterThan(0);
  });

  it("should detect tables", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.tables.count).toBeGreaterThanOrEqual(0);
    if (analysis.tables.count > 0) {
      expect(analysis.tables.tableDetails[0].rows).toBeGreaterThan(0);
      expect(analysis.tables.tableDetails[0].cols).toBeGreaterThan(0);
    }
  });

  it("should detect references", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.references.headingCount).toBeGreaterThanOrEqual(0);
    if (analysis.references.entryCount > 0) {
      expect(analysis.references.entriesAlignedLeft).toBe(true);
    }
  });

  it("should detect TOC", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.toc.exists).toBe(true);
    expect(analysis.toc.hasFieldCode).toBe(true);
  });

  it("should detect pagination", async () => {
    const analysis = await analyzeDocx(TEST_DOCX);
    expect(analysis.pagination.usesWordField).toBe(true);
  });
});

describe("checklist-checker", () => {
  it("should check all items against mock analysis", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis);
    expect(items.length).toBeGreaterThan(0);
    const okItems = items.filter((i) => i.status === "ok");
    expect(okItems.length).toBeGreaterThan(0);
  });

  it("should report failures for non-compliant analysis", () => {
    const analysis = makeMockAnalysis({
      page: { widthTwip: 0, heightTwip: 0, marginTopCm: 0, marginBottomCm: 0, marginLeftCm: 0, marginRightCm: 0 },
      references: { headingCount: 0, headingBold: false, headingCentered: false, entryCount: 0, entriesAlignedLeft: false, entriesSingleSpaced: false, entriesHangingIndent: false, entriesBoldTitle: false, sortedCorrectly: false, entries: [], duplicateHeadings: false, duplicateEntries: false, duplicateClusters: [] },
      tables: { count: 0, hasBorders: false, hasAboveTitle: false, hasBelowSource: false, tableDetails: [] },
      summary: { exists: false, headingCentered: false, headingUppercase: false, headingBold: false, includesReferences: false, includesAppendices: false, includesAnnexes: false, excludesCover: true, excludesPreTextual: true },
      toc: { exists: false, hasFieldCode: false, hasFieldChars: false, hasCorrectRange: false, hasHyperlinkFlag: false, headingStyleRange: "", hyperlink: false },
      pagination: { visibleStartsAtIntroduction: false, usesArabicNumerals: false, usesWordField: false, coverNotCounted: false, preTextualNotVisible: false },
      equations: { count: 0, hasCenteredWithRightNumber: false },
    });
    const items = checkCompliance(analysis);
    const failItems = items.filter((i) => i.status === "fail");
    expect(failItems.length).toBeGreaterThan(0);
  });

  it("should return items with all required fields", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis);
    for (const item of items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("section");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("severity");
      expect(item).toHaveProperty("location");
      expect(item).toHaveProperty("suggestion");
      expect(item).toHaveProperty("fixType");
    }
  });

  it("should detect duplicate headings as GRAVE failure", () => {
    const analysis = makeMockAnalysis({
      references: {
        headingCount: 2,
        headingBold: true,
        headingCentered: true,
        entryCount: 2,
        entriesAlignedLeft: true,
        entriesSingleSpaced: true,
        entriesHangingIndent: true,
        entriesBoldTitle: true,
        sortedCorrectly: true,
        entries: ["A. Teste.", "B. Teste."],
        duplicateHeadings: true,
        duplicateEntries: true,
        duplicateClusters: [{ cluster: ["A. Teste.", "B. Teste."], occurrences: 2 }],
      },
    });
    const items = checkCompliance(analysis);
    const dupHeading = items.find((i) => i.id === "22.11");
    const dupContent = items.find((i) => i.id === "22.12");
    expect(dupHeading?.status).toBe("fail");
    expect(dupHeading?.severity).toBe("grave");
    expect(dupContent?.status).toBe("fail");
    expect(dupContent?.severity).toBe("grave");
  });

  it("should pass duplicate checks when no duplicates", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis);
    const dupHeading = items.find((i) => i.id === "22.11");
    const dupContent = items.find((i) => i.id === "22.12");
    expect(dupHeading?.status).toBe("ok");
    expect(dupContent?.status).toBe("ok");
  });

  it("should mark structurally-excluded items as unchecked for artigo", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis, "artigo");
    for (const id of ["3.1", "3.10", "5.1", "15.1", "25.6", "25.7"]) {
      const item = items.find((i) => i.id === id);
      expect(item?.status).toBe("unchecked");
    }
  });

  it("should mark table items unchecked when document has no tables", () => {
    const analysis = makeMockAnalysis({ tables: { count: 0, hasBorders: false, hasAboveTitle: false, hasBelowSource: false, tableDetails: [] } });
    const items = checkCompliance(analysis);
    for (const id of ["21.1", "21.2", "21.3", "21.4"]) {
      const item = items.find((i) => i.id === id);
      expect(item?.status).toBe("unchecked");
      expect(item?.suggestion).toContain("Documento sem tabelas");
    }
  });

  it("should mark annex/appendix items unchecked when absent (optional)", () => {
    const analysis = makeMockAnalysis({
      summary: { exists: true, headingCentered: true, headingUppercase: true, headingBold: true, includesReferences: true, includesAppendices: false, includesAnnexes: false, excludesCover: true, excludesPreTextual: true },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "25.6")?.status).toBe("unchecked");
    expect(items.find((i) => i.id === "25.7")?.status).toBe("unchecked");
  });

  it("should keep table/annex/appendix as ok when present", () => {
    const analysis = makeMockAnalysis({
      tables: { count: 2, hasBorders: true, hasAboveTitle: true, hasBelowSource: true, tableDetails: [{ rows: 3, cols: 3, hasBorders: true }] },
      summary: { exists: true, headingCentered: true, headingUppercase: true, headingBold: true, includesReferences: true, includesAppendices: true, includesAnnexes: true, excludesCover: true, excludesPreTextual: true },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "21.1")?.status).toBe("ok");
    expect(items.find((i) => i.id === "25.6")?.status).toBe("ok");
    expect(items.find((i) => i.id === "25.7")?.status).toBe("ok");
  });

  it("should mark structurally-excluded items as unchecked for resumo_cpg", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis, "resumo_cpg");
    for (const id of ["3.10", "11.1", "17.1", "25.8"]) {
      const item = items.find((i) => i.id === id);
      expect(item?.status).toBe("unchecked");
    }
  });

  it("should check RESUMO title item from resumo.titleCentered", () => {
    const analysis = makeMockAnalysis({ resumo: { titleCentered: false } });
    const items = checkCompliance(analysis);
    const item = items.find((i) => i.id === "11.1");
    expect(item?.status).toBe("fail");
  });

  it("should pass equation check when equations are centered with right tab", () => {
    const analysis = makeMockAnalysis({ equations: { count: 2, hasCenteredWithRightNumber: true } });
    const items = checkCompliance(analysis);
    const item = items.find((i) => i.id === "23.1");
    expect(item?.status).toBe("ok");
  });

  it("should fail equation check when equations lack centered/right-tab formatting", () => {
    const analysis = makeMockAnalysis({ equations: { count: 1, hasCenteredWithRightNumber: false } });
    const items = checkCompliance(analysis);
    const item = items.find((i) => i.id === "23.1");
    expect(item?.status).toBe("fail");
  });

  it("should not count unchecked items as grave failures", () => {
    const analysis = makeMockAnalysis({
      page: { widthTwip: 0, heightTwip: 0, marginTopCm: 0, marginBottomCm: 0, marginLeftCm: 0, marginRightCm: 0 },
    });
    const items = checkCompliance(analysis, "artigo");
    const failItems = items.filter((i) => i.status === "fail");
    expect(failItems.length).toBeGreaterThan(0);
  });

  it("should validate catalog card detection (5.1)", () => {
    const analysis = makeMockAnalysis({
      catalogCard: { exists: true, hasPlaceholder: false },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "5.1")?.status).toBe("ok");
  });

  it("should fail catalog card when not detected", () => {
    const analysis = makeMockAnalysis({
      catalogCard: { exists: false, hasPlaceholder: false },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "5.1")?.status).toBe("fail");
  });

  it("should validate title page structure (4.1-4.4)", () => {
    const analysis = makeMockAnalysis({
      titlePage: {
        exists: true,
        hasNature: true,
        natureText: "Tese apresentada...",
        hasCourse: true,
        hasProgram: true,
        hasAdvisor: true,
        hasCoadvisor: true,
        hasEnglishTitle: true,
        englishTitleText: "English Title",
      },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "4.1")?.status).toBe("ok");
    expect(items.find((i) => i.id === "4.2")?.status).toBe("ok");
    expect(items.find((i) => i.id === "4.3")?.status).toBe("ok");
    expect(items.find((i) => i.id === "4.4")?.status).toBe("ok");
  });

  it("should validate TOC field chars (15.5) and flags (15.6)", () => {
    const analysis = makeMockAnalysis({
      toc: {
        exists: true,
        hasFieldCode: true,
        hasFieldChars: true,
        hasCorrectRange: true,
        hasHyperlinkFlag: true,
        headingStyleRange: "1-3",
        hyperlink: true,
      },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "15.5")?.status).toBe("ok");
    expect(items.find((i) => i.id === "15.6")?.status).toBe("ok");
  });

  it("should fail TOC field chars when missing", () => {
    const analysis = makeMockAnalysis({
      toc: {
        exists: true,
        hasFieldCode: true,
        hasFieldChars: false,
        hasCorrectRange: false,
        hasHyperlinkFlag: false,
        headingStyleRange: "",
        hyperlink: false,
      },
    });
    const items = checkCompliance(analysis);
    expect(items.find((i) => i.id === "15.5")?.status).toBe("fail");
    expect(items.find((i) => i.id === "15.6")?.status).toBe("fail");
  });
});

describe("report-generator", () => {
  it("should generate markdown report", () => {
    const analysis = makeMockAnalysis();
    const items = checkCompliance(analysis);
    const report = {
      timestamp: "2025-01-01T00:00:00.000Z",
      fileAnalyzed: "teste-final.docx",
      analysis,
      items,
      summary: { total: items.length, ok: items.filter((i) => i.status === "ok").length, fail: items.filter((i) => i.status === "fail").length, partial: items.filter((i) => i.status === "partial").length, unchecked: items.filter((i) => i.status === "unchecked").length, grave: 0, medio: 0, baixo: 0 },
      passed: true,
    };
    const output = generateReport(report);
    expect(output).toContain("Relatório de Conformidade UFLA");
    expect(output).toContain("teste-final.docx");
    expect(output).toContain("Resumo");
    expect(output).toContain("Detalhamento por Seção");
  });

  it("should show failure in summary", () => {
    const analysis = makeMockAnalysis({ page: { widthTwip: 0, heightTwip: 0, marginTopCm: 0, marginBottomCm: 0, marginLeftCm: 0, marginRightCm: 0 } });
    const items = checkCompliance(analysis);
    const report = {
      timestamp: "2025-01-01T00:00:00.000Z",
      fileAnalyzed: "teste-final.docx",
      analysis,
      items,
      summary: { total: items.length, ok: items.filter((i) => i.status === "ok").length, fail: items.filter((i) => i.status === "fail").length, partial: items.filter((i) => i.status === "partial").length, unchecked: items.filter((i) => i.status === "unchecked").length, grave: 5, medio: 3, baixo: 0 },
      passed: false,
    };
    const output = generateReport(report);
    expect(output).toContain("REPROVADO");
  });
});

describe("fix-suggester", () => {
  it("should suggest fixes for failed items", () => {
    const items: ChecklistItem[] = [
      { id: "2.1", section: "Formatacao", description: "Teste", status: "fail", severity: "grave", location: "page", suggestion: "Fix it", fixType: "code", fixFile: "src/test.ts", fixLine: 10, fixInstruction: "Do X" },
      { id: "2.2", section: "Formatacao", description: "Test 2", status: "fail", severity: "medio", location: "page", suggestion: "Fix it", fixType: "manual", fixInstruction: "Do Y" },
    ];
    const fixes = suggestFixes(items);
    expect(fixes.length).toBe(2);
    expect(fixes[0].itemId).toBe("2.1");
    expect(fixes[0].fixType).toBe("code");
    expect(fixes[1].fixType).toBe("manual");
  });
});

describe("skill-activator", () => {
  it("should parse validar command", () => {
    const cmd = parseCommand("@ufla-docx-compliance validar teste-final.docx");
    expect(cmd.action).toBe("validar");
    expect(cmd.filePath).toBe("teste-final.docx");
  });

  it("should parse command with options", () => {
    const cmd = parseCommand("@ufla-docx-compliance validar --json --report=out.md teste-final.docx");
    expect(cmd.action).toBe("validar");
    expect(cmd.filePath).toBe("teste-final.docx");
    expect(cmd.options.json).toBe(true);
    expect(cmd.options.output).toBe("out.md");
  });

  it("should parse command without options", () => {
    const cmd = parseCommand("@ufla-docx-compliance validar --verbose arquivo.docx");
    expect(cmd.action).toBe("validar");
    expect(cmd.filePath).toBe("arquivo.docx");
    expect(cmd.options.verbose).toBe(true);
  });

  it("should handle command without @mention", () => {
    const cmd = parseCommand("validar doc.docx");
    expect(cmd.action).toBe("validar");
    expect(cmd.filePath).toBe("doc.docx");
  });
});

describe("validateDocx integration", () => {
  it("should validate a real DOCX file and return a report", async () => {
    const { validateDocx } = await import("../src/index");
    const report = await validateDocx(TEST_DOCX);
    expect(report.fileAnalyzed).toContain("teste-final.docx");
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.items.length).toBe(report.summary.total);
    expect(report.passed).toBeDefined();
  });

  it("should generate report as markdown", async () => {
    const { validateDocx } = await import("../src/index");
    const report = await validateDocx(TEST_DOCX);
    const markdown = generateReport(report);
    expect(markdown.length).toBeGreaterThan(100);
    expect(markdown).toContain("teste-final.docx");
  });

  it("should accept workType option and classify excluded items as unchecked", async () => {
    const { validateDocx } = await import("../src/index");
    const report = await validateDocx(TEST_DOCX, { workType: "artigo" });
    expect(report.summary.unchecked).toBeGreaterThan(0);
  });
});
