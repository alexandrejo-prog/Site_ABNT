import { describe, expect, it } from "vitest";
import {
  normalizePdfTextAnomalies,
  detectPdfTextAnomalyAlerts,
  shouldKeepHyphenAtJoin,
} from "../src/pdf-text-anomaly-normalizer";

describe("normalizacao de anomalias textuais reconstruidas do PDF", () => {
  it("preserva COVID-19-19 fielmente ao PDF", () => {
    expect(normalizePdfTextAnomalies("A pandemia da COVID-19-19 alterou o trabalho."))
      .toBe("A pandemia da COVID-19-19 alterou o trabalho.");
  });

  it("emite alerta de duplicacao para COVID-19-19", () => {
    const alerts = detectPdfTextAnomalyAlerts("A pandemia da COVID-19-19 alterou o trabalho.");
    expect(alerts).toContain("Possível duplicação textual presente no documento original: COVID-19-19.");
  });

  it("nao emite alerta para COVID-19 ja normalizado", () => {
    expect(detectPdfTextAnomalyAlerts("A pandemia da COVID-19 alterou o trabalho.")).toEqual([]);
  });

  it("preserva COVID-19 intacto (passthrough)", () => {
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
    expect(normalizePdfTextAnomalies("socioeconomico")).toBe("socioeconomico");
    expect(normalizePdfTextAnomalies("multidisciplinar")).toBe("multidisciplinar");
    expect(normalizePdfTextAnomalies("autoavaliacao")).toBe("autoavaliacao");
    expect(normalizePdfTextAnomalies("semiestruturado")).toBe("semiestruturado");
  });

  it("nao corrige qualiquantitativa fundido; emite aviso de revisao", () => {
    expect(normalizePdfTextAnomalies("qualiquantitativa")).toBe("qualiquantitativa");
    const alerts = detectPdfTextAnomalyAlerts("Uma abordagem qualiquantitativa foi usada.");
    expect(alerts.some((a) => a.includes("qualiquantitativa"))).toBe(true);
  });

  it("nao corrige servidorpesquisador fundido; emite aviso de revisao", () => {
    expect(normalizePdfTextAnomalies("servidorpesquisador")).toBe("servidorpesquisador");
    const alerts = detectPdfTextAnomalyAlerts("O servidorpesquisador atuou na gestao.");
    expect(alerts.some((a) => a.includes("servidorpesquisador"))).toBe(true);
  });

  it("preserva citacoes, autores, anos e paginas sem alterar", () => {
    expect(normalizePdfTextAnomalies("Segundo Silva et al. (2020), a COVID-19-19 provocou mudancas."))
      .toBe("Segundo Silva et al. (2020), a COVID-19-19 provocou mudancas.");
    expect(normalizePdfTextAnomalies("Conforme (Silva, 2020, p. 15) a pandemia."))
      .toBe("Conforme (Silva, 2020, p. 15) a pandemia.");
  });

  it("preserva URLs e identificadores mesmo com padroes semelhantes", () => {
    expect(normalizePdfTextAnomalies("Consulte https://exemplo.com/artigo-19-19 e analise COVID-19-19."))
      .toBe("Consulte https://exemplo.com/artigo-19-19 e analise COVID-19-19.");
    const input = "DOI 10.1000/xyz, ISBN 978-85-123, e-mail a@b.com, Lei 13.979/2020, intervalo 2025-2026, item 10-10, artigos 19-19.";
    expect(normalizePdfTextAnomalies(input)).toBe(input);
  });

  it("shouldKeepHyphenAtJoin mantem quali-quantitativa somente com fronteira", () => {
    expect(shouldKeepHyphenAtJoin("quali-", "quantitativa")).toBe(true);
    expect(shouldKeepHyphenAtJoin("servidor-", "pesquisador")).toBe(true);
    expect(shouldKeepHyphenAtJoin("inter-", "disciplinar")).toBe(false);
    expect(shouldKeepHyphenAtJoin("multi-", "disciplinar")).toBe(false);
  });

  it("e idempotente para saidas ja preservadas", () => {
    const once = normalizePdfTextAnomalies("A COVID-19-19 e a qualiquantitativa.");
    expect(once).toBe("A COVID-19-19 e a qualiquantitativa.");
    expect(normalizePdfTextAnomalies(once)).toBe(once);
  });
});
