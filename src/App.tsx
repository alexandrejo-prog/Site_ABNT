import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  Bold,
  Eraser,
  FileCheck2,
  FileDown,
  Heading1,
  Heading2,
  Italic,
  Pilcrow,
  Quote,
  Upload,
  XCircle,
} from "lucide-react";
import { importDocumentFile } from "./import-docx";
import {
  ACADEMIC_FIELD_KEYS,
  AcademicFieldKey,
  type AcademicFields,
  CONFIDENCE_LABELS,
  Confidence,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  emptyAcademicFields,
  emptyConfidenceMap,
  isCpgWork,
} from "./ufla-rules";
import {
  ValidationIssue,
  hasBlockingErrors,
  validateWork,
  ADHERENCE_CATEGORIES,
  type AdherenceCategory,
} from "./validators";

const FIELD_LABELS: Record<AcademicFieldKey, string> = {
  author: "Autor",
  title: "Título",
  subtitle: "Subtítulo",
  workNature: "Natureza do trabalho",
  course: "Curso",
  program: "Programa",
  advisor: "Orientador",
  coadvisor: "Coorientador",
  location: "Local",
  year: "Ano",
  resumo: "Resumo",
  palavrasChave: "Palavras-chave",
  abstractText: "Abstract",
  keywords: "Keywords",
  introducao: "Introdução",
  conclusao: "Conclusão",
  referencias: "Referências",
  anexos: "Anexos",
  apendices: "Apêndices",
  dedicatoria: "Dedicatória",
  agradecimentos: "Agradecimentos",
  epigrafe: "Epígrafe",
  indicadoresImpacto: "Indicadores de impacto",
  impactIndicators: "Impact indicators",
  imageWarnings: "Avisos de imagens",
};

const LONG_FIELDS = new Set<AcademicFieldKey>([
  "workNature",
  "resumo",
  "abstractText",
  "introducao",
  "conclusao",
  "referencias",
  "anexos",
  "apendices",
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
  "indicadoresImpacto",
  "impactIndicators",
  "imageWarnings",
]);

type EditorMode = "body" | "references";

function safeFileName(title: string): string {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalized || "trabalho-ufla"}.docx`;
}

function stripBlockMarker(line: string): string {
  return line
    .replace(/^#{1,3}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^\[REF\]\s+/i, "");
}

function stripInlineMarkup(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkupToHtml(value: string): string {
  const parts: string[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(escapeHtml(value.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(`<strong>${escapeHtml(token.slice(2, -2))}</strong>`);
    } else {
      parts.push(`<em>${escapeHtml(token.slice(1, -1))}</em>`);
    }
    cursor = match.index + token.length;
  }

  if (cursor < value.length) {
    parts.push(escapeHtml(value.slice(cursor)));
  }

  return parts.join("") || "<br />";
}

function editorMarkupToHtml(value: string): string {
  const lines = value.split(/\n/);
  if (!value.trim()) return "<p><br /></p>";

  return lines
    .map((rawLine) => {
      const line = rawLine.trimEnd();
      if (!line.trim()) return "<p><br /></p>";
      if (/^###\s+/.test(line)) return `<h3>${inlineMarkupToHtml(line.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s+/.test(line)) return `<h2>${inlineMarkupToHtml(line.replace(/^##\s+/, ""))}</h2>`;
      if (/^#\s+/.test(line)) return `<h1>${inlineMarkupToHtml(line.replace(/^#\s+/, ""))}</h1>`;
      if (/^>\s+/.test(line)) return `<blockquote>${inlineMarkupToHtml(line.replace(/^>\s+/, ""))}</blockquote>`;
      if (/^\[REF\]\s+/i.test(line)) return `<p data-reference="true">${inlineMarkupToHtml(line.replace(/^\[REF\]\s+/i, ""))}</p>`;
      return `<p>${inlineMarkupToHtml(line)}</p>`;
    })
    .join("");
}

function inlineNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  if (element.tagName === "BR") return "\n";

  const text = Array.from(element.childNodes).map(inlineNodeToMarkup).join("");
  if (!text) return "";
  if (element.tagName === "STRONG" || element.tagName === "B") return `**${text}**`;
  if (element.tagName === "EM" || element.tagName === "I") return `*${text}*`;
  return text;
}

function blockNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").trim();
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const text = Array.from(element.childNodes)
    .map(inlineNodeToMarkup)
    .join("")
    .replace(/\n+$/g, "")
    .trimEnd();

  if (!text.trim()) return "";
  if (element.tagName === "H1") return `# ${text}`;
  if (element.tagName === "H2") return `## ${text}`;
  if (element.tagName === "H3") return `### ${text}`;
  if (element.tagName === "BLOCKQUOTE") return `> ${text}`;
  if (element.dataset.reference === "true") return `[REF] ${text}`;
  return text;
}

function editorHtmlToMarkup(element: HTMLElement): string {
  const blocks = Array.from(element.childNodes)
    .map(blockNodeToMarkup)
    .filter((line) => line.trim().length > 0);
  return blocks.join("\n");
}

function rowsForField(key: AcademicFieldKey): number {
  if (key === "referencias") return 12;
  if (key === "anexos" || key === "apendices") return 7;
  if (key === "workNature" || key === "imageWarnings") return 4;
  return LONG_FIELDS.has(key) ? 5 : 1;
}

function isGraduateStrictWork(workType: AcademicFields["workType"]): boolean {
  return workType === "dissertacao" || workType === "tese";
}

function isGenericWorkNature(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    !value.trim() ||
    normalized.includes("requisito academico") ||
    normalized.includes("dados revisados pelo usuario") ||
    normalized.includes("trabalho apresentado a universidade federal de lavras como requisito")
  );
}

function defaultWorkNature(fields: AcademicFields): string {
  const isThesis = fields.workType === "tese";
  const kind = isThesis ? "Tese" : "Dissertação";
  const degree = isThesis ? "Doutor em Ciências" : "Mestre em Ciências";
  const program =
    fields.program || "Programa de Pós-Graduação em Educação Científica e Ambiental";

  return `${kind} apresentada à Universidade Federal de Lavras, como parte das exigências do ${program}, para obtenção do título de ${degree}.`;
}

function ensureGraduateCompleteStructure(fields: AcademicFields): AcademicFields {
  if (!isGraduateStrictWork(fields.workType)) return fields;

  const next = { ...fields };

  if (isGenericWorkNature(next.workNature)) {
    next.workNature = defaultWorkNature(next);
  }

  if (!next.program.trim()) {
    next.program = "Programa de Pós-Graduação em Educação Científica e Ambiental";
  }

  if (!next.abstractText.trim()) {
    next.abstractText =
      "Abstract não informado no arquivo original. Revise e substitua este texto antes da versão final.";
  }

  if (!next.keywords.trim()) {
    next.keywords = "research; university; work; management; UFLA";
  }

  return next;
}

