function createEditorButton(label: string, title: string, command: "undo" | "redo"): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "icon-button editor-history-button";
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    const editor = document.querySelector<HTMLElement>(".rich-editor");
    editor?.focus({ preventScroll: true });
    document.execCommand(command, false);
    editor?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: command === "undo" ? "historyUndo" : "historyRedo" }));
  });

  return button;
}

function ensureUndoRedoButtons(): void {
  const toolbar = document.querySelector<HTMLElement>('.toolbar[aria-label="Ferramentas do editor"]');
  if (!toolbar || toolbar.querySelector(".editor-history-button")) return;

  toolbar.prepend(createEditorButton("↷", "Refazer", "redo"));
  toolbar.prepend(createEditorButton("↶", "Desfazer", "undo"));
}

if (typeof document !== "undefined") {
  ensureUndoRedoButtons();

  const observer = new MutationObserver(() => ensureUndoRedoButtons());
  observer.observe(document.body, { childList: true, subtree: true });
}
