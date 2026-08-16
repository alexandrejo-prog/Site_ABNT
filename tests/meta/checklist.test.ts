import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("segurança e checklist", () => {
  it("CHECKLIST.md existe (histórico) e status canônico presente", () => {
    // docs/CHECKLIST.md foi movido para docs/historico/ na reorg (regra do projeto:
    // um canônico por documento, sem duplicatas; status vive em STATUS_ATUAL.md).
    expect(existsSync(join(process.cwd(), "docs", "historico", "CHECKLIST.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "STATUS_ATUAL.md"))).toBe(true);
  });

  it("não existe chave de API hardcoded nos arquivos principais", () => {
    const sourceDir = join(process.cwd(), "src");
    const source = readdirSync(sourceDir)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => readFileSync(join(sourceDir, file), "utf8"))
      .join("\n");

    const secretPatterns = [
      new RegExp(["sk", "-"].join("") + "[A-Za-z0-9_-]{16,}"),
      /AIza[A-Za-z0-9_-]{20,}/,
      /api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i,
    ];

    for (const pattern of secretPatterns) {
      expect(source).not.toMatch(pattern);
    }
  });
});
