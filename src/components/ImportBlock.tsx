import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent } from "react";
import { Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "../import-docx";
import type { ImportedDocumentImage } from "../imported-images";
import { emptyAcademicFields, emptyConfidenceMap, WORK_TYPE_LABELS } from "../ufla-rules";

export interface ImportBlockHandle {
  open: () => void;
}

interface ImportBlockProps {
  onImport: (result: {
    fields: ReturnType<typeof emptyAcademicFields>;
    confidence: ReturnType<typeof emptyConfidenceMap>;
    editorText: string;
    messages: string[];
    fileName: string;
    importedImages?: ImportedDocumentImage[];
  }) => void;
  onRemove: () => void;
  onNewDocument?: () => void;
  importedFileName: string | null;
  workType: string;
}

function selectedWorkTypeLabel(workType: string): string {
  return workType ? WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] || workType : "Nenhum tipo selecionado";
}

export const ImportBlock = forwardRef<ImportBlockHandle, ImportBlockProps>(
  function ImportBlock({ onImport, onRemove, onNewDocument, importedFileName, workType }: ImportBlockProps, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => inputRef.current?.click(),
    }));

    async function handleChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        setStatus("Importando arquivo...");
        const result = await importDocumentFile(file);
        onImport({ ...result, fileName: file.name });
        setStatus(`Arquivo importado: ${file.name}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Falha ao importar.");
      } finally {
        event.target.value = "";
      }
    }

    return (
      <div className="import-block">
        <h2 className="import-block-title sr-only">Importar arquivo existente</h2>
        <p className="import-block-hint sr-only">Importe DOCX, TXT ou Markdown para extrair texto e metadados. Revise tudo antes de gerar.</p>
        <div className="import-actions-row">
          <label className="upload-button primary">
            <Upload size={16} aria-hidden="true" />
            <span>Importar arquivo</span>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.txt,.md"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          </label>
          {onNewDocument && (
            <button className="secondary-action" type="button" onClick={onNewDocument}>
              Novo documento
            </button>
          )}
        </div>
        {importedFileName ? (
          <div className="import-status">
            <span className="import-file-name">Arquivo: {importedFileName}</span>
            <span className="import-work-type">Tipo selecionado: {selectedWorkTypeLabel(workType)}</span>
            <button className="secondary-action" type="button" onClick={onRemove} title={`Remover importação: ${importedFileName}`}>
              <XCircle size={16} aria-hidden="true" />
              <span>Remover importação</span>
            </button>
          </div>
        ) : null}
        {status && <p className="import-note" role="status" aria-live="polite">{status}</p>}
      </div>
    );
  },
);
