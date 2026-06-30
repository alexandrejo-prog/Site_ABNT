import { ChangeEvent, ReactNode, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  Bold,
  BrainCircuit,
  Eraser,
  FileCheck2,
  FileDown,
  Heading1,
  Heading2,
  Italic,
  KeyRound,
  Pilcrow,
  Quote,
  Upload,
} from "lucide-react";
import { AI_PROVIDERS } from "./ai-assistant";
import { generateDocxBlob } from "./export-docx";
import { importDocumentFile } from "./import-docx";
import {
  ACADEMIC_FIELD_KEYS,
  AcademicFieldKey,
  CONFIDENCE_LABELS,
  Confidence,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  emptyAcademicFields,
  emptyConfidenceMap,
} from "./ufla-rules";
import {
  ValidationIssue,
  hasBlockingErrors,
  validateWork,
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
    .replace(/^#{1,2}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^\[REF\]\s+/i, "");
}

function stripInlineMarkup(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function rowsForField(key: AcademicFieldKey): number {
  if (key === "referencias") return 12;
  if (key === "anexos" || key === "apendices") return 7;
  if (key === "workNature" || key === "imageWarnings") return 4;
  return LONG_FIELDS.has(key) ? 5 : 1;
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
  const [aiProvider, setAiProvider] = useState("none");
  const [aiKey, setAiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateAnyway, setGenerateAnyway] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const errors = useMemo(
    () => issues.filter((issue) => issue.severity === "error"),
    [issues],
  );
  const warnings = useMemo(
    () => issues.filter((issue) => issue.severity === "warning"),
    [issues],
  );

  function updateField(key: AcademicFieldKey, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setConfidence((current) => ({
      ...current,
      [key]: current[key] === "nao-identificado" ? "baixa" : current[key],
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
      return next;
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
      setEditorText((current) =>
        current.trim() ? current : result.editorText || result.fields.introducao || result.text,
      );
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

  function selectedLineRange(value: string, start: number, end: number) {
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    return { lineStart, lineEnd };
  }

  function applyBlockStyle(prefix: string) {
    const textarea = editorRef.current;
    if (!textarea) return;

    const { value, selectionStart, selectionEnd } = textarea;
    const { lineStart, lineEnd } = selectedLineRange(value, selectionStart, selectionEnd);
    const before = value.slice(0, lineStart);
    const selected = value.slice(lineStart, lineEnd);
    const after = value.slice(lineEnd);
    const updated = selected
      .split(/\n/)
      .map((line) => {
        const cleanLine = stripBlockMarker(line);
        return cleanLine.trim() ? `${prefix}${cleanLine}` : cleanLine;
      })
      .join("\n");

    setEditorText(`${before}${updated}${after}`);
    requestAnimationFrame(() => textarea.focus());
  }

  function wrapSelection(marker: "*" | "**") {
    const textarea = editorRef.current;
    if (!textarea) return;

    const { value, selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const replacement = selected ? `${marker}${selected}${marker}` : marker.repeat(2);
    setEditorText(
      `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`,
    );
    requestAnimationFrame(() => textarea.focus());
  }

  function clearFormatting() {
    const textarea = editorRef.current;
    if (!textarea) return;

    const { value, selectionStart, selectionEnd } = textarea;
    const { lineStart, lineEnd } = selectedLineRange(value, selectionStart, selectionEnd);
    const before = value.slice(0, lineStart);
    const selected = value.slice(lineStart, lineEnd);
    const after = value.slice(lineEnd);
    const cleaned = selected
      .split(/\n/)
      .map((line) => stripInlineMarkup(stripBlockMarker(line)))
      .join("\n");
    setEditorText(`${before}${cleaned}${after}`);
    requestAnimationFrame(() => textarea.focus());
  }

  function runValidation() {
    const nextIssues = validateWork(fields, editorText);
    setIssues(nextIssues);
    setStatus(
      hasBlockingErrors(nextIssues)
        ? "Há erros essenciais antes da geração."
        : "Validação concluída. Alertas não bloqueiam a geração.",
    );
    return nextIssues;
  }

  async function handleGenerateDocx() {
    const nextIssues = runValidation();
    if (hasBlockingErrors(nextIssues) && !generateAnyway) {
      return;
    }

    try {
      setIsGenerating(true);
      setStatus("Gerando DOCX...");
      const blob = await generateDocxBlob({ fields, editorText });
      saveAs(blob, safeFileName(fields.title));
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
          <p className="eyebrow">Normalização UFLA</p>
          <h1>UFLA DOCX Acadêmico</h1>
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
          <button className="primary-action" type="button" onClick={runValidation}>
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
                setFields((current) => ({
                  ...current,
                  workType: event.target.value as typeof fields.workType,
                }))
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
                    Revise as referências antes de gerar a versão final. O sistema aplica destaques automaticamente apenas quando há segurança. Use **negrito** e *itálico* para marcação manual.
                  </p>
                  <p>
                    Para editar: altere o texto acima. Para marcar manualmente: use **título em negrito** e *periódico em itálico*. Se houver [REF] no editor textual, elas são incorporadas automaticamente.
                  </p>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="editor-pane" aria-label="Editor do texto">
          <div className="toolbar" aria-label="Ferramentas do editor">
            <ToolButton title="Parágrafo normal" onClick={() => applyBlockStyle("")}>
              <Pilcrow size={18} aria-hidden="true" />
            </ToolButton>
            <ToolButton title="Título primário" onClick={() => applyBlockStyle("# ")}>
              <Heading1 size={18} aria-hidden="true" />
            </ToolButton>
            <ToolButton title="Título secundário" onClick={() => applyBlockStyle("## ")}>
              <Heading2 size={18} aria-hidden="true" />
            </ToolButton>
            <ToolButton title="Negrito" onClick={() => wrapSelection("**")}>
              <Bold size={18} aria-hidden="true" />
            </ToolButton>
            <ToolButton title="Itálico" onClick={() => wrapSelection("*")}>
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

          <textarea
            ref={editorRef}
            className="editor"
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            spellCheck
          />

          <div className="ai-panel">
            <div className="ai-title">
              <BrainCircuit size={18} aria-hidden="true" />
              <span>Assistência de IA</span>
            </div>
            <select
              value={aiProvider}
              onChange={(event) => setAiProvider(event.target.value)}
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
            <label className="key-field">
              <KeyRound size={16} aria-hidden="true" />
              <input
                type="password"
                value={aiKey}
                onChange={(event) => setAiKey(event.target.value)}
                placeholder="Chave própria"
                disabled={aiProvider === "none"}
              />
            </label>
            <span className="ai-state">
              {aiProvider === "none"
                ? "desligada"
                : aiKey
                  ? "estrutura pronta"
                  : "aguardando chave"}
            </span>
          </div>
        </section>

        <aside className="validation-pane" aria-label="Validação">
          <div className="status-line" aria-live="polite">
            {status}
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
                <p className="issue error" key={issue.code}>
                  {issue.message}
                </p>
              ))
            ) : (
              <p className="empty-state">Nenhum erro essencial.</p>
            )}
          </div>

          <div className="issue-list">
            <h2>Alertas</h2>
            {warnings.length ? (
              warnings.map((issue) => (
                <p className="issue warning" key={issue.code}>
                  {issue.message}
                </p>
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
