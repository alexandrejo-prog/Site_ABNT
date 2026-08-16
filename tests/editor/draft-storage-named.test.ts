import { describe, expect, it } from "vitest";
import {
  createNamedDraft,
  deleteNamedDraft,
  exportDraftAsJson,
  exportDraftsBackup,
  getNamedDraft,
  importDraftFromJson,
  importDraftsFromBackup,
  listNamedDrafts,
  mergeDraftsBackup,
  migrateLegacyDraft,
  renameNamedDraft,
  saveDraft,
  saveNamedDraft,
  type DraftPayload,
} from "../../src/draft-storage";

const DRAFTS_INDEX_KEY = "site-abnt:drafts-index:v1";
const DRAFT_KEY = "site-abnt:draft:v3";

function makePayload(overrides: Partial<DraftPayload> = {}): DraftPayload {
  return {
    fields: { author: "Ana", title: "Trabalho" },
    editorText: "# Introducao\nTexto.",
    workType: "monografia",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

describe("rascunhos nomeados (P1)", () => {
  it("migra o rascunho legado para o índice nomeado na primeira leitura", () => {
    const storage = createStorage();
    const legacy = makePayload();
    storage.setItem(DRAFT_KEY, JSON.stringify(legacy));

    const drafts = listNamedDrafts(storage);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Rascunho");
    expect(drafts[0].payload).toEqual(legacy);
    // O rascunho legado (ativo/autosave) é preservado: nada é apagado.
    expect(storage.getItem(DRAFT_KEY)).toBeTruthy();
  });

  it("migração é idempotente e não roda de novo com índice existente", () => {
    const storage = createStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify(makePayload()));

    expect(migrateLegacyDraft(storage)).toBe(true);
    expect(listNamedDrafts(storage)).toHaveLength(1);
    expect(migrateLegacyDraft(storage)).toBe(false);
    expect(listNamedDrafts(storage)).toHaveLength(1);
  });

  it("não migra rascunho legado expirado", () => {
    const storage = createStorage();
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify(makePayload({ updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() })),
    );

    expect(listNamedDrafts(storage)).toEqual([]);
  });

  it("cria rascunho nomeado e o localiza", () => {
    const storage = createStorage();

    const result = createNamedDraft("Monografia final", makePayload(), storage);

    expect(result.ok).toBe(true);
    expect(result.draft?.name).toBe("Monografia final");
    expect(listNamedDrafts(storage)).toHaveLength(1);
    expect(getNamedDraft(result.draft!.id, storage)?.name).toBe("Monografia final");
  });

  it("rejeita nome vazio ao criar", () => {
    const storage = createStorage();

    const result = createNamedDraft("   ", makePayload(), storage);

    expect(result.ok).toBe(false);
    expect(result.kind).toBe("invalid-name");
    expect(listNamedDrafts(storage)).toHaveLength(0);
  });

  it("trata colisão de nomes (case-insensitive) ao criar", () => {
    const storage = createStorage();
    createNamedDraft("Rascunho A", makePayload(), storage);

    const result = createNamedDraft("rascunho a", makePayload(), storage);

    expect(result.ok).toBe(false);
    expect(result.kind).toBe("duplicate-name");
    expect(listNamedDrafts(storage)).toHaveLength(1);
  });

  it("saveNamedDraft atualiza rascunho existente mantendo o id", () => {
    const storage = createStorage();

    const first = saveNamedDraft("Meu rascunho", makePayload(), storage);
    const second = saveNamedDraft("meu rascunho", makePayload({ editorText: "Novo texto." }), storage);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.draft?.id).toBe(first.draft?.id);
    expect(listNamedDrafts(storage)).toHaveLength(1);
    expect(listNamedDrafts(storage)[0].payload.editorText).toBe("Novo texto.");
  });

  it("renomeia rascunho mantendo o conteúdo", () => {
    const storage = createStorage();
    const created = createNamedDraft("A", makePayload(), storage);

    const result = renameNamedDraft(created.draft!.id, "B", storage);

    expect(result.ok).toBe(true);
    expect(listNamedDrafts(storage)[0].name).toBe("B");
    expect(listNamedDrafts(storage)[0].payload.editorText).toBe("# Introducao\nTexto.");
  });

  it("renomeação rejeita nome vazio, colisão e id inexistente", () => {
    const storage = createStorage();
    const a = createNamedDraft("A", makePayload(), storage);
    createNamedDraft("B", makePayload(), storage);

    expect(renameNamedDraft(a.draft!.id, "  ", storage).kind).toBe("invalid-name");
    expect(renameNamedDraft(a.draft!.id, "b", storage).kind).toBe("duplicate-name");
    expect(renameNamedDraft("id-inexistente", "C", storage).kind).toBe("not-found");
  });

  it("exclui rascunho sem remover o documento ativo (DRAFT_KEY)", () => {
    const storage = createStorage();
    saveDraft(makePayload(), storage);
    const created = createNamedDraft("A", makePayload(), storage);

    const result = deleteNamedDraft(created.draft!.id, storage);

    expect(result.ok).toBe(true);
    expect(listNamedDrafts(storage)).toHaveLength(0);
    expect(storage.getItem(DRAFT_KEY)).toBeTruthy();
  });

  it("exclusão de id inexistente retorna not-found", () => {
    const storage = createStorage();
    expect(deleteNamedDraft("nao-existe", storage).kind).toBe("not-found");
  });

  it("lista rascunhos com o mais recente primeiro", () => {
    const storage = createStorage();
    const a = createNamedDraft("A", makePayload(), storage);
    const b = createNamedDraft("B", makePayload(), storage);

    expect(listNamedDrafts(storage).map((draft) => draft.id)).toEqual([b.draft!.id, a.draft!.id]);
  });

  it("exporta backup JSON com todos os rascunhos locais", () => {
    const storage = createStorage();
    createNamedDraft("A", makePayload(), storage);
    createNamedDraft("B", makePayload({ editorText: "Outro." }), storage);

    const json = exportDraftsBackup(listNamedDrafts(storage));
    const parsed = JSON.parse(json) as { version: number; exportedAt: string; drafts: unknown[] };

    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.drafts).toHaveLength(2);
    for (const entry of parsed.drafts) {
      expect(entry).toMatchObject({ id: expect.any(String), name: expect.any(String), updatedAt: expect.any(String) });
    }
  });

  it("exportDraftAsJson exporta somente os dados locais do documento", () => {
    const payload = makePayload();

    const parsed = JSON.parse(exportDraftAsJson(payload)) as DraftPayload;

    expect(parsed).toEqual(payload);
    expect(parsed.fields.title).toBe("Trabalho");
    expect(parsed.editorText).toBe("# Introducao\nTexto.");
    expect(parsed.workType).toBe("monografia");
  });

  it("importa backup JSON válido (objeto de backup)", () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      drafts: [
        { id: "draft-1", name: "Capítulo 1", payload: makePayload(), updatedAt: new Date().toISOString() },
        { id: "draft-2", name: "Capítulo 2", payload: makePayload({ editorText: "Segundo." }), updatedAt: new Date().toISOString() },
      ],
    };

    const imported = importDraftsFromBackup(JSON.stringify(backup));

    expect(imported).toHaveLength(2);
    expect(imported![0].id).toBe("draft-1");
    expect(imported![1].payload.editorText).toBe("Segundo.");
  });

  it("importa array de rascunhos nomeados", () => {
    const imported = importDraftsFromBackup(
      JSON.stringify([
        { id: "d1", name: "Um", payload: makePayload(), updatedAt: new Date().toISOString() },
      ]),
    );

    expect(imported).toHaveLength(1);
    expect(imported![0].name).toBe("Um");
  });

  it("importa um único DraftPayload como rascunho 'Importado'", () => {
    const payload = makePayload();
    const imported = importDraftsFromBackup(JSON.stringify(payload));

    expect(imported).toHaveLength(1);
    expect(imported![0].name).toBe("Importado");
    expect(imported![0].payload).toEqual(payload);
  });

  it("rejeita JSON corrompido sem tocar no armazenamento", () => {
    const storage = createStorage();
    createNamedDraft("Existente", makePayload(), storage);

    expect(importDraftsFromBackup("{corrompido")).toBeNull();
    expect(importDraftsFromBackup("isto não é json")).toBeNull();
    expect(listNamedDrafts(storage)).toHaveLength(1);
  });

  it("rejeita backup com qualquer entrada inválida", () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      drafts: [
        { id: "ok", name: "Válido", payload: makePayload(), updatedAt: new Date().toISOString() },
        { id: "ruim", name: "", payload: makePayload(), updatedAt: new Date().toISOString() },
      ],
    };

    expect(importDraftsFromBackup(JSON.stringify(backup))).toBeNull();
  });

  it("rejeita versão de backup desconhecida", () => {
    expect(importDraftsFromBackup(JSON.stringify({ version: 99, drafts: [] }))).toBeNull();
  });

  it("mescla backup preservando rascunhos existentes", () => {
    const storage = createStorage();
    createNamedDraft("Existente", makePayload({ editorText: "Original." }), storage);

    const imported = importDraftsFromBackup(
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        drafts: [
          { id: "draft-novo", name: "Novo", payload: makePayload(), updatedAt: new Date().toISOString() },
          { id: "draft-1", name: "Existente", payload: makePayload({ editorText: "Atualizado." }), updatedAt: new Date().toISOString() },
        ],
      }),
    );

    const result = mergeDraftsBackup(imported!, storage);

    expect(result.ok).toBe(true);
    const drafts = listNamedDrafts(storage);
    expect(drafts).toHaveLength(2);
    expect(drafts.find((draft) => draft.name === "Existente")?.payload.editorText).toBe("Atualizado.");
  });

  it("colisão de nomes no merge atualiza o existente em vez de duplicar", () => {
    const storage = createStorage();
    const created = createNamedDraft("Mesmo nome", makePayload(), storage);

    const result = mergeDraftsBackup(
      [{ id: "outro-id", name: "MESMO NOME", payload: makePayload({ editorText: "Novo." }), updatedAt: new Date().toISOString() }],
      storage,
    );

    expect(result.ok).toBe(true);
    const drafts = listNamedDrafts(storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(created.draft!.id);
    expect(drafts[0].payload.editorText).toBe("Novo.");
  });

  it("aceita documento vazio (schema válido)", () => {
    const empty: DraftPayload = { fields: {}, editorText: "", updatedAt: new Date().toISOString() };

    expect(importDraftFromJson(JSON.stringify(empty))).toEqual(empty);

    const storage = createStorage();
    const result = createNamedDraft("Vazio", empty, storage);
    expect(result.ok).toBe(true);
    expect(listNamedDrafts(storage)).toHaveLength(1);
  });

  it("importDraftFromJson rejeita payloads inválidos", () => {
    expect(importDraftFromJson("{corrompido")).toBeNull();
    expect(importDraftFromJson(JSON.stringify({ fields: null }))).toBeNull();
    expect(importDraftFromJson(JSON.stringify({ fields: {}, editorText: 42 }))).toBeNull();
    expect(importDraftFromJson(JSON.stringify({ fields: {}, editorText: "", references: [1, 2] }))).toBeNull();
  });

  it("índice corrompido é tratado como vazio sem quebrar", () => {
    const storage = createStorage();
    storage.setItem(DRAFTS_INDEX_KEY, "{lixo");

    expect(listNamedDrafts(storage)).toEqual([]);
  });
});
