import { ClipboardEvent, Suspense, lazy } from "react";
import { editorCommandAdapter } from "../editor-command-adapter";
import { EDITOR_DESCRIPTION_ID } from "../app-constants";
import EditorToolbar from "./EditorToolbar";
import { AdherencePanel } from "./AdherencePanel";
import type { EditorMode } from "../hooks/useEditor";

const AcademicTiptapEditor = lazy(() => import("./AcademicTiptapEditor"));

interface Props {
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  isTiptapEditorEnabled: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  handleEditorInput: () => void;
  runEditorAction: (cmd: string, fn: () => void) => void;
  applyBlockStyle: (prefix: string) => void;
  activeEditorText: string;
  updateField: (key: any, value: string) => void;
  setEditorText: (t: string) => void;
  tiptapCommandSignal: any;
  adherenceExpanded: boolean;
  setAdherenceExpanded: (v: boolean) => void;
}

export default function EditorSection({
  editorMode, setEditorMode, isTiptapEditorEnabled, editorRef, handleEditorInput,
  runEditorAction, applyBlockStyle, activeEditorText, updateField, setEditorText,
  tiptapCommandSignal, adherenceExpanded, setAdherenceExpanded,
}: Props) {
  return (
    <section className="editor-pane" aria-label="Editor do texto">
      <EditorToolbar editorMode={editorMode} setEditorMode={setEditorMode} isTiptapEditorEnabled={isTiptapEditorEnabled} editorRef={editorRef} handleEditorInput={handleEditorInput} runEditorAction={runEditorAction} applyBlockStyle={applyBlockStyle} />
      <div className="editor-page-stack" aria-label="Editor de texto contínuo">
        <div className="editor-page-shell">
          {isTiptapEditorEnabled ? (
            <Suspense fallback={<div className="editor rich-editor tiptap-loading" role="status">Carregando editor Tiptap experimental...</div>}>
              <AcademicTiptapEditor value={activeEditorText} onChange={(v) => editorMode === "references" ? updateField("referencias", v) : setEditorText(v)} ariaLabel={editorMode === "references" ? "Editor de referências" : "Editor do texto principal"} describedBy={EDITOR_DESCRIPTION_ID} editable={true} commandSignal={tiptapCommandSignal} editorMode={editorMode} />
            </Suspense>
          ) : (
            <div ref={editorRef as any} className="editor rich-editor" data-editor-mode={editorMode} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-describedby={EDITOR_DESCRIPTION_ID} aria-label={editorMode === "references" ? "Editor de referências" : "Editor do texto principal"} onInput={handleEditorInput} onPaste={(e: ClipboardEvent<HTMLDivElement>) => { e.preventDefault(); editorCommandAdapter.insertEditorText(e.clipboardData.getData("text/plain")); setTimeout(() => requestAnimationFrame(handleEditorInput), 0); }} spellCheck />
          )}
        </div>
      </div>
      <p className="editor-page-note">Editor em visualização contínua. A paginação final deve ser conferida no Word/LibreOffice após atualizar campos e sumário.</p>
      <AdherencePanel expanded={adherenceExpanded} onToggle={() => setAdherenceExpanded(!adherenceExpanded)} />
    </section>
  );
}
