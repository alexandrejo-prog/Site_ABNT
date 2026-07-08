import { describe, expect, it } from "vitest";
import { createEditorCommandAdapter, editorCommandAdapter } from "../src/editor-command-adapter";

describe("editor-command-adapter", () => {
  it("retorna false quando document.execCommand nao existe", () => {
    const adapter = createEditorCommandAdapter({ document: undefined });
    expect(adapter.applyEditorCommand("bold")).toBe(false);
    expect(adapter.insertEditorText("texto")).toBe(false);
    expect(adapter.formatEditorBlock("h1")).toBe(false);
    expect(adapter.clearEditorFormatting()).toBe(false);
  });

  it("chama execCommand com parametros corretos quando disponivel", () => {
    const calls: Array<{ command: string; showUI: boolean; value?: string }> = [];
    const fakeDocument = {
      execCommand: (command: string, showUI: boolean, value?: string) => {
        calls.push({ command, showUI, value });
        return true;
      },
    };

    const adapter = createEditorCommandAdapter({ document: fakeDocument as unknown as Document });
    expect(adapter.applyEditorCommand("bold", undefined)).toBe(true);
    expect(adapter.insertEditorText("hello")).toBe(true);
    expect(adapter.formatEditorBlock("h1")).toBe(true);
    expect(adapter.clearEditorFormatting()).toBe(true);

    expect(calls).toEqual([
      { command: "bold", showUI: false },
      { command: "insertText", showUI: false, value: "hello" },
      { command: "formatBlock", showUI: false, value: "h1" },
      { command: "removeFormat", showUI: false },
      { command: "formatBlock", showUI: false, value: "p" },
    ]);
  });

  it("insertEditorText trata texto simples sem interpretar HTML", () => {
    const calls: Array<{ command: string; showUI: boolean; value?: string }> = [];
    const fakeDocument = {
      execCommand: (command: string, showUI: boolean, value?: string) => {
        calls.push({ command, showUI, value });
        return true;
      },
    };

    const adapter = createEditorCommandAdapter({ document: fakeDocument as unknown as Document });
    expect(adapter.insertEditorText("<b>nao</b>")).toBe(true);
    expect(calls[0].value).toBe("<b>nao</b>");
  });

  it("nao lança erro quando execCommand falha", () => {
    const fakeDocument = {
      execCommand: () => {
        throw new Error("falha");
      },
    };

    const adapter = createEditorCommandAdapter({ document: fakeDocument as unknown as Document });
    expect(() => adapter.applyEditorCommand("bold")).not.toThrow();
    expect(adapter.applyEditorCommand("bold")).toBe(false);
  });
});
