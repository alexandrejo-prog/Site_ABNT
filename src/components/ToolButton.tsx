import { ReactNode } from "react";

interface ToolButtonProps {
  title: string;
  glyph: ReactNode;
  onClick: () => void;
  className?: string;
}

function dispatchEditorInput(editor: HTMLElement) {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function editorElement(): HTMLElement | null {
  return document.querySelector(".rich-editor") as HTMLElement | null;
}

export function runEditorCommand(command: string) {
  const editor = editorElement();
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false);
  dispatchEditorInput(editor);
}

export function insertEditorText(text: string) {
  const editor = editorElement();
  if (!editor) return;
  editor.focus();
  document.execCommand("insertText", false, text);
  dispatchEditorInput(editor);
}

function currentBlock(editor: HTMLElement): HTMLElement | null {
  const selection = document.getSelection();
  const node = selection?.anchorNode;
  if (!node) return editor.querySelector("p, h1, h2, h3, blockquote, li");
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return element?.closest("p, h1, h2, h3, blockquote, li") as HTMLElement | null;
}

export function setLineSpacing(value: string) {
  const editor = editorElement();
  if (!editor) return;
  editor.focus();
  const block = currentBlock(editor);
  if (!block) return;
  block.style.lineHeight = value;
  block.dataset.lineSpacing = value;
  dispatchEditorInput(editor);
}

export function ToolButton({ title, glyph, onClick, className }: ToolButtonProps) {
  return (
    <button
      className={`word-tool-button ${className ?? ""}`.trim()}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <span className="word-tool-glyph" aria-hidden="true">{glyph}</span>
    </button>
  );
}
