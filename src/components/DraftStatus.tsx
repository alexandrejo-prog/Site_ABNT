import { Eraser } from "lucide-react";

interface DraftStatusProps {
  draftStatus: "idle" | "saved" | "restored" | "cleared" | "error";
  hasDraft: boolean;
  onClearDraft: () => void;
}

export function DraftStatus({ draftStatus, hasDraft, onClearDraft }: DraftStatusProps) {
  const canClearDraft = hasDraft || draftStatus === "saved" || draftStatus === "restored";

  return (
    <>
      {canClearDraft && <button className="primary-action draft-clear-button" type="button" onClick={onClearDraft} title="Limpar rascunho local"><Eraser size={18} aria-hidden="true" />Limpar rascunho</button>}
      <span className="draft-status" aria-live="polite" role="status">{draftStatus === "saved" ? "Rascunho salvo localmente" : draftStatus === "restored" ? "Rascunho restaurado" : draftStatus === "cleared" ? "Rascunho local removido" : draftStatus === "error" ? "Nao foi possivel acessar armazenamento local" : ""}</span>
    </>
  );
}
