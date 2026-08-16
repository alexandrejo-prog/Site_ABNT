import { lazy, MouseEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { Eye, FileCheck2, FileDown } from "lucide-react";
import { isCpgWork, type AcademicFields } from "./ufla-rules";
import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { isTiptapExperimentalEditor } from "./editor-feature-flags";
import { templateForWorkType } from "./document-template";
import { buildDownloadFileName } from "./download-filename";
import { buildDraftFromFields, hasUnfilledPlaceholders } from "./draft-builder";
import { editorCommandAdapter } from "./editor-command-adapter";
import { installEditorScrollFix } from "./editor-scroll-fix";
import { finalVersionPendingReport } from "./final-version-pending";
import { computeFlowProgress } from "./flow-progress";
import { friendlyGenerationError, reportTechnicalError } from "./error-utils";
import { resolveFieldTarget } from "./field-navigation";
import { describeOutputType } from "./output-type";
import { traceEvent } from "./observability";
import { DEMO_EXAMPLE, demoFieldsWithWorkType, demoConfidenceMap } from "./demo-example";
import { useFormModel } from "./hooks/useFormModel";
import { useEditor } from "./hooks/useEditor";
import { useDraft } from "./hooks/useDraft";
import { useValidation } from "./hooks/useValidation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  createNamedDraft,
  deleteNamedDraft,
  exportDraftsBackup,
  getNamedDraft,
  importDraftsFromBackup,
  listNamedDrafts,
  mergeDraftsBackup,
  renameNamedDraft,
  saveNamedDraft,
  type DraftPayload,
  type NamedDraft,
  type NamedDraftErrorKind,
} from "./draft-storage";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import { importedFileNameSuggestsOtherType, type ImportResult } from "./services/ImportService";
import { DraftStatus } from "./components/DraftStatus";
import { ImportBlock, type ImportBlockHandle } from "./components/ImportBlock";
import type { WelcomeAction } from "./components/WelcomePanel";
import { WorkTypeSelector } from "./components/WorkTypeSelector";
import { ValidationSidebar } from "./components/ValidationSidebar";
import MetadataFields from "./components/MetadataFields";
import EditorSection from "./components/EditorSection";
import { FlowProgress } from "./components/FlowProgress";
import { FirstUseGuide } from "./components/FirstUseGuide";
import { isOnboardingDismissed } from "./onboarding";
import type { TiptapEditorCommand } from "./tiptap-command-bridge";

const PreviewModal = lazy(() =>
  import("./components/PreviewModal").then((module) => ({ default: module.PreviewModal })),
);

function flashField(el: HTMLElement, durationMs = 1500): void {
  el.classList.add("field-focus-flash");
  window.setTimeout(() => el.classList.remove("field-focus-flash"), durationMs);
}

function smoothScrollIntoView(el: HTMLElement): void {
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function buildLocalDraftPayload(fields: AcademicFields, editorText: string): DraftPayload {
  const rest: Record<string, unknown> = { ...fields };
  delete rest.workType;
  const stringFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    stringFields[key] = Array.isArray(value) ? value : String(value);
  }
  return {
    fields: stringFields,
    editorText,
    workType: fields.workType,
    updatedAt: new Date().toISOString(),
  };
}

function namedDraftErrorMessage(kind: NamedDraftErrorKind): string {
  switch (kind) {
    case "invalid-name":
      return "O nome do rascunho não pode ficar vazio.";
    case "duplicate-name":
      return "Já existe um rascunho com esse nome.";
    case "not-found":
      return "Rascunho não encontrado.";
    case "invalid-payload":
      return "O conteúdo do rascunho é inválido.";
    case "storage":
      return "Não foi possível acessar o armazenamento local.";
    default:
      return "Não foi possível concluir a operação com os rascunhos.";
  }
}

