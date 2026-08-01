import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { Eye, FileCheck2, FileDown } from "lucide-react";
import { isCpgWork } from "./ufla-rules";
import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { useTiptapExperimentalEditor } from "./editor-feature-flags";
import { templateForWorkType } from "./document-template";
import { buildDownloadFileName } from "./download-filename";
import { buildDraftFromFields, hasUnfilledPlaceholders } from "./draft-builder";
import { editorCommandAdapter } from "./editor-command-adapter";
import { installEditorScrollFix } from "./editor-scroll-fix";
import { finalVersionPendingReport } from "./final-version-pending";
import { useFormModel } from "./hooks/useFormModel";
import { useEditor } from "./hooks/useEditor";
import { useDraft } from "./hooks/useDraft";
import { useValidation } from "./hooks/useValidation";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import { importedFileNameSuggestsOtherType, type ImportResult } from "./services/ImportService";
import { DraftStatus } from "./components/DraftStatus";
import { ImportBlock } from "./components/ImportBlock";
import { WorkTypeSelector } from "./components/WorkTypeSelector";
import { ValidationSidebar } from "./components/ValidationSidebar";
import MetadataFields from "./components/MetadataFields";
import EditorSection from "./components/EditorSection";
import { PreviewModal } from "./components/PreviewModal";
import type { TiptapEditorCommand } from "./tiptap-command-bridge";
export default function App() {
  const { fields, confidence, updateField, updateWorkType, replaceFields, resetFields } = useFormModel();
  const { editorText, setEditorText, editorMode, setEditorMode, tiptapCommandSignal, runTiptapCommand, editorRef, lastAppliedEditorTextRef, editorContentVersionRef, isTiptapEditorEnabled, resetEditor } = useEditor();
  const { draftStatus, hasStoredDraft, handleClearDraft, restoredDraft } = useDraft(fields, editorText);
  const { errors, warnings, generateAnyway, setGenerateAnyway, runValidation, resetValidation } = useValidation();
  const [status, setStatus] = useState("Pronto para editar.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importedImages, setImportedImages] = useState<ImportedDocumentImage[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTable[]>([]);
  const [adherenceExpanded, setAdherenceExpanded] = useState(false);
  const [assistedMode, setAssistedMode] = useState(false);
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);

  void useTiptapExperimentalEditor;

  void isCpgWork(fields.workType);
  const activeEditorText = editorMode === "references" ? fields.referencias : editorText;
  const finalPending = useMemo(() => finalVersionPendingReport(fields, activeEditorText), [fields, activeEditorText]);

  useEffect(() => installEditorScrollFix(), []);
  useEffect(() => { if (restoredDraft) { replaceFields(restoredDraft.fields as any); if (restoredDraft.editorText) setEditorText(restoredDraft.editorText); } }, [restoredDraft]);
  useEffect(() => { runValidation(fields, editorText, editorMode); }, [runValidation, fields, editorText, editorMode]);

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    const markup = editorHtmlToMarkup(editorRef.current);
    if (editorMode === "references") { updateField("referencias", markup); return; }
    setEditorText(markup);
    lastAppliedEditorTextRef.current = markup;
  }, [editorMode, updateField, setEditorText]);

  const applyBlockStyle = useCallback((prefix: string) => {
    editorRef.current?.focus();
    const block = prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "> " ? "blockquote" : "p";
    editorCommandAdapter.formatEditorBlock(block);
    if (prefix === "[REF] ") editorCommandAdapter.insertEditorText("[REF] ");
    setTimeout(() => requestAnimationFrame(handleEditorInput), 0);
  }, [handleEditorInput]);

  const runEditorAction = useCallback((tiptapCommand: TiptapEditorCommand, legacy: () => void) => {
    if (isTiptapEditorEnabled) { runTiptapCommand(tiptapCommand); return; }
    legacy();
  }, [isTiptapEditorEnabled, runTiptapCommand]);

  const handleImport = useCallback(async (result: ImportResult) => {
    setStatus("Importando arquivo...");
    replaceFields(result.fields, result.confidence);
    setImportedFileName(result.fileName);
    setEditorMode("body");
    resetValidation();
    setGenerateAnyway(false);
    setImportedImages(result.importedImages ?? []);
    setImportedTables(result.importedTables ?? []);
    const text = result.editorText || result.fields.introducao;
    setEditorText(text);
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(text);
    lastAppliedEditorTextRef.current = text;
    editorContentVersionRef.current += 1;
    const msg = result.messages.length ? `Arquivo importado com ${result.messages.length} aviso(s). Metadados anteriores foram substituídos.` : "Arquivo importado. Metadados anteriores foram substituídos; revise os campos antes de gerar.";
    const conflict = importedFileNameSuggestsOtherType(result.fileName, fields.workType) ? " O tipo atual é Projeto de pesquisa. O nome do arquivo importado não será usado para alterar o modelo." : "";
    setStatus(msg + conflict);
  }, [replaceFields, fields.workType, editorRef, setEditorText, setEditorMode, resetValidation, setGenerateAnyway, setImportedFileName, setImportedImages, setImportedTables]);

  const handleRemoveImport = useCallback(() => {
    resetFields(); resetEditor(); resetValidation(); setGenerateAnyway(false);
    setImportedFileName(null); setImportedImages([]); setImportedTables([]);
    setStatus("Importação removida. Escolha outro arquivo ou preencha manualmente.");
  }, [resetFields, resetEditor, resetValidation, setGenerateAnyway, setImportedFileName, setImportedImages, setImportedTables]);

  const triggerValidation = useCallback(() => { const { issues: r, hasBlocking } = runValidation(fields, editorText, editorMode); setStatus(hasBlocking ? `Validação concluída: ${r.filter(i => i.severity === "error").length} erro(s), ${r.filter(i => i.severity === "warning" || i.severity === "info").length} alerta(s). Há erros essenciais antes da geração.` : `Validação concluída: ${r.filter(i => i.severity === "error").length} erro(s), ${r.filter(i => i.severity === "warning" || i.severity === "info").length} alerta(s). Pode gerar o DOCX como rascunho editável.`); }, [runValidation, fields, editorText, editorMode]);

  const handleGenerateDocx = useCallback(async () => {
    const { canGenerate } = runValidation(fields, editorText, editorMode);
    if (!canGenerate && !generateAnyway) { setStatus("Há pendências críticas que impedem a geração do DOCX. Corrija os campos obrigatórios e marcadores [PREENCHER: ...] antes de gerar."); return; }
    try {
      setIsGenerating(true); setStatus("Gerando DOCX...");
      const generationFields = fields;
      const blob = await templateForWorkType(fields.workType).generate({ fields: generationFields, editorText, importedImages, importedTables });
      saveAs(blob, buildDownloadFileName({ workType: fields.workType, title: fields.title, importedFileName }));
      const pending = finalVersionPendingReport(fields, activeEditorText);
      setStatus(generateAnyway || pending.hasPendingItems ? "Rascunho gerado. Abra no Word/LibreOffice, atualize o sumário e substitua campos provisórios antes da submissão." : "DOCX gerado. Se o sumário aparecer vazio, atualize os campos no Word/LibreOffice. Isso é esperado.");
    } catch (err) { setStatus(err instanceof Error ? err.message : "Falha ao gerar DOCX."); }
    finally { setIsGenerating(false); }
  }, [fields, editorText, importedImages, importedTables, generateAnyway, editorMode, importedFileName, activeEditorText, runValidation]);

  const handleOpenPreview = useCallback(() => {
    setIsPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  const handleCommitPreviewEditorText = useCallback((text: string) => {
    if (editorMode === "references") {
      updateField("referencias", text);
      return;
    }
    setEditorText(text);
    lastAppliedEditorTextRef.current = text;
  }, [editorMode, updateField, setEditorText, lastAppliedEditorTextRef]);

  const handleGenerateFromPreview = useCallback(() => {
    setIsPreviewOpen(false);
    handleGenerateDocx();
  }, [handleGenerateDocx]);

  const handleBuildDraft = useCallback(() => {
    if (editorText.trim() && !confirmReplaceDraft) { setConfirmReplaceDraft(true); setStatus("Clique em 'Montar rascunho a partir dos campos' novamente para confirmar a substituição do texto do editor."); return; }
    setConfirmReplaceDraft(false);
    const draft = buildDraftFromFields(fields);
    setEditorText(draft);
    lastAppliedEditorTextRef.current = draft;
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(draft);
    editorContentVersionRef.current += 1;
    setStatus(hasUnfilledPlaceholders(draft) ? "Rascunho montado. Campos vazios geraram marcadores [PREENCHER: ...]; preencha-os antes da versão final." : "Rascunho montado a partir dos campos informados.");
  }, [fields, editorText, confirmReplaceDraft, setEditorText, editorRef]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); window.location.hash = "#main-content"; document.getElementById("main-content")?.focus({ preventScroll: true }); }}>Pular para o conteúdo principal</a>
      <header className="app-header">
        <img src="/assets/ufla-logo.jpeg" alt="Marca UFLA" className="ufla-logo" />
        <div><p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p><h1>Assistente de estruturação e normalização acadêmica</h1></div>
        <div className="header-actions">
          <DraftStatus draftStatus={draftStatus} hasDraft={hasStoredDraft} onClearDraft={() => { handleClearDraft(); resetFields(); resetEditor(); setImportedFileName(null); setImportedImages([]); setImportedTables([]); setStatus("Rascunho local removido e formulário limpo."); }} />
          <button className="primary-action" type="button" onClick={triggerValidation}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
          <button className="primary-action" type="button" onClick={handleOpenPreview}><Eye size={18} aria-hidden="true" />Visualizar</button>
          <button className="primary-action strong" type="button" onClick={handleGenerateDocx} disabled={isGenerating}><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX editável"}</button>
        </div>
      </header>
      <p className="global-draft-notice" role="note">O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem ser conferidos no Word/LibreOffice.</p>
      <main id="main-content" className="workspace" tabIndex={-1} aria-busy={isGenerating}>
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <ImportBlock onImport={handleImport} onRemove={handleRemoveImport} importedFileName={importedFileName} workType={fields.workType} />
          <div className="work-type-section"><WorkTypeSelector value={fields.workType} onChange={updateWorkType} /></div>
          <MetadataFields fields={fields} confidence={confidence} updateField={updateField} assistedMode={assistedMode} setAssistedMode={setAssistedMode} handleBuildDraft={handleBuildDraft} confirmReplaceDraft={confirmReplaceDraft} setConfirmReplaceDraft={setConfirmReplaceDraft} />
        </section>
        <EditorSection editorMode={editorMode} setEditorMode={setEditorMode} isTiptapEditorEnabled={isTiptapEditorEnabled} editorRef={editorRef} handleEditorInput={handleEditorInput} runEditorAction={runEditorAction as (cmd: string, fn: () => void) => void} applyBlockStyle={applyBlockStyle} activeEditorText={activeEditorText} updateField={updateField} setEditorText={setEditorText} tiptapCommandSignal={tiptapCommandSignal} adherenceExpanded={adherenceExpanded} setAdherenceExpanded={setAdherenceExpanded} />
        <ValidationSidebar status={status} generateAnyway={generateAnyway} onToggleGenerateAnyway={setGenerateAnyway} fields={fields} editorText={editorText} errors={errors} warnings={warnings} finalPending={finalPending} />
      </main>
      {isPreviewOpen && (
        <PreviewModal
          input={{ fields, editorText: activeEditorText, importedImages, importedTables }}
          onClose={handleClosePreview}
          onCommitEditorText={handleCommitPreviewEditorText}
          onUpdateField={updateField}
          onGenerate={handleGenerateFromPreview}
        />
      )}
    </div>
  );
}
