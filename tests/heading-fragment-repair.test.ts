import { describe, expect, it } from "vitest";
import { repairHeadingFragments } from "../src/heading-fragment-repair";

describe("reparo de titulos quebrados", () => {
  it("une objetivo especifico quebrado em duas linhas", () => {
    const input = "# 1.3.2 Objetivos\nespecificos\n1) Mapear normas";

    expect(repairHeadingFragments(input)).toContain("# 1.3.2 Objetivos especificos");
    expect(repairHeadingFragments(input)).not.toContain("Objetivos\nespecificos");
  });

  it("une cronograma de execucao quebrado em duas linhas", () => {
    const input = "# 5.1 Cronograma\nde execucao\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# 5.1 Cronograma de execucao");
    expect(repairHeadingFragments(input)).not.toContain("Cronograma\nde execucao");
  });

  it("mantem demais linhas inalteradas", () => {
    const input = "# 1.4 Justificativa\nTexto.";

    expect(repairHeadingFragments(input)).toBe(input);
  });
});
