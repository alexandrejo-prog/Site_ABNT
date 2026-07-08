import { ChangeEvent, ClipboardEvent as ReactClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { Bold, Eraser, FileCheck2, FileDown, Heading1, Heading2, Italic, Pilcrow, Quote, Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "./import-docx";
import { ACADEMIC_FIELD_KEYS, AcademicFieldKey, type AcademicFields, CONFIDENCE_LABELS, Confidence, WORK_TYPE_LABELS, WORK_TYPES, emptyAcademicFields, emptyConfidenceMap, isCpgWork, isResearchProject, isUflaCollectionWork } from "./ufla-rules";
import { ValidationIssue, hasBlockingErrors, validateWork } from "./validators";
import { isAbsoluteGenerationBlocker, isNonOverridableError } from "./generation-blockers";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { UFLA_PPG_PROGRAMS } from "./ufla-ppg-programs";
import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { templateForWorkType } from "./document-template";
import { buildDownloadFileName } from "./download-filename";
import { stripCpgForbiddenSections, hasCpgForbiddenSections } from "./cpg-content-filter";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "./academic-production-types";
import { buildDraftFromFields, hasUnfilledPlaceholders, draftWorkTypeSupportsIndicators } from "./draft-builder";
import { editorCommandAdapter } from "./editor-command-adapter";
import { installEditorScrollFix } from "./editor-scroll-fix";
import { clearDraft, hasDraft, loadDraft, saveDraft } from "./draft-storage";
import { AdherencePanel } from "./components/AdherencePanel";
import { ValidationSidebar } from "./components/ValidationSidebar";
import { DraftStatus } from "./components/DraftStatus";
import { ToolButton } from "./components/ToolButton";

const FIELD_LABELS: Record<AcademicFieldKey, string> = {
  author: "Autor", title: "Título", subtitle: "Subtítulo", workNature: "Natureza do trabalho", course: "Curso", program: "Programa", advisor: "Orientador", coadvisor: "Coorientador", location: "Local", year: "Ano", resumo: "Resumo", palavrasChave: "Palavras-chave", abstractText: "Abstract", keywords: "Keywords", introducao: "Introdução", conclusao: "Conclusão", referencias: "Referências", anexos: "Anexos", apendices: "Apêndices", dedicatoria: "Dedicatória", agradecimentos: "Agradecimentos", epigrafe: "Epígrafe", indicadoresImpacto: "Indicadores de impacto", impactIndicators: "Impact indicators", imageWarnings: "Avisos de imagens", tema: "Tema", delimitacaoTema: "Delimitação do Tema", problemaPesquisa: "Problema de Pesquisa", hipotese: "Hipótese", objetivoGeral: "Objetivo Geral", objetivosEspecificos: "Objetivos Específicos", justificativa: "Justificativa", referencialTeorico: "Referencial Teórico", metodologia: "Metodologia", cronograma: "Cronograma", recursosOrcamento: "Recursos/Orçamento", resultadosEsperados: "Resultados Esperados", corpusDados: "Corpus/Dados", contextoInstitucional: "Contexto Institucional", conclusaoProvisoria: "Conclusão Provisória", contribuicoesImpactos: "Contribuições/Impactos", impactoSocial: "Impacto social", impactoCientifico: "Impacto científico", impactoEducacional: "Impacto educacional", impactoAmbiental: "Impacto ambiental", impactoTecnologico: "Impacto tecnológico/econômico", publicoBeneficiado: "Público beneficiado", aderenciaOds: "Aderência a ODS/política institucional",
};

const RESEARCH_PROJECT_FIELD_KEYS: AcademicFieldKey[] = ["tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia", "cronograma", "recursosOrcamento", "resultadosEsperados"];
const ASSISTED_FIELD_KEYS: AcademicFieldKey[] = ["tema", "problemaPesquisa", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "corpusDados", "contextoInstitucional", "metodologia", "resultadosEsperados", "conclusaoProvisoria", "contribuicoesImpactos"];
const LONG_FIELDS = new Set<AcademicFieldKey>(["workNature", "resumo", "abstractText", "introducao", "conclusao", "referencias", "anexos", "apendices", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators", "imageWarnings", ...RESEARCH_PROJECT_FIELD_KEYS]);
const EDITOR_DESCRIPTION_ID = "editor-mode-note";
type EditorMode = "body" | "references";

function rowsForField(key: AcademicFieldKey): number {
  if (key === "referencias") return 12;
  if (key === "anexos" || key === "apendices") return 7;
  return LONG_FIELDS.has(key) ? 5 : 1;
}

function visibleField(key: AcademicFieldKey, workType: AcademicFields["workType"]): boolean {
  if (RESEARCH_PROJECT_FIELD_KEYS.includes(key)) return isResearchProject(workType);
  const indicatorSpecificKeys: AcademicFieldKey[] = ["impactoSocial", "impactoCientifico", "impactoEducacional", "impactoAmbiental", "impactoTecnologico", "publicoBeneficiado", "aderenciaOds"];
  if (indicatorSpecificKeys.includes(key)) return false;
  if (workType === "artigo") return !["workNature", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators"].includes(key);
  if (isUflaCollectionWork(workType)) return !["dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators"].includes(key);
  if (isCpgWork(workType)) return !["workNature", "dedicatoria", "epigrafe", "indicadoresImpacto", "impactIndicators", "anexos", "apendices"].includes(key);
  return true;
}

function modelConfidence(workType: AcademicFields["workType"]): boolean {
  return ["monografia", "dissertacao", "tese", "projeto_pesquisa"].includes(workType);
}

function shouldNormalizeAfterFieldChange(key: AcademicFieldKey): boolean {
  return key === "program" || key === "course";
}

function hasDraftableContent(fields: AcademicFields, editorText: string): boolean {
  if (editorText.trim().length > 0) return true;
  const emptyFields = emptyAcademicFields();
  return ACADEMIC_FIELD_KEYS.some((key) => fields[key].trim() !== emptyFields[key].trim());
}

function draftFieldsPayload(fields: AcademicFields): Record<string, string> {
  return Object.fromEntries(ACADEMIC_FIELD_KEYS.map((key) => [key, fields[key]]));
}

function academicFieldsFromDraft(payload: Record<string, unknown>): AcademicFields {
  const restored = emptyAcademicFields();
  for (const key of ACADEMIC_FIELD_KEYS) {
    const value = payload[key];
    if (typeof value === "string") restored[key] = value;
  }
  return restored;
}

function editorTextForValidation(workType: AcademicFields["workType"], editorMode: EditorMode, referencesText: string, bodyText: string): string {
  if (editorMode === "references") return referencesText;
  return isCpgWork(workType) ? stripCpgForbiddenSections(bodyText) : bodyText;
}

function cpgAutoFilterIssue(workType: AcademicFields["workType"], originalText: string, validationText: string): ValidationIssue | null {
  if (!isCpgWork(workType)) return null;
  if (!hasCpgForbiddenSections(originalText)) return null;
  if (originalText.trim() === validationText.trim()) return null;
  return {
    severity: "warning",
    code: "cpg-auto-filtered-structures",
    message: "Seções incompatíveis com CPG/UFLA serão removidas automaticamente do DOCX.",
    what: "O texto importado contém elementos como indicadores de impacto, sumário, ficha, folha de aprovação, apêndices ou anexos.",
    why: "O modelo CPG/UFLA não usa esses elementos no corpo do artigo/resumo, mas o sistema consegue removê-los com segurança antes da validação e da exportação.",
    action: "Confira o DOCX gerado e revise a numeração das seções no Word/LibreOffice antes da submissão final.",
  };
}

export default function App() {
  const [fields, setFields] = useState(emptyAcademicFields);
  const [confidence, setConfidence] = useState(emptyConfidenceMap);
  const [editorText, setEditorText] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState("Pronto para editar.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateAnyway, setGenerateAnyway] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("body");
  const [adherenceExpanded, setAdherenceExpanded] = useState(false);
  const [assistedMode, setAssistedMode] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saved" | "restored" | "cleared" | "error">("idle");
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);
  const [hasStoredDraft, setHasStoredDraft] = useState(() => typeof window !== "undefined" && hasDraft(window.localStorage));
  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContentVersionRef = useRef(0);
  const lastAppliedEditorTextRef = useRef("");
  const errors = useMemo(() => issues.filter((issue) => issue.severity === "error"), [issues]);
  const warnings = useMemo(() => issues.filter((issue) => issue.severity === "warning"), [issues]);
  const isCpgSelected = isCpgWork(fields.workType);
  const selectedUflaProductionType = isUflaCollectionWork(fields.workType) ? academicProductionTypeById(fields.workType) : undefined;
  const activeEditorText = editorMode === "references" ? fields.referencias : editorText;

  useEffect(() => installEditorScrollFix(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft = loadDraft(window.localStorage);
    if (!draft) return;
    const isEmpty = !draft.fields && !draft.editorText;
    if (isEmpty) return;
    if (fields.author || fields.title || editorText) return;
    try {
      setFields((current) => ({ ...current, ...academicFieldsFromDraft(draft.fields) }));
      if (draft.editorText) setEditorText(draft.editorText);
      setHasStoredDraft(true);
      setDraftStatus("restored");
    } catch {
      // Ignora rascunho incompatível.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (!hasDraftableContent(fields, editorText)) {
      clearDraft(window.localStorage);
      autosaveTimeoutRef.current = null;
      setHasStoredDraft(false);
      return;
    }
    const timeout = setTimeout(() => {
      try {
        saveDraft({
          fields: draftFieldsPayload(fields),
          editorText,
          references: fields.referencias ? [fields.referencias] : [],
          workType: fields.workType,
          updatedAt: new Date().toISOString(),
        }, window.localStorage);
        autosaveTimeoutRef.current = null;
        setHasStoredDraft(true);
        setDraftStatus("saved");
      } catch {
        autosaveTimeoutRef.current = null;
        setDraftStatus("error");
      }
    }, 800);
    autosaveTimeoutRef.current = timeout;
    return () => {
      clearTimeout(timeout);
      if (autosaveTimeoutRef.current === timeout) autosaveTimeoutRef.current = null;
    };
  }, [fields, editorText]);

  useEffect(() => {
    if (!editorRef.current) return;
    const newContent = editorMarkupToHtml(activeEditorText);
    const isEditing = document.activeElement === editorRef.current;
    const contentChanged = lastAppliedEditorTextRef.current !== activeEditorText;
    if (contentChanged && (!isEditing || editorMode !== "body")) {
      editorRef.current.innerHTML = newContent;
      lastAppliedEditorTextRef.current = activeEditorText;
      editorContentVersionRef.current += 1;
    }
  }, [activeEditorText, editorMode]);

  function updateField(key: AcademicFieldKey, value: string) {
    setFields((current) => {
      const next = { ...current, [key]: value };
      return shouldNormalizeAfterFieldChange(key) ? normalizeFieldsForSelectedModel(next) : next;
    });
    setConfidence((current) => ({
      ...current,
      [key]: current[key] === "nao-identificado" ? "baixa" : current[key],
      ...(shouldNormalizeAfterFieldChange(key) && modelConfidence(fields.workType) ? { workNature: "media" as Confidence } : {}),
    }));
  }

  function updateActiveEditorText(value: string) {
    if (editorMode === "references") {
      updateField("referencias", value);
      return;
    }
    setEditorText(value);
    lastAppliedEditorTextRef.current = value;
  }

  function handleRichEditorInput() {
    if (!editorRef.current) return;
    const markup = editorHtmlToMarkup(editorRef.current);
    updateActiveEditorText(markup);
    lastAppliedEditorTextRef.current = markup;
  }

  function updateWorkType(workType: AcademicFields["workType"]) {
    const nextFields = normalizeFieldsForSelectedModel({ ...fields, workType });
    const textToValidate = editorTextForValidation(workType, editorMode, nextFields.referencias, editorText);
    const nextIssues = [...validateWork(nextFields, textToValidate)];
    const autoFilterIssue = cpgAutoFilterIssue(workType, editorText, textToValidate);
    if (autoFilterIssue) nextIssues.push(autoFilterIssue);
    setFields(nextFields);
    setConfidence((current) => ({ ...current, workNature: modelConfidence(workType) ? "media" : current.workNature, program: modelConfidence(workType) ? "media" : current.program }));
    setGenerateAnyway(false);
    setIssues(nextIssues);
  }

  function replaceFieldsWithImportedDocument(importedFields: ReturnType<typeof emptyAcademicFields>, importedConfidence: Record<AcademicFieldKey, Confidence>) {
    setFields(() => normalizeFieldsForSelectedModel({ ...emptyAcademicFields(), ...importedFields }));
    setConfidence(() => {
      const next = emptyConfidenceMap();
      for (const key of ACADEMIC_FIELD_KEYS) next[key] = importedConfidence[key];
      return next;
    });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus("Importando arquivo...");
      const result = await importDocumentFile(file);
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      clearDraft(window.localStorage);
      setHasStoredDraft(false);
      replaceFieldsWithImportedDocument(result.fields, result.confidence);
      setImportedFileName(file.name);
      setEditorMode("body");
      setIssues([]);
      setGenerateAnyway(false);
      const newEditorText = result.editorText || result.fields.introducao || result.text;
      setEditorText(newEditorText);
      if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(newEditorText);
      lastAppliedEditorTextRef.current = newEditorText;
      editorContentVersionRef.current += 1;
      setStatus(result.messages.length ? `Arquivo importado com ${result.messages.length} aviso(s). Metadados anteriores foram substituídos.` : "Arquivo importado. Metadados anteriores foram substituídos; revise os campos antes de gerar.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      event.target.value = "";
    }
  }

  function handleRemoveImport() {
    setFields(emptyAcademicFields());
    setConfidence(emptyConfidenceMap());
    setEditorText("");
    setIssues([]);
    setGenerateAnyway(false);
    setImportedFileName(null);
    setEditorMode("body");
    lastAppliedEditorTextRef.current = "";
    editorContentVersionRef.current += 1;
    setStatus("Importação removida. Escolha outro arquivo ou preencha manualmente.");
  }

  function handleClearDraft() {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    clearDraft(window.localStorage);
    setFields(emptyAcademicFields());
    setConfidence(emptyConfidenceMap());
    setEditorText("");
    setIssues([]);
    setGenerateAnyway(false);
    setImportedFileName(null);
    setEditorMode("body");
    lastAppliedEditorTextRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
    editorContentVersionRef.current += 1;
    setHasStoredDraft(false);
    setDraftStatus("cleared");
    setStatus("Rascunho local removido e formulário limpo.");
  }

  function applyBlockStyle(prefix: string) {
    editorRef.current?.focus();
    const block = prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "> " ? "blockquote" : "p";
    editorCommandAdapter.formatEditorBlock(block);
    if (prefix === "[REF] ") editorCommandAdapter.insertEditorText("[REF] ");
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function wrapSelection(command: "bold" | "italic") {
    editorRef.current?.focus();
    editorCommandAdapter.applyEditorCommand(command);
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function clearFormatting() {
    editorRef.current?.focus();
    editorCommandAdapter.clearEditorFormatting();
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    editorCommandAdapter.insertEditorText(event.clipboardData.getData("text/plain"));
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function handleBuildDraft() {
    if (editorText.trim() && !confirmReplaceDraft) {
      setConfirmReplaceDraft(true);
      setStatus("Clique em 'Montar rascunho a partir dos campos' novamente para confirmar a substituição do texto do editor.");
      return;
    }
    setConfirmReplaceDraft(false);
    const draft = buildDraftFromFields(fields);
    setEditorText(draft);
    lastAppliedEditorTextRef.current = draft;
    if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(draft);
    editorContentVersionRef.current += 1;
    const hasPlaceholder = hasUnfilledPlaceholders(draft);
    setStatus(
      hasPlaceholder
        ? "Rascunho montado. Campos vazios geraram marcadores [PREENCHER: ...]; preencha-os antes da versão final."
        : "Rascunho montado a partir dos campos informados.",
    );
  }

  function runValidation(candidateFields = fields) {
    const normalizedFields = normalizeFieldsForSelectedModel(candidateFields);
    const rawText = editorMode === "references" ? normalizedFields.referencias : editorText;
    const textToValidate = editorTextForValidation(normalizedFields.workType, editorMode, normalizedFields.referencias, editorText);
    const nextIssues = [...validateWork(normalizedFields, textToValidate)];
    const autoFilterIssue = cpgAutoFilterIssue(normalizedFields.workType, rawText, textToValidate);
    if (autoFilterIssue) nextIssues.push(autoFilterIssue);
    setIssues(nextIssues);
    const errorCount = nextIssues.filter((issue) => issue.severity === "error").length;
    const warningCount = nextIssues.filter((issue) => issue.severity === "warning" || issue.severity === "info").length;
    setStatus(
      hasBlockingErrors(nextIssues)
        ? `Validação concluída: ${errorCount} erro(s), ${warningCount} alerta(s). Há erros essenciais antes da geração.`
        : `Validação concluída: ${errorCount} erro(s), ${warningCount} alerta(s). Pode gerar o DOCX como rascunho editável.`,
    );
    return nextIssues;
  }

  async function handleGenerateDocx() {
    const generationFields = normalizeFieldsForSelectedModel(fields);
    const nextIssues = runValidation(generationFields);
    const nonOverridable = nextIssues.some((issue) => issue.severity === "error" && isNonOverridableError(issue));
    if (nonOverridable && !generateAnyway) {
      setStatus("Há pendências críticas que impedem a geração do DOCX. Corrija os campos obrigatórios e marcadores [PREENCHER: ...] antes de gerar.");
      return;
    }
    const absoluteBlocker = nextIssues.some((issue) => issue.severity === "error" && isAbsoluteGenerationBlocker(issue));
    if (absoluteBlocker) {
      setStatus("Há pendências que impedem a geração do DOCX. Corrija os marcadores [PREENCHER: ...] e campos mínimos antes de gerar.");
      return;
    }
    try {
      setIsGenerating(true);
      setStatus("Gerando DOCX...");
      const blob = await templateForWorkType(generationFields.workType).generate({ fields: generationFields, editorText });
      saveAs(blob, buildDownloadFileName({ workType: generationFields.workType, title: generationFields.title, importedFileName }));
      setStatus(generateAnyway ? "Documento gerado como rascunho com pendências críticas. Revise o DOCX no Word/LibreOffice antes da submissão." : "DOCX gerado como rascunho editável. Confira o arquivo no Word/LibreOffice antes da submissão.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar DOCX.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Pular para o conteúdo</a>
      <header className="app-header">
        <div><p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p><h1>Assistente de estruturação e pré-normalização UFLA/ABNT</h1></div>
        <div className="header-actions">
          <label className="upload-button"><Upload size={18} aria-hidden="true" />Importar<input type="file" accept=".docx,.txt,.md" onChange={handleImport} /></label>
          {importedFileName && <button className="primary-action" type="button" onClick={handleRemoveImport} title={`Remover importação: ${importedFileName}`}><XCircle size={18} aria-hidden="true" />Remover importação</button>}
          <DraftStatus draftStatus={draftStatus} hasDraft={hasStoredDraft} onClearDraft={handleClearDraft} />
          <button className="primary-action" type="button" onClick={() => runValidation()}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
          <button className="primary-action strong" type="button" onClick={handleGenerateDocx} disabled={isGenerating}><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX"}</button>
        </div>
      </header>

      <p className="global-draft-notice" role="note">O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem ser conferidos no Word/LibreOffice. Após abrir no Word/LibreOffice, clique com o botão direito no sumário e selecione &ldquo;Atualizar campo&rdquo;.</p>

      <a href="#workspace" className="skip-link">Pular para o conteúdo</a>
      <main id="workspace" className="workspace">
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <div className="assisted-panel">
            <div className="assisted-header-row">
              <h2>Elaborar texto acadêmico assistido</h2>
              <label className="assisted-toggle"><input type="checkbox" checked={assistedMode} onChange={(event) => setAssistedMode(event.target.checked)} /><span>Mostrar campos guiados</span></label>
            </div>
            <p className="assisted-note">Preencha os campos abaixo e use <strong>Montar rascunho</strong> para gerar a estrutura no editor. Campos vazios viram marcadores [PREENCHER: ...]; o sistema não inventa conteúdo.</p>
            <div>
              <button className="primary-action" type="button" onClick={handleBuildDraft}><FileCheck2 size={18} aria-hidden="true" />{confirmReplaceDraft ? "Confirmar substituição" : "Montar rascunho a partir dos campos"}</button>
              {confirmReplaceDraft && <button className="secondary-action" type="button" onClick={() => setConfirmReplaceDraft(false)}>Cancelar</button>}
            </div>
          </div>
          <div className="field-group"><label htmlFor="work-type">Tipo de trabalho</label><select id="work-type" value={fields.workType} onChange={(event) => updateWorkType(event.target.value as typeof fields.workType)}><option value="">Selecione</option>{WORK_TYPES.map((type) => <option key={type} value={type}>{WORK_TYPE_LABELS[type]}</option>)}</select></div>
          {fields.workType === "artigo" && <div className="mode-panel"><h2>Artigo acadêmico simples</h2><p>Modelo sem capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto e sumário.</p></div>}
          {isCpgSelected && <div className="mode-panel"><h2>Modo CPG/UFLA selecionado</h2><p>Este modelo segue template CPG/UFLA. Seções incompatíveis importadas serão removidas automaticamente do DOCX e da validação do rascunho.</p><p><strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.</p></div>}
          {isResearchProject(fields.workType) && <div className="mode-panel"><h2>Estrutura do Projeto de Pesquisa</h2><p>Campos específicos para estrutura de projeto de pesquisa conforme ABNT NBR 15287:2025.</p></div>}
          {selectedUflaProductionType && <div className="mode-panel"><h2>{selectedUflaProductionType.label}</h2><p>{ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE}</p><p><strong>Saída do sistema:</strong> DOCX editável; o PDF final deve ser exportado no Word ou LibreOffice.</p></div>}
          {ACADEMIC_FIELD_KEYS.map((key) => (visibleField(key, fields.workType) || (assistedMode && ASSISTED_FIELD_KEYS.includes(key))) ? <div className="field-group" key={key}><div className="label-row"><label htmlFor={key}>{FIELD_LABELS[key]}</label><span className={`confidence confidence-${confidence[key]}`}>{CONFIDENCE_LABELS[confidence[key]]}</span></div>{LONG_FIELDS.has(key) ? <textarea id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} rows={rowsForField(key)} /> : key === "program" && ["dissertacao", "tese", "projeto_pesquisa"].includes(fields.workType) ? <input id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} list="ufla-ppg-programs" /> : <input id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} />}{key === "referencias" && <div className="field-note"><p>Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.</p><p>Use uma referência por linha. Para destacar manualmente, selecione o trecho e clique em Negrito ou Itálico.</p></div>}</div> : null)}
          {["dissertacao", "tese", "projeto_pesquisa"].includes(fields.workType) && (
            <datalist id="ufla-ppg-programs">
              {UFLA_PPG_PROGRAMS.map((program) => (
                <option key={`${program.type}-${program.name}`} value={program.name} />
              ))}
            </datalist>
          )}
          {draftWorkTypeSupportsIndicators(fields.workType) && (
            <div className="field-group impact-indicators-group">
              <h3>Indicadores de impacto (dissertação/tese)</h3>
              {(["impactoSocial", "impactoCientifico", "impactoEducacional", "impactoAmbiental", "impactoTecnologico", "publicoBeneficiado", "aderenciaOds"] as AcademicFieldKey[]).map((key) => (
                <div className="field-group" key={key}><label htmlFor={key}>{FIELD_LABELS[key]}</label><textarea id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} rows={2} /></div>
              ))}
            </div>
          )}
        </section>

        <section className="editor-pane" aria-label="Editor do texto">
          <div className="editor-toolbar-sticky">
            <div className="toolbar" aria-label="Modo de edição"><button className={`text-button ${editorMode === "body" ? "active" : ""}`} type="button" onClick={() => setEditorMode("body")}>Texto</button><button className={`text-button ${editorMode === "references" ? "active" : ""}`} type="button" onClick={() => setEditorMode("references")}>Referências</button></div>
            <div className="toolbar" aria-label="Ferramentas do editor"><ToolButton title="Desfazer (Ctrl+Z)" onClick={() => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("undo"); }}><span className="toolbar-text">Desfazer</span></ToolButton><ToolButton title="Refazer (Ctrl+Y)" onClick={() => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("redo"); }}><span className="toolbar-text">Refazer</span></ToolButton><ToolButton title="Parágrafo normal" onClick={() => applyBlockStyle("")}><Pilcrow size={18} aria-hidden="true" /></ToolButton><ToolButton title="Título primário" onClick={() => applyBlockStyle("# ")}><Heading1 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Título secundário" onClick={() => applyBlockStyle("## ")}><Heading2 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Negrito" onClick={() => wrapSelection("bold")}><Bold size={18} aria-hidden="true" /></ToolButton><ToolButton title="Itálico" onClick={() => wrapSelection("italic")}><Italic size={18} aria-hidden="true" /></ToolButton><ToolButton title="Citação longa" onClick={() => applyBlockStyle("> ")}><Quote size={18} aria-hidden="true" /></ToolButton><ToolButton title="Referência" onClick={() => applyBlockStyle("[REF] ")}><FileCheck2 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Limpar formatação" onClick={clearFormatting}><Eraser size={18} aria-hidden="true" /></ToolButton></div>
            <p id={EDITOR_DESCRIPTION_ID} className="field-note editor-mode-note">{editorMode === "references" ? "Editando referências no painel central. Selecione palavras e use Negrito/Itálico como no Word." : "Editando texto principal. Selecione palavras e use Negrito/Itálico como no Word."}</p>
          </div>
          <div ref={editorRef} className="editor rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-describedby={EDITOR_DESCRIPTION_ID} aria-label={editorMode === "references" ? "Editor de referências" : "Editor do texto principal"} onInput={handleRichEditorInput} onPaste={handleEditorPaste} spellCheck />
          <AdherencePanel expanded={adherenceExpanded} onToggle={() => setAdherenceExpanded((prev) => !prev)} />
        </section>

        <ValidationSidebar
          status={status}
          generateAnyway={generateAnyway}
          onToggleGenerateAnyway={setGenerateAnyway}
          fields={fields}
          editorText={editorText}
          errors={errors}
          warnings={warnings}
        />
      </main>
    </div>
  );
}
