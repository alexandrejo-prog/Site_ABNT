import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../../src/hooks/useKeyboardShortcuts";

function dispatchKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts (P1)", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("Ctrl+S chama onSaveDraft e previne o download nativo do navegador", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));

    const event = dispatchKey(window, { key: "s", ctrlKey: true });

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Cmd+S (metaKey) também salva rascunho", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));

    dispatchKey(window, { key: "s", metaKey: true });

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Shift+E exporta DOCX", () => {
    const onExportDocx = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onExportDocx }));

    dispatchKey(window, { key: "e", ctrlKey: true, shiftKey: true });

    expect(onExportDocx).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Shift+V alterna validação", () => {
    const onToggleValidation = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onToggleValidation }));

    dispatchKey(window, { key: "v", ctrlKey: true, shiftKey: true });

    expect(onToggleValidation).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Shift+P abre preview", () => {
    const onTogglePreview = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onTogglePreview }));

    dispatchKey(window, { key: "p", ctrlKey: true, shiftKey: true });

    expect(onTogglePreview).toHaveBeenCalledTimes(1);
  });

  it("tecla sem Ctrl/Cmd é ignorada", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));

    dispatchKey(window, { key: "s" });

    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it("não intercepta Ctrl+S dentro de input", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));
    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = dispatchKey(input, { key: "s", ctrlKey: true });

    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("não intercepta atalhos dentro de textarea e select", () => {
    const onExportDocx = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onExportDocx }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    dispatchKey(textarea, { key: "e", ctrlKey: true, shiftKey: true });

    const select = document.createElement("select");
    document.body.appendChild(select);
    dispatchKey(select, { key: "e", ctrlKey: true, shiftKey: true });

    expect(onExportDocx).not.toHaveBeenCalled();
  });

  it("respeita contentEditable (elemento e descendentes)", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.appendChild(child);
    document.body.appendChild(editable);

    dispatchKey(editable, { key: "s", ctrlKey: true });
    dispatchKey(child, { key: "s", ctrlKey: true });

    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it("não previne atalho nativo quando não há ação da aplicação", () => {
    renderHook(() => useKeyboardShortcuts({}));

    const event = dispatchKey(window, { key: "s", ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
  });

  it("não previne combinação sem ação mapeada (ex.: Ctrl+Shift+Q)", () => {
    const onSaveDraft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSaveDraft }));

    const event = dispatchKey(window, { key: "q", ctrlKey: true, shiftKey: true });

    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignora tecla repetida (evita loops de geração DOCX)", () => {
    const onExportDocx = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onExportDocx }));

    dispatchKey(window, { key: "e", ctrlKey: true, shiftKey: true, repeat: true });

    expect(onExportDocx).not.toHaveBeenCalled();
  });

  it("não registra listeners duplicados quando os handlers mudam", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onSaveDraft }) => useKeyboardShortcuts({ onSaveDraft }),
      { initialProps: { onSaveDraft: first } },
    );

    rerender({ onSaveDraft: second });
    dispatchKey(window, { key: "s", ctrlKey: true });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("remove o listener no unmount", () => {
    const onSaveDraft = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onSaveDraft }));

    unmount();
    dispatchKey(window, { key: "s", ctrlKey: true });

    expect(onSaveDraft).not.toHaveBeenCalled();
  });
});
