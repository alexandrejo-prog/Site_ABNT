import { classifyStorageError, type DraftStorageErrorKind } from "./draft-storage-error";

export interface DraftPayload {
  fields: Record<string, unknown>;
  editorText: string;
  references?: string[];
  workType?: string;
  updatedAt: string;
}

export interface DraftSaveResult {
  ok: boolean;
  kind: DraftStorageErrorKind;
}

const DRAFT_KEY = "site-abnt:draft:v3";
const LEGACY_DRAFT_KEYS = ["site-abnt:draft:v1", "site-abnt:draft:v2"];
const DRAFT_TTL_DAYS = 14;
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;

function logDraftStorageError(action: string, error: unknown): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
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

function isExpiredDraft(payload: DraftPayload, now = Date.now()): boolean {
  const updatedAt = Date.parse(payload.updatedAt);
  if (!Number.isFinite(updatedAt)) return true;
  return now - updatedAt > DRAFT_TTL_MS;
}

function clearLegacyDrafts(storage: Storage): void {
  for (const key of LEGACY_DRAFT_KEYS) {
    storage.removeItem(key);
  }
}

export function saveDraft(payload: DraftPayload, storage: Storage = globalThis.localStorage): DraftSaveResult {
  try {
    clearLegacyDrafts(storage);
    storage.setItem(DRAFT_KEY, JSON.stringify(payload));
    return { ok: true, kind: "none" };
  } catch (error) {
    logDraftStorageError("salvar", error);
    return { ok: false, kind: classifyStorageError(error) };
  }
}

export function loadDraft(storage: Storage = globalThis.localStorage): DraftPayload | null {
  try {
    clearLegacyDrafts(storage);
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDraft(parsed)) return null;
    if (isExpiredDraft(parsed)) {
      storage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    logDraftStorageError("carregar", error);
    return null;
  }
}

export function clearDraft(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(DRAFT_KEY);
    clearLegacyDrafts(storage);
  } catch (error) {
    logDraftStorageError("remover", error);
  }
}

export function hasDraft(storage: Storage = globalThis.localStorage): boolean {
  return loadDraft(storage) !== null;
}

export function draftRetentionDays(): number {
  return DRAFT_TTL_DAYS;
}
