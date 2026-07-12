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

function pdfDiagnosticResult(fileName = "diagnostico.pdf") {
  return {
    sourceKind: "pdf",
    documentMode: "pdf-diagnostic",
    text: "",
    editorText: "",
    fields: emptyAcademicFields(),
    confidence: emptyConfidenceMap(),
    messages: ["O PDF foi lido para diagnóstico. A conversão para DOCX ainda não está habilitada nesta etapa."],
    blocks: [],
    importedImages: [],
    importedTables: [],
    pdfDiagnostic: {
      fileName,
      pageCount: 139,
      pages: [
        { pageNumber: 1, rawText: "Texto bruto da pagina um.", textItemCount: 7 },
        { pageNumber: 2, rawText: "Texto bruto da pagina dois.", textItemCount: 8 },
      ],
      warnings: ["O PDF foi lido para diagnóstico. A conversão para DOCX ainda não está habilitada nesta etapa."],
    },
  };
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
    await user.upload(screen.getByLabelText("Importar arquivo"), file);
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

  it("projeto de pesquisa sem resumo impede a geracao", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "projeto_pesquisa");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Educação Científica e Ambiental" } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it("projeto de pesquisa sem abstract impede a geracao", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "projeto_pesquisa");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "Educação Científica e Ambiental" } });
    fireEvent.change(screen.getByLabelText("Resumo"), { target: { value: "Resumo do trabalho." } });
    fireEvent.click(getButtonByText(/Gerar DOCX/));
    expect(saveAsMock).not.toHaveBeenCalled();
  });

  it("importa arquivo com nome de outro tipo quando projeto_pesquisa esta selecionado e avisa", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "projeto_pesquisa");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });

    importDocumentFileMock.mockResolvedValue({
      text: "Texto importado.",
      editorText: "# 1 Introdução\nTexto importado.",
      fields: {
        ...emptyAcademicFields(),
        workType: "projeto_pesquisa",
        title: "Título importado",
        author: "Maria Silva",
        resumo: "Resumo importado.",
        abstractText: "Abstract importado.",
        referencias: "SILVA, M. Texto. Lavras: UFLA, 2024.",
      },
      confidence: emptyConfidenceMap(),
      messages: [],
      blocks: [],
    });

    const file = new File(["docx"], "desenvolvimento-de-software-ufla.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);
    await screen.findByText(/O tipo atual é Projeto de pesquisa. O nome do arquivo importado não será usado para alterar o modelo./);
  });

  it("importar PDF preserva campos e editor, oculta interface academica e restaura ao remover", async () => {
    const user = userEvent.setup();
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult("andrade.pdf"));

    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    fireEvent.change(getTitleInput(), { target: { value: "Título preservado" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Introdução"), { target: { value: "Texto acadêmico preservado." } });
    await user.click(getButtonByText(/Montar rascunho/));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Editor do texto principal/i }).textContent).toContain("Texto acadêmico preservado."));

    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "andrade.pdf", { type: "application/pdf" }));

    expect(await screen.findByText(/Leitura de PDF/i)).toBeInTheDocument();
    expect(screen.getByText("139")).toBeInTheDocument();
    expect(screen.getByText(/Texto bruto da pagina um/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de trabalho")).not.toBeInTheDocument();
    expect(screen.queryByText("Validar trabalho")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gerar DOCX/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Editor do texto principal/i })).not.toBeInTheDocument();
    expect(generateMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Remover importa/i }));

    expect(screen.queryByText(/Leitura de PDF/i)).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Título preservado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria Silva")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Editor do texto principal/i }).textContent).toContain("Texto acadêmico preservado."));
  });

  it("PDF nao chama clearDraft nem altera workType", async () => {
    const user = userEvent.setup();
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult());

    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    window.localStorage.setItem("site-abnt:draft:v3", JSON.stringify({
      fields: { title: "Rascunho" },
      editorText: "Texto salvo",
      updatedAt: new Date().toISOString(),
    }));
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "diagnostico.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/Leitura de PDF/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("site-abnt:draft:v3")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /Remover importa/i }));

    expect(screen.queryByText(/Leitura de PDF/i)).not.toBeInTheDocument();
    expect((screen.getByLabelText("Tipo de trabalho") as HTMLSelectElement).value).toBe("dissertacao");
  });

  it("importar DOCX depois de PDF volta ao fluxo estruturado normal", async () => {
    const user = userEvent.setup();
    importDocumentFileMock
      .mockResolvedValueOnce({
        ...pdfDiagnosticResult(),
      })
      .mockResolvedValueOnce({
        sourceKind: "docx",
        documentMode: "ufla-structured",
        text: "Texto importado.",
        editorText: "# 1 Introducao\nTexto importado.",
        fields: {
          ...emptyAcademicFields(),
          workType: "artigo",
          title: "Titulo DOCX",
          author: "Maria Silva",
        },
        confidence: emptyConfidenceMap(),
        messages: [],
        blocks: [],
        importedImages: [],
        importedTables: [],
      });

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "diagnostico.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/Leitura de PDF/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["docx"], "normal.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    await screen.findByDisplayValue("Titulo DOCX");
    expect(screen.queryByText(/Leitura de PDF/i)).not.toBeInTheDocument();
    expect(getButtonByText(/Gerar DOCX/).disabled).toBe(false);
  });

  it("importar PDF depois de DOCX preserva dados importados, imagens e tabelas ao remover", async () => {
    const user = userEvent.setup();
    const importedImages = [{ id: "img-1", position: 1, status: "preserved" }];
    const importedTables = [{ id: "tbl-1", rows: [[{ text: "A" }]], rowCount: 1, columnCount: 1, position: 2, origin: "docx-table", status: "preserved" }];
    importDocumentFileMock
      .mockResolvedValueOnce({
        sourceKind: "docx",
        documentMode: "ufla-structured",
        text: "Texto importado.",
        editorText: "# 1 Introducao\nTexto importado.",
        fields: {
          ...emptyAcademicFields(),
          workType: "artigo",
          title: "Titulo DOCX",
          author: "Maria Silva",
        },
        confidence: emptyConfidenceMap(),
        messages: [],
        blocks: [],
        importedImages,
        importedTables,
      })
      .mockResolvedValueOnce(pdfDiagnosticResult("diagnostico.pdf"));

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["docx"], "normal.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    await screen.findByDisplayValue("Titulo DOCX");

    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "diagnostico.pdf", { type: "application/pdf" }));

    expect(await screen.findByText(/Leitura de PDF/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Titulo DOCX")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remover importa/i }));

    expect(await screen.findByDisplayValue("Titulo DOCX")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria Silva")).toBeInTheDocument();
    fireEvent.click(getGenerateAnywayCheckbox());
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    const generationCalls = generateMock.mock.calls as unknown as Array<[{ importedImages?: unknown; importedTables?: unknown }]>;
    const savedFileName = saveAsMock.mock.calls[0]?.[1];
    const generationInput = generationCalls[0]?.[0];
    expect(generationInput).toBeDefined();
    expect(savedFileName).toBeDefined();
    expect(generationInput?.importedImages).toEqual(importedImages);
    expect(generationInput?.importedTables).toEqual(importedTables);
    expect(savedFileName).not.toContain("diagnostico");
  });

  it("mostra aviso de rascunho editável para dissertação", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    expect(screen.getByText(/Use este modelo para rascunho editável/)).toBeInTheDocument();
  });

  it("mostra aviso de rascunho editável para tese", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "tese");
    expect(screen.getByText(/Use este modelo para rascunho editável/)).toBeInTheDocument();
  });

  it("mensagem pós-geração orienta atualizar sumário no Word/LibreOffice quando há pendências", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "dissertacao");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Programa"), { target: { value: "ECA" } });
    fireEvent.change(screen.getByLabelText("Orientador"), { target: { value: "[nome do orientador]" } });
    fireEvent.click(getGenerateAnywayCheckbox());
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Rascunho gerado. Abra no Word\/LibreOffice/)).toBeInTheDocument();
  });

  it("mensagem pós-geração menciona sumário vazio esperado quando não há pendências", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/DOCX gerado. Se o sumário aparecer vazio/)).toBeInTheDocument();
  });

  it("editor contínuo avisa visualização contínua sem poluir o editor", () => {
    render(<App />);
    expect(screen.getByText(/Editor em visualização contínua/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ir para a página visual anterior/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ir para a próxima página visual/i })).not.toBeInTheDocument();
    const editor = screen.getByRole("textbox", { name: /Editor do texto principal/i });
    expect(editor.textContent).not.toContain("Editor em visualização contínua");
    expect(editor.textContent).not.toContain("Página anterior");
    expect(editor.textContent).not.toContain("Próxima página");
  });

  it("gera DOCX sem artefatos da paginação visual", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(getTitleInput(), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });
    await user.click(getButtonByText(/Gerar DOCX/));
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const content = await blob.text();
    expect(content).not.toContain("Editor em visualização contínua");
    expect(content).not.toContain("Paginação visual aproximada");
    expect(content).not.toContain("Página anterior");
    expect(content).not.toContain("Próxima página");
    expect(content).not.toContain("Página 1 de");
    expect(content).not.toContain("[PAGE]");
    expect(content).not.toContain("[QUEBRA DE PÁGINA]");
  });
});
