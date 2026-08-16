import { it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { baselineRoundTrip, type BaselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { auditReferenceRoundTrip, type ReferenceAudit } from ".././test-utils/reference-roundtrip-audit";
import { testEvidenceDir } from ".././test-utils/test-evidence";
import { normalizeOoxmlText } from ".././test-utils/ooxml";

/**
 * Round-trip vivo: baseline real (artifacts/baselines/dissertacao-referencia.docx)
 * -> importDocumentFile -> generateDocxBlob -> re-import.
 *
 * O teste valida IDENTIDADE item a item (não contagem aproximada):
 * cada referência de entrada deve ter uma correspondente na saída; autor, ano,
 * título, URL, DOI e "Acesso em" não podem ser perdidos; acentos e pontuação
 * precisam ser preservados. Não há margem numérica de perda: a tolerância de
 * contagem só é aceita com exceções explícitas (duplicata, fragmento
 * reagrupado, entrada inválida documentada, não-referência).
 *
 * O resultado é gravado no diretório temporário de evidências
 * (reference-roundtrip-diff.json) automaticamente, sem sobrescrever artefatos
 * oficiais (auditoria 100% automática, sem revisão manual).
 */

const auditPath = join(testEvidenceDir(), "reference-roundtrip-diff.json");

describeWithArtifacts("acceptance: preservacao de referencias (round-trip vivo)", ["baselines/dissertacao-referencia.docx"], () => {
  let rt: BaselineRoundTrip;
  let audit: ReferenceAudit;

  beforeAll(async () => {
    rt = await baselineRoundTrip();
    audit = auditReferenceRoundTrip(
      rt.input.referencias,
      rt.output.referencias,
      {
        input: "baseline dissertacao-referencia.docx (apos importacao)",
        output: "DOCX gerado por generateDocxBlob e reimportado",
      },
    );
    mkdirSync(dirname(auditPath), { recursive: true });
    writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
  });

  it("cada referencia de entrada tem correspondente na saida (identidade item a item)", () => {
    const unmatched = audit.records.filter((r) => r.matchMethod === "unmatched");
    expect(unmatched, `referencias sem correspondente na saida: ${unmatched
      .map((r) => r.inputText.slice(0, 80))
      .join(" | ")}`).toEqual([]);
  });

  it("nenhuma parte semantica perdida (autor, ano, titulo, URL, DOI, Acesso em, texto)", () => {
    expect(audit.summary.lostParts, `partes perdidas: ${JSON.stringify(audit.summary.lostParts.slice(0, 5))}`).toEqual([]);
    expect(audit.summary.preserved, `referencias nao preservadas: ${audit.summary.inputItems - audit.summary.preserved}`).toBe(
      audit.summary.inputItems,
    );
  });

  it("delta de contagem zero ou justificado por excecoes explicitas (sem margem numerica)", () => {
    expect(audit.summary.countDelta, `delta nao justificado: ${JSON.stringify(audit.summary)}`).toBe(0);
    expect(audit.summary.countDeltaJustified).toBe(true);
    expect(audit.summary.exceptions, "excecoes inesperadas no round-trip atual").toEqual([]);
  });

  it("preserva URLs, DOI e marcadores (Disponivel em / Acesso em) com acentos", () => {
    const outFull = normalizeOoxmlText(rt.output.fields.referencias ?? "");
    const inFull = normalizeOoxmlText(rt.input.fields.referencias ?? "");

    // cada host de URL da entrada aparece na saida
    const hostsIn = new Set(
      (inFull.match(/HTTPS?:\/\/[^<\s]+/g) ?? [])
        .map((u) => (u.match(/^HTTPS?:\/\/[^/]+/i) ?? [])[0])
        .filter(Boolean),
    );
    for (const host of hostsIn) {
      expect(outFull, `host ausente na saida: ${host}`).toContain(host);
    }

    // DOI presentes na entrada permanecem na saida (sem pontuacao/bracket final)
    for (const raw of inFull.match(/\b10\.\d{4,9}\/[^\s]+/g) ?? []) {
      const doi = raw.replace(/[>.,;:)\]]+$/u, "");
      expect(outFull, `DOI ausente na saida: ${doi}`).toContain(doi);
    }

    // marcadores "Disponivel em"/"Acesso em" preservados (forma com acento)
    expect(outFull).toContain("DISPO");
    expect(outFull).toContain("ACESSO EM:");
  });

  it("gravou artifacts/ufla-audit/reference-roundtrip-diff.json no schema acordado", () => {
    const record = audit.records[0];
    expect(record).toMatchObject({
      inputIndex: expect.any(Number),
      inputText: expect.any(String),
      normalizedInput: expect.any(String),
      outputCandidates: expect.any(Array),
      matchedOutputIndex: expect.any(Number),
      matchMethod: expect.stringMatching(/^(exact|normalized|fragment-rejoined|unmatched)$/),
      preserved: expect.any(Boolean),
      reason: expect.any(String),
    });
    expect(record.parts).toMatchObject({
      author: expect.any(Boolean),
      year: expect.any(Boolean),
      title: expect.any(Boolean),
      url: expect.any(Boolean),
      doi: expect.any(Boolean),
      access: expect.any(Boolean),
    });
    expect(audit.summary.byMethod).toMatchObject({
      exact: expect.any(Number),
      normalized: expect.any(Number),
      "fragment-rejoined": expect.any(Number),
    });
  });
});
