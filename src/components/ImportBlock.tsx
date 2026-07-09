import { ChangeEvent } from "react";
import { Upload, XCircle } from "lucide-react";
import { WORK_TYPE_LABELS, type WorkTypeValue } from "../ufla-rules";

interface ImportBlockProps {
  importedFileName: string | null;
  workType: WorkTypeValue;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImport: () => void;
}

function selectedWorkTypeLabel(workType: WorkTypeValue): string {
  return workType ? WORK_TYPE_LABELS[workType] : "Nenhum tipo selecionado";
}

export function ImportBlock({ importedFileName, workType, onImport, onRemoveImport }: ImportBlockProps) {
  return (
    <section className="import-block" aria-label="Importar arquivo existente">
      <div className="import-block-header">
        <div>
          <p className="section-kicker">Etapa 1</p>
          <h2>Importar arquivo existente</h2>
        </div>
        {importedFileName && (
          <button
            className="secondary-action import-remove-action"
            type="button"
            onClick={onRemoveImport}
            title={`Remover importação: ${importedFileName}`}
          >
            <XCircle size={18} aria-hidden="true" />
            Remover
          </button>
        )}
      </div>

      <p className="import-block-text">
        Importe DOCX, TXT ou Markdown para extrair texto e metadados. Revise tudo antes de gerar.
      </p>

      <label className="upload-button import-main-action">
        <Upload size={18} aria-hidden="true" />
        Importar arquivo
        <input aria-label="Importar" type="file" accept=".docx,.txt,.md" onChange={onImport} />
      </label>

      {importedFileName ? (
        <div className="imported-file-summary" role="status">
          <p><strong>Arquivo importado:</strong> {importedFileName}</p>
          <p><strong>Tipo selecionado:</strong> {selectedWorkTypeLabel(workType)}</p>
          <p>Confira se o tipo de trabalho selecionado está correto antes de gerar o DOCX.</p>
        </div>
      ) : (
        <p className="import-caution">
          Importante: o tipo de trabalho não é alterado automaticamente pelo nome do arquivo. Confira se o modelo selecionado corresponde ao documento.
        </p>
      )}
    </section>
  );
}
