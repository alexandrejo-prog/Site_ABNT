import { useCallback, useEffect, useRef, useState } from "react";
import type { AcademicFields } from "../ufla-rules";
import { clearDraft, hasDraft, loadDraft, saveDraft } from "../draft-storage";
import type { DraftStorageErrorKind } from "../draft-storage-error";

const DEBOUNCE_MS = 800;

function hasDraftableContent(fields: AcademicFields, editorText: string): boolean {
  if (editorText.trim().length > 0) return true;
  return Object.values(fields).some((v) => typeof v === "string" && v.trim().length > 0);
}

function draftFieldsPayload(fields: AcademicFields): Record<string, string> {
  const rest = { ...fields };
  delete (rest as any).workType;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, String(value)]));
}

export interface RestoredDraft {
  fields: Partial<AcademicFields>;
  editorText: string;
}

export type DraftStatusValue = "idle" | "saved" | "restored" | "cleared" | "error";

export function useDraft(fields: AcademicFields, editorText: string) {
  const [draftStatus, setDraftStatus] = useState<DraftStatusValue>("idle");
  const [draftSaving, setDraftSaving] = useState(false);
  const [hasStoredDraft, setHasStoredDraft] = useState(() => typeof window !== "undefined" && hasDraft(window.localStorage));
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [restoredDraft, setRestoredDraft] = useState<RestoredDraft | null>(null);
  const [draftErrorKind, setDraftErrorKind] = useState<DraftStorageErrorKind | null>(null);
  const initialHasContentRef = useRef(Boolean(fields.author || fields.title || editorText));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft = loadDraft(window.localStorage);
    if (!draft) return;
    if (!draft.fields && !draft.editorText) return;
    if (initialHasContentRef.current) return;
    try {
      const restored: Partial<AcademicFields> = {};
      for (const [key, value] of Object.entries(draft.fields ?? {})) {
        if (typeof value === "string") (restored as any)[key] = value;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura rascunho externo (localStorage) na montagem
      setRestoredDraft({ fields: restored, editorText: draft.editorText ?? "" });
      setHasStoredDraft(true);
      setDraftStatus("restored");
      setDraftErrorKind(null);
      const savedAt = draft.updatedAt ? new Date(draft.updatedAt) : null;
      setLastSavedAt(savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt : null);
    } catch {
      // Ignora rascunho incompatível.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (clearedRef.current) {
      clearedRef.current = false;
      clearDraft(window.localStorage);
      autosaveTimeoutRef.current = null;
      setHasStoredDraft(false);
      setDraftSaving(false);
      return;
    }
    if (!hasDraftableContent(fields, editorText)) {
      clearDraft(window.localStorage);
      autosaveTimeoutRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflete limpeza do rascunho externo no mesmo tick
      setHasStoredDraft(false);
      setDraftSaving(false);
      return;
    }
    setDraftSaving(true);
    const timeout = setTimeout(() => {
      try {
        const result = saveDraft({
          fields: draftFieldsPayload(fields),
          editorText,
          updatedAt: new Date().toISOString(),
        }, window.localStorage);
        autosaveTimeoutRef.current = null;
        setDraftSaving(false);
        if (result.ok) {
          setHasStoredDraft(true);
          setDraftStatus("saved");
          setDraftErrorKind(null);
          setLastSavedAt(new Date());
        } else {
          setDraftStatus("error");
          setDraftErrorKind(result.kind);
        }
      } catch {
        autosaveTimeoutRef.current = null;
        setDraftSaving(false);
        setDraftStatus("error");
        setDraftErrorKind("unknown");
      }
    }, DEBOUNCE_MS);
    autosaveTimeoutRef.current = timeout;
    return () => {
      clearTimeout(timeout);
      if (autosaveTimeoutRef.current === timeout) autosaveTimeoutRef.current = null;
    };
  }, [fields, editorText]);

  const handleClearDraft = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    clearedRef.current = true;
    setRestoredDraft(null);
    clearDraft(window.localStorage);
    setHasStoredDraft(false);
    setDraftSaving(false);
    setLastSavedAt(null);
    setDraftErrorKind(null);
    setDraftStatus("cleared");
  }, []);

  return { draftStatus, draftSaving, hasStoredDraft, handleClearDraft, restoredDraft, lastSavedAt, draftErrorKind };
}
