import { describe, expect, it } from "vitest";
import { saveDraft, type DraftPayload } from "../../src/draft-storage";
import { classifyStorageError, friendlyStorageError } from "../../src/draft-storage-error";

const SAMPLE_DRAFT = {
  fields: { author: "Ana", title: "Trabalho" },
  editorText: "# Introducao\nTexto.",
  updatedAt: new Date().toISOString(),
} as DraftPayload;

interface StorageOverrides {
  setItemThrows?: Error;
}

function storageWith(options: StorageOverrides = {}): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options.setItemThrows) throw options.setItemThrows;
      map.set(key, value);
    },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  } as unknown as Storage;
}

describe("draft-storage-error (TEC-02)", () => {
  it("classifica exceção de classe quota como quota-exceeded", () => {
    expect(classifyStorageError(new DOMException("Quota exceeded", "QuotaExceededError"))).toBe("quota-exceeded");
  });

  it("classifica mensagem de quota como quota-exceeded", () => {
    expect(classifyStorageError(new Error("localStorage quota exceeded"))).toBe("quota-exceeded");
  });

  it("classifica SecurityError como indisponível", () => {
    expect(classifyStorageError(new DOMException("denied", "SecurityError"))).toBe("unavailable");
  });

  it("classifica erro genérico como desconhecido", () => {
    expect(classifyStorageError(new Error("something else"))).toBe("unknown");
    expect(classifyStorageError(undefined)).toBe("unknown");
  });

  it("saveDraft devolve ok=true e kind=none em sucesso", () => {
    const result = saveDraft(SAMPLE_DRAFT, storageWith());
    expect(result).toEqual({ ok: true, kind: "none" });
  });

  it("saveDraft devolve ok=false e kind=quota-exceeded quando storage lança quota", () => {
    const storage = storageWith({ setItemThrows: new DOMException("Quota exceeded", "QuotaExceededError") });
    const result = saveDraft(SAMPLE_DRAFT, storage);
    expect(result).toEqual({ ok: false, kind: "quota-exceeded" });
  });

  it("saveDraft não lança quando storage está indisponível", () => {
    const storage = storageWith({ setItemThrows: new DOMException("denied", "SecurityError") });
    const result = saveDraft(SAMPLE_DRAFT, storage);
    expect(result.ok).toBe(false);
  });

  it("friendlyStorageError retorna mensagem clara para cada tipo", () => {
    for (const kind of ["quota-exceeded", "unavailable", "unknown", "none"] as const) {
      expect(friendlyStorageError(kind).length).toBeGreaterThan(0);
    }
  });
});