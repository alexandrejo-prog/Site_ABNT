// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PreviewModal } from "../../src/components/PreviewModal";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import type { AcademicFieldKey } from "../../src/ufla-rules";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    course: "Bacharelado em Biologia",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

const EDITOR_TEXT = "# 1 Introducao\nTexto comum.\n# 2 Metodologia\nTexto.\n";

type ModalOverrides = {
  onCommitEditorText?: Mock<(text: string) => void>;
  onUpdateField?: Mock<(key: AcademicFieldKey, value: string) => void>;
  onGenerate?: Mock<(overrides?: Partial<AcademicFields>) => void>;
  onClose?: Mock<() => void>;
};

function renderPreview(overrides: ModalOverrides = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onCommitEditorText = overrides.onCommitEditorText ?? vi.fn();
  const onUpdateField = overrides.onUpdateField ?? vi.fn();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  render(
    <PreviewModal
      input={{ fields: baseFields(), editorText: EDITOR_TEXT, importedImages: [], importedTables: [] }}
      onClose={onClose}
      onCommitEditorText={onCommitEditorText}
      onUpdateField={onUpdateField}
      onGenerate={onGenerate}
    />,
  );
  return { onClose, onCommitEditorText, onUpdateField, onGenerate };
}

describe("PreviewModal - abrir/fechar e ações", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => cleanup());

  it("Renderiza o modal com diálogo acessível", () => {
    renderPreview();
    expect(screen.getByRole("dialog", { name: /Pré-visualização/i })).toBeTruthy();
  });

  it("Exibe o conteúdo do documento no modo visualização", () => {
    renderPreview();
    expect(screen.getAllByText("MARIA SILVA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("QUALIDADE DO CAFE NO SUL DE MINAS").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 INTRODUCAO/i).length).toBeGreaterThan(0);
  });

  it("Botão Fechar dispara onClose", () => {
    const { onClose } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Botão Gerar DOCX dispara onGenerate e fecha o modal", () => {
    const { onGenerate } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Gerar DOCX/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("Escape fecha o modal", () => {
    const { onClose } = renderPreview();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Exibe contador de páginas simuladas", () => {
    renderPreview();
    expect(screen.getByText(/\d+ página\(s\) simulada/)).toBeTruthy();
  });
});

describe("PreviewModal - edição inline", () => {
  afterEach(() => cleanup());

  it("Botão Editar alterna para o modo de edição", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    expect(screen.getByRole("textbox", { name: /Editor inline/i })).toBeTruthy();
  });

  it("Edição do corpo grava o texto editado de volta", () => {
    const { onCommitEditorText } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const editor = screen.getByRole("textbox", { name: /Editor inline/i });
    editor.innerHTML = "<p>Novo texto editado</p>";
    fireEvent.input(editor);
    expect(onCommitEditorText).toHaveBeenCalled();
    expect(onCommitEditorText.mock.calls[0][0]).toContain("Novo texto editado");
  });

  it("Campos de metadados editáveis chamam onUpdateField", () => {
    const { onUpdateField } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const authorInput = screen.getByLabelText(/Autor\(a\):/);
    fireEvent.change(authorInput, { target: { value: "Novo Autor" } });
    fireEvent.blur(authorInput);
    expect(onUpdateField).toHaveBeenCalledWith("author", "Novo Autor");
  });

  it("Gerar DOCX passa os campos editados como overrides (P1: autor digitado no modal chega na geração)", () => {
    const { onGenerate } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const authorInput = screen.getByLabelText(/Autor\(a\):/);
    fireEvent.change(authorInput, { target: { value: "Ana Souza" } });
    const titleInput = screen.getByLabelText(/Título:/);
    fireEvent.change(titleInput, { target: { value: "Novo titulo" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar DOCX/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0]).toEqual({ author: "Ana Souza", title: "Novo titulo" });
  });

  it("Gerar DOCX sem edição não envia overrides de campos não tocados", () => {
    const { onGenerate } = renderPreview();
    fireEvent.click(screen.getByRole("button", { name: /Gerar DOCX/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0]).toEqual({});
  });
});
