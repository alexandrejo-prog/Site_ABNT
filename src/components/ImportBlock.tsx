import { ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Upload, XCircle } from "lucide-react";
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

      <p className="import-block-text" id="import-help-text">
        Importe DOCX, TXT ou Markdown para aproveitar texto e metadados. Depois confira o tipo de trabalho antes de gerar o DOCX.
      </p>

      <label className="upload-button import-main-action">
        <Upload size={18} aria-hidden="true" />
        Importar arquivo
        <input aria-label="Importar" aria-describedby="import-help-text" type="file" accept=".docx,.txt,.md" onChange={onImport} />
      </label>

      {importedFileName ? (
        <div className="imported-file-summary" role="status" aria-live="polite">
          <p className="imported-file-name"><CheckCircle2 size={16} aria-hidden="true" /><strong>Arquivo:</strong> <span>{importedFileName}</span></p>
          <p><strong>Modelo selecionado:</strong> {selectedWorkTypeLabel(workType)}</p>
          <p className="import-review-warning"><AlertTriangle size={16} aria-hidden="true" />O modelo selecionado define capa, ficha, folha de aprovação e sumário. Altere o tipo se o arquivo importado não corresponder ao modelo.</p>
        </div>
      ) : (
        <p className="import-caution">
          O sistema não muda o tipo de trabalho pelo nome do arquivo. Primeiro importe; depois confirme o modelo na etapa 2.
        </p>
      )}
    </section>
  );
}
