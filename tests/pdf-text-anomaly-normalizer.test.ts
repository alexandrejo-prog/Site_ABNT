import { describe, expect, it } from "vitest";
import { normalizePdfTextAnomalies } from "../src/pdf-text-anomaly-normalizer";

describe("normalizacao de anomalias textuais reconstruidas do PDF", () => {
  it("reduz COVID-19-19 para COVID-19", () => {
    expect(normalizePdfTextAnomalies("COVID-19-19")).toBe("COVID-19");
  });

  it("reduz cadeias repetidas de sufixo -19 para COVID-19", () => {
    expect(normalizePdfTextAnomalies("COVID-19-19-19")).toBe("COVID-19");
  });

  it("mantem COVID-19 intacto (idempotente)", () => {
    expect(normalizePdfTextAnomalies("COVID-19")).toBe("COVID-19");
  });

  it("mantem quali-quantitativa byte a byte identico", () => {
    expect(normalizePdfTextAnomalies("quali-quantitativa")).toBe("quali-quantitativa");
  });

  it("mantem servidor-pesquisador byte a byte identico", () => {
    expect(normalizePdfTextAnomalies("servidor-pesquisador")).toBe("servidor-pesquisador");
  });

  it("nao altera formas corretas sem hifen", () => {
    expect(normalizePdfTextAnomalies("interdisciplinar")).toBe("interdisciplinar");
    expect(normalizePdfTextAnomalies("socioeconômico")).toBe("socioeconômico");
    expect(normalizePdfTextAnomalies("multidisciplinar")).toBe("multidisciplinar");
    expect(normalizePdfTextAnomalies("autoavaliação")).toBe("autoavaliação");
    expect(normalizePdfTextAnomalies("semiestruturado")).toBe("semiestruturado");
  });

  it("corrige qualiquantitativa fundido apos quebra de linha", () => {
    expect(normalizePdfTextAnomalies("qualiquantitativa")).toBe("quali-quantitativa");
    expect(normalizePdfTextAnomalies("A abordagem qualiquantitativa")).toBe("A abordagem quali-quantitativa");
  });

  it("preserva citacoes, autores, anos e paginas", () => {
    expect(normalizePdfTextAnomalies("Segundo Silva et al. (2020), a COVID-19-19 provocou mudanças."))
      .toBe("Segundo Silva et al. (2020), a COVID-19 provocou mudanças.");
    expect(normalizePdfTextAnomalies("Conforme (Silva, 2020, p. 15) a pandemia."))
      .toBe("Conforme (Silva, 2020, p. 15) a pandemia.");
  });

  it("preserva URLs e identificadores mesmo com padroes semelhantes", () => {
    expect(normalizePdfTextAnomalies("Consulte https://exemplo.com/artigo-19-19 e analise COVID-19-19."))
      .toBe("Consulte https://exemplo.com/artigo-19-19 e analise COVID-19.");
    const input = "DOI 10.1000/xyz, ISBN 978-85-123, e-mail a@b.com, Lei 13.979/2020, intervalo 2025-2026, item 10-10, artigos 19-19.";
    expect(normalizePdfTextAnomalies(input)).toBe(input);
  });

  it("e idempotente para saidas ja normalizadas", () => {
    const once = normalizePdfTextAnomalies("A COVID-19-19 e a qualiquantitativa.");
    expect(once).toBe("A COVID-19 e a quali-quantitativa.");
    expect(normalizePdfTextAnomalies(once)).toBe(once);
  });
});
