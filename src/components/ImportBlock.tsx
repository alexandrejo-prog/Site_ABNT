import { useRef, useState } from "react";
import { Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "../import-docx";
import { importAcademicFile } from "../import-file-router";
import type { ImportedDocumentImage } from "../imported-images";
import type { ImportedPdfDocument } from "../imported-pdf";
import { emptyAcademicFields, emptyConfidenceMap, WORK_TYPE_LABELS } from "../ufla-rules";

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
  importedFileName: string | null;
  workType: string;
}

function selectedWorkTypeLabel(workType: string): string {
  return workType ? WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] || workType : "Nenhum tipo selecionado";
}

function buildPdfDiagnosticText(pdf: ImportedPdfDocument): string {
  return pdf.pages
    .map((page) => `— Página ${page.pageNumber} —\n${page.normalizedText}`)
    .join("\n\n")
    .slice(0, 4000);
}

export function ImportBlock({ onImport, onRemove, importedFileName, workType }: ImportBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfDiagnostic, setPdfDiagnostic] = useState<ImportedPdfDocument | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus("Importando arquivo...");
      setPdfDiagnostic(null);
      if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
        const result = await importAcademicFile(file);
        if (result.kind === "pdf") {
          setPdfDiagnostic(result.document);
          setStatus(`PDF lido: ${result.document.source.fileName} (${result.document.source.pageCount} páginas). Integração com geração de DOCX ainda é experimental.`);
        } else if (result.kind === "unknown") {
          setStatus(result.error);
        } else {
          onImport({ ...result.result, fileName: file.name });
          setStatus(`Arquivo importado: ${file.name}`);
        }
        return;
      }
      const docResult = await importDocumentFile(file);
      onImport({ ...docResult, fileName: file.name });
      setStatus(`Arquivo importado: ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      event.target.value = "";
    }
  }

  function clearPdfDiagnostic() {
    setPdfDiagnostic(null);
    setStatus(null);
  }

  return (
    <div className="import-block">
      <div className="import-header">
        <div>
          <h2>Importar arquivo existente</h2>
          <p>Importe DOCX, TXT, Markdown ou PDF para extrair texto e metadados. O site decide como tratar cada arquivo. Revise tudo antes de gerar.</p>
        </div>
        <label className="upload-button primary">
          <Upload size={18} aria-hidden="true" />
          <span>Importar arquivo</span>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.txt,.md,.pdf"
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
      {pdfDiagnostic ? (
        <div className="import-pdf-diagnostic">
          <h3>Diagnóstico de PDF (experimental)</h3>
          <ul>
            <li><strong>Arquivo:</strong> {pdfDiagnostic.source.fileName}</li>
            <li><strong>Páginas:</strong> {pdfDiagnostic.source.pageCount}</li>
            <li>
              <strong>Confiança de texto:</strong> {pdfDiagnostic.quality.textConfidence} |{" "}
              <strong>Confiança de layout:</strong> {pdfDiagnostic.quality.layoutConfidence} |{" "}
              <strong>Revisão manual:</strong> {pdfDiagnostic.quality.requiresManualReview ? "necessária" : "não"}
            </li>
          </ul>
          {pdfDiagnostic.diagnostics.map((d, i) => (
            <p key={i} className={`import-note import-note-${d.severity}`}>
              [{d.severity}] {d.message}
            </p>
          ))}
          <details>
            <summary>Texto extraído do PDF ({pdfDiagnostic.source.pageCount} páginas)</summary>
            <pre className="import-pdf-text">{buildPdfDiagnosticText(pdfDiagnostic)}</pre>
          </details>
          <button className="secondary-action" type="button" onClick={clearPdfDiagnostic} title="Fechar diagnóstico de PDF">
            <XCircle size={18} aria-hidden="true" />
            <span>Fechar diagnóstico</span>
          </button>
        </div>
      ) : null}
      {status && <p className="import-note" role="status" aria-live="polite">{status}</p>}
    </div>
  );
}
