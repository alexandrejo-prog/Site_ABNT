export type EditorCommand =
  | "bold"
  | "italic"
  | "removeFormat"
  | "formatBlock"
  | "insertText"
  | "undo"
  | "redo"
  | "insertUnorderedList"
  | "insertOrderedList";

export interface EditorCommandAdapter {
  applyEditorCommand(command: EditorCommand, value?: string): boolean;
  insertEditorText(text: string): boolean;
  formatEditorBlock(block: "h1" | "h2" | "blockquote" | "p"): boolean;
  clearEditorFormatting(): boolean;
}

export function createEditorCommandAdapter(scope: { document?: Document } = {}): EditorCommandAdapter {
  const doc = scope.document ?? (typeof document !== "undefined" ? document : undefined);
  const execCommand = doc?.execCommand;

  function safeExec(command: string, value?: string): boolean {
    if (!execCommand) return false;
    try {
      return execCommand(command, false, value);
    } catch {
      return false;
    }
  }

  return {
    applyEditorCommand(command, value) {
      return safeExec(command, value);
    },
    insertEditorText(text) {
      return safeExec("insertText", text);
    },
    formatEditorBlock(block) {
      const map: Record<string, string> = {
        h1: "h1",
        h2: "h2",
        blockquote: "blockquote",
        p: "p",
      };
      return safeExec("formatBlock", map[block] ?? "p");
    },
    clearEditorFormatting() {
      const remove = safeExec("removeFormat");
      const block = safeExec("formatBlock", "p");
      return remove || block;
    },
  };
}

export const editorCommandAdapter = createEditorCommandAdapter();
