// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { generateMock, saveAsMock, importAcademicFileMock } = vi.hoisted(() => ({
  generateMock: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  saveAsMock: vi.fn(),
  importAcademicFileMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({ id: "mock-template", generate: generateMock })),
}));
vi.mock("../src/import-file-router", () => ({
  detectImportableFileKind: vi.fn(() => "pdf"),
  importAcademicFile: importAcademicFileMock,
}));

import App from "../src/App";

function getGenerateAnywayCheckbox(): HTMLInputElement {
  return screen.getByRole("checkbox", { name: /Gerar rascunho/i }) as HTMLInputElement;
}

function getButtonByText(text: RegExp): HTMLButtonElement {
  const button = screen.getAllByRole("button").find((el) => text.test(el.textContent ?? ""));
  if (!button) throw new Error(`Botão não encontrado: ${text}`);
  return button as HTMLButtonElement;
}

const PDF_DOCUMENT = {
  kind: "pdf" as const,
  document: {
    source: { fileName: "Andrade_2025.pdf", pageCount: 139 },
    pages: [
      { pageNumber: 1, width: 800, height: 1000, items: [], normalizedText: "Texto extraido de exemplo no rascunho de PDF." },
    ],
    blocks: [],
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  },
};

describe("fluxo de rascunho DOCX a partir de PDF importado", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("PDF importado com texto permite gerar rascunho quando 'Gerar rascunho mesmo com pendências' está marcado", async () => {
    const user = userEvent.setup();
    importAcademicFileMock.mockResolvedValue(PDF_DOCUMENT);
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "monografia");

    const file = new File(["pdf-bytes"], "Andrade_2025.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    await screen.findByText(/ainda não entram no DOCX/);
    expect(screen.queryByText(/Integração com geração de DOCX ainda é experimental/)).toBeNull();

    fireEvent.click(getGenerateAnywayCheckbox());
    fireEvent.click(getButtonByText(/Gerar DOCX/));

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    // PDF usa exclusivamente o modo pdf-text-draft (exportador dedicado),
    // não o template UFLA mockado.
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("PDF importado sem marcar o rascunho fica bloqueado por pendências", async () => {
    const user = userEvent.setup();
    importAcademicFileMock.mockResolvedValue(PDF_DOCUMENT);
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "monografia");

    const file = new File(["pdf-bytes"], "Andrade_2025.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    await screen.findByText(/ainda não entram no DOCX/);

    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it("UI informa que recortes visuais não são inseridos automaticamente no DOCX", async () => {
    const user = userEvent.setup();
    importAcademicFileMock.mockResolvedValue(PDF_DOCUMENT);
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "monografia");

    const file = new File(["pdf-bytes"], "Andrade_2025.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    const status = await screen.findByText(/ainda não entram no DOCX/);
    expect(status.textContent).toMatch(/revise|revisão/i);
    expect(status.textContent).not.toMatch(/100%|perfeita|perfeito/i);
  });
});
