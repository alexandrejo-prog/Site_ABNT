import { useRef, useState } from "react";
import { Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "../import-docx";
import { emptyAcademicFields, emptyConfidenceMap, WORK_TYPE_LABELS } from "../ufla-rules";

interface ImportBlockProps {
  onImport: (result: {
    fields: ReturnType<typeof emptyAcademicFields>;
    confidence: ReturnType<typeof emptyConfidenceMap>;
    editorText: string;
    messages: string[];
    fileName: string;
  }) => void;
  onRemove: () => void;
  importedFileName: string | null;
  workType: string;
}

function selectedWorkTypeLabel(workType: string): string {
  return workType ? WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] || workType : "Nenhum tipo selecionado";
}

export function ImportBlock({ onImport, onRemove, importedFileName, workType }: ImportBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
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
      <div className="import-header">
        <div>
          <h2>Importar arquivo existente</h2>
          <p>Importe DOCX, TXT ou Markdown para extrair texto e metadados. Revise tudo antes de gerar.</p>
        </div>
        <label className="upload-button primary">
          <Upload size={18} aria-hidden="true" />
          <span>Importar arquivo</span>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.txt,.md"
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {importedFileName ? (
        <div className="import-status">
          <span className="import-file-name">Arquivo: {importedFileName}</span>
          <span className="import-work-type">Tipo selecionado: {selectedWorkTypeLabel(workType)}</span>
          <p className="import-confirm">Confira se o tipo de trabalho selecionado está correto antes de gerar o DOCX.</p>
          <button className="secondary-action" type="button" onClick={onRemove} title={`Remover importação: ${importedFileName}`}>
            <XCircle size={18} aria-hidden="true" />
            <span>Remover importação</span>
          </button>
        </div>
      ) : (
        <p className="import-disclaimer">
          Importante: o tipo de trabalho não é alterado automaticamente pelo nome do arquivo. Confira se o modelo selecionado corresponde ao documento.
        </p>
      )}
      {status && <p className="import-note" role="status" aria-live="polite">{status}</p>}
    </div>
  );
}
