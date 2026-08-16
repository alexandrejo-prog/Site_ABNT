import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEditorCommandAdapter } from "../../src/editor-command-adapter";

const editorSectionSource = readFileSync(join(process.cwd(), "src", "components", "EditorSection.tsx"), "utf8");

function handleEditorPasteBody(): string {
  const match = editorSectionSource.match(/onPaste=\{\([^)]*\)\s*=>\s*\{(?<body>[\s\S]*?)\}\s*\}\s*spe/);
  if (!match?.groups?.body) throw new Error("handleEditorPaste nao encontrado");
  return match.groups.body;
}

describe("colagem segura no editor", () => {
  it("bloqueia paste nativo e usa somente text/plain", () => {
    const body = handleEditorPasteBody();

    expect(body).toContain(".preventDefault()");
    expect(body).toContain('clipboardData.getData("text/plain")');
    expect(body).toContain("editorCommandAdapter.insertEditorText");
    expect(body).not.toContain("text/html");
    expect(body).not.toContain("innerHTML");
  });

  it("nao possui caminhos de insercao direta de HTML externo", () => {
    const fullSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8") + "\n" + editorSectionSource;
    expect(fullSource).not.toContain("dangerouslySetInnerHTML");
    expect(fullSource).not.toContain('clipboardData.getData("text/html")');
    expect(fullSource).not.toContain("clipboardData.getData('text/html')");
  });

  it("payloads maliciosos sao enviados como texto para insertText", () => {
    const calls: Array<{ command: string; value?: string }> = [];
    const fakeDocument = {
      execCommand: (command: string, _showUI: boolean, value?: string) => {
        calls.push({ command, value });
        return true;
      },
    };
    const adapter = createEditorCommandAdapter({ document: fakeDocument as unknown as Document });
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "<svg onload=alert(1)></svg>",
      '<iframe src="javascript:alert(1)"></iframe>',
    ];

    for (const payload of payloads) {
      expect(adapter.insertEditorText(payload)).toBe(true);
    }

    expect(calls).toEqual(payloads.map((value) => ({ command: "insertText", value })));
  });
});
