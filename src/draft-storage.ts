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
  if (payload.references !== undefined) {
    if (!Array.isArray(payload.references) || !payload.references.every((entry) => typeof entry === "string")) return false;
  }
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

export interface NamedDraft {
  id: string;
  name: string;
  payload: DraftPayload;
  updatedAt: string;
}

export type NamedDraftErrorKind =
  | "none"
  | "invalid-name"
  | "duplicate-name"
  | "not-found"
  | "invalid-payload"
  | "storage"
  | "unknown";

export interface NamedDraftResult {
  ok: boolean;
  kind: NamedDraftErrorKind;
  drafts: NamedDraft[];
  draft?: NamedDraft;
}

export interface DraftsBackup {
  version: 1;
  exportedAt: string;
  drafts: NamedDraft[];
}

const DRAFTS_INDEX_KEY = "site-abnt:drafts-index:v1";
const MIGRATED_DRAFT_NAME = "Rascunho";
const BACKUP_VERSION = 1;

function draftNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isValidNamedDraft(value: unknown): value is NamedDraft {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.trim() === "") return false;
  if (typeof value.name !== "string" || value.name.trim() === "") return false;
  if (!isValidDraft(value.payload)) return false;
  if (typeof value.updatedAt !== "string") return false;
  return true;
}

function nextDraftId(drafts: NamedDraft[], prefix = "draft"): string {
  const existing = new Set(drafts.map((draft) => draft.id));
  let id = `${prefix}-${Date.now()}`;
  let counter = 0;
  while (existing.has(id)) {
    counter += 1;
    id = `${prefix}-${Date.now()}-${counter}`;
  }
  return id;
}

function writeDraftsIndex(drafts: NamedDraft[], storage: Storage): boolean {
  try {
    storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(drafts));
    return true;
  } catch (error) {
    logDraftStorageError("salvar índice de rascunhos", error);
    return false;
  }
}

function readDraftsIndex(storage: Storage): NamedDraft[] {
  try {
    const raw = storage.getItem(DRAFTS_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidNamedDraft);
  } catch (error) {
    logDraftStorageError("ler índice de rascunhos", error);
    return [];
  }
}

function sortedDrafts(drafts: NamedDraft[]): NamedDraft[] {
  return [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Migra o rascunho único legado (site-abnt:draft:v1/v2/v3) para o índice de
 * rascunhos nomeados, na primeira vez que o índice é usado. A migração é
 * idempotente e copia o conteúdo — o rascunho legado continua como "rascunho
 * ativo" (autosave), sem perda de dados.
 */
export function migrateLegacyDraft(storage: Storage = globalThis.localStorage): boolean {
  try {
    if (storage.getItem(DRAFTS_INDEX_KEY) !== null) return false;
    for (const key of [DRAFT_KEY, ...LEGACY_DRAFT_KEYS]) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!isValidDraft(parsed) || isExpiredDraft(parsed)) continue;
      const migrated: NamedDraft = {
        id: nextDraftId([], "draft"),
        name: MIGRATED_DRAFT_NAME,
        payload: parsed,
        updatedAt: parsed.updatedAt,
      };
      storage.setItem(DRAFTS_INDEX_KEY, JSON.stringify([migrated]));
      return true;
    }
    return false;
  } catch (error) {
    logDraftStorageError("migrar rascunho antigo", error);
    return false;
  }
}

export function listNamedDrafts(storage: Storage = globalThis.localStorage): NamedDraft[] {
  migrateLegacyDraft(storage);
  return sortedDrafts(readDraftsIndex(storage));
}

export function createNamedDraft(name: string, payload: DraftPayload, storage: Storage = globalThis.localStorage): NamedDraftResult {
  const normalized = name.trim();
  if (!normalized) return { ok: false, kind: "invalid-name", drafts: listNamedDrafts(storage) };
  if (!isValidDraft(payload)) return { ok: false, kind: "invalid-payload", drafts: listNamedDrafts(storage) };
  const drafts = readDraftsIndex(storage);
  if (drafts.some((draft) => draftNameKey(draft.name) === draftNameKey(normalized))) {
    return { ok: false, kind: "duplicate-name", drafts: sortedDrafts(drafts) };
  }
  const draft: NamedDraft = {
    id: nextDraftId(drafts),
    name: normalized,
    payload,
    updatedAt: new Date().toISOString(),
  };
  const next = [draft, ...drafts];
  if (!writeDraftsIndex(next, storage)) return { ok: false, kind: "storage", drafts: sortedDrafts(drafts) };
  saveDraft(payload, storage);
  return { ok: true, kind: "none", drafts: sortedDrafts(next), draft };
}

