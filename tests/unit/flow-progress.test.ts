import { describe, expect, it } from "vitest";
import { computeFlowProgress, FLOW_STEP_LABELS } from "../../src/flow-progress";
import type { FlowProgressInput, FlowStepKey } from "../../src/flow-progress";

const base: FlowProgressInput = {
  workType: "monografia",
  title: "Título",
  author: "Autor",
  editorText: "Texto do corpo",
  referencias: "REFERÊNCIA",
  hasBlockingErrors: false,
};

describe("computeFlowProgress", () => {
  it("celebra fluxo completo quando tudo está preenchido e sem erros", () => {
    const p = computeFlowProgress(base);
    expect(p.allComplete).toBe(true);
    expect(p.currentIndex).toBe(5);
    expect(p.steps.every((s) => s.complete)).toBe(true);
  });

  it("aponta como etapa atual a primeira incompleta", () => {
    const p = computeFlowProgress({ ...base, author: "" });
    expect(p.allComplete).toBe(false);
    expect(p.steps[1].key).toBe("dados");
    expect(p.currentIndex).toBe(1);
    expect(p.steps[1].complete).toBe(false);
  });

  it("sem tipo de trabalho a primeira etapa é 'tipo'", () => {
    const p = computeFlowProgress({ ...base, workType: "" });
    expect(p.currentIndex).toBe(0);
    expect(p.steps[0].key).toBe("tipo");
    expect(p.steps[0].complete).toBe(false);
  });

  it("texto vazio deixa a etapa 'texto' pendente", () => {
    const p = computeFlowProgress({ ...base, editorText: "" });
    expect(p.steps[2].key).toBe("texto");
    expect(p.currentIndex).toBe(2);
  });

  it("referencias não exigidas para CPG marcam a etapa como completa", () => {
    const p = computeFlowProgress({ ...base, workType: "artigo_completo_cpg", referencias: "", editorText: "texto", hasBlockingErrors: false, title: "T", author: "A" });
    expect(p.steps[3].key).toBe("referencias");
    expect(p.steps[3].complete).toBe(true);
  });

  it("referencias vazias tornam a etapa pendente para não-CPG", () => {
    const p = computeFlowProgress({ ...base, referencias: "" });
    expect(p.steps[3].complete).toBe(false);
    expect(p.currentIndex).toBe(3);
  });

  it("exposição de erro bloqueante mantém a etapa revisão pendente", () => {
    const p = computeFlowProgress({ ...base, hasBlockingErrors: true });
    expect(p.hasBlockingError).toBe(true);
    expect(p.steps[4].key).toBe("revisao");
    expect(p.steps[4].complete).toBe(false);
    expect(p.currentIndex).toBe(4);
  });

  it("todos os rótulos das etapas estão definidos", () => {
    const keys: FlowStepKey[] = ["tipo", "dados", "texto", "referencias", "revisao"];
    for (const key of keys) expect(FLOW_STEP_LABELS[key]).toBeTruthy();
  });
});