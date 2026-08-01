import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("aviso do Tiptap experimental", () => {
  const toolbarSource = readFileSync(join(process.cwd(), "src", "components", "EditorToolbar.tsx"), "utf8");

  it("exibe aviso apenas quando o Tiptap esta ativo", () => {
    expect(toolbarSource).toContain("Modo Tiptap experimental.");
    expect(toolbarSource).toContain("isTiptapEditorEnabled &&");
  });
});