export function saveNamedDraft(name: string, payload: DraftPayload, storage: Storage = globalThis.localStorage): NamedDraftResult {
  const normalized = name.trim();
  if (!normalized) return { ok: false, kind: "invalid-name", drafts: listNamedDrafts(storage) };
  if (!isValidDraft(payload)) return { ok: false, kind: "invalid-payload", drafts: listNamedDrafts(storage) };
  const drafts = readDraftsIndex(storage);
  const existingIndex = drafts.findIndex((draft) => draftNameKey(draft.name) === draftNameKey(normalized));
  const updatedAt = new Date().toISOString();
  const draft: NamedDraft =
    existingIndex >= 0
      ? { ...drafts[existingIndex], name: normalized, payload, updatedAt }
      : { id: nextDraftId(drafts), name: normalized, payload, updatedAt };
  const next =
    existingIndex >= 0
      ? [draft, ...drafts.filter((_, index) => index !== existingIndex)]
      : [draft, ...drafts];
  if (!writeDraftsIndex(next, storage)) return { ok: false, kind: "storage", drafts: sortedDrafts(drafts) };
  saveDraft(payload, storage);
  return { ok: true, kind: "none", drafts: sortedDrafts(next), draft };
}

export function renameNamedDraft(id: string, newName: string, storage: Storage = globalThis.localStorage): NamedDraftResult {
  const normalized = newName.trim();
  if (!normalized) return { ok: false, kind: "invalid-name", drafts: listNamedDrafts(storage) };
  const drafts = readDraftsIndex(storage);
  const targetIndex = drafts.findIndex((draft) => draft.id === id);
  if (targetIndex < 0) return { ok: false, kind: "not-found", drafts: sortedDrafts(drafts) };
  const collision = drafts.some((draft) => draft.id !== id && draftNameKey(draft.name) === draftNameKey(normalized));
  if (collision) return { ok: false, kind: "duplicate-name", drafts: sortedDrafts(drafts) };
  const renamed: NamedDraft = { ...drafts[targetIndex], name: normalized, updatedAt: new Date().toISOString() };
  const next = drafts.map((draft, index) => (index === targetIndex ? renamed : draft));
  if (!writeDraftsIndex(next, storage)) return { ok: false, kind: "storage", drafts: sortedDrafts(drafts) };
  return { ok: true, kind: "none", drafts: sortedDrafts(next), draft: renamed };
}

export function deleteNamedDraft(id: string, storage: Storage = globalThis.localStorage): NamedDraftResult {
  const drafts = readDraftsIndex(storage);
  if (!drafts.some((draft) => draft.id === id)) return { ok: false, kind: "not-found", drafts: sortedDrafts(drafts) };
  const next = drafts.filter((draft) => draft.id !== id);
  if (!writeDraftsIndex(next, storage)) return { ok: false, kind: "storage", drafts: sortedDrafts(drafts) };
  return { ok: true, kind: "none", drafts: sortedDrafts(next) };
}

export function getNamedDraft(id: string, storage: Storage = globalThis.localStorage): NamedDraft | null {
  return readDraftsIndex(storage).find((draft) => draft.id === id) ?? null;
}

export function exportDraftAsJson(payload: DraftPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function exportDraftsBackup(drafts: NamedDraft[]): string {
  const backup: DraftsBackup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    drafts,
  };
  return JSON.stringify(backup, null, 2);
}

export function importDraftFromJson(jsonString: string): DraftPayload | null {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (!isValidDraft(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Lê um backup JSON (objeto {version, drafts} ou array de rascunhos nomeados,
 * ou ainda um único DraftPayload) e valida o schema. Retorna null se qualquer
 * entrada for inválida — neste caso o armazenamento NÃO é tocado.
 */
export function importDraftsFromBackup(jsonString: string): NamedDraft[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    if (!parsed.every(isValidNamedDraft)) return null;
    return parsed.map((draft) => ({ ...draft, name: draft.name.trim() }));
  }
  if (!isRecord(parsed)) return null;
  if (isValidDraft(parsed)) {
    return [
      {
        id: nextDraftId([], "draft"),
        name: "Importado",
        payload: parsed,
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  if (parsed.version !== BACKUP_VERSION || !Array.isArray(parsed.drafts)) return null;
  if (!parsed.drafts.every(isValidNamedDraft)) return null;
  return parsed.drafts.map((draft) => ({ ...draft, name: draft.name.trim() }));
}

/**
 * Mescla rascunhos importados no índice local, preservando os existentes:
 * atualiza por id e, em colisão de nome com outro id, atualiza o rascunho
 * existente para manter a unicidade de nomes.
 */
export function mergeDraftsBackup(imported: NamedDraft[], storage: Storage = globalThis.localStorage): NamedDraftResult {
  const current = readDraftsIndex(storage);
  const next = [...current];
  for (const incoming of imported) {
    const byId = next.findIndex((draft) => draft.id === incoming.id);
    if (byId >= 0) {
      next[byId] = { ...incoming };
      continue;
    }
    const byName = next.findIndex((draft) => draftNameKey(draft.name) === draftNameKey(incoming.name));
    if (byName >= 0) {
      next[byName] = { ...next[byName], name: incoming.name, payload: incoming.payload, updatedAt: incoming.updatedAt };
      continue;
    }
    next.push(incoming);
  }
  if (!writeDraftsIndex(next, storage)) return { ok: false, kind: "storage", drafts: sortedDrafts(current) };
  return { ok: true, kind: "none", drafts: sortedDrafts(next) };
}

