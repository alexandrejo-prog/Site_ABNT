import { describe, it, expect } from "vitest";
import { evaluateOoxmlGate } from "../../scripts/ufla-compliance/ooxml-checks";

const errorIssue = {
  code: "page-a4",
  message: "A4 ausente.",
  severity: "error" as const,
  rule: "Manual UFLA 4.1",
  item: "seção 1",
  action: undefined,
};

const warningIssue = {
  code: "table-header-missing",
  message: "Tabela 1 sem w:tblHeader.",
  severity: "warning" as const,
  rule: "NBR 17225",
  item: "tabela 1",
  action: undefined,
};

describe("B6 — ooxmlGate computado (evaluateOoxmlGate)", () => {
  it("falha quando o Word abriu com reparo (openedByRepair=true) mesmo sem achados", () => {
    const r = evaluateOoxmlGate([], true);
    expect(r.status).toBe("failed");
    expect(r.errors).toEqual([]);
  });

  it("falha quando há achado estrutural (severity error)", () => {
    const r = evaluateOoxmlGate([errorIssue], false);
    expect(r.status).toBe("failed");
    expect(r.errors.map((e) => e.code)).toContain("page-a4");
  });

  it("passa com apenas achados não-estruturais (warnings)", () => {
    const r = evaluateOoxmlGate([warningIssue], false);
    expect(r.status).toBe("passed");
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("table-header-missing");
  });

  it("passa sem achados e sem reparo", () => {
    const r = evaluateOoxmlGate([], false);
    expect(r.status).toBe("passed");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("separa errors de warnings na saída", () => {
    const r = evaluateOoxmlGate([errorIssue, warningIssue], false);
    expect(r.status).toBe("failed");
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});
