import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizePdfTextAnomalies } from "../src/pdf-text-anomaly-normalizer";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/pdf-text-anomaly-normalizer.ts"), "utf8");

describe("normalizacao de anomalias textuais da reconstrucao pdf", () => {
  it("1. corrige repeticao de sufixo determinada por recomposicao", () => {
    const result = normalizePdfTextAnomalies("Trecho com COVID-19-19 apos recomposicao.");
    expect(result.text).toContain("COVID-19");
    expect(result.text).not.toContain("COVID-19-19");
    expect(result.changed).toBe(true);
    expect(result.reasons.some((reason) => /repetido/.test(reason))).toBe(true);
  });

  it("2. corrige COVID-19-19 por regra geral", () => {
    const result = normalizePdfTextAnomalies("COVID-19-19");
    expect(result.text).toBe("COVID-19");
    expect(result.changed).toBe(true);
  });

  it("3. preserva intervalo 2025-2026", () => {
    const result = normalizePdfTextAnomalies("Periodo 2025-2026 de estudo.");
    expect(result.text).toBe("Periodo 2025-2026 de estudo.");
    expect(result.changed).toBe(false);
  });

  it("4. preserva numero legitimo 10-10", () => {
    const result = normalizePdfTextAnomalies("item 10-10 mantido.");
    expect(result.text).toBe("item 10-10 mantido.");
    expect(result.changed).toBe(false);
  });

  it("5. insere espaco entre fragmentos servidor + pesquisador", () => {
    const result = normalizePdfTextAnomalies("servidorpesquisador", {
      previousFragment: "servidor",
      nextFragment: "pesquisador",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("servidor pesquisador");
    expect(result.changed).toBe(true);
  });

  it("6. palavra normal sem evidenicia de quebra permanece", () => {
    const result = normalizePdfTextAnomalies("palavra normal sem anomalia conhecida.");
    expect(result.text).toBe("palavra normal sem anomalia conhecida.");
    expect(result.changed).toBe(false);
  });

  it("7. reconstrói hifen entre quali- + quantitativa", () => {
    const result = normalizePdfTextAnomalies("qualiquantitativa", {
      previousFragment: "quali-",
      nextFragment: "quantitativa",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("quali-quantitativa");
    expect(result.changed).toBe(true);
  });

  it("8. mantem hifen de palavra hifenizada comum entre linhas", () => {
    const result = normalizePdfTextAnomalies("socioeconomico", {
      previousFragment: "socio-",
      nextFragment: "economico",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("socio-economico");
    expect(result.changed).toBe(true);
  });

  it("9. remove hifen de translineacao quando representa continuacao normal", () => {
    const result = normalizePdfTextAnomalies("abdom", {
      previousFragment: "ab-",
      nextFragment: "dom",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("abdom");
    expect(result.changed).toBe(false);
  });

  it("10. preserva hifen morfologico reconstruido", () => {
    const result = normalizePdfTextAnomalies("interdisciplinar", {
      previousFragment: "inter-",
      nextFragment: "disciplinar",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("inter-disciplinar");
    expect(result.changed).toBe(true);
  });

  it("11. e conservador na mudanca de pagina", () => {
    const result = normalizePdfTextAnomalies("servidorpesquisador", {
      previousFragment: "servidor",
      nextFragment: "pesquisador",
      joinedAcrossPage: true,
    });
    expect(result.text).toBe("servidorpesquisador");
    expect(result.changed).toBe(false);
  });

  it("12. nao unije titulo ao paragrafo seguinte", () => {
    const result = normalizePdfTextAnomalies("1 INTRODUCAO paragrafo", {
      previousFragment: "1 INTRODUCAO",
      nextFragment: "paragrafo",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("1 INTRODUCAO paragrafo");
    expect(result.changed).toBe(false);
  });

  it("13. nao unije legenda ao elemento", () => {
    const result = normalizePdfTextAnomalies("Figura 1 ilustra", {
      previousFragment: "Figura 1",
      nextFragment: "ilustra",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("Figura 1 ilustra");
    expect(result.changed).toBe(false);
  });

  it("14. nao unije fonte ao proximo paragrafo", () => {
    const result = normalizePdfTextAnomalies("Fonte: IBGE texto", {
      previousFragment: "Fonte: IBGE",
      nextFragment: "texto",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("Fonte: IBGE texto");
    expect(result.changed).toBe(false);
  });

  it("15. preserva URL", () => {
    const result = normalizePdfTextAnomalies("Veja https://exemplo.com/artigo-19-19 mais.");
    expect(result.text).toBe("Veja https://exemplo.com/artigo-19-19 mais.");
    expect(result.changed).toBe(false);
  });

  it("16. preserva DOI", () => {
    const result = normalizePdfTextAnomalies("doi:10.1000/xyz-19-19 artigo.");
    expect(result.text).toBe("doi:10.1000/xyz-19-19 artigo.");
    expect(result.changed).toBe(false);
  });

  it("17. preserva ISBN", () => {
    const result = normalizePdfTextAnomalies("ISBN 978-19-19-12345 livro.");
    expect(result.text).toBe("ISBN 978-19-19-12345 livro.");
    expect(result.changed).toBe(false);
  });

  it("18. preserva nome proprio fundido", () => {
    const result = normalizePdfTextAnomalies("Joãosilva", {
      previousFragment: "João",
      nextFragment: "silva",
      joinedAcrossLine: true,
    });
    expect(result.text).toBe("Joãosilva");
    expect(result.changed).toBe(false);
  });

  it("19. preserva referencia bibliografica quando ambigua", () => {
    const result = normalizePdfTextAnomalies("SMITH, J. et al. COVID-19-19 studies.");
    expect(result.text).toBe("SMITH, J. et al. COVID-19-19 studies.");
    expect(result.changed).toBe(false);
  });

  it("20. nao muta as entradas recebidas", () => {
    const text = "servidorpesquisador";
    const context = { previousFragment: "servidor", nextFragment: "pesquisador", joinedAcrossLine: true };
    const result = normalizePdfTextAnomalies(text, context);
    expect(text).toBe("servidorpesquisador");
    expect(context.previousFragment).toBe("servidor");
    expect(context.nextFragment).toBe("pesquisador");
    expect(context.joinedAcrossLine).toBe(true);
    expect(result.text).toBe("servidor pesquisador");
  });

  it("21. e deterministico", () => {
    const a = normalizePdfTextAnomalies("COVID-19-19", {});
    const b = normalizePdfTextAnomalies("COVID-19-19", {});
    expect(a).toEqual(b);
  });

  it("22. mantem texto sem anomalia byte-a-byte igual", () => {
    const original = "Este paragrafo possui texto corrido suficiente para representar corpo aca demico normal.";
    const result = normalizePdfTextAnomalies(original);
    expect(result.text).toBe(original);
    expect(result.changed).toBe(false);
  });

  it("23. nenhuma regra especifica contem 'Andrade'", () => {
    expect(src).not.toContain("Andrade");
  });

  it("24. nenhuma regra usa numero de pagina especifico", () => {
    expect(src).not.toMatch(/\bp[áa]ginas?\s+1\d\b/i);
    expect(src).not.toMatch(/\bpage\s+1\d\b/i);
  });

  it("25. nenhuma dependencia externa e usada", () => {
    expect(src).not.toContain("import ");
    expect(src).not.toContain("require(");
  });
});
