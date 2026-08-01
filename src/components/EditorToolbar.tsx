
import { editorCommandAdapter } from "../editor-command-adapter";
import { ToolButton, runEditorCommand } from "./ToolButton";
import { EDITOR_DESCRIPTION_ID } from "../app-constants";
import type { EditorMode } from "../hooks/useEditor";

interface Props {
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  isTiptapEditorEnabled: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  handleEditorInput: () => void;
  runEditorAction: (action: string, fn: () => void) => void;
  applyBlockStyle: (prefix: string) => void;
}

function wrapSelection(style: string): void {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.className = `fmt-${style}`;
  try { range.surroundContents(span); } catch { document.execCommand("styleWithCSS", false); }
  sel.removeAllRanges();
}

export default function EditorToolbar({ editorMode, setEditorMode, isTiptapEditorEnabled, editorRef, handleEditorInput, runEditorAction, applyBlockStyle }: Props) {
  return (
    <div className="editor-toolbar-sticky">
      <div className="word-ribbon-tabs" aria-label="Abas da faixa"><button className="word-ribbon-tab active" type="button">Página Inicial</button></div>
      <div className="toolbar editor-mode-toolbar" aria-label="Modo de edição">
        <button className={`text-button ${editorMode === "body" ? "active" : ""}`} type="button" onClick={() => setEditorMode("body")}>Texto</button>
        <button className={`text-button ${editorMode === "references" ? "active" : ""}`} type="button" onClick={() => setEditorMode("references")}>Referências</button>
      </div>
      {isTiptapEditorEnabled ? (
        <div className="tiptap-toolbar" aria-label="Faixa de formatação Tiptap">
          <div className="tiptap-toolbar-group"><span className="tiptap-toolbar-label">Texto</span><div className="tiptap-toolbar-row">
            <ToolButton title="Negrito" glyph="N" className="tool-negrito" onClick={() => runEditorAction("bold", () => wrapSelection("bold"))} />
            <ToolButton title="Itálico" glyph="I" onClick={() => runEditorAction("italic", () => wrapSelection("italic"))} />
            <ToolButton title="Sublinhado" glyph="S" className="tool-sublinhado" onClick={() => runEditorAction("underline", () => runEditorCommand("underline"))} />
            <ToolButton title="Limpar formatação" glyph="⌫" onClick={() => runEditorAction("clearFormatting", () => { editorRef.current?.focus(); editorCommandAdapter.clearEditorFormatting(); setTimeout(() => requestAnimationFrame(handleEditorInput), 0); })} />
          </div></div>
          <div className="tiptap-toolbar-group"><span className="tiptap-toolbar-label">Estrutura</span><div className="tiptap-toolbar-row">
            <ToolButton title="Normal" glyph="¶" onClick={() => runEditorAction("paragraph", () => applyBlockStyle("p"))} />
            <ToolButton title="Título 1" glyph="T1" onClick={() => runEditorAction("heading1", () => applyBlockStyle("# "))} />
            <ToolButton title="Título 2" glyph="T2" onClick={() => runEditorAction("heading2", () => applyBlockStyle("## "))} />
            <ToolButton title="Citação" glyph="❝" onClick={() => runEditorAction("blockquote", () => applyBlockStyle("> "))} />
            <ToolButton title="Ref. ABNT" glyph="Ref" tooltip="Marca o parágrafo como referência bibliográfica para a seção REFERÊNCIAS do DOCX." onClick={() => runEditorAction("reference", () => applyBlockStyle("[REF] "))} />
          </div></div>
          <div className="tiptap-toolbar-group"><span className="tiptap-toolbar-label">Listas</span><div className="tiptap-toolbar-row">
            <ToolButton title="Marcadores" glyph="•" onClick={() => runEditorAction("bulletList", () => runEditorCommand("insertUnorderedList"))} />
            <ToolButton title="Numerada" glyph="1." onClick={() => runEditorAction("orderedList", () => runEditorCommand("insertOrderedList"))} />
          </div></div>
          <div className="tiptap-toolbar-group"><span className="tiptap-toolbar-label">Alinhamento</span><div className="tiptap-toolbar-row">
            <ToolButton title="Alinhar à esquerda" glyph="E" onClick={() => runEditorAction("alignLeft", () => runEditorCommand("justifyLeft"))} />
            <ToolButton title="Centralizar" glyph="C" onClick={() => runEditorAction("alignCenter", () => runEditorCommand("justifyCenter"))} />
            <ToolButton title="Justificar" glyph="J" onClick={() => runEditorAction("alignJustify", () => runEditorCommand("justifyFull"))} />
          </div></div>
          <div className="tiptap-toolbar-group"><span className="tiptap-toolbar-label">Histórico</span><div className="tiptap-toolbar-row">
            <ToolButton title="Desfazer" glyph="↶" onClick={() => runEditorAction("undo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("undo"); })} />
            <ToolButton title="Refazer" glyph="↷" onClick={() => runEditorAction("redo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("redo"); })} />
          </div></div>
        </div>
      ) : (
        <div className="toolbar word-ribbon" aria-label="Faixa de formatação do editor">
          <div className="word-tool-group" data-group="Área de edição" aria-label="Área de Transferência"><div className="word-tool-row">
            <ToolButton title="Limpar formatação" glyph="⌫" onClick={() => runEditorAction("clearFormatting", () => { editorRef.current?.focus(); editorCommandAdapter.clearEditorFormatting(); setTimeout(() => requestAnimationFrame(handleEditorInput), 0); })} />
            <ToolButton title="Desfazer" glyph="↶" onClick={() => runEditorAction("undo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("undo"); })} />
            <ToolButton title="Refazer" glyph="↷" onClick={() => runEditorAction("redo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("redo"); })} />
          </div><span className="word-tool-group-label">Área de Transferência</span></div>
          <div className="word-tool-group" data-group="Estrutura" aria-label="Estrutura"><div className="word-tool-row">
            <ToolButton title="Título 1" glyph="T1" onClick={() => runEditorAction("heading1", () => applyBlockStyle("# "))} />
            <ToolButton title="Título 2" glyph="T2" onClick={() => runEditorAction("heading2", () => applyBlockStyle("## "))} />
            <ToolButton title="Citação longa" glyph="❝" onClick={() => runEditorAction("blockquote", () => applyBlockStyle("> "))} />
            <ToolButton title="Marcar como referência bibliográfica" glyph="Ref. ABNT" className="tool-reference" tooltip="Marca o parágrafo como referência bibliográfica para a seção REFERÊNCIAS do DOCX." onClick={() => runEditorAction("reference", () => applyBlockStyle("[REF] "))} />
          </div><span className="word-tool-group-label">Estrutura</span></div>
          <div className="word-tool-group" data-group="Parágrafo" aria-label="Parágrafo"><div className="word-tool-row">
            <ToolButton title="Lista com marcadores" glyph="•" onClick={() => runEditorAction("bulletList", () => runEditorCommand("insertUnorderedList"))} />
            <ToolButton title="Lista numerada" glyph="1." onClick={() => runEditorAction("orderedList", () => runEditorCommand("insertOrderedList"))} />
            <ToolButton title="Alinhar à esquerda" glyph="E" onClick={() => runEditorAction("alignLeft", () => runEditorCommand("justifyLeft"))} />
            <ToolButton title="Centralizar" glyph="C" onClick={() => runEditorAction("alignCenter", () => runEditorCommand("justifyCenter"))} />
            <ToolButton title="Justificar" glyph="J" onClick={() => runEditorAction("alignJustify", () => runEditorCommand("justifyFull"))} />
          </div><span className="word-tool-group-label">Parágrafo</span></div>
        </div>
      )}
      {isTiptapEditorEnabled && <p className="tiptap-mode-banner" role="note">Modo Tiptap experimental. Use para testar a nova edição. O DOCX continua sendo gerado pelo exportador estável.</p>}
      <p id={EDITOR_DESCRIPTION_ID} className="field-note editor-mode-note">{isTiptapEditorEnabled ? "Modo experimental de edição. Use para testar a nova experiência. O DOCX continua sendo gerado pelo exportador estável." : "Editor acadêmico: edite o conteúdo e marque a estrutura do texto. Fonte, tamanho, recuos e espaçamentos seguem automaticamente o padrão UFLA/ABNT no DOCX."}</p>
    </div>
  );
}
