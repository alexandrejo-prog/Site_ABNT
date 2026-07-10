import { ReactNode } from "react";

interface ToolButtonProps {
  title: string;
  children: ReactNode;
  onClick: () => void;
}

type AcademicTool = {
  label: string;
  title: string;
  group: "Fonte" | "Parágrafo" | "Alinhamento" | "Espaçamento";
  action: () => void;
  className?: string;
};

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

function AcademicToolButton({ label, title, action, className }: AcademicTool) {
  return (
    <button className={`word-tool-button ${className ?? ""}`.trim()} type="button" title={title} aria-label={title} onClick={action}>
      <span className="word-tool-glyph" aria-hidden="true">{label}</span>
      <span className="word-tool-caption">{title}</span>
    </button>
  );
}

function AcademicToolGroup({ label, tools }: { label: AcademicTool["group"]; tools: AcademicTool[] }) {
  return (
    <span className="word-tool-group" aria-label={label}>
      <span className="word-tool-row">
        {tools.map((tool) => <AcademicToolButton key={tool.title} {...tool} />)}
      </span>
      <span className="word-tool-group-label">{label}</span>
    </span>
  );
}

function AcademicExtraTools() {
  const tools: AcademicTool[] = [
    { group: "Fonte", label: "S", title: "Sublinhado", action: () => runEditorCommand("underline"), className: "underline-tool" },
    { group: "Parágrafo", label: "•", title: "Marcadores", action: () => runEditorCommand("insertUnorderedList") },
    { group: "Parágrafo", label: "1.", title: "Numeração", action: () => runEditorCommand("insertOrderedList") },
    { group: "Parágrafo", label: "Tab", title: "Tabulação", action: () => insertEditorText("\t") },
    { group: "Parágrafo", label: "‹", title: "Diminuir recuo", action: () => runEditorCommand("outdent") },
    { group: "Parágrafo", label: "›", title: "Aumentar recuo", action: () => runEditorCommand("indent") },
    { group: "Alinhamento", label: "☰", title: "Esquerda", action: () => runEditorCommand("justifyLeft"), className: "align-left-tool" },
    { group: "Alinhamento", label: "☷", title: "Centro", action: () => runEditorCommand("justifyCenter"), className: "align-center-tool" },
    { group: "Alinhamento", label: "▤", title: "Justificar", action: () => runEditorCommand("justifyFull"), className: "align-justify-tool" },
    { group: "Espaçamento", label: "1,0", title: "Simples", action: () => setLineSpacing("1.2") },
    { group: "Espaçamento", label: "1,5", title: "1,5", action: () => setLineSpacing("1.5") },
    { group: "Espaçamento", label: "2,0", title: "Duplo", action: () => setLineSpacing("2") },
  ];
  const groups: AcademicTool["group"][] = ["Fonte", "Parágrafo", "Alinhamento", "Espaçamento"];

  return (
    <span className="word-ribbon-extra" aria-label="Ferramentas acadêmicas adicionais">
      {groups.map((group) => <AcademicToolGroup key={group} label={group} tools={tools.filter((tool) => tool.group === group)} />)}
    </span>
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
