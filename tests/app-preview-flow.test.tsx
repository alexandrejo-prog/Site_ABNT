// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { generateMock, importDocumentFileMock, saveAsMock } = vi.hoisted(() => ({
  generateMock: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  importDocumentFileMock: vi.fn(),
  saveAsMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../src/import-docx", () => ({ importDocumentFile: importDocumentFileMock }));
vi.mock("../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({ id: "mock-template", generate: generateMock })),
}));

import App from "../src/App";

function getButtonByText(text: RegExp): HTMLButtonElement {
  const button = screen.getAllByRole("button").find((el) => text.test(el.textContent ?? ""));
  if (!button) throw new Error(`Botão não encontrado: ${text}`);
  return button as HTMLButtonElement;
}

function getTitleInput(): HTMLInputElement {
  const input = document.getElementById("title");
  if (!(input instanceof HTMLInputElement)) throw new Error("Campo title nao encontrado.");
  return input;
}

describe("integração tela única + preview (R8)", () => {
  beforeEach(() => {
    generateMock.mockClear();
    importDocumentFileMock.mockReset();
    saveAsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("botão Visualizar abre o modal de pré-visualização e o botão fechar o encerra", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(getButtonByText(/Visualizar/));

    const dialog = await screen.findByRole("dialog", { name: /Pré-visualização do documento/i });
    expect(dialog).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Fechar pré-visualização/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Gerar DOCX no modal gera o documento com o título editado na tela", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    await user.type(getTitleInput(), "Título de teste");
    await user.type(screen.getByLabelText("Autor"), "Maria Silva");

    await user.click(getButtonByText(/Visualizar/));
    const dialog = await screen.findByRole("dialog", { name: /Pré-visualização do documento/i });

    const generateButton = within(dialog).getByRole("button", { name: /Gerar DOCX$/ });
    await user.click(generateButton);

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("edição no modal comita o texto para o documento e fecha", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    await user.type(getTitleInput(), "Título de teste");
    await user.type(screen.getByLabelText("Autor"), "Maria Silva");

    await user.click(getButtonByText(/Visualizar/));
    const dialog = await screen.findByRole("dialog", { name: /Pré-visualização do documento/i });

    await user.click(within(dialog).getByRole("button", { name: /Editar/ }));

    const editor = within(dialog).getByLabelText(/Editor inline do texto/i);
    fireEvent.input(editor, { target: { innerText: "Texto editado no preview." } });

    await user.click(within(dialog).getByRole("button", { name: /Fechar pré-visualização/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(generateMock).not.toHaveBeenCalled();
  });
});