export default function App() {
  const { fields, confidence, updateField, updateWorkType, replaceFields, resetFields } = useFormModel();
  const { editorText, setEditorText, editorMode, setEditorMode, tiptapCommandSignal, runTiptapCommand, editorRef, lastAppliedEditorTextRef, editorContentVersionRef, isTiptapEditorEnabled, resetEditor } = useEditor();
  const { draftStatus, draftSaving, hasStoredDraft, handleClearDraft, restoredDraft, lastSavedAt, draftErrorKind } = useDraft(fields, editorText);
  const { errors, warnings, generateAnyway, setGenerateAnyway, runValidation, resetValidation } = useValidation();
  const [status, setStatus] = useState("Pronto para editar.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importedImages, setImportedImages] = useState<ImportedDocumentImage[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTable[]>([]);
  const [fichaCatalograficaImage, setFichaCatalograficaImage] = useState<{ data: ArrayBuffer | Uint8Array; fileName?: string; width?: number; height?: number } | null>(null);
  const [adherenceExpanded, setAdherenceExpanded] = useState(false);
  const [assistedMode, setAssistedMode] = useState(false);
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);
  const [showFirstUseGuide, setShowFirstUseGuide] = useState(() => !isOnboardingDismissed(window.localStorage));
  const [namedDrafts, setNamedDrafts] = useState<NamedDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftManagerError, setDraftManagerError] = useState<string | null>(null);
  const [draftManagerNotice, setDraftManagerNotice] = useState<string | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [draftManagerOpenSignal, setDraftManagerOpenSignal] = useState(0);

  const replaceFieldsRef = useRef(replaceFields);
  useEffect(() => { replaceFieldsRef.current = replaceFields; });

  const importBlockRef = useRef<ImportBlockHandle>(null);
  const latestRef = useRef({ fields, editorText, activeDraftId, replaceFields, resetValidation });
  useEffect(() => {
    latestRef.current = { fields, editorText, activeDraftId, replaceFields, resetValidation };
  });

  void isTiptapExperimentalEditor;

  void isCpgWork(fields.workType);
  const activeEditorText = editorMode === "references" ? fields.referencias : editorText;
  const finalPending = useMemo(() => finalVersionPendingReport(fields, activeEditorText), [fields, activeEditorText]);
  const flowProgress = useMemo(() => computeFlowProgress({
    workType: fields.workType,
    title: fields.title,
    author: fields.author,
    editorText,
    referencias: fields.referencias,
    hasBlockingErrors: errors.some((issue) => issue.severity === "error"),
  }), [fields, editorText, errors]);

  const outputType = useMemo(
    () => describeOutputType({
      hasBlockingErrors: errors.some((issue) => issue.severity === "error"),
      hasFinalPending: finalPending.hasPendingItems,
      generateAnyway,
    }),
    [errors, finalPending.hasPendingItems, generateAnyway],
  );

  const hasDocumentContent = useMemo(
    () => Boolean(fields.title.trim() || fields.author.trim() || editorText.trim()),
    [fields.title, fields.author, editorText],
  );
  const showWelcome = !welcomeDismissed && !hasDocumentContent;

  useEffect(() => installEditorScrollFix(), []);
  useEffect(() => { if (restoredDraft) { replaceFieldsRef.current(restoredDraft.fields as any); if (restoredDraft.editorText) setEditorText(restoredDraft.editorText); } }, [restoredDraft, setEditorText]);
  useEffect(() => { runValidation(fields, editorText, editorMode); }, [runValidation, fields, editorText, editorMode]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega o índice de rascunhos locais na montagem (com migração idempotente do rascunho legado)
    setNamedDrafts(listNamedDrafts(window.localStorage));
  }, []);

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    const markup = editorHtmlToMarkup(editorRef.current);
    if (editorMode === "references") { updateField("referencias", markup); return; }
    setEditorText(markup);
    lastAppliedEditorTextRef.current = markup;
  }, [editorMode, updateField, setEditorText, editorRef, lastAppliedEditorTextRef]);

  const applyBlockStyle = useCallback((prefix: string) => {
    editorRef.current?.focus();
    const block = prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "> " ? "blockquote" : "p";
    editorCommandAdapter.formatEditorBlock(block);
    if (prefix === "[REF] ") editorCommandAdapter.insertEditorText("[REF] ");
    setTimeout(() => requestAnimationFrame(handleEditorInput), 0);
  }, [handleEditorInput, editorRef]);

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
  }, [replaceFields, fields.workType, editorRef, setEditorText, setEditorMode, resetValidation, setGenerateAnyway, setImportedFileName, setImportedImages, setImportedTables, editorContentVersionRef, lastAppliedEditorTextRef]);

  const handleLoadExample = useCallback(() => {
    replaceFields(demoFieldsWithWorkType(), demoConfidenceMap());
    setImportedFileName(null);
    setImportedImages([]);
    setImportedTables([]);
    setFichaCatalograficaImage(null);
    setEditorMode("body");
    resetValidation();
    setGenerateAnyway(false);
    setEditorText(DEMO_EXAMPLE.editorText);
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(DEMO_EXAMPLE.editorText);
    lastAppliedEditorTextRef.current = DEMO_EXAMPLE.editorText;
    editorContentVersionRef.current += 1;
    setStatus("Exemplo demonstrativo carregado. Explore os campos, edite o texto e gere o DOCX para ver o padrão UFLA/ABNT.");
  }, [replaceFields, resetValidation, setGenerateAnyway, setEditorText, setEditorMode, editorRef, lastAppliedEditorTextRef, editorContentVersionRef]);

  const handleRemoveImport = useCallback(() => {    resetFields(); resetEditor(); resetValidation(); setGenerateAnyway(false);
    setImportedFileName(null); setImportedImages([]); setImportedTables([]); setFichaCatalograficaImage(null);
    setStatus("Importação removida. Escolha outro arquivo ou preencha manualmente.");
  }, [resetFields, resetEditor, resetValidation, setGenerateAnyway, setImportedFileName, setImportedImages, setImportedTables, setFichaCatalograficaImage]);

  const triggerValidation = useCallback(() => { const { issues: r, hasBlocking } = runValidation(fields, editorText, editorMode); setStatus(hasBlocking ? `Validação concluída: ${r.filter(i => i.severity === "error").length} erro(s), ${r.filter(i => i.severity === "warning" || i.severity === "info").length} alerta(s). Há erros essenciais antes da geração.` : `Validação concluída: ${r.filter(i => i.severity === "error").length} erro(s), ${r.filter(i => i.severity === "warning" || i.severity === "info").length} alerta(s). Pode gerar o DOCX como rascunho editável.`); }, [runValidation, fields, editorText, editorMode]);

  const handleGenerateDocx = useCallback(async (fieldOverrides?: Partial<AcademicFields>) => {
    const generationFields = fieldOverrides ? { ...fields, ...fieldOverrides } : fields;
    const { canGenerate } = runValidation(generationFields, editorText, editorMode);
    if (!canGenerate && !generateAnyway) { setStatus("Corrija as pendências para gerar a versão final."); return; }
    try {
      setIsGenerating(true); setStatus("Gerando DOCX...");
      traceEvent("docx-generate:start");
      const blob = await templateForWorkType(generationFields.workType).generate({ fields: generationFields, editorText, importedImages, importedTables, fichaCatalograficaImage: fichaCatalograficaImage ?? undefined });
      traceEvent("docx-generate:complete");
      saveAs(blob, buildDownloadFileName({ workType: generationFields.workType, title: generationFields.title, importedFileName }));
      const pending = finalVersionPendingReport(generationFields, activeEditorText);
      setStatus(generateAnyway || pending.hasPendingItems ? "Rascunho gerado. Abra no Word/LibreOffice, atualize o sumário e substitua campos provisórios antes da submissão." : "DOCX gerado. Se o sumário aparecer vazio, atualize os campos no Word/LibreOffice. Isso é esperado.");
    } catch (err) { traceEvent("docx-generate:error"); reportTechnicalError("geração de DOCX", err); setStatus(friendlyGenerationError(err)); }
    finally { setIsGenerating(false); }
  }, [fields, editorText, importedImages, importedTables, fichaCatalograficaImage, generateAnyway, editorMode, importedFileName, activeEditorText, runValidation]);

  const handleOpenPreview = useCallback(() => {
    traceEvent("preview:open");
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

  const handleGenerateFromPreview = useCallback((overrides?: Partial<AcademicFields>) => {
    setIsPreviewOpen(false);
    handleGenerateDocx(overrides);
  }, [handleGenerateDocx]);

  const openFieldSection = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const details = el.closest<HTMLDetailsElement>("details.field-section");
    if (details && !details.open) details.open = true;
  }, []);

  const handleNavigateToField = useCallback((fieldKey: string) => {
    const target = resolveFieldTarget(fieldKey);
    if (target.kind === "editor") {
      setEditorMode("body");
      const el = document.querySelector<HTMLElement>('.editor-pane [contenteditable="true"][role="textbox"], .editor-pane .rich-editor');
      if (el) { smoothScrollIntoView(el); flashField(el); el.focus({ preventScroll: true }); }
      return;
    }
    if (target.kind === "workType") {
      const el = document.getElementById("work-type");
      if (el) { smoothScrollIntoView(el); flashField(el); el.focus(); }
      return;
    }
    const el = document.getElementById(target.id);
    if (el) {
      openFieldSection(el);
      smoothScrollIntoView(el);
      flashField(el);
      el.focus({ preventScroll: true });
    }
  }, [setEditorMode, openFieldSection]);

  const handleSelectDraft = useCallback((id: string) => {
    const draft = getNamedDraft(id, window.localStorage);
    if (!draft) {
      setDraftManagerError("Não foi possível carregar o rascunho.");
      return;
    }
    const restored: Partial<AcademicFields> = {};
    for (const [key, value] of Object.entries(draft.payload.fields ?? {})) {
      if (typeof value === "string") (restored as any)[key] = value;
      if (Array.isArray(value)) (restored as any)[key] = value;
    }
    if (draft.payload.workType) (restored as any).workType = draft.payload.workType;
    latestRef.current.replaceFields(restored);
    latestRef.current.resetValidation();
    setGenerateAnyway(false);
    setEditorMode("body");
    const text = draft.payload.editorText ?? "";
    setEditorText(text);
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(text);
    lastAppliedEditorTextRef.current = text;
    editorContentVersionRef.current += 1;
    setActiveDraftId(id);
    setDraftManagerError(null);
    setDraftManagerNotice("Rascunho carregado.");
    setStatus("Rascunho carregado.");
  }, [setGenerateAnyway, setEditorMode, setEditorText, editorRef, lastAppliedEditorTextRef, editorContentVersionRef]);

  const handleCreateDraft = useCallback((name: string) => {
    const { fields: currentFields, editorText: currentEditorText } = latestRef.current;
    const result = createNamedDraft(name, buildLocalDraftPayload(currentFields, currentEditorText), window.localStorage);
    setNamedDrafts(result.drafts);
    if (result.ok && result.draft) {
      setActiveDraftId(result.draft.id);
      setDraftManagerError(null);
      setDraftManagerNotice("Rascunho criado.");
    } else {
      setDraftManagerNotice(null);
      setDraftManagerError(namedDraftErrorMessage(result.kind));
    }
  }, []);

  const handleRenameDraft = useCallback((id: string, name: string) => {
    const result = renameNamedDraft(id, name, window.localStorage);
    setNamedDrafts(result.drafts);
    if (result.ok) {
      setDraftManagerError(null);
      setDraftManagerNotice("Rascunho renomeado.");
    } else {
      setDraftManagerNotice(null);
      setDraftManagerError(namedDraftErrorMessage(result.kind));
    }
  }, []);

  const handleDeleteDraft = useCallback((id: string) => {
    const result = deleteNamedDraft(id, window.localStorage);
    setNamedDrafts(result.drafts);
    if (result.ok) {
      setActiveDraftId((current) => (current === id ? null : current));
      setDraftManagerError(null);
      setDraftManagerNotice("Rascunho excluído.");
    } else {
      setDraftManagerNotice(null);
      setDraftManagerError(namedDraftErrorMessage(result.kind));
    }
  }, []);

  const handleExportBackup = useCallback(() => {
    const drafts = listNamedDrafts(window.localStorage);
    if (drafts.length === 0) {
      setDraftManagerNotice("Não há rascunhos para exportar.");
      return;
    }
    const json = exportDraftsBackup(drafts);
    const blob = new Blob([json], { type: "application/json" });
    saveAs(blob, `rascunhos-site-abnt-${new Date().toISOString().slice(0, 10)}.json`);
    setDraftManagerError(null);
    setDraftManagerNotice("Backup exportado.");
  }, []);

  const handleImportBackup = useCallback((jsonText: string) => {
    const imported = importDraftsFromBackup(jsonText);
    if (!imported) {
      setDraftManagerNotice(null);
      setDraftManagerError("Não foi possível importar este backup.");
      return;
    }
    const result = mergeDraftsBackup(imported, window.localStorage);
    setNamedDrafts(result.drafts);
    if (result.ok) {
      setDraftManagerError(null);
      setDraftManagerNotice("Backup importado.");
    } else {
      setDraftManagerNotice(null);
      setDraftManagerError(namedDraftErrorMessage(result.kind));
    }
  }, []);

  const handleWelcomeAction = useCallback((action: WelcomeAction) => {
    switch (action) {
      case "import":
        setWelcomeDismissed(true);
        importBlockRef.current?.open();
        break;
      case "new":
        resetFields();
        resetEditor();
        resetValidation();
        setGenerateAnyway(false);
        setImportedFileName(null);
        setImportedImages([]);
        setImportedTables([]);
        setWelcomeDismissed(true);
        setStatus("Pronto para editar.");
        break;
      case "drafts":
        setWelcomeDismissed(true);
        setDraftManagerOpenSignal((signal) => signal + 1);
        break;
      case "write":
        setWelcomeDismissed(true);
        requestAnimationFrame(() => editorRef.current?.focus());
        break;
      case "example":
        setWelcomeDismissed(true);
        handleLoadExample();
        break;
    }
  }, [resetFields, resetEditor, resetValidation, setGenerateAnyway, setImportedFileName, setImportedImages, setImportedTables, editorRef, handleLoadExample]);

  const handleNewDocument = useCallback(() => {
    if (hasDocumentContent && typeof window !== "undefined" && !window.confirm("Criar um novo documento apaga o conteúdo atual deste navegador. Continuar?")) {
      return;
    }
    handleWelcomeAction("new");
  }, [hasDocumentContent, handleWelcomeAction]);

  const handleSaveDraftShortcut = useCallback(() => {
    const { fields: currentFields, editorText: currentEditorText, activeDraftId: currentActiveDraftId } = latestRef.current;
    const activeDraft = currentActiveDraftId ? getNamedDraft(currentActiveDraftId, window.localStorage) : null;
    const result = saveNamedDraft(activeDraft?.name ?? "Rascunho", buildLocalDraftPayload(currentFields, currentEditorText), window.localStorage);
    setNamedDrafts(result.drafts);
    if (result.ok && result.draft) {
      setActiveDraftId(result.draft.id);
      setDraftManagerError(null);
      setStatus("Rascunho salvo.");
    } else {
      setDraftManagerError(namedDraftErrorMessage(result.kind));
    }
  }, []);

  const handleExportDocxShortcut = useCallback(() => {
    if (isGenerating) return; // evita loops de geração a partir do atalho
    void handleGenerateDocx();
  }, [isGenerating, handleGenerateDocx]);

  const handleToggleValidationShortcut = useCallback(() => {
    triggerValidation();
  }, [triggerValidation]);

  const handleTogglePreviewShortcut = useCallback(() => {
    if (isPreviewOpen) handleClosePreview();
    else handleOpenPreview();
  }, [isPreviewOpen, handleOpenPreview, handleClosePreview]);

  useKeyboardShortcuts({
    onSaveDraft: handleSaveDraftShortcut,
    onExportDocx: handleExportDocxShortcut,
    onToggleValidation: handleToggleValidationShortcut,
    onTogglePreview: handleTogglePreviewShortcut,
  });

  const handleClearDraftAll = useCallback(() => {
    handleClearDraft();
    resetFields();
    resetEditor();
    setImportedFileName(null);
    setImportedImages([]);
    setImportedTables([]);
    setStatus("Rascunho local removido e formulário limpo.");
  }, [handleClearDraft, resetFields, resetEditor, setImportedFileName, setImportedImages, setImportedTables]);

  const saveStateClass = draftSaving
    ? "saving"
    : draftStatus === "error"
      ? "error"
      : draftStatus === "saved"
        ? "saved"
        : "idle";
  const saveStateLabel = draftSaving
    ? "Salvando..."
    : draftStatus === "error"
      ? "Erro ao salvar"
      : draftStatus === "saved"
        ? "Salvo agora"
      : draftStatus === "restored"
        ? "Restaurado"
        : draftStatus === "cleared"
          ? "Removido"
          : "Não salvo";

  const handleBuildDraft = useCallback(() => {
    if (editorText.trim() && !confirmReplaceDraft) { setConfirmReplaceDraft(true); setStatus("Clique em 'Montar rascunho a partir dos campos' novamente para confirmar a substituição do texto do editor."); return; }
    setConfirmReplaceDraft(false);
    const draft = buildDraftFromFields(fields);
    setEditorText(draft);
    lastAppliedEditorTextRef.current = draft;
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(draft);
    editorContentVersionRef.current += 1;
    setStatus(hasUnfilledPlaceholders(draft) ? "Rascunho montado. Campos vazios geraram marcadores [PREENCHER: ...]; preencha-os antes da versão final." : "Rascunho montado a partir dos campos informados.");
  }, [fields, editorText, confirmReplaceDraft, setEditorText, editorRef, lastAppliedEditorTextRef, editorContentVersionRef]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); window.location.hash = "#main-content"; document.getElementById("main-content")?.focus({ preventScroll: true }); }}>Pular para o conteúdo principal</a>
      <header className="app-header">
        <img src="/assets/ufla-logo.jpeg" alt="Marca UFLA" className="ufla-logo" />
        <div><p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p><h1>Assistente de estruturação e normalização acadêmica</h1></div>
        <div className="header-actions">
          <DraftStatus
            draftStatus={draftStatus}
            draftSaving={draftSaving}
            hasDraft={hasStoredDraft}
            lastSavedAt={lastSavedAt}
            saveErrorKind={draftErrorKind}
            onClearDraft={handleClearDraftAll}
            onSaveDraft={handleSaveDraftShortcut}
            drafts={namedDrafts}
            activeDraftId={activeDraftId}
            managerError={draftManagerError}
            managerNotice={draftManagerNotice}
            onSelectDraft={handleSelectDraft}
            onCreateDraft={handleCreateDraft}
            onRenameDraft={handleRenameDraft}
            onDeleteDraft={handleDeleteDraft}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            openSignal={draftManagerOpenSignal}
          />
          <button className="primary-action" type="button" onClick={triggerValidation}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
          <button className="primary-action" type="button" onClick={handleOpenPreview}><Eye size={18} aria-hidden="true" />Visualizar</button>
          <button className="primary-action strong" type="button" onClick={() => handleGenerateDocx()} disabled={isGenerating} title="O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem ser conferidos no Word/LibreOffice."><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX editável"}</button>
        </div>
      </header>
      <FirstUseGuide visible={showFirstUseGuide} onDismiss={() => setShowFirstUseGuide(false)} />
      <main id="main-content" className="workspace" tabIndex={-1} aria-busy={isGenerating}>
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <ImportBlock ref={importBlockRef} onImport={handleImport} onRemove={handleRemoveImport} onNewDocument={handleNewDocument} importedFileName={importedFileName} workType={fields.workType} />
          <div className="work-type-section"><WorkTypeSelector value={fields.workType} onChange={updateWorkType} /></div>
          <MetadataFields fields={fields} confidence={confidence} updateField={updateField} assistedMode={assistedMode} setAssistedMode={setAssistedMode} handleBuildDraft={handleBuildDraft} confirmReplaceDraft={confirmReplaceDraft} setConfirmReplaceDraft={setConfirmReplaceDraft} fichaCatalograficaImage={fichaCatalograficaImage} onFichaCatalograficaImageChange={setFichaCatalograficaImage} onFichaCatalograficaImageRemove={() => setFichaCatalograficaImage(null)} />
        </section>
        <EditorSection editorMode={editorMode} setEditorMode={setEditorMode} isTiptapEditorEnabled={isTiptapEditorEnabled} editorRef={editorRef} handleEditorInput={handleEditorInput} runEditorAction={runEditorAction as (cmd: string, fn: () => void) => void} applyBlockStyle={applyBlockStyle} activeEditorText={activeEditorText} updateField={updateField} setEditorText={setEditorText} tiptapCommandSignal={tiptapCommandSignal} adherenceExpanded={adherenceExpanded} setAdherenceExpanded={setAdherenceExpanded} showWelcome={showWelcome} onWelcomeAction={handleWelcomeAction} />
        <ValidationSidebar status={status} outputType={outputType} generateAnyway={generateAnyway} onToggleGenerateAnyway={setGenerateAnyway} onNavigateToField={handleNavigateToField} fields={fields} editorText={editorText} errors={errors} warnings={warnings} finalPending={finalPending} />
      </main>
      {isPreviewOpen && (
        <Suspense fallback={<div className="preview-loading" role="status">Carregando pré-visualização...</div>}>
          <PreviewModal
            input={{ fields, editorText: activeEditorText, importedImages, importedTables, fichaCatalograficaImage: fichaCatalograficaImage ?? undefined }}
            onClose={handleClosePreview}
            onCommitEditorText={handleCommitPreviewEditorText}
            onUpdateField={updateField}
            onGenerate={handleGenerateFromPreview}
          />
        </Suspense>
      )}
      <footer className="app-status-bar">
        <FlowProgress progress={flowProgress} compact />
        <span className={`status-bar-save status-bar-save--${saveStateClass}`}>
          <span className="status-bar-dot" aria-hidden="true" />
          {saveStateLabel}
        </span>
        <span className="status-bar-counts">
          {errors.length > 0 && (
            <span className="status-bar-count status-bar-count--error">
              {errors.length} pendência{errors.length === 1 ? "" : "s"}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="status-bar-count status-bar-count--warning">
              {warnings.length} aviso{warnings.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </footer>
    </div>
  );
}
