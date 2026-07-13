import { ClipboardEvent as ReactClipboardEvent, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { FileCheck2, FileDown } from "lucide-react";
import { ACADEMIC_FIELD_KEYS, AcademicFieldKey, type AcademicFields, CONFIDENCE_LABELS, Confidence, emptyAcademicFields, emptyConfidenceMap, isCpgWork, isResearchProject, isUflaCollectionWork } from "./ufla-rules";
import { ValidationIssue, hasBlockingErrors, validateWork } from "./validators";
import { isAbsoluteGenerationBlocker, isNonOverridableError } from "./generation-blockers";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { UFLA_PPG_PROGRAMS } from "./ufla-ppg-programs";
import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { templateForWorkType } from "./document-template";
import { buildDownloadFileName } from "./download-filename";
import { buildPdfTextDraftDocxBlob, pdfTextDraftFileName, validatePdfTextDraftExport } from "./export-pdf-text-draft-docx";
import { stripCpgForbiddenSections, hasCpgForbiddenSections } from "./cpg-content-filter";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "./academic-production-types";
import { buildDraftFromFields, hasUnfilledPlaceholders, draftWorkTypeSupportsIndicators } from "./draft-builder";
import { editorCommandAdapter } from "./editor-command-adapter";
import { installEditorScrollFix } from "./editor-scroll-fix";
import { clearDraft, hasDraft, loadDraft, saveDraft } from "./draft-storage";
import { finalVersionPendingReport } from "./final-version-pending";
import { AdherencePanel } from "./components/AdherencePanel";
import { ValidationSidebar } from "./components/ValidationSidebar";
import { DraftStatus } from "./components/DraftStatus";
import { ToolButton, runEditorCommand } from "./components/ToolButton";
import { ImportBlock } from "./components/ImportBlock";
import { WorkTypeSelector } from "./components/WorkTypeSelector";
import { useTiptapExperimentalEditor } from "./editor-feature-flags";
import type { TiptapEditorCommand } from "./tiptap-command-bridge";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import type { DocumentMode, SourceKind } from "./import-contract";
import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";
import type { PdfTextDraftExportInput } from "./pdf-text-draft-contract";

const FIELD_LABELS: Record<AcademicFieldKey, string> = {
  author: "Autor", title: "Título", subtitle: "Subtítulo", workNature: "Natureza do trabalho", course: "Curso", program: "Programa", advisor: "Orientador", coadvisor: "Coorientador", location: "Local", year: "Ano", resumo: "Resumo", palavrasChave: "Palavras-chave", abstractText: "Abstract", keywords: "Keywords", introducao: "Introdução", conclusao: "Conclusão", referencias: "Referências", anexos: "Anexos", apendices: "Apêndices", dedicatoria: "Dedicatória", agradecimentos: "Agradecimentos", epigrafe: "Epígrafe", indicadoresImpacto: "Indicadores de impacto", impactIndicators: "Impact indicators", imageWarnings: "Avisos de imagens", tema: "Tema", delimitacaoTema: "Delimitação do Tema", problemaPesquisa: "Problema de Pesquisa", hipotese: "Hipótese", objetivoGeral: "Objetivo Geral", objetivosEspecificos: "Objetivos Específicos", justificativa: "Justificativa", referencialTeorico: "Referencial Teórico", metodologia: "Metodologia", cronograma: "Cronograma", recursosOrcamento: "Recursos/Orçamento", resultadosEsperados: "Resultados Esperados", corpusDados: "Corpus/Dados", contextoInstitucional: "Contexto Institucional", conclusaoProvisoria: "Conclusão Provisória", contribuicoesImpactos: "Contribuições/Impactos", impactoSocial: "Impacto social", impactoCientifico: "Impacto científico", impactoEducacional: "Impacto educacional", impactoAmbiental: "Impacto ambiental", impactoTecnologico: "Impacto tecnológico/econômico", publicoBeneficiado: "Público beneficiado", aderenciaOds: "Aderência a ODS/política institucional",
};

const RESEARCH_PROJECT_FIELD_KEYS: AcademicFieldKey[] = ["tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia", "cronograma", "recursosOrcamento", "resultadosEsperados"];
const ASSISTED_FIELD_KEYS: AcademicFieldKey[] = ["tema", "problemaPesquisa", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "corpusDados", "contextoInstitucional", "metodologia", "resultadosEsperados", "conclusaoProvisoria", "contribuicoesImpactos"];
const LONG_FIELDS = new Set<AcademicFieldKey>(["workNature", "resumo", "abstractText", "introducao", "conclusao", "referencias", "anexos", "apendices", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators", "imageWarnings", ...RESEARCH_PROJECT_FIELD_KEYS]);
const EDITOR_DESCRIPTION_ID = "editor-mode-note";
type EditorMode = "body" | "references";
const AcademicTiptapEditor = lazy(() => import("./components/AcademicTiptapEditor"));

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

// No CPG o campo "course" carrega o e-mail dos autores (legado de importação),
// então é rotulado como "E-mail" e não como "Curso". Demais tipos mantêm "Curso".
function courseFieldLabel(workType: AcademicFields["workType"]): string {
  return isCpgWork(workType) ? "E-mail dos autores" : "Curso";
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
  const [importedImages, setImportedImages] = useState<ImportedDocumentImage[]>([]);
  const [importedTables, setImportedTables] = useState<ImportedTable[]>([]);
  const [pdfDiagnostic, setPdfDiagnostic] = useState<ImportedPdfDiagnostic | null>(null);
  const [includePdfPretextuals, setIncludePdfPretextuals] = useState(true);
  const [allowMissingPdfPretextualFields, setAllowMissingPdfPretextualFields] = useState(false);
  const [selectedPdfPageNumber, setSelectedPdfPageNumber] = useState(1);
  const [pdfDiagnosticViewMode, setPdfDiagnosticViewMode] = useState<"lines" | "blocks">("lines");
  const [pdfBlockFilter, setPdfBlockFilter] = useState<"all" | "paragraphs" | "headings" | "unresolved" | "low-confidence">("all");
  const [importedSourceKind, setImportedSourceKind] = useState<SourceKind | null>(null);
  const [importedDocumentMode, setImportedDocumentMode] = useState<DocumentMode | null>(null);
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
  const [tiptapCommandSignal, setTiptapCommandSignal] = useState<{ id: number; command: TiptapEditorCommand } | null>(null);
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
  const isTiptapEditorEnabled = useMemo(() => useTiptapExperimentalEditor(), []);
  const editorAriaLabel = editorMode === "references" ? "Editor de referências" : "Editor do texto principal";
  const editorHelpText = isTiptapEditorEnabled
    ? "Modo experimental de edição. Use para testar a nova experiência. O DOCX continua sendo gerado pelo exportador estável."
    : "Editor acadêmico: edite o conteúdo e marque a estrutura do texto. Fonte, tamanho, recuos e espaçamentos seguem automaticamente o padrão UFLA/ABNT no DOCX.";
  const finalPending = useMemo(() => finalVersionPendingReport(fields, activeEditorText), [fields, activeEditorText]);
  const isPdfDiagnosticMode = importedSourceKind === "pdf" && importedDocumentMode === "pdf-diagnostic";
  const selectedPdfPage = useMemo(() => {
    if (!pdfDiagnostic) return null;
    return pdfDiagnostic.pages.find((page) => page.pageNumber === selectedPdfPageNumber) ?? pdfDiagnostic.pages[0] ?? null;
  }, [pdfDiagnostic, selectedPdfPageNumber]);
  const pdfLineCount = useMemo(() => pdfDiagnostic?.pages.reduce((sum, page) => sum + page.lines.length, 0) ?? 0, [pdfDiagnostic]);
  const pdfPagesWithoutText = useMemo(() => pdfDiagnostic?.pages.filter((page) => page.textItemCount === 0).length ?? 0, [pdfDiagnostic]);
  const selectedPdfBlocks = useMemo(() => {
    if (!pdfDiagnostic) return [];
    return pdfDiagnostic.reconstruction.blocks
      .filter((block) => block.pageStart <= selectedPdfPageNumber && block.pageEnd >= selectedPdfPageNumber)
      .filter((block) => {
        if (pdfBlockFilter === "paragraphs") return block.type === "paragraph";
        if (pdfBlockFilter === "headings") return block.type === "heading";
        if (pdfBlockFilter === "unresolved") return block.type === "unresolved";
        if (pdfBlockFilter === "low-confidence") return block.confidence === "low";
        return true;
      })
      .slice(0, 30);
  }, [pdfBlockFilter, pdfDiagnostic, selectedPdfPageNumber]);
  const selectedPdfLayoutRegions = useMemo(() => {
    if (!pdfDiagnostic) return [];
    return pdfDiagnostic.reconstruction.layoutRegions.filter((region) => region.pageStart <= selectedPdfPageNumber && region.pageEnd >= selectedPdfPageNumber);
  }, [pdfDiagnostic, selectedPdfPageNumber]);
  const selectedPdfHyphenation = useMemo(() => {
    if (!pdfDiagnostic) return [];
    return pdfDiagnostic.reconstruction.hyphenation.filter((entry) => entry.pageNumber === selectedPdfPageNumber);
  }, [pdfDiagnostic, selectedPdfPageNumber]);
  const pdfTextDraftInput = useMemo<PdfTextDraftExportInput | null>(() => {
    if (!pdfDiagnostic) return null;
    return {
      sourceKind: "pdf",
      documentMode: "pdf-text-draft",
      fileName: pdfDiagnostic.fileName,
      pageCount: pdfDiagnostic.pageCount,
      pretextual: pdfDiagnostic.pretextual,
      reconstruction: pdfDiagnostic.reconstruction,
      includeReconstructedPretextuals: includePdfPretextuals,
      allowMissingPretextualFields: allowMissingPdfPretextualFields,
    };
  }, [allowMissingPdfPretextualFields, includePdfPretextuals, pdfDiagnostic]);
  const pdfTextDraftValidation = useMemo(() => (
    pdfTextDraftInput ? validatePdfTextDraftExport(pdfTextDraftInput) : null
  ), [pdfTextDraftInput]);
  const pdfPretextualStatus = useMemo(() => {
    const pre = pdfDiagnostic?.pretextual;
    const elementStatus = (found: boolean, confident: boolean) => (found ? (confident ? "encontrada" : "revisão necessária") : "ausente");
    return {
      cover: elementStatus(Boolean(pre?.cover), pre?.cover?.confidence === "high"),
      titlePage: elementStatus(Boolean(pre?.titlePage), pre?.titlePage?.confidence === "high"),
      resumo: elementStatus(Boolean(pre?.resumo), pre?.resumo?.confidence === "high"),
      abstract: elementStatus(Boolean(pre?.abstract), pre?.abstract?.confidence === "high"),
    };
  }, [pdfDiagnostic]);

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

  useEffect(() => {
    if (isPdfDiagnosticMode || !editorRef.current) return;
    editorRef.current.innerHTML = editorMarkupToHtml(activeEditorText);
    lastAppliedEditorTextRef.current = activeEditorText;
    editorContentVersionRef.current += 1;
  }, [isPdfDiagnosticMode]);

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

function importedFileNameSuggestsOtherType(fileName: string, currentWorkType: string): boolean {
  if (currentWorkType !== "projeto_pesquisa") return false;
  const lower = fileName.toLowerCase();
  return [
    "desenvolvimento-de-software",
    "artigo",
    "monografia",
    "tese",
    "dissertacao",
  ].some((keyword) => lower.includes(keyword));
}

  async function handleImport(result: {
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
  }) {
    try {
      setStatus("Importando arquivo...");
      setImportedSourceKind(result.sourceKind);
      setImportedDocumentMode(result.documentMode);
      const previousWorkType = fields.workType;
      if (result.documentMode === "pdf-diagnostic") {
        setPdfDiagnostic(result.pdfDiagnostic ?? null);
        setSelectedPdfPageNumber(1);
        setPdfDiagnosticViewMode("lines");
        setPdfBlockFilter("all");
        setIncludePdfPretextuals(true);
        setAllowMissingPdfPretextualFields(false);
        setStatus("O PDF foi lido para diagnóstico. O rascunho DOCX estruturado pode ser gerado para revisão.");
        return;
      }

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      clearDraft(window.localStorage);
      setHasStoredDraft(false);
      setPdfDiagnostic(null);
      replaceFieldsWithImportedDocument(result.fields, result.confidence);
      setImportedFileName(result.fileName);
      setEditorMode("body");
      setIssues([]);
      setGenerateAnyway(false);
      setImportedImages(result.importedImages ?? []);
      setImportedTables(result.importedTables ?? []);
      const newEditorText = result.editorText || result.fields.introducao;
      setEditorText(newEditorText);
      if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(newEditorText);
      lastAppliedEditorTextRef.current = newEditorText;
      editorContentVersionRef.current += 1;
      const importWarnings = result.messages.length ? `Arquivo importado com ${result.messages.length} aviso(s). Metadados anteriores foram substituídos.` : "Arquivo importado. Metadados anteriores foram substituídos; revise os campos antes de gerar.";
      const fileNameConflict = importedFileNameSuggestsOtherType(result.fileName, previousWorkType) ? " O tipo atual é Projeto de pesquisa. O nome do arquivo importado não será usado para alterar o modelo." : "";
      setStatus(importWarnings + fileNameConflict);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao importar.");
    }
  }

  function handleRemoveImport() {
    if (isPdfDiagnosticMode) {
      setImportedSourceKind(null);
      setImportedDocumentMode(null);
      setPdfDiagnostic(null);
      setSelectedPdfPageNumber(1);
      setPdfDiagnosticViewMode("lines");
      setPdfBlockFilter("all");
      setStatus("Diagnóstico de PDF removido. O documento acadêmico anterior foi preservado.");
      return;
    }
    setFields(emptyAcademicFields());
    setConfidence(emptyConfidenceMap());
    setEditorText("");
    setIssues([]);
    setGenerateAnyway(false);
    setImportedFileName(null);
    setImportedImages([]);
    setImportedTables([]);
    setPdfDiagnostic(null);
    setSelectedPdfPageNumber(1);
    setPdfDiagnosticViewMode("lines");
    setPdfBlockFilter("all");
    setImportedSourceKind(null);
    setImportedDocumentMode(null);
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
    setImportedImages([]);
    setImportedTables([]);
    setPdfDiagnostic(null);
    setSelectedPdfPageNumber(1);
    setPdfDiagnosticViewMode("lines");
    setPdfBlockFilter("all");
    setImportedSourceKind(null);
    setImportedDocumentMode(null);
    setEditorMode("body");
    lastAppliedEditorTextRef.current = "";
    if (editorRef.current) editorRef.current.innerHTML = "";
    editorContentVersionRef.current += 1;
    setHasStoredDraft(false);
    setDraftStatus("cleared");
    setStatus("Rascunho local removido e formulário limpo.");
  }


  function runTiptapCommand(command: TiptapEditorCommand) {
    setTiptapCommandSignal((current) => ({ id: (current?.id ?? 0) + 1, command }));
  }

  function runEditorAction(tiptapCommand: TiptapEditorCommand, legacyAction: () => void) {
    if (isTiptapEditorEnabled) {
      runTiptapCommand(tiptapCommand);
      return;
    }
    legacyAction();
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
    let textToValidate = editorMode === "references" ? normalizedFields.referencias : editorText;
    const rawText = textToValidate;
    if (isCpgWork(normalizedFields.workType) && editorMode !== "references") {
      textToValidate = stripCpgForbiddenSections(textToValidate);
    }
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
    if (isPdfDiagnosticMode) {
      setStatus("O PDF está em modo diagnóstico. Nenhum DOCX é gerado a partir de PDF nesta etapa.");
      return;
    }
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
      // Contrato do editor: generate({ fields: generationFields, editorText }) segue como base; imagens importadas acompanham o payload.
      const blob = await templateForWorkType(generationFields.workType).generate({ fields: generationFields, editorText, importedImages, importedTables });
      saveAs(blob, buildDownloadFileName({ workType: generationFields.workType, title: generationFields.title, importedFileName }));
      const pending = finalVersionPendingReport(generationFields, activeEditorText);
      setStatus(
        generateAnyway || pending.hasPendingItems
          ? "Rascunho gerado. Abra no Word/LibreOffice, atualize o sumário e substitua campos provisórios antes da submissão."
          : "DOCX gerado. Se o sumário aparecer vazio, atualize os campos no Word/LibreOffice. Isso é esperado.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar DOCX.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleTextDraftDocxFromPdf() {
    if (!pdfTextDraftInput) {
      setStatus("Não foi possível gerar o rascunho textual do PDF.");
      return;
    }
    const validation = validatePdfTextDraftExport(pdfTextDraftInput);
    if (!validation.canExport) {
      setStatus(`Não foi possível gerar o rascunho textual do PDF. ${validation.blockers.join(" ")}`);
      return;
    }
    try {
      setIsGenerating(true);
      setStatus("Gerando rascunho textual do PDF...");
      const blob = await buildPdfTextDraftDocxBlob(pdfTextDraftInput);
      saveAs(blob, pdfTextDraftFileName(pdfTextDraftInput.fileName));
      setStatus("Rascunho textual DOCX gerado. Revise o arquivo no Word ou LibreOffice.");
    } catch {
      setStatus("Não foi possível gerar o rascunho textual do PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src="/assets/ufla-logo.jpeg" alt="Marca UFLA" className="ufla-logo" />
        <div>
          <p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p>
          <h1>Assistente de estruturação e normalização acadêmica</h1>
        </div>
        {!isPdfDiagnosticMode && <div className="header-actions">
          <DraftStatus draftStatus={draftStatus} hasDraft={hasStoredDraft} onClearDraft={handleClearDraft} />
          <button className="primary-action" type="button" onClick={() => runValidation()}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
          <button className="primary-action strong" type="button" onClick={handleGenerateDocx} disabled={isGenerating || isPdfDiagnosticMode}><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX editável"}</button>
        </div>}
      </header>

      {!isPdfDiagnosticMode && <p className="global-draft-notice" role="note">O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem ser conferidos no Word/LibreOffice. Após abrir no Word/LibreOffice, clique com o botão direito no sumário e selecione &ldquo;Atualizar campo&rdquo;.</p>}

      <a href="#main-content" className="skip-link">Pular para o conte&uacute;do principal</a>
      <main id="main-content" className="workspace" tabIndex={-1} aria-busy={isGenerating}>
        {isPdfDiagnosticMode ? (
        <section className="metadata-pane pdf-diagnostic-workspace" aria-label="Diagnóstico de PDF">
          <ImportBlock onImport={handleImport} onRemove={handleRemoveImport} importedFileName={pdfDiagnostic?.fileName ?? null} workType={fields.workType} />
          {pdfDiagnostic && (
            <div className="pdf-diagnostic-panel" role="status" aria-live="polite">
              <h2>Leitura de PDF — diagnóstico experimental</h2>
              <p>O PDF foi lido para diagnóstico. O rascunho DOCX estruturado pode ser gerado para revisão humana.</p>
              <dl>
                <div><dt>Arquivo</dt><dd>{pdfDiagnostic.fileName}</dd></div>
                <div><dt>Páginas</dt><dd>{pdfDiagnostic.pageCount}</dd></div>
                <div><dt>Itens textuais</dt><dd>{pdfDiagnostic.pages.reduce((sum, page) => sum + page.textItemCount, 0)}</dd></div>
                <div><dt>Linhas visuais</dt><dd>{pdfLineCount}</dd></div>
                <div><dt>Páginas sem texto</dt><dd>{pdfPagesWithoutText}</dd></div>
                <div><dt>Parágrafos</dt><dd>{pdfDiagnostic.reconstruction.statistics.paragraphCount}</dd></div>
                <div><dt>Títulos</dt><dd>{pdfDiagnostic.reconstruction.statistics.headingCount}</dd></div>
                <div><dt>Listas</dt><dd>{pdfDiagnostic.reconstruction.statistics.listItemCount}</dd></div>
                <div><dt>Legendas</dt><dd>{pdfDiagnostic.reconstruction.statistics.captionCount}</dd></div>
                <div><dt>Fontes</dt><dd>{pdfDiagnostic.reconstruction.statistics.sourceCount}</dd></div>
                <div><dt>Blocos não resolvidos</dt><dd>{pdfDiagnostic.reconstruction.statistics.unresolvedCount}</dd></div>
                <div><dt>Números de página ignorados</dt><dd>{pdfDiagnostic.reconstruction.statistics.removedPageNumberCount}</dd></div>
                <div><dt>Cabeçalhos ignorados</dt><dd>{pdfDiagnostic.reconstruction.statistics.removedHeaderCount}</dd></div>
                <div><dt>Rodapés ignorados</dt><dd>{pdfDiagnostic.reconstruction.statistics.removedFooterCount}</dd></div>
                <div><dt>Regiões de layout</dt><dd>{pdfDiagnostic.reconstruction.statistics.layoutRegionCount}</dd></div>
                <div><dt>Média de linhas por parágrafo</dt><dd>{pdfDiagnostic.reconstruction.statistics.averageLinesPerParagraph}</dd></div>
                <div><dt>Mediana de linhas por parágrafo</dt><dd>{pdfDiagnostic.reconstruction.statistics.medianLinesPerParagraph}</dd></div>
                <div><dt>Parágrafos de uma linha</dt><dd>{pdfDiagnostic.reconstruction.statistics.singleLineParagraphCount}</dd></div>
                <div><dt>Parágrafos multipágina</dt><dd>{pdfDiagnostic.reconstruction.statistics.multiPageParagraphCount}</dd></div>
                <div><dt>Blocos de baixa confiança</dt><dd>{pdfDiagnostic.reconstruction.statistics.lowConfidenceBlockCount}</dd></div>
                <div><dt>Hifenizações incertas</dt><dd>{pdfDiagnostic.reconstruction.statistics.uncertainHyphenationCount}</dd></div>
                <div><dt>Títulos em caixa mista</dt><dd>{pdfDiagnostic.reconstruction.statistics.mixedCaseHeadingCount}</dd></div>
                <div><dt>Títulos multilinha</dt><dd>{pdfDiagnostic.reconstruction.statistics.combinedHeadingCount}</dd></div>
              </dl>
              <section className="pdf-diagnostic-summary" aria-label="Métricas do corpo do PDF">
                <h3>Métricas do corpo</h3>
                <dl>
                  <div><dt>Margem esquerda dominante</dt><dd>{Math.round(pdfDiagnostic.reconstruction.bodyLayoutMetrics.dominantLeft)}</dd></div>
                  <div><dt>Margem direita dominante</dt><dd>{Math.round(pdfDiagnostic.reconstruction.bodyLayoutMetrics.dominantRight)}</dd></div>
                  <div><dt>Altura mediana da linha</dt><dd>{Number(pdfDiagnostic.reconstruction.bodyLayoutMetrics.medianLineHeight.toFixed(2))}</dd></div>
                  <div><dt>Intervalo mediano</dt><dd>{Number(pdfDiagnostic.reconstruction.bodyLayoutMetrics.medianLineGap.toFixed(2))}</dd></div>
                  <div><dt>Recuo provável da primeira linha</dt><dd>{Math.round(pdfDiagnostic.reconstruction.bodyLayoutMetrics.probableFirstLineIndent)}</dd></div>
                  <div><dt>Confiança das métricas</dt><dd>{pdfDiagnostic.reconstruction.bodyLayoutMetrics.confidence}</dd></div>
                </dl>
              </section>
              {pdfDiagnostic.reconstruction.alerts.length > 0 && (
                <section className="pdf-diagnostic-summary" aria-label="Alertas da reconstrução PDF">
                  <h3>Alertas diagnósticos</h3>
                  <ul>
                    {pdfDiagnostic.reconstruction.alerts.map((alert) => <li key={alert}>{alert}</li>)}
                  </ul>
                </section>
              )}
              {pdfDiagnostic.bodyStart.found && (
                <p className="import-note">Candidato de início do corpo: página {pdfDiagnostic.bodyStart.pageNumber}, linha {(pdfDiagnostic.bodyStart.lineIndex ?? 0) + 1}: {pdfDiagnostic.bodyStart.text}. {pdfDiagnostic.bodyStart.reason}</p>
              )}
              <p className="import-note">Esta reconstrução é diagnóstica. O DOCX gerado continua sendo rascunho de revisão e nenhum conteúdo original do PDF é apagado.</p>
              <p className="import-note" role="status" aria-live="polite">{status}</p>
              <div className="pdf-diagnostic-summary">
                <label className="assisted-toggle">
                  <input
                    type="checkbox"
                    checked={includePdfPretextuals}
                    onChange={(event) => setIncludePdfPretextuals(event.target.checked)}
                  />
                  <span>Incluir elementos pré-textuais reconstruídos</span>
                </label>
                <dl>
                  <div><dt>Capa</dt><dd>{pdfPretextualStatus.cover}</dd></div>
                  <div><dt>Folha de rosto</dt><dd>{pdfPretextualStatus.titlePage}</dd></div>
                  <div><dt>Resumo</dt><dd>{pdfPretextualStatus.resumo}</dd></div>
                  <div><dt>Abstract</dt><dd>{pdfPretextualStatus.abstract}</dd></div>
                  <div><dt>Sumário</dt><dd>será gerado a partir dos títulos reconstruídos</dd></div>
                  <div><dt>Logo UFLA</dt><dd>será usada a identidade institucional do sistema</dd></div>
                </dl>
                {pdfTextDraftValidation?.blockers.some((blocker) => blocker.includes("campos essenciais ausentes")) && (
                  <label className="assisted-toggle">
                    <input
                      type="checkbox"
                      checked={allowMissingPdfPretextualFields}
                      onChange={(event) => setAllowMissingPdfPretextualFields(event.target.checked)}
                    />
                    <span>Gerar com campos ausentes</span>
                  </label>
                )}
                <button
                  className="primary-action strong"
                  type="button"
                  onClick={handleTextDraftDocxFromPdf}
                  disabled={isGenerating || !pdfTextDraftValidation?.canExport}
                >
                  <FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar rascunho textual DOCX"}
                </button>
                <p className="import-note">Este arquivo terá pré-textuais reconstruídos quando encontrados. Quadros, tabelas, figuras e gráficos do PDF serão representados por marcadores de revisão.</p>
                {pdfTextDraftValidation && pdfTextDraftValidation.blockers.length > 0 && (
                  <div role="alert" aria-label="Bloqueadores do rascunho textual PDF">
                    <strong>Bloqueadores</strong>
                    <ul>
                      {pdfTextDraftValidation.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  </div>
                )}
                {pdfTextDraftValidation && pdfTextDraftValidation.warnings.length > 0 && (
                  <div role="status" aria-label="Avisos do rascunho textual PDF">
                    <strong>Avisos</strong>
                    <ul>
                      {pdfTextDraftValidation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="field-group">
                <label htmlFor="pdf-page-selector">Página do PDF</label>
                <input
                  id="pdf-page-selector"
                  type="number"
                  min={1}
                  max={pdfDiagnostic.pageCount}
                  value={selectedPdfPageNumber}
                  onChange={(event) => {
                    const nextPage = Number(event.target.value);
                    if (Number.isFinite(nextPage)) setSelectedPdfPageNumber(Math.min(pdfDiagnostic.pageCount, Math.max(1, Math.trunc(nextPage))));
                  }}
                />
              </div>
              <div className="toolbar editor-mode-toolbar" aria-label="Visualização do diagnóstico PDF">
                <button className={`text-button ${pdfDiagnosticViewMode === "lines" ? "active" : ""}`} type="button" onClick={() => setPdfDiagnosticViewMode("lines")}>Linhas visuais</button>
                <button className={`text-button ${pdfDiagnosticViewMode === "blocks" ? "active" : ""}`} type="button" onClick={() => setPdfDiagnosticViewMode("blocks")}>Blocos reconstruídos</button>
              </div>
              {pdfDiagnosticViewMode === "blocks" && (
                <div className="toolbar editor-mode-toolbar" aria-label="Filtro de blocos reconstruídos">
                  <button className={`text-button ${pdfBlockFilter === "all" ? "active" : ""}`} type="button" onClick={() => setPdfBlockFilter("all")}>Todos</button>
                  <button className={`text-button ${pdfBlockFilter === "paragraphs" ? "active" : ""}`} type="button" onClick={() => setPdfBlockFilter("paragraphs")}>Parágrafos</button>
                  <button className={`text-button ${pdfBlockFilter === "headings" ? "active" : ""}`} type="button" onClick={() => setPdfBlockFilter("headings")}>Títulos</button>
                  <button className={`text-button ${pdfBlockFilter === "unresolved" ? "active" : ""}`} type="button" onClick={() => setPdfBlockFilter("unresolved")}>Não resolvidos</button>
                  <button className={`text-button ${pdfBlockFilter === "low-confidence" ? "active" : ""}`} type="button" onClick={() => setPdfBlockFilter("low-confidence")}>Baixa confiança</button>
                </div>
              )}
              {selectedPdfPage && (
                <div className="pdf-diagnostic-preview">
                  <section>
                    <h3>Página {selectedPdfPage.pageNumber}</h3>
                    <dl>
                      <div><dt>Tamanho</dt><dd>{Math.round(selectedPdfPage.width)} × {Math.round(selectedPdfPage.height)}</dd></div>
                      <div><dt>Rotação</dt><dd>{selectedPdfPage.rotation}°</dd></div>
                      <div><dt>Itens da página</dt><dd>{selectedPdfPage.textItemCount}</dd></div>
                      <div><dt>Linhas da página</dt><dd>{selectedPdfPage.lines.length}</dd></div>
                    </dl>
                    {pdfDiagnosticViewMode === "lines" ? (
                      <>
                        <p className="import-note">As linhas abaixo representam linhas visuais do PDF, não parágrafos reconstruídos.</p>
                        <ol className="pdf-line-preview">
                          {selectedPdfPage.lines.slice(0, 30).map((line, index) => (
                            <li key={`${selectedPdfPage.pageNumber}-${index}`}>{line.text || "[linha sem texto]"}</li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <>
                        <p className="import-note">Blocos que começam, terminam ou atravessam a página selecionada. A prévia é limitada aos primeiros 30 blocos relacionados.</p>
                        {selectedPdfLayoutRegions.length > 0 && (
                          <section className="pdf-diagnostic-summary" aria-label="Regiões de layout da página">
                            <h4>Regiões de layout da página</h4>
                            <ul>
                              {selectedPdfLayoutRegions.map((region) => (
                                <li key={region.id}>
                                  <strong>{region.kind}</strong> · linhas {region.startLineIndex + 1}-{region.endLineIndex + 1} · confiança {region.confidence}
                                  {region.logicalVisualId && <span> · grupo {region.logicalVisualId}</span>}
                                  {region.caption && <p>{region.caption}</p>}
                                  {region.source && <small>{region.source}</small>}
                                  {region.reasons.length > 0 && <small>{region.reasons.join(" ")}</small>}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        <ol className="pdf-block-preview">
                          {selectedPdfBlocks.map((block, index) => (
                            <li key={`${block.pageStart}-${block.pageEnd}-${index}`}>
                              <strong>{block.type}</strong> · páginas {block.pageStart}{block.pageEnd !== block.pageStart ? `-${block.pageEnd}` : ""} · confiança {block.confidence} · {block.sourceLines.length} linha(s)
                              {block.layoutRegionId && <span> · região {block.layoutRegionId}</span>}
                              <p>{block.text}</p>
                              {block.reasons.length > 0 && <small>{block.reasons.join(" ")}</small>}
                            </li>
                          ))}
                        </ol>
                        {selectedPdfHyphenation.length > 0 && (
                          <section className="pdf-diagnostic-summary" aria-label="Ações de hifenização da página">
                            <h4>Hifenização da página</h4>
                            <ul>
                              {selectedPdfHyphenation.map((entry) => (
                                <li key={`${entry.pageNumber}-${entry.lineIndex}-${entry.action}`}>
                                  <strong>{entry.action}</strong> · linha {entry.lineIndex + 1}: {entry.originalEnd} / {entry.nextStart}
                                  <small>{entry.reason}</small>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </>
                    )}
                    <details>
                      <summary>Texto bruto da página</summary>
                      <p>{selectedPdfPage.rawText.slice(0, 1400) || "Nenhum texto bruto extraível foi encontrado nesta página."}</p>
                    </details>
                  </section>
                </div>
              )}
              {pdfDiagnostic.warnings.map((warning) => <p className="import-note" key={warning}>{warning}</p>)}
            </div>
          )}
        </section>
        ) : (
        <>
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <ImportBlock onImport={handleImport} onRemove={handleRemoveImport} importedFileName={importedFileName} workType={fields.workType} />
          <div className="work-type-section">
            <WorkTypeSelector value={fields.workType} onChange={updateWorkType} />
          </div>
          <div className="assisted-panel">
            <div className="assisted-header-row">
              <h2>Preencher campos</h2>
              <label className="assisted-toggle"><input type="checkbox" checked={assistedMode} onChange={(event) => setAssistedMode(event.target.checked)} /><span>Mostrar campos guiados</span></label>
            </div>
            <p className="assisted-note">Preencha os campos abaixo e use <strong>Montar rascunho</strong> para gerar a estrutura no editor. Campos vazios viram marcadores [PREENCHER: ...]; o sistema não inventa conteúdo.</p>
            <div>
              <button className="primary-action" type="button" onClick={handleBuildDraft}><FileCheck2 size={18} aria-hidden="true" />{confirmReplaceDraft ? "Confirmar substituição" : "Montar rascunho a partir dos campos"}</button>
              {confirmReplaceDraft && <button className="secondary-action" type="button" onClick={() => setConfirmReplaceDraft(false)}>Cancelar</button>}
            </div>
          </div>
          {fields.workType === "artigo" && <div className="mode-panel"><h2>Artigo acadêmico simples</h2><p>Modelo sem capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto e sumário.</p></div>}
          {isCpgSelected && <div className="mode-panel"><h2>Modo CPG/UFLA selecionado</h2><p>Este modelo segue template CPG/UFLA. Seções incompatíveis importadas serão removidas automaticamente do DOCX e da validação do rascunho.</p><p><strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.</p></div>}
          {(fields.workType === "dissertacao" || fields.workType === "tese") && <div className="mode-panel"><h2>Dissertação/Tese</h2><p>O sumário do DOCX é um campo atualizável. Após abrir no Word ou LibreOffice, atualize os campos para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
          {isResearchProject(fields.workType) && <div className="mode-panel"><h2>Estrutura do Projeto de Pesquisa</h2><p>Campos específicos para estrutura de projeto de pesquisa conforme ABNT NBR 15287:2025.</p><p className="toc-update-note">Após abrir o DOCX no Word ou LibreOffice, atualize os campos do documento para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
          {selectedUflaProductionType && <div className="mode-panel"><h2>{selectedUflaProductionType.label}</h2><p>{ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE}</p><p><strong>Saída do sistema:</strong> DOCX editável; o PDF final deve ser exportado no Word ou LibreOffice.</p></div>}
          {ACADEMIC_FIELD_KEYS.map((key) => (visibleField(key, fields.workType) || (assistedMode && ASSISTED_FIELD_KEYS.includes(key))) ? <div className="field-group" key={key}><div className="label-row"><label htmlFor={key}>{key === "course" ? courseFieldLabel(fields.workType) : FIELD_LABELS[key]}</label><span className={`confidence confidence-${confidence[key]}`}>{CONFIDENCE_LABELS[confidence[key]]}</span></div>{LONG_FIELDS.has(key) ? <textarea id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} rows={rowsForField(key)} /> : key === "program" && ["dissertacao", "tese", "projeto_pesquisa"].includes(fields.workType) ? <input id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} list="ufla-ppg-programs" /> : <input id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} />}{key === "referencias" && <div className="field-note"><p>Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.</p><p>Use uma referência por linha. Para destacar manualmente, selecione o trecho e clique em Negrito ou Itálico.</p></div>}</div> : null)}
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
            <div className="word-ribbon-tabs" aria-label="Abas da faixa">
              <button className="word-ribbon-tab active" type="button">Página Inicial</button>
            </div>
            <div className="toolbar editor-mode-toolbar" aria-label="Modo de edição">
              <button className={`text-button ${editorMode === "body" ? "active" : ""}`} type="button" onClick={() => setEditorMode("body")}>Texto</button>
              <button className={`text-button ${editorMode === "references" ? "active" : ""}`} type="button" onClick={() => setEditorMode("references")}>Referências</button>
            </div>
            {isTiptapEditorEnabled ? (
              <div className="tiptap-toolbar" aria-label="Faixa de formatação Tiptap">
                <div className="tiptap-toolbar-group">
                  <span className="tiptap-toolbar-label">Texto</span>
                  <div className="tiptap-toolbar-row">
                    <ToolButton title="Negrito" glyph="N" className="tool-negrito" onClick={() => runEditorAction("bold", () => wrapSelection("bold"))} />
                    <ToolButton title="Itálico" glyph="I" onClick={() => runEditorAction("italic", () => wrapSelection("italic"))} />
                    <ToolButton title="Sublinhado" glyph="S" className="tool-sublinhado" onClick={() => runEditorAction("underline", () => runEditorCommand("underline"))} />
                    <ToolButton title="Limpar formatação" glyph="⌫" onClick={() => runEditorAction("clearFormatting", clearFormatting)} />
                  </div>
                </div>
                <div className="tiptap-toolbar-group">
                  <span className="tiptap-toolbar-label">Estrutura</span>
                  <div className="tiptap-toolbar-row">
                    <ToolButton title="Normal" glyph="¶" onClick={() => runEditorAction("paragraph", () => applyBlockStyle("p"))} />
                    <ToolButton title="Título 1" glyph="T1" onClick={() => runEditorAction("heading1", () => applyBlockStyle("# "))} />
                    <ToolButton title="Título 2" glyph="T2" onClick={() => runEditorAction("heading2", () => applyBlockStyle("## "))} />
                    <ToolButton title="Citação" glyph="❝" onClick={() => runEditorAction("blockquote", () => applyBlockStyle("> "))} />
                    <ToolButton title="Ref. ABNT" glyph="Ref" tooltip="Marca o parágrafo como referência bibliográfica para a seção REFERÊNCIAS do DOCX." onClick={() => runEditorAction("reference", () => applyBlockStyle("[REF] "))} />
                  </div>
                </div>
                <div className="tiptap-toolbar-group">
                  <span className="tiptap-toolbar-label">Listas</span>
                  <div className="tiptap-toolbar-row">
                    <ToolButton title="Marcadores" glyph="•" onClick={() => runEditorAction("bulletList", () => runEditorCommand("insertUnorderedList"))} />
                    <ToolButton title="Numerada" glyph="1." onClick={() => runEditorAction("orderedList", () => runEditorCommand("insertOrderedList"))} />
                  </div>
                </div>
                <div className="tiptap-toolbar-group">
                  <span className="tiptap-toolbar-label">Alinhamento</span>
                  <div className="tiptap-toolbar-row">
                    <ToolButton title="Alinhar à esquerda" glyph="E" onClick={() => runEditorAction("alignLeft", () => runEditorCommand("justifyLeft"))} />
                    <ToolButton title="Centralizar" glyph="C" onClick={() => runEditorAction("alignCenter", () => runEditorCommand("justifyCenter"))} />
                    <ToolButton title="Justificar" glyph="J" onClick={() => runEditorAction("alignJustify", () => runEditorCommand("justifyFull"))} />
                  </div>
                </div>
                <div className="tiptap-toolbar-group">
                  <span className="tiptap-toolbar-label">Histórico</span>
                  <div className="tiptap-toolbar-row">
                    <ToolButton title="Desfazer" glyph="↶" onClick={() => runEditorAction("undo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("undo"); })} />
                    <ToolButton title="Refazer" glyph="↷" onClick={() => runEditorAction("redo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("redo"); })} />
                  </div>
                </div>
              </div>
            ) : (
                <div className="toolbar word-ribbon" aria-label="Faixa de formatação do editor">
                <div className="word-tool-group" data-group="Área de edição" aria-label="Área de Transferência">
                  <div className="word-tool-row">
                    <ToolButton title="Limpar formatação" glyph="⌫" onClick={() => runEditorAction("clearFormatting", clearFormatting)} />
                    <ToolButton title="Desfazer" glyph="↶" onClick={() => runEditorAction("undo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("undo"); })} />
                    <ToolButton title="Refazer" glyph="↷" onClick={() => runEditorAction("redo", () => { editorRef.current?.focus(); editorCommandAdapter.applyEditorCommand("redo"); })} />
                  </div>
                  <span className="word-tool-group-label">Área de Transferência</span>
                </div>

                <div className="word-tool-group" data-group="Estrutura" aria-label="Estrutura">
                  <div className="word-tool-row">
                    <ToolButton title="Título 1" glyph="T1" onClick={() => runEditorAction("heading1", () => applyBlockStyle("# "))} />
                    <ToolButton title="Título 2" glyph="T2" onClick={() => runEditorAction("heading2", () => applyBlockStyle("## "))} />
                    <ToolButton title="Citação longa" glyph="❝" onClick={() => runEditorAction("blockquote", () => applyBlockStyle("> "))} />
                    <ToolButton title="Marcar como referência bibliográfica" glyph="Ref. ABNT" className="tool-reference" tooltip="Marca o parágrafo como referência bibliográfica para a seção REFERÊNCIAS do DOCX." onClick={() => runEditorAction("reference", () => applyBlockStyle("[REF] "))} />
                  </div>
                  <span className="word-tool-group-label">Estrutura</span>
                </div>

                <div className="word-tool-group" data-group="Parágrafo" aria-label="Parágrafo">
                  <div className="word-tool-row">
                    <ToolButton title="Lista com marcadores" glyph="•" onClick={() => runEditorAction("bulletList", () => runEditorCommand("insertUnorderedList"))} />
                    <ToolButton title="Lista numerada" glyph="1." onClick={() => runEditorAction("orderedList", () => runEditorCommand("insertOrderedList"))} />
                    <ToolButton title="Alinhar à esquerda" glyph="E" onClick={() => runEditorAction("alignLeft", () => runEditorCommand("justifyLeft"))} />
                    <ToolButton title="Centralizar" glyph="C" onClick={() => runEditorAction("alignCenter", () => runEditorCommand("justifyCenter"))} />
                    <ToolButton title="Justificar" glyph="J" onClick={() => runEditorAction("alignJustify", () => runEditorCommand("justifyFull"))} />
                  </div>
                  <span className="word-tool-group-label">Parágrafo</span>
                </div>
              </div>
            )}
            {isTiptapEditorEnabled && (
              <p className="tiptap-mode-banner" role="note">
                Modo Tiptap experimental. Use para testar a nova edição. O DOCX continua sendo gerado pelo exportador estável.
              </p>
            )}
            <p id={EDITOR_DESCRIPTION_ID} className="field-note editor-mode-note">{editorHelpText}</p>
          </div>
          <div className="editor-page-stack" aria-label="Editor de texto contínuo">
            <div className="editor-page-shell">
              {isTiptapEditorEnabled ? (
                <Suspense
                  fallback={
                    <div className="editor rich-editor tiptap-loading" role="status">
                      Carregando editor Tiptap experimental...
                    </div>
                  }
                >
                  <AcademicTiptapEditor
                    value={activeEditorText}
                    onChange={updateActiveEditorText}
                    ariaLabel={editorAriaLabel}
                    describedBy={EDITOR_DESCRIPTION_ID}
                    editable={true}
                    commandSignal={tiptapCommandSignal}
                    editorMode={editorMode}
                  />
                </Suspense>
              ) : (
                <div ref={editorRef} className="editor rich-editor" data-editor-mode={editorMode} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-describedby={EDITOR_DESCRIPTION_ID} aria-label={editorAriaLabel} onInput={handleRichEditorInput} onPaste={handleEditorPaste} spellCheck />
              )}
            </div>
          </div>
          <p className="editor-page-note">Editor em visualização contínua. A paginação final deve ser conferida no Word/LibreOffice após atualizar campos e sumário.</p>
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
          finalPending={finalPending}
        />
        </>
        )}
      </main>
    </div>
  );
}
