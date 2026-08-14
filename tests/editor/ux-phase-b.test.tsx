// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

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

describe("Fase B — selo de saída, guia rápido e exemplo demonstrativo", () => {
  afterEach(() => {
    cleanup();
    try {
      if (typeof globalThis.localStorage !== "undefined") globalThis.localStorage.clear();
    } catch {
      // ignora
    }
  });

  it("UX-04: selo de saída registrado sem erros (bloqueado)", () => {
    render(<App />);
    expect(screen.getByText("Exportação bloqueada")).toBeInTheDocument();
  });

  it("UX-04: ao cumprir requisitos, selo indica versão para revisão", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Tipo de trabalho"), { target: { value: "artigo" } });
    fireEvent.change(document.getElementById("title") as HTMLInputElement, { target: { value: "Título" } });
    fireEvent.change(document.getElementById("author") as HTMLInputElement, { target: { value: "Maria Silva" } });
    fireEvent.change(document.getElementById("resumo") as HTMLTextAreaElement, { target: { value: "Resumo de teste." } });
    fireEvent.change(document.getElementById("referencias") as HTMLTextAreaElement, { target: { value: "SILVA. Livro. Lavras, 2020." } });
    expect(screen.getByText("Versão para revisão")).toBeInTheDocument();
  });

  it("OP-02: guia rápido com 5 passos colapsável está presente", () => {
    render(<App />);
    const summary = screen.getByText(/Guia rápido de uso/i);
    expect(summary).toBeInTheDocument();
    fireEvent.click(summary);
    const items = document.querySelectorAll(".quick-guide ol > li");
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("PROD-02: carregar exemplo preenche título no formulário e no editor", () => {
    render(<App />);
    fireEvent.click(getButtonByText(/Carregar exemplo demonstrativo/i));
    const title = document.getElementById("title") as HTMLInputElement;
    expect(title.value.length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Autor")).toHaveValue("Maria da Silva");
  });
});