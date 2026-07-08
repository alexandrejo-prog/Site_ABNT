// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { saveAsMock } = vi.hoisted(() => ({
  saveAsMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({ id: "mock-template", generate: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })) })),
}));

import App from "../src/App";

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as unknown as Storage;
}

describe("fluxo de autosave e restauração (App)", () => {
  beforeEach(() => {
    saveAsMock.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    try {
      if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
    } catch {
      // ignora
    }
  });

  it("preenche campos e salva rascunho no localStorage após debounce", async () => {
    const storage = createStorage();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Tipo de trabalho"), { target: { value: "artigo" } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Resumo de teste" } });

    act(() => { vi.advanceTimersByTime(850); });

    const raw = storage.getItem("site-abnt:draft:v1");
    expect(raw).toBeTruthy();
    const draft = JSON.parse(raw!);
    expect(draft.fields.title).toBe("Título de teste");
    expect(draft.fields.author).toBe("Maria Silva");
    expect(draft.editorText).toBe("");

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("restaura rascunho quando estado inicial está vazio", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Título restaurado", author: "Autor restaurado", workType: "artigo" },
      editorText: "Texto restaurado.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);

    expect(screen.getByLabelText("Título")).toHaveValue("Título restaurado");
    expect(screen.getByLabelText("Autor")).toHaveValue("Autor restaurado");

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("não restaura rascunho por cima de dados já preenchidos", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Título antigo", author: "Autor antigo", workType: "artigo" },
      editorText: "Texto antigo.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Tipo de trabalho"), { target: { value: "dissertacao" } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título novo" } });

    expect(screen.getByLabelText("Título")).toHaveValue("Título novo");
    expect(screen.getByLabelText("Tipo de trabalho")).toHaveValue("dissertacao");

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("clique em Limpar rascunho remove localStorage imediatamente", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Titulo", author: "Autor", workType: "artigo" },
      editorText: "Texto salvo.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);
    expect(screen.getByRole("button", { name: /limpar rascunho/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpar rascunho/i }));

    expect(storage.getItem("site-abnt:draft:v1")).toBeNull();

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("clique em Limpar rascunho atualiza UI imediatamente", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Titulo", author: "Autor", workType: "artigo" },
      editorText: "Texto salvo.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /limpar rascunho/i }));

    expect(screen.getByText("Rascunho local removido")).toBeInTheDocument();
    expect(screen.queryByText("Rascunho salvo localmente")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /limpar rascunho/i })).not.toBeInTheDocument();

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("autosave nao recria rascunho sem nova edicao depois de limpar", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Titulo", author: "Autor", workType: "artigo" },
      editorText: "Texto salvo.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /limpar rascunho/i }));
    act(() => { vi.advanceTimersByTime(1000); });

    expect(storage.getItem("site-abnt:draft:v1")).toBeNull();

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("nova edicao depois de limpar salva novo rascunho", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Titulo", author: "Autor", workType: "artigo" },
      editorText: "Texto salvo.",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /limpar rascunho/i }));
    fireEvent.change(document.getElementById("title") as HTMLInputElement, { target: { value: "Titulo novo" } });
    act(() => { vi.advanceTimersByTime(850); });

    const raw = storage.getItem("site-abnt:draft:v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).fields.title).toBe("Titulo novo");

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("exibe status de rascunho restaurado", async () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({
      fields: { title: "Título restaurado", author: "Autor restaurado", workType: "artigo" },
      editorText: "",
      references: [],
      workType: "artigo",
      updatedAt: new Date().toISOString(),
    }));
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

    render(<App />);
    expect(screen.getByText("Rascunho restaurado")).toBeInTheDocument();

    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });
});
