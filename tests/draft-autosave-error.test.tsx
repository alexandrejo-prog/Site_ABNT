// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

function failingStorage(setItemThrows: Error): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: () => { throw setItemThrows; },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as unknown as Storage;
}

describe("TEC-02 — autosave com falha de storage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete (window as any).__fakeLocalStorage;
  });

  it("mostra feedback claro quando o localStorage rejeita a gravação por quota", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => failingStorage(new DOMException("Quota exceeded", "QuotaExceededError")),
    });
    vi.useFakeTimers();

    render(<App />);
    const title = document.getElementById("title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Título de teste" } });

    act(() => { vi.advanceTimersByTime(900); });

    expect(screen.getByText(/armazenamento local deste navegador está cheio/i)).toBeInTheDocument();
  });

  it("continua funcionando (sem exceção para a UI) quando o storage está indisponível", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => failingStorage(new DOMException("denied", "SecurityError")),
    });
    vi.useFakeTimers();

    render(<App />);
    const title = document.getElementById("title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Título de teste" } });

    act(() => { vi.advanceTimersByTime(900); });

    expect(screen.getByText(/armazenamento local está indisponível/i)).toBeInTheDocument();
  });
});