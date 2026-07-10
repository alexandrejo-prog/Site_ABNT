import { ReactNode } from "react";

interface ToolButtonProps {
  title: string;
  children: ReactNode;
  onClick: () => void;
}

function dispatchEditorInput(editor: HTMLElement) {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function editorElement(): HTMLElement | null {
  return document.querySelector(".rich-editor") as HTMLElement | null;
}

function runEditorCommand(command: string) {
  const editor = editorElement();
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false);
  dispatchEditorInput(editor);
}

function insertEditorText(text: string) {
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

function setLineSpacing(value: string) {
  const editor = editorElement();
  if (!editor) return;
  editor.focus();
  const block = currentBlock(editor);
  if (!block) return;
  block.style.lineHeight = value;
  block.dataset.lineSpacing = value;
  dispatchEditorInput(editor);
}

function AcademicExtraTools() {
  const tools: Array<{ label: string; title: string; action: () => void }> = [
    { label: "S", title: "Sublinhado", action: () => runEditorCommand("underline") },
    { label: "•", title: "Lista com marcadores", action: () => runEditorCommand("insertUnorderedList") },
    { label: "1.", title: "Lista numerada", action: () => runEditorCommand("insertOrderedList") },
    { label: "⇥", title: "Inserir tabulação", action: () => insertEditorText("\t") },
    { label: "←", title: "Diminuir recuo", action: () => runEditorCommand("outdent") },
    { label: "→", title: "Aumentar recuo", action: () => runEditorCommand("indent") },
    { label: "E", title: "Alinhar à esquerda", action: () => runEditorCommand("justifyLeft") },
    { label: "C", title: "Centralizar", action: () => runEditorCommand("justifyCenter") },
    { label: "J", title: "Justificar", action: () => runEditorCommand("justifyFull") },
    { label: "1,0", title: "Espaçamento simples no parágrafo atual", action: () => setLineSpacing("1.2") },
    { label: "1,5", title: "Espaçamento 1,5 no parágrafo atual", action: () => setLineSpacing("1.5") },
    { label: "2,0", title: "Espaçamento duplo no parágrafo atual", action: () => setLineSpacing("2") },
  ];

  return (
    <>
      <span className="toolbar-separator academic-static-separator" aria-hidden="true" />
      {tools.map((tool) => (
        <button key={tool.title} className="icon-button academic-extra-button" type="button" title={tool.title} aria-label={tool.title} onClick={tool.action}>
          {tool.label}
        </button>
      ))}
    </>
  );
}

export function ToolButton({ title, children, onClick }: ToolButtonProps) {
  return (
    <>
      <button className="icon-button" type="button" title={title} onClick={onClick}>{children}<span className="sr-only">{title}</span></button>
      {title === "Limpar formatação" && <AcademicExtraTools />}
    </>
  );
}