function ToolButton({
  title,
  children,
  onClick,
}: {
  title: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="icon-button" type="button" title={title} onClick={onClick}>
      {children}
      <span className="sr-only">{title}</span>
    </button>
  );
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

  const errors = useMemo(
    () => issues.filter((issue) => issue.severity === "error"),
    [issues],
  );
  const warnings = useMemo(
    () => issues.filter((issue) => issue.severity === "warning"),
    [issues],
  );
  const isCpgSelected = isCpgWork(fields.workType);
  const activeEditorText = editorMode === "references" ? fields.referencias : editorText;

  useEffect(() => {
    if (!editorRef.current) return;
    const newContent = editorMarkupToHtml(activeEditorText);
    const currentVersion = editorContentVersionRef.current;
    
    // Atualiza o innerHTML se o conteúdo mudou e não estamos editando ativamente
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
    setConfidence((current) => ({
      ...current,
      [key]: current[key] === "nao-identificado" ? "baixa" : current[key],
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
    setFields((current) => ensureGraduateCompleteStructure({ ...current, workType }));
    setConfidence((current) => ({
      ...current,
      workNature: isGraduateStrictWork(workType) ? "media" : current.workNature,
      program: isGraduateStrictWork(workType) ? "media" : current.program,
      abstractText: isGraduateStrictWork(workType) ? "baixa" : current.abstractText,
      keywords: isGraduateStrictWork(workType) ? "baixa" : current.keywords,
    }));
  }

  function mergeImportedFields(
    importedFields: ReturnType<typeof emptyAcademicFields>,
    importedConfidence: Record<AcademicFieldKey, Confidence>,
  ) {
    setFields((current) => {
      const next = { ...current };
      if (!next.workType && importedFields.workType) {
        next.workType = importedFields.workType;
      }
      for (const key of ACADEMIC_FIELD_KEYS) {
        if (!next[key] && importedFields[key]) {
          next[key] = importedFields[key];
        }
      }
      return ensureGraduateCompleteStructure(next);
    });

    setConfidence((current) => {
      const next = { ...current };
      for (const key of ACADEMIC_FIELD_KEYS) {
        if (importedConfidence[key] !== "nao-identificado") {
          next[key] = importedConfidence[key];
        }
      }
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
      lastAppliedEditorTextRef.current = newEditorText;
      editorContentVersionRef.current += 1;
      
      setStatus(
        result.messages.length
          ? `Arquivo importado com ${result.messages.length} aviso(s).`
          : "Arquivo importado. Revise os campos antes de gerar.",
      );
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
    const block = prefix === "# " ? "h1" : prefix === "## " ? "h2" : prefix === "> " ? "blockquote" : "p";
    document.execCommand("formatBlock", false, block);
    if (prefix === "[REF] ") {
      document.execCommand("insertText", false, "[REF] ");
    }
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

  function handleEditorPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0);
  }

  function runValidation(candidateFields = fields) {
    const normalizedFields = ensureGraduateCompleteStructure(candidateFields);
    const textToValidate = editorMode === "references" ? fields.referencias : editorText;
    const nextIssues = validateWork(normalizedFields, textToValidate);
    setFields(normalizedFields);
    setIssues(nextIssues);
    setStatus(
      hasBlockingErrors(nextIssues)
        ? "Há erros essenciais antes da geração."
        : "Validação concluída. Alertas não bloqueiam a geração.",
    );
    return nextIssues;
  }

  async function handleGenerateDocx() {
    const generationFields = ensureGraduateCompleteStructure(fields);
    const nextIssues = runValidation(generationFields);
    if (hasBlockingErrors(nextIssues) && !generateAnyway) {
      return;
    }

    try {
      setIsGenerating(true);
      setStatus("Gerando DOCX...");
      
      // Carrega exportadores sob demanda para reduzir bundle inicial
      const [{ generateDocxBlob }, { generateArticleDocxBlob }, { generateCpgDocxBlob }] = await Promise.all([
        import("./export-docx"),
        import("./export-article-docx"),
        import("./export-cpg-docx"),
      ]);
      
      const blob = isCpgWork(generationFields.workType)
        ? await generateCpgDocxBlob({ fields: generationFields, editorText })
        : generationFields.workType === "artigo"
          ? await generateArticleDocxBlob({ fields: generationFields, editorText })
          : await generateDocxBlob({ fields: generationFields, editorText });
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
        <div>
          <p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p>
          <h1>Normalização Acadêmica UFLA — DOCX editável</h1>
        </div>
        <div className="header-actions">
          <label className="upload-button">
            <Upload size={18} aria-hidden="true" />
            Importar
            <input
              type="file"
              accept=".docx,.txt,.md"
              onChange={handleImport}
            />
          </label>
          {importedFileName && (
            <button
              className="primary-action"
              type="button"
              onClick={handleRemoveImport}
              title={`Remover importação: ${importedFileName}`}
            >
              <XCircle size={18} aria-hidden="true" />
              Remover importação
            </button>
          )}
          <button className="primary-action" type="button" onClick={() => runValidation()}>
            <FileCheck2 size={18} aria-hidden="true" />
            Validar trabalho
          </button>
          <button
            className="primary-action strong"
            type="button"
            onClick={handleGenerateDocx}
            disabled={isGenerating}
          >
            <FileDown size={18} aria-hidden="true" />
            {isGenerating ? "Gerando..." : "Gerar DOCX"}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="metadata-pane" aria-label="Campos acadêmicos">
          <div className="field-group">
            <label htmlFor="work-type">Tipo de trabalho</label>
            <select
              id="work-type"
              value={fields.workType}
              onChange={(event) =>
                updateWorkType(event.target.value as typeof fields.workType)
              }
            >
              <option value="">Selecione</option>
              {WORK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {fields.workType === "artigo" && (
            <div className="mode-panel">
              <h2>Artigo academico simples</h2>
              <p>
                Artigo simples nao usa capa, folha de rosto, ficha catalografica, folha de aprovacao, indicadores de impacto nem sumario.
              </p>
            </div>
          )}

          {isCpgSelected && (
            <div className="mode-panel">
              <h2>Modo CPG/UFLA selecionado</h2>
              <p>
                Este modelo e diferente de monografia, dissertacao e tese. Nao usa capa, folha de rosto, ficha catalografica, folha de aprovacao, indicadores de impacto, sumario, cabecalho, rodape nem numero de pagina.
              </p>
              {fields.workType === "resumo_cpg" && (
                <p>
                  Resumo de 1 pagina, em portugues, A4, coluna simples, Times 12, margens 3,5 cm superior, 2,5 cm inferior e 3 cm laterais.
                </p>
              )}
              {fields.workType === "resumo_expandido_cpg" && (
                <p>
                  Resumo expandido de 4 a 6 paginas. Primeira pagina com titulo, autores, enderecos, e-mails, abstract, keywords, resumo e palavras-chave.
                </p>
              )}
              {fields.workType === "artigo_completo_cpg" && (
                <p>
                  Artigo completo de 8 a 14 paginas. Primeira pagina com titulo, autores, enderecos, e-mails, abstract, keywords, resumo e palavras-chave.
                </p>
              )}
              <p>
                O campo Autor pode receber multiplos autores separados por virgula. Use Programa como endereco ou afiliacao institucional e Curso para e-mails ou informacoes adicionais nesta rodada.
              </p>
              <p>
                <strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.
              </p>
            </div>
          )}

          {ACADEMIC_FIELD_KEYS.map((key) => (
            <div className="field-group" key={key}>
              <div className="label-row">
                <label htmlFor={key}>{FIELD_LABELS[key]}</label>
                <span className={`confidence confidence-${confidence[key]}`}>
                  {CONFIDENCE_LABELS[confidence[key]]}
                </span>
              </div>
              {LONG_FIELDS.has(key) ? (
                <textarea
                  id={key}
                  value={fields[key]}
                  onChange={(event) => updateField(key, event.target.value)}
                  rows={rowsForField(key)}
                />
              ) : (
                <input
                  id={key}
                  value={fields[key]}
                  onChange={(event) => updateField(key, event.target.value)}
                />
              )}
              {key === "referencias" && (
                <div className="field-note">
                  <p>
                    Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.
                  </p>
                  <p>
                    Use uma referência por linha. Para destacar manualmente, selecione o trecho e clique em Negrito ou Itálico.
                  </p>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="editor-pane" aria-label="Editor do texto">
          <div className="editor-toolbar-sticky">
            <div className="toolbar" aria-label="Modo de edição">
              <button
                className={`text-button ${editorMode === "body" ? "active" : ""}`}
                type="button"
                title="Editar texto principal"
                onClick={() => setEditorMode("body")}
              >
                Texto
              </button>
              <button
                className={`text-button ${editorMode === "references" ? "active" : ""}`}
                type="button"
                title="Editar referências no painel central"
                onClick={() => setEditorMode("references")}
              >
                Referências
              </button>
            </div>

            <div className="toolbar" aria-label="Ferramentas do editor">
              <ToolButton title="Desfazer (Ctrl+Z)" onClick={() => {
                editorRef.current?.focus();
                document.execCommand("undo", false);
              }}>
                <span className="toolbar-text">Desfazer</span>
              </ToolButton>
              <ToolButton title="Refazer (Ctrl+Y)" onClick={() => {
                editorRef.current?.focus();
                document.execCommand("redo", false);
              }}>
                <span className="toolbar-text">Refazer</span>
              </ToolButton>
              <ToolButton title="Parágrafo normal" onClick={() => applyBlockStyle("")}>
                <Pilcrow size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Título primário" onClick={() => applyBlockStyle("# ")}>
                <Heading1 size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Título secundário" onClick={() => applyBlockStyle("## ")}>
                <Heading2 size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Negrito" onClick={() => wrapSelection("bold")}>
                <Bold size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Itálico" onClick={() => wrapSelection("italic")}>
                <Italic size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Citação longa" onClick={() => applyBlockStyle("> ")}>
                <Quote size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Referência" onClick={() => applyBlockStyle("[REF] ")}>
                <FileCheck2 size={18} aria-hidden="true" />
              </ToolButton>
              <ToolButton title="Limpar formatação" onClick={clearFormatting}>
                <Eraser size={18} aria-hidden="true" />
              </ToolButton>
            </div>

            <p className="field-note editor-mode-note">
              {editorMode === "references"
                ? "Editando referências no painel central. Selecione palavras e use Negrito/Itálico como no Word."
                : "Editando texto principal. Selecione palavras e use Negrito/Itálico como no Word."}
            </p>
          </div>

          <div
            ref={editorRef}
            className="editor rich-editor"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={editorMode === "references" ? "Editor de referências" : "Editor do texto principal"}
            onInput={handleRichEditorInput}
            onPaste={handleEditorPaste}
            spellCheck
          />

          <div className="adherence-panel">
            <button
              type="button"
              className="adherence-header"
              onClick={() => setAdherenceExpanded((prev) => !prev)}
              aria-expanded={adherenceExpanded}
              aria-controls="adherence-content"
            >
              <span>Painel de aderência normativa</span>
              <span className={`adherence-chevron ${adherenceExpanded ? "open" : ""}`}>▼</span>
            </button>
            {adherenceExpanded && (
              <div className="adherence-body" id="adherence-content">
                <p className="adherence-disclaimer">
                  Este painel reflete o que o sistema implementa atualmente. A conformidade final depende de revisão manual no DOCX gerado.
                </p>
                <div className="adherence-grid">
                  {ADHERENCE_CATEGORIES.map((category) => (
                    <div className="adherence-item" key={category.key}>
                      <span className="adherence-label">{category.label}</span>
                      <span className={`adherence-status adherence-${category.status}`}>
                        {category.statusLabel}
                      </span>
                      {category.note && (
                        <span className="adherence-note">{category.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="validation-pane" aria-label="Validação">
          <div className="status-line" aria-live="polite">
            {status}
          </div>

          <div className="post-generation-note">
            <strong>Após gerar o DOCX:</strong> abra no Word ou em outro editor de texto, atualize o sumário (F9) e campos quando necessário, confira paginação e exporte para PDF para submissão final.
          </div>

          <label className="force-generate">
            <input
              type="checkbox"
              checked={generateAnyway}
              onChange={(event) => setGenerateAnyway(event.target.checked)}
            />
            <span>Gerar mesmo assim</span>
          </label>

          <div className="issue-list">
            <h2>Erros</h2>
            {errors.length ? (
              errors.map((issue) => (
                <div className={`issue error`} key={issue.code}>
                  <p className="issue-message">{issue.message}</p>
                  {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
                  {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
                  {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
                </div>
              ))
            ) : (
              <p className="empty-state">Nenhum erro essencial.</p>
            )}
          </div>

          <div className="issue-list">
            <h2>Alertas</h2>
            {warnings.length ? (
              warnings.map((issue) => (
                <div className={`issue warning`} key={issue.code}>
                  <p className="issue-message">{issue.message}</p>
                  {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
                  {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
                  {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
                </div>
              ))
            ) : (
              <p className="empty-state">Nenhum alerta registrado.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
