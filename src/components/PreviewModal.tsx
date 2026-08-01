import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileDown, PencilLine, Eye, ZoomIn, ZoomOut } from "lucide-react";
import { buildPreviewHtml } from "../preview-html";
import { editorMarkupToHtml, editorHtmlToMarkup } from "../editor-markup";
import { editorCommandAdapter } from "../editor-command-adapter";
import type { DocxGenerationInput } from "../export-docx";
import type { AcademicFieldKey } from "../ufla-rules";

export interface PreviewModalProps {
  input: DocxGenerationInput;
  onClose: () => void;
  onCommitEditorText: (text: string) => void;
  onUpdateField: (key: AcademicFieldKey, value: string) => void;
  onGenerate: () => void;
}

const MIN_SCALE = 50;
const MAX_SCALE = 150;

const EDITABLE_FIELDS: Array<{ key: AcademicFieldKey; label: string }> = [
  { key: "author", label: "Autor(a)" },
  { key: "title", label: "Título" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "advisor", label: "Orientador(a)" },
  { key: "coadvisor", label: "Coorientador(a)" },
  { key: "year", label: "Ano" },
];

export function PreviewModal({
  input,
  onClose,
  onCommitEditorText,
  onUpdateField,
  onGenerate,
}: PreviewModalProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [scale, setScale] = useState(90);
  const [draftText, setDraftText] = useState(input.editorText);
  const editableRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => buildPreviewHtml(input), [input]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (mode === "edit" && editableRef.current) {
      editableRef.current.innerHTML = editorMarkupToHtml(draftText);
    }
  }, [mode, draftText]);

  const commitDraft = (): void => {
    if (!editableRef.current) return;
    const markup = editorHtmlToMarkup(editableRef.current);
    setDraftText(markup);
    onCommitEditorText(markup);
  };

  const runEditCommand = (command: string, value?: string): void => {
    editableRef.current?.focus();
    const applied = editorCommandAdapter.applyEditorCommand(command as never, value);
    if (!applied && command === "bold") document.execCommand("bold");
    if (!applied && command === "italic") document.execCommand("italic");
    if (!applied && command === "underline") document.execCommand("underline");
    if (!applied && command === "formatBlock") document.execCommand("formatBlock", false, value);
    setTimeout(commitDraft, 0);
  };

  const changeScale = (delta: number): void => {
    setScale((current) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta)));
  };

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const pages = useMemo(() => {
    const count = (html.match(/<section class="preview-page/g) ?? []).length;
    return count;
  }, [html]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="preview-modal-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização do documento">
      <div className="preview-modal-shell">
        <header className="preview-modal-header">
          <h2 className="preview-modal-title">Pré-visualização fiel ao DOCX</h2>
          <div className="preview-modal-toolbar">
            <div className="preview-scale-controls" aria-label="Escala de zoom">
              <button className="preview-action" type="button" onClick={() => changeScale(-10)} aria-label="Diminuir zoom"><ZoomOut size={16} aria-hidden="true" /></button>
              <input
                className="preview-scale-input"
                type="number"
                min={MIN_SCALE}
                max={MAX_SCALE}
                value={scale}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
                }}
                aria-label="Escala em porcentagem"
              />
              <span>%</span>
              <button className="preview-action" type="button" onClick={() => changeScale(10)} aria-label="Aumentar zoom"><ZoomIn size={16} aria-hidden="true" /></button>
            </div>
            <span className="preview-scale-controls">{pages} página(s) simuladas</span>
            <button className={`preview-action ${mode === "view" ? "active" : ""}`} type="button" onClick={() => { commitDraft(); setMode("view"); }}><Eye size={16} aria-hidden="true" />Visualizar</button>
            <button className={`preview-action ${mode === "edit" ? "active" : ""}`} type="button" onClick={() => { commitDraft(); setMode("edit"); }}><PencilLine size={16} aria-hidden="true" />Editar</button>
            <button className="preview-action primary" type="button" onClick={() => { commitDraft(); onGenerate(); }}><FileDown size={16} aria-hidden="true" />Gerar DOCX</button>
            <button className="preview-action-close" type="button" onClick={onClose} aria-label="Fechar pré-visualização"><X size={16} aria-hidden="true" /></button>
          </div>
        </header>
        {mode === "edit" && (
          <div className="preview-edit-toolbar" aria-label="Ferramentas de edição">
            <button type="button" onClick={() => runEditCommand("bold")}><strong>N</strong></button>
            <button type="button" onClick={() => runEditCommand("italic")}><em>I</em></button>
            <button type="button" onClick={() => runEditCommand("underline")}>S</button>
            <button type="button" onClick={() => runEditCommand("formatBlock", "h1")}>Título 1</button>
            <button type="button" onClick={() => runEditCommand("formatBlock", "h2")}>Título 2</button>
            <button type="button" onClick={() => runEditCommand("formatBlock", "blockquote")}>Citação</button>
            <button type="button" onClick={() => runEditCommand("formatBlock", "p")}>Parágrafo</button>
          </div>
        )}
        <div className="preview-viewport" ref={viewportRef}>
          <div className="preview-scale-wrap" style={{ transform: `scale(${scale / 100})` }}>
            {mode === "edit" ? (
              <section className="preview-page">
                <div
                  ref={editableRef}
                  className="preview-editable editing"
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Editor inline do texto do documento"
                  onInput={commitDraft}
                  spellCheck
                />
              </section>
            ) : (
              <div className="preview-document" dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
        {mode === "edit" && (
          <div className="preview-edit-toolbar" aria-label="Campos de metadados editáveis">
            {EDITABLE_FIELDS.map((field) => (
              <label key={field.key} className="preview-edit-field">
                {field.label}:{" "}
                <input
                  type="text"
                  defaultValue={input.fields[field.key] as string}
                  onBlur={(event) => onUpdateField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
