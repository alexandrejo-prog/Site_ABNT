import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDocxBlob } from "../../src/export-docx";
import { ACADEMIC_PRODUCTION_TYPES } from "../../src/academic-production-types";
import { PER_PRODUCTION_FIXTURES, productionFixtureFor } from "../../scripts/ufla-compliance/per-production-fixtures";
import { verifyProductionFormatContent, expectedContentFor } from "../../scripts/ufla-compliance/verify-production-format";
import { auditFormatsCross } from "../../scripts/ufla-compliance/audit-formats-cross";

describe("Coleção Produção Acadêmica: gate por formato com requiredFields próprios (UFLA-formatos-20)", () => {
  it("todos os 8 formatos têm fixture com conteúdo para cada requiredField definido", () => {
    expect(PER_PRODUCTION_FIXTURES.length).toBe(ACADEMIC_PRODUCTION_TYPES.length);
    for (const fixture of PER_PRODUCTION_FIXTURES) {
      expect(fixture.fields.workType).toBe(fixture.def.id);
      for (const field of fixture.def.requiredFields) {
        const expected = expectedContentFor(field, fixture);
        expect(expected, `${fixture.def.id} → ${field}`).toBeTruthy();
      }
    }
  });

  it("todo DOCX gerado contém conteúdo para todos os requiredFields do formato", async () => {
    for (const fixture of PER_PRODUCTION_FIXTURES) {
      const blob = await generateDocxBlob({ fields: fixture.fields, editorText: fixture.editorText });
      const dir = mkdtempSync(join(tmpdir(), "ufla-prod-"));
      const path = join(dir, "doc.docx");
      writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
      const check = verifyProductionFormatContent(path, fixture);
      expect(check.missing, `${fixture.def.id} sem ${check.missing.join(", ")}`).toEqual([]);
      expect(check.checked).toBe(fixture.def.requiredFields.length);
    }
  });

  it("DOCX gerado não contém capa/folha de rosto (estrutura de artigo, conforme a matriz)", async () => {
    for (const fixture of PER_PRODUCTION_FIXTURES) {
      const blob = await generateDocxBlob({ fields: fixture.fields, editorText: fixture.editorText });
      const dir = mkdtempSync(join(tmpdir(), "ufla-prod-"));
      const path = join(dir, "doc.docx");
      writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
      const { readFileSync } = await import("node:fs");
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(readFileSync(path));
      const xml = zip.readAsText("word/document.xml");
      expect(xml, `${fixture.def.id} não deve ter capa`).not.toMatch(/FICHA CATALOGRÁFICA|FOLHA DE ROSTO/i);
    }
  });

  it("a auditoria cruzada mapeia os 8 formatos para as regras de artigo com cobertura ok", () => {
    const audit = auditFormatsCross();
    const production = audit.formats.filter((f) => f.collection === "produção acadêmica");
    expect(production.length).toBe(8);
    for (const f of production) {
      expect(f.documentType).toBe("artigo");
      expect(f.coverageOk).toBe(true);
    }
  });

  it("relatorio_estagio tem curso entre os requiredFields e o DOCX contém o curso", async () => {
    const fixture = productionFixtureFor("relatorio_estagio_ufla");
    expect(fixture?.def.requiredFields).toContain("course");
    const blob = await generateDocxBlob({ fields: fixture!.fields, editorText: fixture!.editorText });
    const dir = mkdtempSync(join(tmpdir(), "ufla-prod-"));
    const path = join(dir, "doc.docx");
    writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
    const check = verifyProductionFormatContent(path, fixture!);
    expect(check.missing).toEqual([]);
  });
});
