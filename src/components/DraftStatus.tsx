import { memo, useEffect, useRef, useState } from "react";
import { Eraser, FolderOpen, Save, X } from "lucide-react";
import { draftRetentionDays, type DraftCorruptionIssue, type NamedDraft } from "../draft-storage";
import { friendlyStorageError, type DraftStorageErrorKind } from "../draft-storage-error";

interface DraftStatusProps {
  draftStatus: "idle" | "saved" | "restored" | "cleared" | "error";
  draftSaving?: boolean;
  hasDraft: boolean;
  lastSavedAt?: Date | null;
  saveErrorKind?: DraftStorageErrorKind | null;
  onClearDraft: () => void;
  onSaveDraft?: () => void;
  drafts?: NamedDraft[];
  activeDraftId?: string | null;
  managerError?: string | null;
  managerNotice?: string | null;
  openSignal?: number;
  onSelectDraft?: (id: string) => void;
  onCreateDraft?: (name: string) => void;
  onRenameDraft?: (id: string, name: string) => void;
  onDeleteDraft?: (id: string) => void;
  onExportBackup?: () => void;
  onImportBackup?: (jsonText: string) => void;
  corruptionWarnings?: DraftCorruptionIssue[];
  onDiscardCorrupted?: () => void;
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDraftDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DraftStatusComponent({
  draftStatus,
  draftSaving = false,
  hasDraft,
  lastSavedAt,
  saveErrorKind,
  onClearDraft,
  onSaveDraft,
  drafts = [],
  activeDraftId = null,
  managerError = null,
  managerNotice = null,
  openSignal = 0,
  onSelectDraft,
  onCreateDraft,
  onRenameDraft,
  onDeleteDraft,
  onExportBackup,
  onImportBackup,
  corruptionWarnings = [],
  onDiscardCorrupted,
}: DraftStatusProps) {
  const canClearDraft = hasDraft || draftStatus === "saved" || draftStatus === "restored";
  const retention = draftRetentionDays();
  const savedTime = lastSavedAt ? formatSavedTime(lastSavedAt) : null;

  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [newDraftName, setNewDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o gerenciador quando o App pede (ação "Abrir rascunho")
    if (openSignal > 0) setIsManagerOpen(true);
  }, [openSignal]);

