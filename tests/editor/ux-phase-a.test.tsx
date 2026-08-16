// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within, waitFor } from "@testing-library/react";

const { saveAsMock, generateMock, importDocumentFileMock } = vi.hoisted(() => ({
  saveAsMock: vi.fn(),
  generateMock: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  importDocumentFileMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../../src/import-docx", () => ({ importDocumentFile: importDocumentFileMock }));
vi.mock("../../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({ id: "mock-template", generate: generateMock })),
}));

import App from "../../src/App";

function getButtonByText(text: RegExp): HTMLButtonElement {
  const button = screen.getAllByRole("button").find((el) => text.test(el.textContent ?? ""));
  if (!button) throw new Error(`Botão não encontrado: ${text}`);
  return button as HTMLButtonElement;
}

function getField(id: string): HTMLInputElement {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Campo ${id} nao encontrado.`);
  return input;
}

function getAuthorInput(): HTMLInputElement {
  return getField("author");
}

describe("Fase A — progresso, navegação de pendências e autosave", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    try {
      if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
    } catch {
      // ignora
    }
  });

  it("UX-01: mapa de progresso é exibido com as 5 etapas", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: /progresso do fluxo/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("listitem").length).toBe(5);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
  });

  it("UX-02: erro essencial oferece botão Corrigir que foca o campo", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Tipo de trabalho"), { target: { value: "dissertacao" } });
    fireEvent.click(getButtonByText(/Validar trabalho/));

    const authorError = screen.getByText(/Informe o autor do trabalho/i);
    const alertBox = authorError.closest(".issue");
    expect(alertBox).not.toBeNull();
    const corrigir = within(alertBox as HTMLElement).getByRole("button", { name: /Corrigir/i });
    fireEvent.click(corrigir);

    expect(document.activeElement).toBe(getAuthorInput());
    expect(alertBox!).toContainElement(corrigir);
  });

  it("UX-03: autosave exibe hora do último salvamento", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título de teste" } });
    fireEvent.change(getAuthorInput(), { target: { value: "Maria Silva" } });

    act(() => { vi.advanceTimersByTime(900); });

    const saved = screen.getByText(/Rascunho salvo às/i);
    expect(saved.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("TEC-03: falha de geração mostra mensagem amigável", async () => {
    render(<App />);
    generateMock.mockRejectedValueOnce(new Error("The file cannot be opened because it is corrupt"));
    fireEvent.change(screen.getByLabelText("Tipo de trabalho"), { target: { value: "artigo" } });
    fireEvent.change(getField("title"), { target: { value: "Título de teste" } });
    fireEvent.change(getAuthorInput(), { target: { value: "Maria Silva" } });

    fireEvent.click(getButtonByText(/Gerar DOCX/));

    await waitFor(() => {
      const statusLine = document.querySelector(".status-line");
      expect(statusLine?.textContent ?? "").toMatch(/não foi possível montar o arquivo DOCX/i);
    });
  });
});