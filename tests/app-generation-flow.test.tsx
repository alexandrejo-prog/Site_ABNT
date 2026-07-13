// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { generateMock, importDocumentFileMock, pdfDraftBuildMock, pdfDraftFileNameMock, pdfDraftValidateMock, saveAsMock, templateForWorkTypeMock } = vi.hoisted(() => ({
  generateMock: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  importDocumentFileMock: vi.fn(),
  pdfDraftBuildMock: vi.fn(async () => new Blob(["pdf-text-draft"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  pdfDraftFileNameMock: vi.fn(() => "andrade-rascunho-textual.docx"),
  pdfDraftValidateMock: vi.fn(() => ({ canExport: true, blockers: [] as string[], warnings: ["Há blocos visuais não resolvidos que serão representados por marcadores."] as string[] })),
  saveAsMock: vi.fn(),
  templateForWorkTypeMock: vi.fn(() => ({ id: "mock-template", generate: generateMock })),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../src/import-docx", () => ({ importDocumentFile: importDocumentFileMock }));
vi.mock("../src/document-template", () => ({
  templateForWorkType: templateForWorkTypeMock,
}));
vi.mock("../src/export-pdf-text-draft-docx", () => ({
  buildPdfTextDraftDocxBlob: pdfDraftBuildMock,
  pdfTextDraftFileName: pdfDraftFileNameMock,
  validatePdfTextDraftExport: pdfDraftValidateMock,
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
      pretextual: {
        cover: {
          institution: "UNIVERSIDADE FEDERAL DE LAVRAS",
          author: "Maria Silva",
          title: "Titulo importado do PDF",
          city: "Lavras - MG",
          year: "2025",
          confidence: "high",
          sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
        },
        titlePage: {
          author: "Maria Silva",
          title: "Titulo importado do PDF",
          natureText: "Dissertacao apresentada a Universidade Federal de Lavras.",
          program: "Programa de Pos-Graduacao",
          advisor: "Orientador: Prof. Teste",
          city: "Lavras - MG",
          year: "2025",
          confidence: "high",
          sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
        },
        resumo: {
          title: "RESUMO",
          text: "Resumo reconstruido.",
          keywordsLabel: "Palavras-chave:",
          keywords: "PDF. Teste",
          pageNumber: 1,
          confidence: "high",
          sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
        },
        abstract: {
          title: "ABSTRACT",
          text: "Abstract rebuilt.",
          keywordsLabel: "Keywords:",
          keywords: "PDF. Test",
          pageNumber: 1,
          confidence: "high",
          sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
        },
        warnings: [],
      },
      bodyStart: { found: true, pageNumber: 2, lineIndex: 0, text: "1 INTRODUÇÃO", matchType: "numbered-introduction" },
      pages: [
        {
          pageNumber: 1,
          width: 595,
          height: 842,
          rotation: 0,
          rawText: "Texto bruto da pagina um.",
          textItemCount: 7,
          items: [{ text: "Texto", x: 72, y: 80, width: 40, height: 12 }],
          lines: [{ pageNumber: 1, text: "Texto bruto da pagina um.", items: [], left: 72, right: 220, top: 80, bottom: 92, height: 12 }],
        },
        {
          pageNumber: 2,
          width: 595,
          height: 842,
          rotation: 0,
          rawText: "1 INTRODUÇÃO Texto bruto da pagina dois.",
          textItemCount: 8,
          items: [{ text: "1 INTRODUÇÃO", x: 72, y: 80, width: 120, height: 12 }],
          lines: [
            { pageNumber: 2, text: "1 INTRODUÇÃO", items: [], left: 72, right: 192, top: 80, bottom: 92, height: 12 },
            { pageNumber: 2, text: "Texto bruto da pagina dois.", items: [], left: 72, right: 240, top: 110, bottom: 122, height: 12 },
          ],
        },
      ],
      reconstruction: {
        bodyStart: { found: true, pageNumber: 2, lineIndex: 0, text: "1 INTRODUÇÃO", matchType: "numbered-introduction", reason: "Título de introdução seguido por texto corrido." },
        ignoredLines: [{ pageNumber: 2, lineIndex: 2, role: "page-number", text: "2" }],
        bodyLayoutMetrics: {
          dominantLeft: 72,
          dominantRight: 500,
          medianLineHeight: 12,
          medianLineGap: 6,
          probableFirstLineIndent: 36,
          probableBodyFontHeight: 12,
          confidence: "medium",
        },
        layoutRegions: [
          {
            id: "layout-1-1",
            pageStart: 1,
            pageEnd: 1,
            startLineIndex: 0,
            endLineIndex: 0,
            kind: "quadro",
            caption: "Quadro 1 - Teste",
            source: "Fonte: teste.",
            confidence: "high",
            reasons: ["Legenda visual identificada."],
            logicalVisualId: "quadro-1",
          },
        ],
        hyphenation: [
          {
            pageNumber: 2,
            lineIndex: 1,
            originalEnd: "administra-",
            nextStart: "ção",
            action: "joined-without-hyphen",
            reason: "Quebra de palavra recomposta com proximo fragmento minusculo.",
          },
        ],
        alerts: ["Quantidade elevada de paragrafos de uma linha."],
        statistics: {
          paragraphCount: 1,
          headingCount: 1,
          listItemCount: 0,
          captionCount: 0,
          sourceCount: 0,
          unresolvedCount: 1,
          removedPageNumberCount: 1,
          removedHeaderCount: 0,
          removedFooterCount: 0,
          averageLinesPerParagraph: 2,
          medianLinesPerParagraph: 2,
          singleLineParagraphCount: 0,
          multiPageParagraphCount: 1,
          lowConfidenceBlockCount: 1,
          uncertainHyphenationCount: 0,
          layoutRegionCount: 1,
          mixedCaseHeadingCount: 0,
          combinedHeadingCount: 0,
        },
        blocks: [
          {
            type: "heading",
            text: "1 INTRODUÇÃO",
            pageStart: 2,
            pageEnd: 2,
            sourceLines: [{ pageNumber: 2, lineIndex: 0 }],
            confidence: "high",
            reasons: ["Padrão estrutural de título detectado."],
          },
          {
            type: "paragraph",
            text: "Texto bruto da pagina dois.",
            pageStart: 2,
            pageEnd: 3,
            sourceLines: [{ pageNumber: 2, lineIndex: 1 }, { pageNumber: 3, lineIndex: 0 }],
            confidence: "medium",
            reasons: ["Linhas visuais compatíveis foram unidas como parágrafo diagnóstico."],
          },
          {
            type: "unresolved",
            text: "Conteúdo de quadro sensível a layout.",
            pageStart: 1,
            pageEnd: 1,
            sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
            confidence: "low",
            reasons: ["Conteúdo marcado como sensível a layout; não foi convertido em parágrafo."],
            layoutRegionId: "layout-1-1",
          },
        ],
      },
      warnings: ["O PDF foi lido para diagnóstico. A conversão para DOCX ainda não está habilitada nesta etapa."],
    },
  };
}

describe("fluxo real de bloqueio de geração (App)", () => {
  beforeEach(() => {
    generateMock.mockClear();
    importDocumentFileMock.mockReset();
    pdfDraftBuildMock.mockClear();
    pdfDraftFileNameMock.mockClear();
    pdfDraftValidateMock.mockReset();
    pdfDraftValidateMock.mockReturnValue({ canExport: true, blockers: [] as string[], warnings: ["Há blocos visuais não resolvidos que serão representados por marcadores."] as string[] });
    saveAsMock.mockClear();
    templateForWorkTypeMock.mockClear();
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
    expect(screen.getAllByText(/Texto bruto da pagina um/)).toHaveLength(2);
    expect(screen.getAllByText("Linhas visuais").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Parágrafos")).toBeInTheDocument();
    expect(screen.getByText("Números de página ignorados")).toBeInTheDocument();
    expect(screen.getByText("Regiões de layout")).toBeInTheDocument();
    expect(screen.getByText("Métricas do corpo")).toBeInTheDocument();
    expect(screen.getByText("Alertas diagnósticos")).toBeInTheDocument();
    expect(screen.getByLabelText("Página do PDF")).toHaveValue(1);
    expect(screen.getByText(/As linhas abaixo representam linhas visuais do PDF/)).toBeInTheDocument();
    expect(screen.getByText(/Candidato de início do corpo: página 2/)).toBeInTheDocument();
    expect(screen.getByText(/Esta reconstrução é diagnóstica/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar rascunho textual DOCX/i })).toBeInTheDocument();
    expect(screen.getByText(/Este arquivo terá pré-textuais reconstruídos/)).toBeInTheDocument();
    expect(screen.getByText(/Há blocos visuais não resolvidos/)).toBeInTheDocument();
    expect(screen.queryByText(/O DOCX é rascunho técnico/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Texto bruto da pagina dois/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Blocos reconstruídos/i }));
    expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parágrafos" })).toBeInTheDocument();
    expect(screen.getByText("Regiões de layout da página")).toBeInTheDocument();
    expect(screen.getByText(/Conteúdo de quadro sensível a layout/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Página do PDF"), { target: { value: "2" } });
    expect(screen.getAllByText(/Texto bruto da pagina dois/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/páginas 2-3/)).toBeInTheDocument();
    expect(screen.getByText("Hifenização da página")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Parágrafos" }));
    expect(screen.queryByText(/Conteúdo de quadro sensível a layout/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Gerar rascunho textual DOCX/i }));
    await waitFor(() => expect(pdfDraftBuildMock).toHaveBeenCalledTimes(1));
    expect((pdfDraftBuildMock.mock.calls as unknown[][])[0][0]).toMatchObject({ sourceKind: "pdf", documentMode: "pdf-text-draft", fileName: "andrade.pdf" });
    expect(pdfDraftFileNameMock).toHaveBeenCalledWith("andrade.pdf");
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), "andrade-rascunho-textual.docx");
    expect(screen.getByText(/Rascunho textual DOCX gerado/)).toBeInTheDocument();
    expect(templateForWorkTypeMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Linhas visuais/i }));
    expect(screen.getByText("1 INTRODUÇÃO")).toBeInTheDocument();
    expect(screen.getAllByText(/Texto bruto da pagina dois/)).toHaveLength(2);
    expect(screen.queryByLabelText("Tipo de trabalho")).not.toBeInTheDocument();
    expect(screen.queryByText("Validar trabalho")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gerar DOCX/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Editor do texto principal/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remover importa/i }));

    expect(screen.queryByText(/Leitura de PDF/i)).not.toBeInTheDocument();
    expect(screen.getByText(/O DOCX é rascunho técnico/)).toBeInTheDocument();
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

  it("bloqueadores do rascunho textual PDF nao desabilitam o botao e aparecem visiveis", async () => {
    const user = userEvent.setup();
    pdfDraftValidateMock.mockReturnValue({
      canExport: false,
      blockers: ["Nenhum parágrafo reconstruído foi encontrado."] as string[],
      warnings: ["Há blocos de baixa confiança."] as string[],
    });
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult("bloqueado.pdf"));

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "bloqueado.pdf", { type: "application/pdf" }));

    const button = await screen.findByRole("button", { name: /Gerar rascunho textual DOCX/i });
    expect(button).not.toBeDisabled();
    expect(screen.getByText("Revise os bloqueadores abaixo")).toBeInTheDocument();
    expect(screen.getByText("Nenhum parágrafo reconstruído foi encontrado.")).toBeInTheDocument();
    expect(screen.getByText("Há blocos de baixa confiança.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de trabalho")).not.toBeInTheDocument();
    expect(pdfDraftBuildMock).not.toHaveBeenCalled();
    expect(templateForWorkTypeMock).not.toHaveBeenCalled();
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

  it("botao do rascunho textual PDF fica desabilitado somente durante geracao", async () => {
    const user = userEvent.setup();
    pdfDraftValidateMock.mockReturnValue({
      canExport: true,
      blockers: [] as string[],
      warnings: [] as string[],
    });
    pdfDraftBuildMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    });
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult("ok.pdf"));

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "ok.pdf", { type: "application/pdf" }));

    const button = await screen.findByRole("button", { name: /Gerar rascunho textual DOCX/i });
    expect(button).not.toBeDisabled();

    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent("Gerando...");

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("Gerar rascunho textual DOCX");
  });

  it("botao do rascunho textual PDF retorna a ficar habilitado apos erro", async () => {
    const user = userEvent.setup();
    pdfDraftValidateMock.mockReturnValue({
      canExport: true,
      blockers: [] as string[],
      warnings: [] as string[],
    });
    pdfDraftBuildMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      throw new Error("Falha simulada");
    });
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult("erro.pdf"));

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "erro.pdf", { type: "application/pdf" }));

    const button = await screen.findByRole("button", { name: /Gerar rascunho textual DOCX/i });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByText(/Não foi possível gerar o rascunho textual do PDF/)).toBeInTheDocument();
  });

  it("clique no botao com bloqueadores nao chama exportador e mantem botao habilitado", async () => {
    const user = userEvent.setup();
    pdfDraftValidateMock.mockReturnValue({
      canExport: false,
      blockers: ["Bloqueio 1", "Bloqueio 2"] as string[],
      warnings: [] as string[],
    });
    importDocumentFileMock.mockResolvedValue(pdfDiagnosticResult("bloqueado2.pdf"));

    render(<App />);
    await user.upload(screen.getByLabelText("Importar arquivo"), new File(["pdf"], "bloqueado2.pdf", { type: "application/pdf" }));

    const button = await screen.findByRole("button", { name: /Gerar rascunho textual DOCX/i });
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(pdfDraftBuildMock).not.toHaveBeenCalled();
    expect(saveAsMock).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
    expect(screen.getByText("Bloqueio 1")).toBeInTheDocument();
    expect(screen.getByText("Bloqueio 2")).toBeInTheDocument();
  });
});
