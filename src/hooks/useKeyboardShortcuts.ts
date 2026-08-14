import { useEffect, useRef } from "react";

export interface KeyboardShortcutActions {
  onSaveDraft?: () => void;
  onExportDocx?: () => void;
  onToggleValidation?: () => void;
  onTogglePreview?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]') !== null;
}

/**
 * Registra atalhos globais da aplicação:
 * - Ctrl/Cmd+S → salvar rascunho (sem baixar arquivo);
 * - Ctrl/Cmd+Shift+E → exportar DOCX;
 * - Ctrl/Cmd+Shift+V → alternar/executar validação;
 * - Ctrl/Cmd+Shift+P → abrir/fechar preview.
 *
 * Regras: não interfere em input/textarea/select/contentEditable; só previne
 * o comportamento nativo quando existe ação da aplicação para o atalho; ignora
 * teclas repetidas (evita loops de geração); registra um único listener e o
 * remove no unmount.
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions): void {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const action = event.shiftKey
        ? key === "e"
          ? actionsRef.current.onExportDocx
          : key === "v"
            ? actionsRef.current.onToggleValidation
            : key === "p"
              ? actionsRef.current.onTogglePreview
              : undefined
        : key === "s"
          ? actionsRef.current.onSaveDraft
          : undefined;

      if (!action) return; // preserva atalhos nativos sem ação da aplicação
      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
