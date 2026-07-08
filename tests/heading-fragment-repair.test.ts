import { describe, expect, it } from "vitest";
import { repairHeadingFragments } from "../src/heading-fragment-repair";

describe("reparo de titulos quebrados", () => {
  it("une objetivo especifico quebrado em duas linhas", () => {
    const input = "# 1.3.2 Objetivos\nespecificos\n1) Mapear normas";

    expect(repairHeadingFragments(input)).toContain("# 1.3.2 Objetivos especificos");
    expect(repairHeadingFragments(input)).not.toContain("Objetivos\nespecificos");
  });

  it("une objetivo especifico mesmo com linha vazia intermediaria", () => {
    const input = "# 1.3.2 Objetivos\n\nespecificos\n1) Mapear normas";

    expect(repairHeadingFragments(input)).toContain("# 1.3.2 Objetivos especificos");
    expect(repairHeadingFragments(input)).not.toContain("Objetivos\n\nespecificos");
  });

  it("une cronograma de execucao quebrado em duas linhas", () => {
    const input = "# 5.1 Cronograma\nde execucao\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# 5.1 Cronograma de execucao");
    expect(repairHeadingFragments(input)).not.toContain("Cronograma\nde execucao");
  });

  it("une cronograma de execucao mesmo com linha vazia intermediaria", () => {
    const input = "# 5.1 Cronograma\n\nde execucao\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# 5.1 Cronograma de execucao");
    expect(repairHeadingFragments(input)).not.toContain("Cronograma\n\nde execucao");
  });

  it("une consideracoes finais quebrado", () => {
    const input = "# Considerações\nfinais\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# Considerações finais");
    expect(repairHeadingFragments(input)).not.toContain("Considerações\nfinais");
  });

  it("une referencias bibliograficas quebrado", () => {
    const input = "# Referências\nbibliográficas\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# Referências bibliográficas");
    expect(repairHeadingFragments(input)).not.toContain("Referências\nbibliográficas");
  });

  it("une fundamentacao teorica quebrado", () => {
    const input = "# Fundamentação\nteórica\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# Fundamentação teórica");
    expect(repairHeadingFragments(input)).not.toContain("Fundamentação\nteórica");
  });

  it("une revisao bibliografica quebrado", () => {
    const input = "# Revisão\nbibliográfica\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# Revisão bibliográfica");
    expect(repairHeadingFragments(input)).not.toContain("Revisão\nbibliográfica");
  });

  it("une resultados esperados quebrado", () => {
    const input = "# Resultados\nesperados\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# Resultados esperados");
    expect(repairHeadingFragments(input)).not.toContain("Resultados\nesperados");
  });

  it("une metodologia de teste quebrada no arquivo-base", () => {
    const input = "# 3 METODOLOGIA\nDE TESTE\nTexto.";

    expect(repairHeadingFragments(input)).toContain("# 3 METODOLOGIA DE TESTE");
    expect(repairHeadingFragments(input)).not.toContain("METODOLOGIA\nDE TESTE");
  });

  it("une material e metodos quebrado preservando nivel de titulo", () => {
    const input = "## Material e\nmetodos\nTexto.";

    expect(repairHeadingFragments(input)).toContain("## Material e metodos");
    expect(repairHeadingFragments(input)).not.toContain("Material e\nmetodos");
  });

  it("une recursos e orcamento quebrado preservando subtitulo", () => {
    const input = "### Recursos\ne orcamento\nTexto.";

    expect(repairHeadingFragments(input)).toContain("### Recursos e orcamento");
    expect(repairHeadingFragments(input)).not.toContain("Recursos\ne orcamento");
  });

  it("mantem demais linhas inalteradas", () => {
    const input = "# 1.4 Justificativa\nTexto.";

    expect(repairHeadingFragments(input)).toBe(input);
  });

  it("nao junta paragrafos comuns", () => {
    const input = "Este é um parágrafo comum.\nOutro parágrafo.";

    expect(repairHeadingFragments(input)).toBe(input);
  });
});

it("une referencias bibliograficas mesmo com travessao no fim da linha", () => {
  const input = "# Referências —\nbibliográficas\nTexto.";

  expect(repairHeadingFragments(input)).toContain("# Referências — bibliográficas");
  expect(repairHeadingFragments(input)).not.toContain("Referências —\nbibliográficas");
});
