import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("aviso do Tiptap experimental", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("exibe aviso apenas quando o Tiptap esta ativo", () => {
    expect(appSource).toContain("Modo experimental Tiptap ativo");
    expect(appSource).toContain("isTiptapEditorEnabled &&");
  });
});
