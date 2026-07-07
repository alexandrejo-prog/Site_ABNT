export interface DraftPayload {
  fields: Record<string, unknown>;
  editorText: string;
  references?: string[];
  workType?: string;
  updatedAt: string;
}

const DRAFT_KEY = "site-abnt:draft:v1";

export function saveDraft(payload: DraftPayload, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignora falhas de quota/permissão.
  }
}

export function loadDraft(storage: Storage = globalThis.localStorage): DraftPayload | null {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.updatedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // Ignora falhas de permissão.
  }
}

export function hasDraft(storage: Storage = globalThis.localStorage): boolean {
  return loadDraft(storage) !== null;
}
