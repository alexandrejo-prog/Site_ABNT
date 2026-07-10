import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Segurança da marca UFLA no header", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("usa asset oficial existente para a marca UFLA", () => {
    expect(app).toContain('src="/assets/ufla-logo.jpeg"');
  });

  it("não tenta recriar marca via texto estilizado falso", () => {
    expect(app).not.toContain("ufla-logo-text");
    expect(app).not.toContain("marca-texto");
  });

  it("não separa explicitamente símbolo e logotipo", () => {
    expect(app).not.toContain("ufla-symbol");
    expect(app).not.toContain("ufla-logotype");
  });
});
