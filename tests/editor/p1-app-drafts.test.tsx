import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { saveAsMock } = vi.hoisted(() => ({
  saveAsMock: vi.fn(),
}));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));
vi.mock("../../src/document-template", () => ({
  templateForWorkType: vi.fn(() => ({
    id: "mock-template",
    generate: vi.fn(async () => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
  })),
}));

import App from "../../src/App";

const DRAFT_KEY = "site-abnt:draft:v3";
const INDEX_KEY = "site-abnt:drafts-index:v1";

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as unknown as Storage;
}

function draftIndex(storage: Storage): Array<{ id: string; name: string; payload: { fields: Record<string, unknown>; editorText: string } }> {
  const raw = storage.getItem(INDEX_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

describe("P1 — rascunhos múltiplos no App", () => {
  let storage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    saveAsMock.mockClear();
    storage = createStorage();
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
  });

  it("Ctrl+S cria rascunho nomeado 'Rascunho' com os campos atuais", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Meu TCC" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria" } });

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    const drafts = draftIndex(storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Rascunho");
    expect(drafts[0].payload.fields.title).toBe("Meu TCC");
    expect(drafts[0].payload.fields.author).toBe("Maria");
  });

  it("Ctrl+S repetido atualiza o mesmo rascunho sem duplicar", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título 1" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título 2" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    const drafts = draftIndex(storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].payload.fields.title).toBe("Título 2");
  });

  it("selecionar um rascunho carrega seus campos no formulário", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Meu TCC" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Outro título" } });
    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Trocar para o rascunho Rascunho" }));

    expect(screen.getByLabelText("Título")).toHaveValue("Meu TCC");
  });

  it("renomeia e exclui rascunho pela interface, com confirmação", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ações de Rascunho" }));
    fireEvent.click(screen.getByRole("button", { name: /renomear/i }));
    fireEvent.change(screen.getByLabelText(/Novo nome do rascunho/), { target: { value: "Versão final" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar novo nome" }));

    expect(draftIndex(storage)[0].name).toBe("Versão final");

    fireEvent.click(screen.getByRole("button", { name: "Ações de Versão final" }));
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    // Primeiro clique pede confirmação; o documento atual não é alterado.
    expect(draftIndex(storage)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(draftIndex(storage)).toHaveLength(0);
  });

  it("exporta backup JSON com os rascunhos locais", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título backup" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    fireEvent.click(screen.getByText("Mais opções"));
    fireEvent.click(screen.getByRole("button", { name: /salvar backup/i }));

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [blob, filename] = saveAsMock.mock.calls[0] as [Blob, string];
    expect(filename).toMatch(/\.json$/);
    const parsed = JSON.parse((await blob.text()) as string) as { version: number; drafts: unknown[] };
    expect(parsed.version).toBe(1);
    expect(parsed.drafts).toHaveLength(1);
  });

  it("importa backup JSON válido e adiciona os rascunhos", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    fireEvent.click(screen.getByText("Mais opções"));

    const backup = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      drafts: [
        {
          id: "draft-backup-1",
          name: "Do backup",
          payload: { fields: { title: "Título do backup" }, editorText: "Texto.", workType: "artigo", updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const file = new File([backup], "backup.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Arquivo de backup JSON"), file);

    await waitFor(() => expect(draftIndex(storage)).toHaveLength(1));
    expect(draftIndex(storage)[0].name).toBe("Do backup");
  });

  it("importação de JSON inválido não altera o documento atual nem o índice", async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título atual" } });
    fireEvent.click(screen.getByRole("button", { name: /^Rascunhos/ }));
    fireEvent.click(screen.getByText("Mais opções"));

    const file = new File(["{corrompido"], "backup.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Arquivo de backup JSON"), file);

    await screen.findByText(/Não foi possível importar este backup/);
    expect(screen.getByLabelText("Título")).toHaveValue("Título atual");
    expect(draftIndex(storage)).toHaveLength(0);
  });

  it("migra rascunho legado do localStorage na montagem", () => {
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        fields: { title: "Legado" },
        editorText: "",
        workType: "artigo",
        updatedAt: new Date().toISOString(),
      }),
    );

    render(<App />);

    const drafts = draftIndex(storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Rascunho");
    expect(drafts[0].payload.fields.title).toBe("Legado");
  });

  it("Ctrl+Shift+V executa a validação e atualiza o status", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "v", ctrlKey: true, shiftKey: true });
    expect(screen.getByText(/Validação concluída/)).toBeInTheDocument();
  });

  it("Ctrl+Shift+E gera o DOCX (sem duplicar por tecla repetida)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Tipo de trabalho"), "artigo");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título de teste" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Maria Silva" } });

    fireEvent.keyDown(window, { key: "e", ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1));
    expect(saveAsMock.mock.calls[0][1]).toMatch(/\.docx$/);
  });
});
