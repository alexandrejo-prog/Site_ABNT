import { describe, expect, it } from "vitest";
import { repairHeadingFragments } from "../src/heading-fragment-repair";

describe("reparo de titulos quebrados", () => {
  it("une objetivo especifico quebrado em duas linhas", () => {
    const input = "# 1.3.2 Objetivos\nespecificos\n1) Mapear normas";

    expect(repairHeadingFragments(input)).toContain("# 1.3.2 Objetivos especificos");
    expect(repairHeadingFragments(input)).not.toContain("Objetivos\nespecificos");
  });

  it("mantem demais linhas inalteradas", () => {
    const input = "# 1.4 Justificativa\nTexto.";

    expect(repairHeadingFragments(input)).toBe(input);
  });
});
