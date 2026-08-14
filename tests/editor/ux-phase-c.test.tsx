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

describe("Fase C — guia de primeiro uso (PROD-01)", () => {
  afterEach(() => {
    cleanup();
    try {
      globalThis.localStorage.clear();
    } catch {
      // ignora
    }
  });

  it("exibe o guia no primeiro acesso", () => {
    render(<App />);
    expect(screen.getByText("Comece por aqui")).toBeInTheDocument();
    const items = document.querySelectorAll(".first-use-guide-steps > li");
    expect(items.length).toBe(3);
  });

  it("'Entendi, começar' descarta o guia e grava no localStorage", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Entendi, começar" }));
    expect(screen.queryByText("Comece por aqui")).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem("site-abnt:onboarding:first-use-v1")).toBe("1");
  });

  it("não reaparece na próxima montagem quando descartado", () => {
    globalThis.localStorage.setItem("site-abnt:onboarding:first-use-v1", "1");
    render(<App />);
    expect(screen.queryByText("Comece por aqui")).not.toBeInTheDocument();
  });

  it("alterna o passo ativo em 'Próximo passo'", () => {
    render(<App />);
    const first = document.querySelectorAll(".first-use-guide-steps > li")[0];
    expect(first?.className).toContain("is-active");
    fireEvent.click(screen.getByRole("button", { name: "Próximo passo" }));
    const second = document.querySelectorAll(".first-use-guide-steps > li")[1];
    expect(second?.className).toContain("is-active");
  });
});