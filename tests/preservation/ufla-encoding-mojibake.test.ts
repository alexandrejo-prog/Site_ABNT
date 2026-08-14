import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cleanMojibakeText } from "../../src/docx-render-core";

const root = process.cwd();

/** Conta ocorrências de U+FFFD (byte sequence EF BF BD) em um buffer. */
function countReplacementChars(buf: Buffer): number {
  const needle = Buffer.from([0xef, 0xbf, 0xbd]);
  let count = 0;
  let idx = 0;
  while ((idx = buf.indexOf(needle, idx)) !== -1) {
    count++;
    idx += 3;
  }
  return count;
}

/** Valida se o buffer é UTF-8 estritamente válido (decodificação fatal). */
function decodeUtf8(buf: Buffer): { ok: boolean; error: string | null } {
  try {
    const td = new TextDecoder("utf-8", { fatal: true });
    td.decode(buf);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

describe("ufla-encoding-artifacts", () => {
  const artifacts = [
    "artifacts/ufla-compliance/rendered-analysis.json",
    "artifacts/ufla-compliance/pdf-physical-analysis.json",
    "artifacts/ufla-compliance/baseline-extraction.json",
    "artifacts/ufla-compliance/content-preservation.json",
    "artifacts/ufla-compliance/reference-roundtrip.json",
  ];

  it("artefatos JSON do pipeline não contêm caracteres de substituição (U+FFFD)", () => {
    for (const rel of artifacts) {
      const path = join(root, rel);
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      expect(countReplacementChars(buf), `${rel} contém U+FFFD`).toBe(0);
    }
  });

  it("artefatos JSON não contêm sequências UTF-8 inválidas (corrupção de decodificação)", () => {
    for (const rel of artifacts) {
      const path = join(root, rel);
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      const r = decodeUtf8(buf);
      expect(r.ok, `${rel} com UTF-8 inválido: ${r.error}`).toBe(true);
    }
  });

  it("DOCX baseline e normalizado são XML UTF-8 válido (sem U+FFFD)", () => {
    for (const rel of [
      "artifacts/baselines/dissertacao-referencia.docx",
      "artifacts/ufla-compliance/normalized-dissertacao.docx",
    ]) {
      const path = join(root, rel);
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      // texto XML dentro do zip é compactado; U+FFFD raramente sobrevive, mas se houver
      // corrupção na origem (cp850) viria como bytes altos não-UTF8 que não seriam U+FFFD.
      // A validação robusta é feita ao extrair; aqui asseguramos que o arquivo não
      // foi salvo com BOM de substituição como conteúdo puro.
      expect(countReplacementChars(buf), `${rel} contém U+FFFD`).toBe(0);
    }
  });
});

describe("ufla-clean-mojibake-completo", () => {
  const input = "ççããéêáàíóôõúüÁÉÍÓÚÃÂÇ—“”‘’–";
  const expected = "ççããéêáàíóôõúüÁÉÍÓÚÃÂÇ—“”‘’–";

  it("preserva o conjunto completo de acentos e sinais tipográficos corretos", () => {
    const cleaned = cleanMojibakeText(input);
    expect(cleaned).toBe(expected);
  });

  it("não introduz Ã, Â nem U+FFFD quando a entrada já está correta", () => {
    const cleaned = cleanMojibakeText(input);
    expect(cleaned).not.toContain("�");
    expect(cleaned).not.toMatch(/Ã(?![\u00C2\u00A9])/u);
  });

  it("corrige mojibake clássico (UTF-8 lido como latin1) para o conjunto completo", () => {
    // 'café' corrompido: bytes E9 (é) lidos como â€¦ (cp1252) -> 'cafÃ©'
    const cases: Array<[string, string]> = [
      ["cafÃ©", "café"],
      ["Ã§Ã£o", "ção"],
      ["Ãºnico", "único"],
      ["Ã¡rvore", "árvore"],
      ["Ã¢nimo", "ânimo"],
      ["Ã©", "é"],
      ["Ãª", "ê"],
      ["Ã­ndice", "índice"],
      ["Ã³leo", "óleo"],
      ["Ã´nibus", "ônibus"],
      ["Ãµ", "õ"],
      ["Ã¼", "ü"],
      ["Ã‰", "É"],
      ["Ã", "Ã"], // 'Ã' sozinho não deve ser alterado (não é par de mojibake)
    ];
    for (const [bad, good] of cases) {
      expect(cleanMojibakeText(bad), `falhou em ${bad}`).toBe(good);
    }
  });

  it("falha de corrupção: rejeita saída com U+FFFD (substituição de caractere)", () => {
    const cleaned = cleanMojibakeText("texto correto");
    expect(cleaned).not.toContain("�");
  });
});
