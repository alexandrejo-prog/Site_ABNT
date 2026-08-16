import { describe, expect, it } from "vitest";
import {
  createNamedDraft,
  discardCorruptedDraftData,
  draftCorruptionIssues,
  listNamedDrafts,
  loadDraft,
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
  } as Storage;
}

describe("C14 — rascunhos corrompidos viram aviso (nunca somem em silêncio)", () => {
  it("índice com JSON inválido gera aviso e o dado original é preservado", () => {
    const storage = createStorage();
    storage.setItem(DRAFTS_INDEX_KEY, "{corrompido");
    const issues = draftCorruptionIssues(storage);
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe(DRAFTS_INDEX_KEY);
    expect(issues[0].reason).toMatch(/JSON inválido/);
    // listagem não quebra, mas o raw continua no storage (não foi apagado)
    expect(listNamedDrafts(storage)).toEqual([]);
    expect(storage.getItem(DRAFTS_INDEX_KEY)).toBe("{corrompido");
  });

  it("índice com shape inesperado (não-array) gera aviso sem apagar", () => {
    const storage = createStorage();
    storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify({ oops: true }));
    const issues = draftCorruptionIssues(storage);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toMatch(/formato inesperado/);
    expect(storage.getItem(DRAFTS_INDEX_KEY)).toBe(JSON.stringify({ oops: true }));
  });

  it("índice com entradas inválidas gera aviso com contagem e preserva o raw", () => {
    const storage = createStorage();
    const valid = createNamedDraft("Meu rascunho", makePayload(), storage);
    expect(valid.ok).toBe(true);
    const raw = storage.getItem(DRAFTS_INDEX_KEY) as string;
    const parsed = JSON.parse(raw);
    parsed.push({ id: "x", name: "", payload: { nope: 1 } }); // entrada inválida
    storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(parsed));
    const issues = draftCorruptionIssues(storage);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toMatch(/1 entrada\(s\) inválida/);
    // o rascunho válido continua listado
    expect(listNamedDrafts(storage)).toHaveLength(1);
    expect(storage.getItem(DRAFTS_INDEX_KEY)).toBe(JSON.stringify(parsed));
  });

  it("rascunho ativo (autosave) com JSON inválido: loadDraft null, raw preservado, aviso", () => {
    const storage = createStorage();
    storage.setItem(DRAFT_KEY, "not-json{");
    expect(loadDraft(storage)).toBeNull();
    expect(storage.getItem(DRAFT_KEY)).toBe("not-json{");
    const issues = draftCorruptionIssues(storage);
    expect(issues.some((issue) => issue.key === DRAFT_KEY && /JSON inválido/.test(issue.reason))).toBe(true);
  });

  it("discard remove apenas os dados corrompidos por decisão explícita", () => {
    const storage = createStorage();
    const valid = createNamedDraft("Bom rascunho", makePayload(), storage);
    expect(valid.ok).toBe(true);
    storage.setItem(DRAFT_KEY, "corrompido{");
    const removed = discardCorruptedDraftData(storage);
    expect(removed).toContain(DRAFT_KEY);
    expect(storage.getItem(DRAFT_KEY)).toBeNull();
    // o índice válido não é tocado
    expect(listNamedDrafts(storage)).toHaveLength(1);
    expect(storage.getItem(DRAFTS_INDEX_KEY)).not.toBeNull();
  });

  it("armazenamento limpo não gera avisos", () => {
    const storage = createStorage();
    expect(draftCorruptionIssues(storage)).toEqual([]);
  });
});