  // Fecha o menu contextual do rascunho ao clicar fora dele.
  useEffect(() => {
    if (!menuOpenForId) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpenForId(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuOpenForId]);

  const feedback =
    draftStatus === "error"
      ? saveErrorKind && saveErrorKind !== "none"
        ? friendlyStorageError(saveErrorKind)
        : "Nao foi possivel acessar armazenamento local"
      : draftStatus === "restored"
        ? `Rascunho restaurado deste navegador${savedTime ? ` (salvo às ${savedTime})` : ""}; nada foi enviado ao servidor`
        : draftStatus === "cleared"
          ? "Rascunho local removido"
          : draftSaving
            ? "Salvando..."
            : draftStatus === "saved"
              ? `Rascunho salvo${savedTime ? ` às ${savedTime}` : ""} neste navegador por até ${retention} dias`
              : "";

  const handleCreate = () => {
    const name = newDraftName.trim();
    if (!name || !onCreateDraft) return;
    onCreateDraft(name);
    setNewDraftName("");
  };

  const commitRename = (id: string) => {
    const name = renameValue.trim();
    if (!name || !onRenameDraft) return;
    onRenameDraft(id, name);
    setRenamingId(null);
    setRenameValue("");
  };

  const handleImportFile = (file: File | null) => {
    if (!file || !onImportBackup) return;
    const reader = new FileReader();
    reader.onload = () => {
      onImportBackup(String(reader.result ?? ""));
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Foco acessível + teclado dentro do diálogo: fecha no Escape, cicla no Tab
  // e devolve o foco ao botão que abriu o gerenciador. O elemento focado ANTES
  // de abrir (o gatilho) é capturado ANTES de focar o botão X — senão a
  // restauração devolveria o foco ao próprio X, que some com o diálogo (B4).
  useEffect(() => {
    if (!isManagerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsManagerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = dialogRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isManagerOpen]);

  const panelFeedback = managerError ?? managerNotice;
  const managerEnabled = Boolean(onCreateDraft && onRenameDraft && onDeleteDraft && onExportBackup && onImportBackup);
  const activeDraft = activeDraftId ? drafts.find((draft) => draft.id === activeDraftId) ?? null : null;

  return (
    <>
      {managerEnabled && (
        <span className="draft-manager">
          {onSaveDraft && (
            <button
              type="button"
              className="secondary-action draft-save-button"
              onClick={onSaveDraft}
              title="Salvar rascunho no navegador (Ctrl+S)"
            >
              <Save size={16} aria-hidden="true" />
              Salvar
            </button>
          )}
          <button
            ref={toggleRef}
            type="button"
            className="secondary-action"
            aria-expanded={isManagerOpen}
            aria-haspopup="dialog"
            aria-controls="draft-manager-dialog"
            onClick={() => setIsManagerOpen((open) => !open)}
            title="Abrir gerenciador de rascunhos"
          >
            <FolderOpen size={16} aria-hidden="true" />
            Rascunhos ({drafts.length})
          </button>
          {activeDraft && (
            <span className="active-draft-label">
              Rascunho atual: {activeDraft.name}
            </span>
          )}
        </span>
      )}
      {canClearDraft && (
        <button className="secondary-action draft-clear-icon" type="button" onClick={onClearDraft} aria-label="Limpar rascunho" title={`Limpar rascunho salvo apenas neste navegador por até ${retention} dias`}>
          <Eraser size={16} aria-hidden="true" />
        </button>
      )}
      <span className="draft-status" aria-live="polite" role="status">
        {feedback}
      </span>
      {isManagerOpen && (
        <div className="draft-manager-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsManagerOpen(false); }}>
          <div
            id="draft-manager-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-manager-title"
            className="draft-manager-dialog"
          >
            <header className="draft-manager-header">
              <h2 id="draft-manager-title" className="draft-manager-title">Meus rascunhos</h2>
              <button ref={closeRef} type="button" className="secondary-action draft-action" onClick={() => setIsManagerOpen(false)} aria-label="Fechar gerenciador de rascunhos" title="Fechar (Esc)">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="draft-manager-body">
              {corruptionWarnings.length > 0 && (
                <div
                  role="alert"
                  className="draft-feedback draft-feedback--error"
                  style={{ marginBottom: 10 }}
                >
                  <strong>Atenção:</strong>{" "}
                  {corruptionWarnings.length === 1
                    ? "Um item do armazenamento de rascunhos está corrompido e não foi carregado."
                    : `${corruptionWarnings.length} itens do armazenamento de rascunhos estão corrompidos e não foram carregados.`}{" "}
                  O dado original foi preservado — nada foi apagado.
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {corruptionWarnings.map((issue) => (
                      <li key={issue.key}>{issue.reason}</li>
                    ))}
                  </ul>
                  <div className="draft-manager-row" style={{ marginTop: 8 }}>
                    <button type="button" className="secondary-action draft-action" onClick={onDiscardCorrupted}>
                      Descartar dados corrompidos
                    </button>
                    <span className="draft-shortcut-hint">Decisão sua — nada é apagado automaticamente.</span>
                  </div>
                </div>
              )}
              {panelFeedback && (
                <p role="status" className={`draft-feedback ${managerError ? "draft-feedback--error" : "draft-feedback--notice"}`}>
                  {panelFeedback}
                </p>
              )}
              <p className="draft-shortcut-hint">Dica: Ctrl+S salva o rascunho atual.</p>
              <section aria-label="Novo rascunho" style={{ marginTop: 10 }}>
                <p className="draft-manager-section-label">Novo rascunho</p>
                <div className="draft-manager-row">
                  <input
                    type="text"
                    value={newDraftName}
                    onChange={(event) => setNewDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleCreate();
                      if (event.key === "Escape") setNewDraftName("");
                    }}
                    aria-label="Novo rascunho"
                    placeholder="Nome do novo rascunho"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="button" className="secondary-action draft-action" onClick={handleCreate} disabled={!newDraftName.trim()}>
                    Criar
                  </button>
                </div>
              </section>
              <section aria-label="Rascunhos salvos" style={{ marginTop: 12 }}>
                {drafts.length === 0 ? (
                  <p className="draft-manager-empty">
                    Nenhum rascunho salvo ainda. Crie um acima ou clique em Salvar.
                  </p>
                ) : (
                  <ul className="draft-manager-list">
                    {drafts.map((draft) => {
                      const isActive = draft.id === activeDraftId;
                      const isRenaming = renamingId === draft.id;
                      const isConfirmingDelete = confirmingDeleteId === draft.id;
                      return (
                        <li key={draft.id}>
                          {isRenaming ? (
                            <div className="draft-manager-row">
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") commitRename(draft.id);
                                  if (event.key === "Escape") setRenamingId(null);
                                }}
                                aria-label={`Novo nome do rascunho ${draft.name}`}
                                style={{ flex: 1, minWidth: 0 }}
                              />
                              <button type="button" className="secondary-action draft-action" onClick={() => commitRename(draft.id)}>
                                Salvar novo nome
                              </button>
                              <button type="button" className="secondary-action draft-action" onClick={() => setRenamingId(null)}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="draft-manager-row">
                              <button
                                type="button"
                                className="draft-row-open"
                                onClick={() => onSelectDraft?.(draft.id)}
                                aria-current={isActive ? "true" : undefined}
                                aria-label={`Trocar para o rascunho ${draft.name}`}
                                title={isActive ? `${draft.name} (rascunho atual)` : `Trocar para ${draft.name}`}
                              >
                                <span className="draft-row-name">{draft.name}</span>
                                <span className="draft-row-meta">
                                  {formatDraftDate(draft.updatedAt)}
                                  {isActive ? " · atual" : ""}
                                </span>
                              </button>
                              <div className="draft-row-menu" ref={menuOpenForId === draft.id ? menuRef : undefined}>
                                <button
                                  type="button"
                                  className="secondary-action draft-action draft-menu-toggle"
                                  aria-label={`Ações de ${draft.name}`}
                                  aria-haspopup="menu"
                                  aria-expanded={menuOpenForId === draft.id}
                                  onClick={() => setMenuOpenForId((current) => (current === draft.id ? null : draft.id))}
                                  title={`Ações de ${draft.name}`}
                                >
                                  ⋯
                                </button>
                                {menuOpenForId === draft.id && (
                                  <div className="draft-context-menu">
                                    {isConfirmingDelete ? (
                                      <>
                                        <button type="button" onClick={() => { onDeleteDraft?.(draft.id); setConfirmingDeleteId(null); setMenuOpenForId(null); }}>
                                          Confirmar
                                        </button>
                                        <button type="button" onClick={() => { setConfirmingDeleteId(null); setMenuOpenForId(null); }}>
                                          Cancelar
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setRenamingId(draft.id); setRenameValue(draft.name); setMenuOpenForId(null); }}>
                                          Renomear
                                        </button>
                                        <button type="button" onClick={() => setConfirmingDeleteId(draft.id)}>
                                          Excluir
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <details className="draft-manager-options">
                <summary>Mais opções</summary>
                <div className="draft-manager-options-actions">
                  <button type="button" className="secondary-action draft-action" onClick={() => onExportBackup?.()} title="Baixa um arquivo JSON com todos os rascunhos locais deste navegador">
                    Salvar backup
                  </button>
                  <button type="button" className="secondary-action draft-action" onClick={() => fileInputRef.current?.click()} title="Restaura rascunhos a partir de um arquivo JSON exportado antes">
                    Restaurar backup
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: "none" }}
                    aria-label="Arquivo de backup JSON"
                    onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <ul className="shortcut-hints" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, color: "#64748b", fontSize: "0.8rem" }}>
                  <li><kbd>Ctrl</kbd>+<kbd>S</kbd> salvar rascunho</li>
                  <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> exportar DOCX</li>
                  <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> validar trabalho</li>
                  <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> visualizar</li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const DraftStatus = memo(DraftStatusComponent, (prev, next) => {
  return (
    prev.draftStatus === next.draftStatus &&
    prev.draftSaving === next.draftSaving &&
    prev.hasDraft === next.hasDraft &&
    prev.lastSavedAt === next.lastSavedAt &&
    prev.saveErrorKind === next.saveErrorKind &&
    prev.drafts === next.drafts &&
    prev.activeDraftId === next.activeDraftId &&
    prev.managerError === next.managerError &&
    prev.managerNotice === next.managerNotice &&
    prev.openSignal === next.openSignal &&
    prev.corruptionWarnings === next.corruptionWarnings &&
    prev.onDiscardCorrupted === next.onDiscardCorrupted
  );
});