// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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
import { emptyAcademicFields, emptyConfidenceMap } from "../src/ufla-rules";

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

function getGenerateAnywayCheckbox(): HTMLInputElement {
  return screen.getByRole("checkbox", { name: /Gerar rascunho/i }) as HTMLInputElement;
}

describe("fluxo real de bloqueio de geração (App)", () => {
  beforeEach(() => {
    generateMock.mockClear();
    importDocumentFileMock.mockReset();
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
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
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
    await user.type(getTitleInput(), "Título de teste");
    await user.type(screen.getByLabelText("Autor"), "Maria Silva");
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
  });

  it("nomeia DOCX pelo tipo selecionado e título atual", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "tese");
    fireEvent.change(getTitleInput(), { target: { value: "Documento ideal de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Administração" } });
    fireEvent.change(screen.getByLabelText("Orientador"), { target: { value: "Prof. Dr. João da Silva" } });
    fireEvent.click(getGenerateAnywayCheckbox());
    await user.click(getButtonByText(/Gerar DOCX/));

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(saveAsMock.mock.calls[0][1]).toBe("tese-documento-ideal-de-teste.docx");
  });

  it("nomeia DOCX importado pelo arquivo importado, nao pelo titulo antigo", async () => {
    const user = userEvent.setup();
    importDocumentFileMock.mockResolvedValue({
      text: "Texto importado.",
      editorText: "# 1 Introducao\nTexto importado.",
      fields: {
        ...emptyAcademicFields(),
        workType: "artigo",
        title: "Titulo importado",
        author: "Maria Silva",
        resumo: "Resumo importado.",
        referencias: "SILVA, M. Texto. Lavras: UFLA, 2024.",
      },
      confidence: emptyConfidenceMap(),
      messages: [],
      blocks: [],
    });

    render(<App />);
    fireEvent.change(getTitleInput(), { target: { value: "Métricas, trabalho e saúde..." } });

    const file = new File(["docx"], "documento_ideal_teste_tipos_trabalho_ufla_abnt.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(screen.getByLabelText("Importar"), file);
    await screen.findByText(/Metadados anteriores foram substituídos/);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "tese");
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Administração" } });
    fireEvent.change(screen.getByLabelText("Orientador"), { target: { value: "Prof. Dr. João da Silva" } });
    fireEvent.click(getGenerateAnywayCheckbox());
    await user.click(getButtonByText(/Gerar DOCX/));

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(saveAsMock.mock.calls[0][1]).toBe("tese-documento-ideal-teste-tipos-trabalho-ufla-abnt.docx");
  });

  it("placeholder natural em título impede a geração", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "grau acadêmico correspondente" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/pendência|erro/i).length).toBeGreaterThan(0);
  });

  it("placeholder natural bloqueia mesmo com gerar mesmo com pendências", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "grau acadêmico correspondente" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.click(getGenerateAnywayCheckbox());
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/pendência|erro/i).length).toBeGreaterThan(0);
  });

  it("conflito programa/área não bloqueia rascunho com pendências", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Educação Científica e Ambiental" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Este trabalho apresenta análise no programa de pós-graduação em Engenharia de Sistemas e Automação." } });
    fireEvent.click(getGenerateAnywayCheckbox());
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
  });

  it("artigo simples nao exibe conflito programa/area no diagnostico", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Educação Científica e Ambiental" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Este trabalho apresenta análise no programa de pós-graduação em Engenharia de Sistemas e Automação." } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(screen.queryByText("Há conflito entre programa/área informado e texto do documento.")).not.toBeInTheDocument();
  });

  it("trocar de monografia para artigo simples remove erro de curso imediatamente", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "monografia");
    expect(screen.getByText("Informe o curso da monografia antes de gerar o DOCX.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    expect(screen.queryByText("Informe o curso da monografia antes de gerar o DOCX.")).not.toBeInTheDocument();
  });

  it("atualiza natureza generica de tese quando o programa muda", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "tese");
    fireEvent.change(screen.getByLabelText("Natureza do trabalho"), {
      target: { value: "Natureza do trabalho: Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis." },
    });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Administração" } });

    expect((screen.getByLabelText("Natureza do trabalho") as HTMLTextAreaElement).value).toContain("Tese apresentada à Universidade Federal de Lavras");
    expect((screen.getByLabelText("Natureza do trabalho") as HTMLTextAreaElement).value).toContain("Programa de Pós-Graduação em Administração");
  });

  it("rascunho gera mesmo com indicadores de impacto ausentes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Orientador"), { target: { value: "Orientador Teste" } });
    fireEvent.click(getGenerateAnywayCheckbox());
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
  });

  it("rascunho gera mesmo com aviso de imagem", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Resumo sem imagem." } });
    fireEvent.click(getGenerateAnywayCheckbox());
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
  });

  it("botão Gerar DOCX não fica disabled por pendências revisáveis", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Educação Científica e Ambiental" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Este trabalho apresenta análise no programa de pós-graduação em Engenharia de Sistemas e Automação." } });
    const button = getButtonByText(/Gerar DOCX/);
    expect(button.disabled).toBe(false);
  });
});
