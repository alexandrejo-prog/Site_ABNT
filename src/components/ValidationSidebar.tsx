import { AcademicFields } from "../ufla-rules";
import { TextDiagnosticPanel } from "../text-diagnostic-panel";
import { type ValidationIssue } from "../validators";
import { type FinalVersionPendingReport } from "../final-version-pending";
import { type OutputTypeResult } from "../output-type";

interface ValidationSidebarProps {
  status: string;
  outputType?: OutputTypeResult;
  generateAnyway: boolean;
  onToggleGenerateAnyway: (value: boolean) => void;
  onNavigateToField: (fieldKey: string) => void;
  fields: AcademicFields;
  editorText: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  finalPending?: FinalVersionPendingReport;
}

function IssueAction({ fieldKey, label, onNavigateToField }: { fieldKey: string | undefined; label: string; onNavigateToField: (k: string) => void }) {
  if (!fieldKey) return null;
  return (
    <button type="button" className="issue-navigate" onClick={() => onNavigateToField(fieldKey)}>
      {label}
    </button>
  );
}

export function ValidationSidebar({
  status,
  outputType,
  generateAnyway,
  onToggleGenerateAnyway,
  onNavigateToField,
  fields,
  editorText,
  errors,
  warnings,
  finalPending,
}: ValidationSidebarProps) {
  const showFinalPending =
    !!finalPending && finalPending.hasPendingItems && (fields.workType === "dissertacao" || fields.workType === "tese");

  return (
    <aside className="validation-pane" aria-label="Validação">
      <div className="status-line" role="status" aria-live="polite">{status}</div>
      {outputType && (
        <div className={`output-badge output-badge-${outputType.badge}`} role="status">
          <strong>{outputType.label}</strong>
          <span>{outputType.detail}</span>
        </div>
      )}
      <details className="quick-guide">
        <summary>Guia rápido de uso</summary>
        <ol>
          <li>Escolha o <strong>Tipo de trabalho</strong> e preencha os campos de dados.</li>
          <li>Escreva ou importe o texto no <strong>editor central</strong> e as referências em <strong>Referências</strong>.</li>
          <li>Clique em <strong>Validar trabalho</strong> e corrija os erros marcados com <em>Corrigir</em>.</li>
          <li>Visualize o resultado e clique em <strong>Gerar DOCX editável</strong>.</li>
          <li>No Word/LibreOffice: selecione tudo e pressione <strong>F9</strong> (Word) ou <strong>Atualizar tudo</strong> (LibreOffice) para preencher o sumário; confira paginação e exporte o PDF.</li>
        </ol>
      </details>
      <div className="post-generation-note">
        <strong>Após gerar o DOCX:</strong> o arquivo é um rascunho editável. Erros essenciais impedem a geração. Alertas não impedem. Pendências de versão final permitem rascunho, mas impedem submissão final. Abra no Word ou LibreOffice, atualize campos dinâmicos e o sumário (tecle F9), confira paginação e exporte para PDF para submissão.
        <ul className="conformance-report">
          <li>Pontos que ainda exigem revisão manual</li>
          <li>Alertas de referências</li>
          <li>Alertas de metadados</li>
          <li>Alertas de coerência textual</li>
        </ul>
      </div>
      {showFinalPending && (
        <div className="issue-list" role="region" aria-label="Pendencias de versao final">
          <h2>Pendencias de versao final</h2>
          <p className="field-note">Este DOCX e um rascunho editavel. Antes da versao final, substitua orientador, banca, ficha catalografica provisoria e atualize o sumario no Word/LibreOffice.</p>
          <ul>
            {finalPending.items.map((item, index) => (
              <li key={index}><strong>{item.label}:</strong> {item.description}{" "}<IssueAction fieldKey={item.fieldKey} label="Ir para o campo" onNavigateToField={onNavigateToField} /></li>
            ))}
          </ul>
        </div>
      )}
      <label className="force-generate">
        <input type="checkbox" checked={generateAnyway} onChange={(event) => onToggleGenerateAnyway(event.target.checked)} />
        <span>Gerar rascunho mesmo com pendências</span>
      </label>
      <TextDiagnosticPanel fields={fields} editorText={editorText} />
      <div className="issue-list" role="region" aria-label="Erros de validação">
        <h2>Erros</h2>
        {errors.length ? errors.map((issue) => (
          <div className="issue error" key={issue.code} role="alert">
            <p className="issue-message">{issue.message}</p>
            {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
            {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
            {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
            <IssueAction fieldKey={issue.fieldKey} label="Corrigir" onNavigateToField={onNavigateToField} />
          </div>
        )) : <p className="empty-state" role="status">Nenhum erro essencial.</p>}
      </div>
      <div className="issue-list" role="region" aria-label="Alertas de validação">
        <h2>Alertas</h2>
        {warnings.length ? warnings.map((issue) => (
          <div className="issue warning" key={issue.code} role="status">
            <p className="issue-message">{issue.message}</p>
            {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
            {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
            {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
            <IssueAction fieldKey={issue.fieldKey} label="Corrigir" onNavigateToField={onNavigateToField} />
          </div>
        )) : <p className="empty-state" role="status">Nenhum alerta registrado.</p>}
      </div>
    </aside>
  );
}
