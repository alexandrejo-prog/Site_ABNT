import { type MouseEvent, type ReactNode } from "react";
import { type EditorCommand, editorCommandAdapter, getActiveRichEditor, saveEditorSelection } from "../editor-command-adapter";
import { useTiptapExperimentalEditor } from "../editor-feature-flags";

interface ToolButtonProps {
  title: string;
  glyph: ReactNode;
  onClick: () => void;
  className?: string;
  tooltip?: string;
}

function rememberEditorSelection() {
  const editor = getActiveRichEditor();
  if (editor) saveEditorSelection(editor);
}

export function runEditorCommand(command: EditorCommand | string) {
  if (useTiptapExperimentalEditor()) return;
  rememberEditorSelection();
  editorCommandAdapter.applyEditorCommand(command as EditorCommand);
}

export function insertEditorText(text: string) {
  if (useTiptapExperimentalEditor()) return;
  rememberEditorSelection();
  editorCommandAdapter.insertEditorText(text);
}

export function setLineSpacing(value: string) {
  if (useTiptapExperimentalEditor()) return;
  rememberEditorSelection();
  editorCommandAdapter.setCurrentBlockLineSpacing(value);
}

export function ToolButton({ title, glyph, onClick, className, tooltip }: ToolButtonProps) {
  function handleMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    rememberEditorSelection();
  }

  function handleClick() {
    rememberEditorSelection();
    onClick();
  }

  return (
    <button
      className={`word-tool-button ${className ?? ""}`.trim()}
      type="button"
      title={tooltip ?? title}
      aria-label={title}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <span className="word-tool-glyph" aria-hidden="true">{glyph}</span>
    </button>
  );
}

export function FontSelector({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span className="word-font-selector" title={title} aria-label={title}>
      {children}
    </span>
  );
}
