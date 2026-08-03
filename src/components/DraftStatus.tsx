import { Eraser } from "lucide-react";
import { draftRetentionDays } from "../draft-storage";
import { friendlyStorageError, type DraftStorageErrorKind } from "../draft-storage-error";

interface DraftStatusProps {
  draftStatus: "idle" | "saved" | "restored" | "cleared" | "error";
  hasDraft: boolean;
  lastSavedAt?: Date | null;
  saveErrorKind?: DraftStorageErrorKind | null;
  onClearDraft: () => void;
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DraftStatus({ draftStatus, hasDraft, lastSavedAt, saveErrorKind, onClearDraft }: DraftStatusProps) {
  const canClearDraft = hasDraft || draftStatus === "saved" || draftStatus === "restored";
  const retention = draftRetentionDays();
  const savedTime = lastSavedAt ? formatSavedTime(lastSavedAt) : null;

  const feedback = draftStatus === "error"
    ? saveErrorKind && saveErrorKind !== "none"
      ? friendlyStorageError(saveErrorKind)
      : "Nao foi possivel acessar armazenamento local"
    : draftStatus === "saved"
      ? `Rascunho salvo${savedTime ? ` às ${savedTime}` : ""} neste navegador por até ${retention} dias`
      : draftStatus === "restored"
        ? `Rascunho restaurado deste navegador${savedTime ? ` (salvo às ${savedTime})` : ""}; nada foi enviado ao servidor`
        : draftStatus === "cleared"
          ? "Rascunho local removido"
          : "";

  return (
    <>
      {canClearDraft && <button className="primary-action draft-clear-button" type="button" onClick={onClearDraft} title={`Limpar rascunho salvo apenas neste navegador por até ${retention} dias`}><Eraser size={18} aria-hidden="true" />Limpar rascunho</button>}
      <span className="draft-status" aria-live="polite" role="status">{feedback}</span>
    </>
  );
}
