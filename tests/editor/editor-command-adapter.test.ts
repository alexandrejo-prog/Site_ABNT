// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createEditorCommandAdapter } from "../../src/editor-command-adapter";

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

  function mountEditorWithSelection(): { editor: HTMLElement; paragraph: HTMLElement } {
    document.body.innerHTML = '<div class="rich-editor" contenteditable="true"><p>Texto selecionado</p></div>';
    const editor = document.querySelector(".rich-editor") as HTMLElement;
    const paragraph = editor.querySelector("p") as HTMLElement;
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    return { editor, paragraph };
  }

  it("ajusta indenta??o do bloco atual", () => {
    const { paragraph } = mountEditorWithSelection();
    const adapter = createEditorCommandAdapter({ document });

    expect(adapter.adjustCurrentBlockIndent("firstLine", 0.5)).toBe(true);
    expect(paragraph.style.textIndent).toBe("0.5cm");
    expect(paragraph.dataset.firstLineIndent).toBe("0.5");
  });

  it("respeita limites de indenta??o", () => {
    const { paragraph } = mountEditorWithSelection();
    const adapter = createEditorCommandAdapter({ document });

    expect(adapter.adjustCurrentBlockIndent("left", 5)).toBe(true);
    expect(paragraph.style.marginLeft).toBe("4cm");
    expect(paragraph.dataset.leftIndent).toBe("4");
  });

  it("define indenta??o atual do bloco via setCurrentBlockIndent", () => {
    const { paragraph } = mountEditorWithSelection();
    const adapter = createEditorCommandAdapter({ document });

    expect(adapter.setCurrentBlockIndent("firstLine", 1.0)).toBe(true);
    expect(paragraph.style.textIndent).toBe("1cm");
    expect(paragraph.dataset.firstLineIndent).toBe("1");

    expect(adapter.setCurrentBlockIndent("left", 2.0)).toBe(true);
    expect(paragraph.style.marginLeft).toBe("2cm");
    expect(paragraph.dataset.leftIndent).toBe("2");

    expect(adapter.setCurrentBlockIndent("right", 1.5)).toBe(true);
    expect(paragraph.style.marginRight).toBe("1.5cm");
    expect(paragraph.dataset.rightIndent).toBe("1.5");
  });

  it("dispara input do editor apos alterar indenta??o", () => {
    const { editor } = mountEditorWithSelection();
    const adapter = createEditorCommandAdapter({ document });
    const events: Event[] = [];
    editor.addEventListener("input", (event) => events.push(event));

    expect(adapter.setCurrentBlockIndent("firstLine", 0.5)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.type).toBe("input");
  });

  it("respeita limites maximos em setCurrentBlockIndent", () => {
    const { paragraph } = mountEditorWithSelection();
    const adapter = createEditorCommandAdapter({ document });

    expect(adapter.setCurrentBlockIndent("firstLine", 5.0)).toBe(true);
    expect(paragraph.style.textIndent).toBe("3cm");
    expect(paragraph.dataset.firstLineIndent).toBe("3");

    expect(adapter.setCurrentBlockIndent("left", 10.0)).toBe(true);
    expect(paragraph.style.marginLeft).toBe("4cm");
    expect(paragraph.dataset.leftIndent).toBe("4");
  });

});
