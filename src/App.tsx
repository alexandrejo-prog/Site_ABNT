import { ChangeEvent, ClipboardEvent as ReactClipboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { Bold, Eraser, FileCheck2, FileDown, Heading1, Heading2, Italic, Pilcrow, Quote, Upload, XCircle } from "lucide-react";
import { importDocumentFile } from "./import-docx";
import { ACADEMIC_FIELD_KEYS, AcademicFieldKey, type AcademicFields, CONFIDENCE_LABELS, Confidence, WORK_TYPE_LABELS, WORK_TYPES, emptyAcademicFields, emptyConfidenceMap, isCpgWork, isResearchProject, isUflaCollectionWork } from "./ufla-rules";
import { ValidationIssue, hasBlockingErrors, validateWork, ADHERENCE_CATEGORIES } from "./validators";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { templateForWorkType } from "./document-template";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "./academic-production-types";

const FIELD_LABELS: Record<AcademicFieldKey, string> = {
  author: "Autor", title: "Título", subtitle: "Subtítulo", workNature: "Natureza do trabalho", course: "Curso", program: "Programa", advisor: "Orientador", coadvisor: "Coorientador", location: "Local", year: "Ano", resumo: "Resumo", palavrasChave: "Palavras-chave", abstractText: "Abstract", keywords: "Keywords", introducao: "Introdução", conclusao: "Conclusão", referencias: "Referências", anexos: "Anexos", apendices: "Apêndices", dedicatoria: "Dedicatória", agradecimentos: "Agradecimentos", epigrafe: "Epígrafe", indicadoresImpacto: "Indicadores de impacto", impactIndicators: "Impact indicators", imageWarnings: "Avisos de imagens", tema: "Tema", delimitacaoTema: "Delimitação do Tema", problemaPesquisa: "Problema de Pesquisa", hipotese: "Hipótese", objetivoGeral: "Objetivo Geral", objetivosEspecificos: "Objetivos Específicos", justificativa: "Justificativa", referencialTeorico: "Referencial Teórico", metodologia: "Metodologia", cronograma: "Cronograma", recursosOrcamento: "Recursos/Orçamento", resultadosEsperados: "Resultados Esperados",
};

const RESEARCH_PROJECT_FIELD_KEYS: AcademicFieldKey[] = ["tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia", "cronograma", "recursosOrcamento", "resultadosEsperados"];
const LONG_FIELDS = new Set<AcademicFieldKey>(["workNature", "resumo", "abstractText", "introducao", "conclusao", "referencias", "anexos", "apendices", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators", "imageWarnings", ...RESEARCH_PROJECT_FIELD_KEYS]);
type EditorMode = "body" | "references";

function safeFileName(title: string): string {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${normalized || "trabalho-ufla"}.docx`;
}

function rowsForField(key: AcademicFieldKey): number {
  if (key === "referencias") return 12;
  if (key === "anexos" || key === "apendices") return 7;
  return LONG_FIELDS.has(key) ? 5 : 1;
}

function visibleField(key: AcademicFieldKey, workType: AcademicFields["workType"]): boolean {
  if (RESEARCH_PROJECT_FIELD_KEYS.includes(key)) return isResearchProject(workType);
  if (workType === "artigo") return !["workNature", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators"].includes(key);
  if (isUflaCollectionWork(workType)) return !["dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators"].includes(key);
  if (isCpgWork(workType)) return !["workNature", "dedicatoria", "epigrafe", "indicadoresImpacto", "impactIndicators", "anexos", "apendices"].includes(key);
  return true;
}

function modelConfidence(workType: AcademicFields["workType"]): boolean {
  return ["monografia", "dissertacao", "tese", "projeto_pesquisa"].includes(workType);
}

function ToolButton({ title, children, onClick }: { title: string; children: ReactNode; onClick: () => void }) {
  return <button className="icon-button" type="button" title={title} onClick={onClick}>{children}<span className="sr-only">{title}</span></button>;
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
  const editorRef = useRef<HTMLDivElement>(null);
  const editorContentVersionRef = useRef(0);
  const lastAppliedEditorTextRef = useRef("");
  const errors = useMemo(() => issues.filter((issue) => issue.severity === "error"), [issues]);
  const warnings = useMemo(() => issues.filter((issue) => issue.severity === "warning"), [issues]);
  const isCpgSelected = isCpgWork(fields.workType);
  const selectedUflaProductionType = isUflaCollectionWork(fields.workType) ? academicProductionTypeById(fields.workType) : undefined;
  const activeEditorText = editorMode === "references" ? fields.referencias : editorText;

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
    setFields((current) => ({ ...current, [key]: value }));
    setConfidence((current) => ({ ...current, [key]: current[key] === "nao-identificado" ? "baixa" : current[key] }));
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
    setFields((current) => normalizeFieldsForSelectedModel({ ...current, workType }));
    setConfidence((current) => ({ ...current, workNature: modelConfidence(workType) ? "media" : current.workNature, program: modelConfidence(workType) ? "media" : current.program }));
    setGenerateAnyway(false);
    setIssues((current) => current.filter((issue) => issue.code !== "work-type-required"));
  }

  function mergeImportedFields(importedFields: ReturnType<typeof emptyAcademicFields>, importedConfidence: Record<AcademicFieldKey, Confidence>) {
    setFields((current) => {
      const next = { ...current };
      if (!next.workType && importedFields.workType) next.workType = importedFields.workType;
      for (const key of ACADEMIC_FIELD_KEYS) if (!next[key] && importedFields[key]) next[key] = importedFields[key];
      return normalizeFieldsForSelectedModel(next);
    });
    setConfidence((current) => {
      const next = { ...current };
      for (const key of ACADEMIC_FIELD_KEYS) if (importedConfidence[key] !== "nao-identificado") next[key] = importedConfidence[key];
      return next;
    });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus("Importando arquivo...");
      const result = await importDocumentFile(file);
      mergeImportedFields(result.fields, result.confidence);
      setImportedFileName(file.name);
      setEditorMode("body");
      const newEditorText = result.editorText || result.fields.introducao || result.text;
      setEditorText(newEditorText);
      if (editorRef.current) editorRef.current.innerHTML = editorMarkupToHtml(newEditorText);
      lastAppliedEditorTextRef.current = newEditorText;
      editorContentVersionRef.current += 1;
      setStatus(result.messages.length ? `Arquivo importado com ${result.messages.length} aviso(s).` : "Arquivo importado. Revise os campos antes de gerar.");
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

  function applyBlockStyle(prefix: string) {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "> " ? "blockquote" : "p");
    if (prefix === "[REF] ") document.execCommand("insertText", false, "[REF] ");
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function wrapSelection(command: "bold" | "italic") {
    editorRef.current?.focus();
    document.execCommand(command, false);
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function clearFormatting() {
    editorRef.current?.focus();
    document.execCommand("removeFormat", false);
    document.execCommand("formatBlock", false, "p");
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function runValidation(candidateFields = fields) {
    const normalizedFields = normalizeFieldsForSelectedModel(candidateFields);
    const textToValidate = editorMode === "references" ? fields.referencias : editorText;
    const nextIssues = validateWork(normalizedFields, textToValidate);
    setFields(normalizedFields);
    setIssues(nextIssues);
    setStatus(hasBlockingErrors(nextIssues) ? "Há erros essenciais antes da geração." : "Validação concluída. Alertas não bloqueiam a geração.");
    return nextIssues;
  }

  async function handleGenerateDocx() {
    const generationFields = normalizeFieldsForSelectedModel(fields);
    const nextIssues = runValidation(generationFields);
    if (hasBlockingErrors(nextIssues) && !generateAnyway) return;
    try {
      setIsGenerating(true);
      setStatus("Gerando DOCX...");
      const blob = await templateForWorkType(generationFields.workType).generate({ fields: generationFields, editorText });
      saveAs(blob, safeFileName(generationFields.title));
      setStatus("DOCX gerado. Confira o arquivo baixado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar DOCX.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p><h1>Assistente de estruturação e pré-normalização UFLA/ABNT</h1></div>
        <div className="header-actions">
          <label className="upload-button"><Upload size={18} aria-hidden="true" />Importar<input type="file" accept=".docx,.txt,.md" onChange={handleImport} /></label>
          {importedFileName && <button className="primary-action" type="button" onClick={handleRemoveImport} title={`Remover importação: ${importedFileName}`}><XCircle size={18} aria-hidden="true" />Remover importação</button>}
          <button className="primary-action" type="button" onClick={() => runValidation()}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
          <button className="primary-action strong" type="button" onClick={handleGenerateDocx} disabled={isGenerating}><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX"}</button>
        </div>
      </header>

      <p className="global-draft-notice" role="note">O sistema gera um rascunho técnico editável. A submissão final exige revisão humana no Word ou LibreOffice.</p>

      <main className="workspace">
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <div className="field-group"><label htmlFor="work-type">Tipo de trabalho</label><select id="work-type" value={fields.workType} onChange={(event) => updateWorkType(event.target.value as typeof fields.workType)}><option value="">Selecione</option>{WORK_TYPES.map((type) => <option key={type} value={type}>{WORK_TYPE_LABELS[type]}</option>)}</select></div>
          {fields.workType === "artigo" && <div className="mode-panel"><h2>Artigo acadêmico simples</h2><p>Modelo sem capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto e sumário.</p></div>}
          {isCpgSelected && <div className="mode-panel"><h2>Modo CPG/UFLA selecionado</h2><p>Este modelo segue template CPG/UFLA. Quando o template CPG não for específico, use a ABNT aplicável.</p><p><strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.</p></div>}
          {isResearchProject(fields.workType) && <div className="mode-panel"><h2>Estrutura do Projeto de Pesquisa</h2><p>Campos específicos para estrutura de projeto de pesquisa conforme ABNT NBR 15287:2025.</p></div>}
          {selectedUflaProductionType && <div className="mode-panel"><h2>{selectedUflaProductionType.label}</h2><p>{ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE}</p><p><strong>Saida do sistema:</strong> DOCX editavel; o PDF final deve ser exportado no Word ou LibreOffice.</p></div>}
          {ACADEMIC_FIELD_KEYS.map((key) => visibleField(key, fields.workType) ? <div className="field-group" key={key}><div className="label-row"><label htmlFor={key}>{FIELD_LABELS[key]}</label><span className={`confidence confidence-${confidence[key]}`}>{CONFIDENCE_LABELS[confidence[key]]}</span></div>{LONG_FIELDS.has(key) ? <textarea id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} rows={rowsForField(key)} /> : <input id={key} value={fields[key]} onChange={(event) => updateField(key, event.target.value)} />}{key === "referencias" && <div className="field-note"><p>Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.</p><p>Use uma referência por linha. Para destacar manualmente, selecione o trecho e clique em Negrito ou Itálico.</p></div>}</div> : null)}
        </section>

        <section className="editor-pane" aria-label="Editor do texto">
          <div className="editor-toolbar-sticky">
            <div className="toolbar" aria-label="Modo de edição"><button className={`text-button ${editorMode === "body" ? "active" : ""}`} type="button" onClick={() => setEditorMode("body")}>Texto</button><button className={`text-button ${editorMode === "references" ? "active" : ""}`} type="button" onClick={() => setEditorMode("references")}>Referências</button></div>
            <div className="toolbar" aria-label="Ferramentas do editor"><ToolButton title="Desfazer (Ctrl+Z)" onClick={() => { editorRef.current?.focus(); document.execCommand("undo", false); }}><span className="toolbar-text">Desfazer</span></ToolButton><ToolButton title="Refazer (Ctrl+Y)" onClick={() => { editorRef.current?.focus(); document.execCommand("redo", false); }}><span className="toolbar-text">Refazer</span></ToolButton><ToolButton title="Parágrafo normal" onClick={() => applyBlockStyle("")}><Pilcrow size={18} aria-hidden="true" /></ToolButton><ToolButton title="Título primário" onClick={() => applyBlockStyle("# ")}><Heading1 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Título secundário" onClick={() => applyBlockStyle("## ")}><Heading2 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Negrito" onClick={() => wrapSelection("bold")}><Bold size={18} aria-hidden="true" /></ToolButton><ToolButton title="Itálico" onClick={() => wrapSelection("italic")}><Italic size={18} aria-hidden="true" /></ToolButton><ToolButton title="Citação longa" onClick={() => applyBlockStyle("> ")}><Quote size={18} aria-hidden="true" /></ToolButton><ToolButton title="Referência" onClick={() => applyBlockStyle("[REF] ")}><FileCheck2 size={18} aria-hidden="true" /></ToolButton><ToolButton title="Limpar formatação" onClick={clearFormatting}><Eraser size={18} aria-hidden="true" /></ToolButton></div>
            <p className="field-note editor-mode-note">{editorMode === "references" ? "Editando referências no painel central. Selecione palavras e use Negrito/Itálico como no Word." : "Editando texto principal. Selecione palavras e use Negrito/Itálico como no Word."}</p>
          </div>
          <div ref={editorRef} className="editor rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={editorMode === "references" ? "Editor de referências" : "Editor do texto principal"} onInput={handleRichEditorInput} onPaste={handleEditorPaste} spellCheck />
          <div className="adherence-panel"><button type="button" className="adherence-header" onClick={() => setAdherenceExpanded((prev) => !prev)} aria-expanded={adherenceExpanded} aria-controls="adherence-content"><span>Painel de aderência normativa</span><span className={`adherence-chevron ${adherenceExpanded ? "open" : ""}`}>▼</span></button>{adherenceExpanded && <div className="adherence-body" id="adherence-content"><p className="adherence-disclaimer">Este painel reflete o que o sistema implementa atualmente. A conformidade final depende de revisão manual no DOCX gerado.</p><div className="adherence-grid">{ADHERENCE_CATEGORIES.map((category) => <div className="adherence-item" key={category.key}><span className="adherence-label">{category.label}</span><span className={`adherence-status adherence-${category.status}`}>{category.statusLabel}</span>{category.note && <span className="adherence-note">{category.note}</span>}</div>)}</div></div>}</div>
        </section>

        <aside className="validation-pane" aria-label="Validação"><div className="status-line" aria-live="polite">{status}</div><div className="post-generation-note"><strong>Após gerar o DOCX:</strong> abra no Word ou em outro editor de texto, atualize o sumário (F9) e campos quando necessário, confira paginação e exporte para PDF para submissão final.</div><label className="force-generate"><input type="checkbox" checked={generateAnyway} onChange={(event) => setGenerateAnyway(event.target.checked)} /><span>Gerar mesmo assim</span></label><div className="issue-list" aria-label="Erros de validação"><h2>Erros</h2>{errors.length ? errors.map((issue) => <div className="issue error" key={issue.code} role="alert"><p className="issue-message">{issue.message}</p>{issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}{issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}{issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}</div>) : <p className="empty-state" role="status">Nenhum erro essencial.</p>}</div><div className="issue-list" aria-label="Alertas de validação"><h2>Alertas</h2>{warnings.length ? warnings.map((issue) => <div className="issue warning" key={issue.code} role="status"><p className="issue-message">{issue.message}</p>{issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}{issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}{issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}</div>) : <p className="empty-state" role="status">Nenhum alerta registrado.</p>}</div></aside>
      </main>
    </div>
  );
}
