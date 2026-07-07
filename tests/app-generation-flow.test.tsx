// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { generateMock, saveAsMock } = vi.hoisted(() => ({
  generateMock: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  saveAsMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({ id: "mock-template", generate: generateMock })),
}));

import App from "../src/App";

function getButtonByText(text: RegExp): HTMLButtonElement {
  const button = screen.getAllByRole("button").find((el) => text.test(el.textContent ?? ""));
  if (!button) throw new Error(`Botão não encontrado: ${text}`);
  return button as HTMLButtonElement;
}

describe("fluxo real de bloqueio de geração (App)", () => {
  beforeEach(() => {
    generateMock.mockClear();
    saveAsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("formulário vazio impede a geração do DOCX", () => {
    render(<App />);
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/pendência|erro/i).length).toBeGreaterThan(0);
  });

  it("dissertação sem orientador impede a geração", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it("placeholder de rascunho impede a geração", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "[PREENCHER: resumo]" } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it("gera rascunho de artigo simples com título e autor preenchidos", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    await user.type(screen.getByLabelText("Título"), "Título de teste");
    await user.type(screen.getByLabelText("Autor"), "Maria Silva");
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
  });

  it("placeholder natural em título impede a geração", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "grau acadêmico correspondente" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/pendência|erro/i).length).toBeGreaterThan(0);
  });
});
