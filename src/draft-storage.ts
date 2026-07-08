export interface DraftPayload {
  fields: Record<string, unknown>;
  editorText: string;
  references?: string[];
  workType?: string;
  updatedAt: string;
}

const DRAFT_KEY = "site-abnt:draft:v1";

function logDraftStorageError(action: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`Falha ao ${action} rascunho local do Site_ABNT.`, error);
  }
}

function isValidDraft(value: unknown): value is DraftPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (typeof payload.fields !== "object" || payload.fields === null) return false;
  if (typeof payload.editorText !== "string") return false;
  if (!Array.isArray(payload.references) && payload.references !== undefined) return false;
  if (typeof payload.workType !== "string" && payload.workType !== undefined) return false;
  if (typeof payload.updatedAt !== "string") return false;
  return true;
}

export function saveDraft(payload: DraftPayload, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (error) {
    logDraftStorageError("salvar", error);
  }
}

export function loadDraft(storage: Storage = globalThis.localStorage): DraftPayload | null {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDraft(parsed)) return null;
    return parsed;
  } catch (error) {
    logDraftStorageError("carregar", error);
    return null;
  }
}

export function clearDraft(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch (error) {
    logDraftStorageError("remover", error);
  }
}

export function hasDraft(storage: Storage = globalThis.localStorage): boolean {
  return loadDraft(storage) !== null;
}
