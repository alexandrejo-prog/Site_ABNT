export type EditorCommand =
  | "bold"
  | "italic"
  | "underline"
  | "removeFormat"
  | "formatBlock"
  | "insertText"
  | "undo"
  | "redo"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "outdent"
  | "indent"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull";

export type EditorBlockTag = "h1" | "h2" | "blockquote" | "p";

export interface EditorCommandAdapter {
  applyEditorCommand(command: EditorCommand, value?: string): boolean;
  insertEditorText(text: string): boolean;
  formatEditorBlock(block: EditorBlockTag): boolean;
  clearEditorFormatting(): boolean;
  setCurrentBlockLineSpacing(value: string): boolean;
  setCurrentBlockIndent(kind: "firstLine" | "left" | "right", valueCm: number): boolean;
  adjustCurrentBlockIndent(kind: "firstLine" | "left" | "right", deltaCm: number): boolean;
}

let lastEditorRange: Range | null = null;

function docFromScope(scopeDocument?: Document): Document | undefined {
  return scopeDocument ?? (typeof document !== "undefined" ? document : undefined);
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function asElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE && isHTMLElement(node)) return node;
  return node.parentElement;
}

function ownsNode(editor: HTMLElement, node: Node | null): boolean {
  if (!node) return false;
  return node === editor || editor.contains(node);
}

function selectionInsideEditor(editor: HTMLElement, selection: Selection | null): boolean {
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return ownsNode(editor, range.commonAncestorContainer) || ownsNode(editor, selection.anchorNode);
}

export function getActiveRichEditor(scopeDocument?: Document): HTMLElement | null {
  const doc = docFromScope(scopeDocument);
  if (!doc || typeof doc.querySelector !== "function") return null;

  const active = doc.activeElement;
  if (isHTMLElement(active)) {
    const activeEditor = active.closest(".rich-editor[contenteditable='true'], .rich-editor, [contenteditable='true']");
    if (isHTMLElement(activeEditor)) return activeEditor;
  }

  const candidates = [
    ".rich-editor[contenteditable='true']",
    ".rich-editor",
    "[contenteditable='true']",
  ];

  for (const selector of candidates) {
    const editor = doc.querySelector(selector);
    if (isHTMLElement(editor)) return editor;
  }

  return null;
}

export function saveEditorSelection(editor: HTMLElement | null = getActiveRichEditor()): boolean {
  if (!editor) return false;
  const doc = editor.ownerDocument;
  const selection = doc.getSelection?.();
  if (!selectionInsideEditor(editor, selection)) return false;

  lastEditorRange = selection!.getRangeAt(0).cloneRange();
  return true;
}

export function restoreEditorSelection(editor: HTMLElement | null = getActiveRichEditor()): boolean {
  if (!editor || !lastEditorRange) return false;
  const doc = editor.ownerDocument;
  const selection = doc.getSelection?.();
  if (!selection) return false;

  try {
    if (!ownsNode(editor, lastEditorRange.commonAncestorContainer)) return false;
    selection.removeAllRanges();
    selection.addRange(lastEditorRange);
    return true;
  } catch {
    return false;
  }
}

export function focusEditor(editor: HTMLElement | null = getActiveRichEditor()): void {
  editor?.focus();
}

export function dispatchEditorInput(editor: HTMLElement): void {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function currentBlock(editor: HTMLElement): HTMLElement | null {
  const doc = editor.ownerDocument;
  const selection = doc.getSelection?.();
  const node = selection?.anchorNode ?? null;
  const element = ownsNode(editor, node) ? asElement(node) : null;
  const block = element?.closest("p, h1, h2, h3, blockquote, li, div") as HTMLElement | null;
  if (block && block !== editor && editor.contains(block)) return block;
  const fallback = editor.querySelector("p, h1, h2, h3, blockquote, li, div") as HTMLElement | null;
  return fallback && fallback !== editor ? fallback : editor;
}

function boundedCm(value: number, max: number): number {
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function readCm(element: HTMLElement, property: "textIndent" | "marginLeft" | "marginRight"): number {
  const raw = element.style[property];
  if (!raw) return 0;
  const match = raw.match(/^([0-9.]+)cm$/);
  return match ? Number(match[1]) : 0;
}

export function createEditorCommandAdapter(scope: { document?: Document } = {}): EditorCommandAdapter {
  const doc = docFromScope(scope.document);
  const execCommand = doc?.execCommand?.bind(doc);

  function safeExec(command: string, value?: string): boolean {
    if (!execCommand) return false;
    try {
      return execCommand(command, false, value);
    } catch {
      return false;
    }
  }

  function withEditor(action: (editor: HTMLElement | null) => boolean, dispatchInput = true): boolean {
    const editor = getActiveRichEditor(doc);
    if (editor) {
      saveEditorSelection(editor);
      focusEditor(editor);
      restoreEditorSelection(editor);
    }

    const result = action(editor);

    if (editor && dispatchInput) {
      saveEditorSelection(editor);
      dispatchEditorInput(editor);
    }

    return result;
  }

  function setBlockIndent(kind: "firstLine" | "left" | "right", valueCm: number): boolean {
    return withEditor((editor) => {
      if (!editor) return false;
      const block = currentBlock(editor);
      if (!block) return false;

      const max = kind === "firstLine" ? 3 : 4;
      const normalized = boundedCm(valueCm, max);
      const value = `${normalized}cm`;

      if (kind === "firstLine") {
        block.style.textIndent = value;
        block.dataset.firstLineIndent = String(normalized);
      } else if (kind === "left") {
        block.style.marginLeft = value;
        block.dataset.leftIndent = String(normalized);
      } else {
        block.style.marginRight = value;
        block.dataset.rightIndent = String(normalized);
      }

      return true;
    });
  }

  return {
    applyEditorCommand(command, value) {
      return withEditor(() => safeExec(command, value));
    },
    insertEditorText(text) {
      return withEditor(() => safeExec("insertText", text));
    },
    formatEditorBlock(block) {
      const map: Record<EditorBlockTag, string> = {
        h1: "h1",
        h2: "h2",
        blockquote: "blockquote",
        p: "p",
      };
      return withEditor(() => safeExec("formatBlock", map[block] ?? "p"));
    },
    clearEditorFormatting() {
      return withEditor(() => {
        const remove = safeExec("removeFormat");
        const block = safeExec("formatBlock", "p");
        return remove || block;
      });
    },
    setCurrentBlockLineSpacing(value) {
      return withEditor((editor) => {
        if (!editor) return false;
        const block = currentBlock(editor);
        if (!block) return false;
        block.style.lineHeight = value;
        block.dataset.lineSpacing = value;
        return true;
      });
    },
    setCurrentBlockIndent(kind, valueCm) {
      return setBlockIndent(kind, valueCm);
    },
    adjustCurrentBlockIndent(kind, deltaCm) {
      const editor = getActiveRichEditor(doc);
      if (!editor) return false;
      restoreEditorSelection(editor);
      const block = currentBlock(editor);
      if (!block) return false;

      const property = kind === "firstLine" ? "textIndent" : kind === "left" ? "marginLeft" : "marginRight";
      const max = kind === "firstLine" ? 3 : 4;
      const current = readCm(block, property);
      return setBlockIndent(kind, boundedCm(current + deltaCm, max));
    },
  };
}

export const editorCommandAdapter = createEditorCommandAdapter();
