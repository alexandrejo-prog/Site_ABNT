import { useMemo, useRef, useState } from "react";
import { Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "../import-docx";
import { importAcademicFile } from "../import-file-router";
import type { ImportedDocumentImage } from "../imported-images";
import type { ImportedPdfDocument, PdfRegion, RenderedPdfRegion } from "../imported-pdf";
import { detectPdfVisualRegionCandidates, renderPdfRegionToPng } from "../pdf-region-renderer";
import { buildPdfDraftInput } from "../pdf-to-imported-blocks";
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDiagnostic, setPdfDiagnostic] = useState<ImportedPdfDocument | null>(null);
  const [previews, setPreviews] = useState<Record<string, RenderedPdfRegion>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});

  const [showAllRegions, setShowAllRegions] = useState(false);

  const regionCandidates = useMemo(
    () => (pdfDiagnostic ? detectPdfVisualRegionCandidates(pdfDiagnostic) : []),
    [pdfDiagnostic],
  );

  const visibleRegions = useMemo(() => {
    const sorted = [...regionCandidates].sort(
      (a, b) => a.pageNumber - b.pageNumber || a.kind.localeCompare(b.kind),
    );
    const reliable = sorted.filter((r) => r.confidence !== "low");
    const base = reliable.length > 0 ? reliable : sorted;
    return showAllRegions ? base : base.slice(0, 10);
  }, [regionCandidates, showAllRegions]);

  const hiddenLowCount = regionCandidates.filter((r) => r.confidence === "low").length;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
     try {
       setStatus("Lendo arquivo...");
       setPdfDiagnostic(null);
       setPdfFile(null);
       setPreviews({});
       setPreviewErrors({});
       if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
         const result = await importAcademicFile(file);
         if (result.kind === "pdf") {
           setPdfFile(file);
           setPdfDiagnostic(result.document);
           const draft = buildPdfDraftInput(result.document, file.name, workType);
           onImport(draft);
           setStatus(
             `PDF lido (${result.document.source.pageCount} páginas). Um rascunho foi gerado abaixo — revise antes de usar.`,
           );
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
       setStatus(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
     } finally {
      event.target.value = "";
    }
  }

  function clearPdfDiagnostic() {
    setPdfDiagnostic(null);
    setPdfFile(null);
    setPreviews({});
    setPreviewErrors({});
    setStatus(null);
  }

  async function handlePreviewRegion(region: PdfRegion) {
    if (!pdfFile) return;
    const key = `${region.pageNumber}:${region.caption}`;
    try {
      const rendered = await renderPdfRegionToPng({ file: pdfFile, region, scale: 2 });
      setPreviews((prev) => ({ ...prev, [key]: rendered }));
      setPreviewErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      setPreviewErrors((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Falha ao renderizar a região.",
      }));
    }
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
          <h3>Leitura do PDF (experimental)</h3>
          <p className="import-note import-note-info">
            Extraímos o texto e possíveis figuras/quadros. As imagens ainda não entram no DOCX —
            revise o rascunho e ajuste manualmente antes de usar.
          </p>
          <ul>
            <li><strong>Arquivo:</strong> {pdfDiagnostic.source.fileName}</li>
            <li><strong>Páginas:</strong> {pdfDiagnostic.source.pageCount}</li>
          </ul>
          {pdfDiagnostic.diagnostics.map((d, i) => (
            <p key={i} className={`import-note import-note-${d.severity}`}>
              {d.message}
            </p>
          ))}
          <details>
            <summary>Ver texto extraído ({pdfDiagnostic.source.pageCount} páginas)</summary>
            <pre className="import-pdf-text">{buildPdfDiagnosticText(pdfDiagnostic)}</pre>
          </details>
          <h4>Figuras e quadros encontrados ({regionCandidates.length})</h4>
          {regionCandidates.length === 0 ? (
            <p className="import-note import-note-info">Nenhuma legenda de figura/quadro/gráfico detectada automaticamente.</p>
          ) : (
            <>
              <p className="import-note import-note-info">
                São apenas sugestões para revisão; nada é inserido no DOCX automaticamente.
              </p>
              <ul className="pdf-region-list">
                {visibleRegions.map((region) => {
                  const key = `${region.pageNumber}:${region.caption}`;
                  const preview = previews[key];
                  const previewError = previewErrors[key];
                  return (
                    <li key={key} className={`pdf-region-item pdf-region-${region.kind}`}>
                      <div className="pdf-region-meta">
                        <span className="pdf-region-page">página {region.pageNumber}</span>
                        <span className={`pdf-region-confidence pdf-region-confidence-${region.confidence}`}>
                          {region.confidence === "high" ? "boa" : region.confidence === "medium" ? "média" : "baixa"} confiança
                        </span>
                      </div>
                      <p className="pdf-region-caption">{region.caption}</p>
                      {region.source ? <p className="pdf-region-source">{region.source}</p> : null}
                      {region.warnings && region.warnings.length > 0 ? (
                        <ul className="pdf-region-warnings">
                          {region.warnings.map((w, wi) => (
                            <li key={wi}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                      <button className="secondary-action" type="button" onClick={() => handlePreviewRegion(region)} title={`Visualizar recorte da página ${region.pageNumber}`}>
                        <span>Visualizar recorte</span>
                      </button>
                      {previewError ? <p className="import-note import-note-error">{previewError}</p> : null}
                      {preview ? (
                        <img className="pdf-region-preview" src={preview.dataUrl} alt={`Recorte de ${region.kind} na página ${region.pageNumber}`} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {hiddenLowCount > 0 && !showAllRegions ? (
                <p className="import-note import-note-info">
                  {hiddenLowCount} {hiddenLowCount === 1 ? "região com baixa confiança está oculta" : "regiões com baixa confiança estão ocultas"}.
                </p>
              ) : null}
              {regionCandidates.length > 10 && !showAllRegions ? (
                <button className="secondary-action" type="button" onClick={() => setShowAllRegions(true)} title="Mostrar todas as regiões">
                  <span>Mostrar todas ({regionCandidates.length})</span>
                </button>
              ) : null}
              {showAllRegions && regionCandidates.length > 10 ? (
                <button className="secondary-action" type="button" onClick={() => setShowAllRegions(false)} title="Mostrar apenas as primeiras regiões">
                  <span>Mostrar menos</span>
                </button>
              ) : null}
            </>
          )}
          <button className="secondary-action" type="button" onClick={clearPdfDiagnostic} title="Fechar leitura do PDF">
            <XCircle size={18} aria-hidden="true" />
            <span>Fechar</span>
          </button>
        </div>
      ) : null}
      {status && <p className="import-note" role="status" aria-live="polite">{status}</p>}
    </div>
  );
}
