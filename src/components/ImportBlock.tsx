import { useRef, useState } from "react";
import { Upload, XCircle, FileDown } from "lucide-react";
import { importDocumentFile } from "../import-docx";
import { buildPdfCopyDocxBlob, pdfCopyDocxFileName } from "../pdf-to-copy-docx";
import type { ImportedDocumentImage } from "../imported-images";
import type { ImportedTable } from "../imported-tables";
import type { DocumentMode, SourceKind } from "../import-contract";
import type { ImportedPdfDiagnostic } from "../imported-pdf-diagnostic";
import { emptyAcademicFields, emptyConfidenceMap, WORK_TYPE_LABELS } from "../ufla-rules";

interface ImportBlockProps {
  onImport: (result: {
    sourceKind: SourceKind;
    documentMode: DocumentMode;
    fields: ReturnType<typeof emptyAcademicFields>;
    confidence: ReturnType<typeof emptyConfidenceMap>;
    editorText: string;
    messages: string[];
    fileName: string;
    importedImages?: ImportedDocumentImage[];
    importedTables?: ImportedTable[];
    pdfDiagnostic?: ImportedPdfDiagnostic;
    pdfBytes?: Uint8Array;
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
  const [lastPdfResult, setLastPdfResult] = useState<{
    fileName: string;
    editorText: string;
    importedImages: ImportedDocumentImage[];
    importedTables: ImportedTable[];
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus("Importando arquivo...");
      const result = await importDocumentFile(file);
      const extra: { fileName: string; pdfBytes?: Uint8Array } = { fileName: file.name };
      if (result.sourceKind === "pdf") {
        extra.pdfBytes = new Uint8Array(await file.arrayBuffer());
        setLastPdfResult({
          fileName: file.name,
          editorText: result.editorText,
          importedImages: result.importedImages,
          importedTables: result.importedTables,
        });
      } else {
        setLastPdfResult(null);
      }
      onImport({ ...result, ...extra });
      setStatus(`Arquivo importado: ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleGenerateCopy() {
    if (!lastPdfResult) return;
    try {
      setCopyStatus("Gerando DOCX idêntico...");
      const result = await buildPdfCopyDocxBlob({
        editorText: lastPdfResult.editorText,
        importedImages: lastPdfResult.importedImages,
        importedTables: lastPdfResult.importedTables,
        fileName: lastPdfResult.fileName,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfCopyDocxFileName(lastPdfResult.fileName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setCopyStatus(
        `DOCX idêntico gerado (${result.figureCount} figura(s), ${result.tableCount} tabela(s)). Reimporte-o e gere o DOCX normalizado.`,
      );
    } catch (error) {
      setCopyStatus(error instanceof Error ? error.message : "Falha ao gerar DOCX idêntico.");
    }
  }

  return (
    <div className="import-block">
      <div className="import-header">
        <div>
          <h2>Importar arquivo existente</h2>
          <p>Importe DOCX, TXT, Markdown ou PDF para extrair texto e metadados. Para PDF, o sistema gera um diagn├│stico de reconstru├º├úo ABNT. Revise tudo antes de gerar.</p>
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
          <p className="import-confirm">Confira se o tipo de trabalho selecionado est├í correto antes de gerar o DOCX.</p>
          <button className="secondary-action" type="button" onClick={onRemove} title={`Remover importa├º├úo: ${importedFileName}`}>
            <XCircle size={18} aria-hidden="true" />
            <span>Remover importa├º├úo</span>
          </button>
          {lastPdfResult ? (
            <button className="secondary-action" type="button" onClick={handleGenerateCopy} title="Gerar um DOCX idêntico ao PDF (texto, figuras e tabelas) para depois normalizar">
              <FileDown size={18} aria-hidden="true" />
              <span>Gerar DOCX idêntico</span>
            </button>
          ) : null}
        </div>
      ) : (
        <p className="import-disclaimer">
          Importante: o tipo de trabalho n├úo ├® alterado automaticamente pelo nome do arquivo. Confira se o modelo selecionado corresponde ao documento.
        </p>
      )}
      {status && <p className="import-note" role="status" aria-live="polite">{status}</p>}
      {copyStatus && <p className="import-note" role="status" aria-live="polite">{copyStatus}</p>}
    </div>
  );
}
