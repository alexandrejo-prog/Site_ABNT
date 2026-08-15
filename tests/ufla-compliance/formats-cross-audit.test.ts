import { describe, expect, it } from "vitest";
import { auditFormatsCross } from "../../scripts/ufla-compliance/audit-formats-cross";
import { WORK_TYPES } from "../../src/ufla-rules";
import { ACADEMIC_PRODUCTION_TYPE_IDS } from "../../src/academic-production-types";

describe("auditoria cruzada de formatos (UFLA-formatos-20)", () => {
  const audit = auditFormatsCross();

  it("todo formato cadastrado mapeia para um tipo da matriz (nenhum sem regras pertinentes)", () => {
    expect(audit.checks.allFormatsMapped).toBe(true);
    expect(audit.checks.unmappedFormats).toEqual([]);
  });

  it("todo requisito da matriz é aplicável a pelo menos um formato (sem órfãos)", () => {
    expect(audit.checks.noOrphanRequirements).toBe(true);
    expect(audit.checks.orphanRequirements).toEqual([]);
  });

  it("todo formato tem cobertura de regras com validator definido", () => {
    expect(audit.checks.allCoverageOk).toBe(true);
    expect(audit.checks.formatsWithoutCoverage).toEqual([]);
  });

  it("os 8 formatos da Coleção Produção Acadêmica são auditados com as regras de artigo", () => {
    const production = audit.formats.filter((f) => f.collection === "produção acadêmica");
    expect(production.length).toBe(ACADEMIC_PRODUCTION_TYPE_IDS.length);
    for (const f of production) {
      expect(f.documentType).toBe("artigo");
      expect(f.applicableReqs.length).toBeGreaterThan(0);
      expect(f.coverageOk).toBe(true);
    }
  });

  it("dissertação/tese/monografia têm as regras pré-textuais completas (capa→sumário)", () => {
    const diss = audit.formats.find((f) => f.formatId === "dissertacao");
    expect(diss?.applicableReqs).toContain("REQ-001");
    expect(diss?.applicableReqs).toContain("REQ-007");
    const artigo = audit.formats.find((f) => f.formatId === "artigo");
    expect(artigo?.applicableReqs).not.toContain("REQ-001");
    expect(artigo?.applicableReqs).not.toContain("REQ-007");
  });

  it("todos os WORK_TYPES estão representados na auditoria", () => {
    const ids = new Set(audit.formats.map((f) => f.formatId));
    for (const w of WORK_TYPES) expect(ids.has(w)).toBe(true);
  });
});
