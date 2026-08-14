import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const jsonPath = new URL("../../artifacts/ufla-compliance/baseline-extraction.json", import.meta.url);

describeWithArtifacts("acceptance: baseline extraction", ["ufla-compliance/baseline-extraction.json"], () => {
  it("produces a valid JSON artifact with required fields", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.file.path).toContain("dissertacao-referencia.docx");
    expect(data.file.size).toBeGreaterThan(0);
    expect(data.file.sha256).toHaveLength(64);
    expect(data.parts.length).toBeGreaterThan(0);
    expect(data.paragraphCount).toBeGreaterThan(0);
    expect(Array.isArray(data.paragraphs)).toBe(true);
    expect(data.headings).toBeDefined();
    expect(data.styles).toBeDefined();
    expect(data.references).toBeDefined();
    expect(data.referenceCount).toBeGreaterThan(0);
    expect(data.tables).toBeDefined();
    expect(data.tableCount).toBeGreaterThan(0);
    expect(data.images).toBeDefined();
    expect(data.imageCount).toBeGreaterThan(0);
    expect(data.captions).toBeDefined();
    expect(data.captions.length).toBeGreaterThan(0);
    expect(data.sections).toBeDefined();
    expect(data.sections.length).toBeGreaterThan(0);
    expect(data.headers).toBeDefined();
    expect(data.footers).toBeDefined();
    expect(data.fields).toBeDefined();
    expect(Array.isArray(data.fields)).toBe(true);
    expect(data.metadata).toBeDefined();
    expect(data.bodyOrder).toBeDefined();
  });

  it("paragraph objects contain required properties", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.paragraphs.length).toBeGreaterThan(0);
    for (const p of data.paragraphs) {
      expect(p).toHaveProperty("index");
      expect(p).toHaveProperty("text");
      expect(p).toHaveProperty("style");
      expect(p).toHaveProperty("isHeading");
      expect(p).toHaveProperty("headingLevel");
      expect(p).toHaveProperty("hasPageBreak");
      expect(p).toHaveProperty("hasTable");
      expect(p).toHaveProperty("hasImage");
    }
  });

  it("detects pre-textual sections in correct order", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    const sectionNames = data.bodyOrder.map((s: any) => s.section);
    expect(sectionNames).toContain("LISTAS DE ILUSTRAÇÕES");
    expect(sectionNames).toContain("LISTA DE SIGLAS");
    expect(sectionNames).toContain("SUMÁRIO");
  });

  it("preserves all paragraphs from input", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.paragraphCount).toBe(4708);
    expect(data.paragraphs.length).toBe(4708);
  });

  it("preserves all references from input", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.referenceCount).toBeGreaterThan(200);
    expect(data.references.length).toBe(data.referenceCount);
  });

  it("preserves all tables from input", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.tableCount).toBeGreaterThan(30);
    expect(data.tables.length).toBe(data.tableCount);
  });

  it("preserves all images from input", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.imageCount).toBeGreaterThan(0);
    expect(data.images.length).toBe(data.imageCount);
  });

  it("detects captions in input", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.captions.length).toBeGreaterThan(30);
  });
});