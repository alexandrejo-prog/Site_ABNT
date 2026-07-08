import { describe, expect, it } from "vitest";
import { clearDraft, hasDraft, loadDraft, saveDraft, type DraftPayload } from "../src/draft-storage";

const SAMPLE_DRAFT = {
  fields: { author: "Ana", title: "Trabalho" },
  editorText: "# Introducao\nTexto.",
  references: ["SILVA, M. Livro. UFLA, 2024."],
  workType: "monografia",
  updatedAt: new Date().toISOString(),
};

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

describe("draft-storage", () => {
  it("salva e carrega rascunho", () => {
    const storage = createStorage();
    saveDraft(SAMPLE_DRAFT, storage);
    const loaded = loadDraft(storage);
    expect(loaded).toEqual(SAMPLE_DRAFT);
    clearDraft(storage);
  });

  it("limpa rascunho", () => {
    const storage = createStorage();
    saveDraft(SAMPLE_DRAFT, storage);
    expect(hasDraft(storage)).toBe(true);
    clearDraft(storage);
    expect(hasDraft(storage)).toBe(false);
    expect(loadDraft(storage)).toBeNull();
  });

  it("ignora JSON invalido", () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v3", "{invalid json");
    expect(loadDraft(storage)).toBeNull();
  });

  it("remove rascunhos legados v1/v2 para evitar metadados antigos restaurados", () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify({ ...SAMPLE_DRAFT, fields: { title: "Metricas antigas v1" } }));
    storage.setItem("site-abnt:draft:v2", JSON.stringify({ ...SAMPLE_DRAFT, fields: { title: "Metricas antigas v2" } }));

    expect(loadDraft(storage)).toBeNull();
    expect(storage.getItem("site-abnt:draft:v1")).toBeNull();
    expect(storage.getItem("site-abnt:draft:v2")).toBeNull();
  });

  it("clearDraft remove rascunhos atual e legados", () => {
    const storage = createStorage();
    storage.setItem("site-abnt:draft:v1", JSON.stringify(SAMPLE_DRAFT));
    storage.setItem("site-abnt:draft:v2", JSON.stringify(SAMPLE_DRAFT));
    saveDraft(SAMPLE_DRAFT, storage);

    clearDraft(storage);

    expect(storage.getItem("site-abnt:draft:v1")).toBeNull();
    expect(storage.getItem("site-abnt:draft:v2")).toBeNull();
    expect(storage.getItem("site-abnt:draft:v3")).toBeNull();
  });
  it("nao quebra sem localStorage", () => {
    expect(() => {
      saveDraft(SAMPLE_DRAFT, undefined as unknown as Storage);
      expect(hasDraft(undefined as unknown as Storage)).toBe(false);
      expect(loadDraft(undefined as unknown as Storage)).toBeNull();
      clearDraft(undefined as unknown as Storage);
    }).not.toThrow();
  });

  it("rejeita payloads invalidos", () => {
    const storage = createStorage();
    expect(loadDraft(storage)).toBeNull();
    saveDraft({ fields: {}, updatedAt: new Date().toISOString() } as unknown as DraftPayload, storage);
    expect(loadDraft(storage)).toBeNull();
    saveDraft({ fields: null, editorText: "", updatedAt: new Date().toISOString() } as unknown as DraftPayload, storage);
    expect(loadDraft(storage)).toBeNull();
    saveDraft({ fields: {}, editorText: 123 as unknown as string, updatedAt: new Date().toISOString() } as unknown as DraftPayload, storage);
    expect(loadDraft(storage)).toBeNull();
  });
});
