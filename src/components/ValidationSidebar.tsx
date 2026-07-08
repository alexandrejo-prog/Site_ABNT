import { AcademicFields } from "../ufla-rules";
import { TextDiagnosticPanel } from "../text-diagnostic-panel";
import { type ValidationIssue } from "../validators";

interface ValidationSidebarProps {
  status: string;
  generateAnyway: boolean;
  onToggleGenerateAnyway: (value: boolean) => void;
  fields: AcademicFields;
  editorText: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function ValidationSidebar({
  status,
  generateAnyway,
  onToggleGenerateAnyway,
  fields,
  editorText,
  errors,
  warnings,
}: ValidationSidebarProps) {
  return (
    <aside className="validation-pane" aria-label="Validação">
      <div className="status-line" aria-live="polite">{status}</div>
      <div className="post-generation-note">
        <strong>Após gerar o DOCX:</strong> o arquivo é um rascunho editável. Abra no Word ou LibreOffice, atualize campos dinâmicos e o sumário (tecle F9), confira paginação e exporte para PDF para submissão.
        <ul className="conformance-report">
          <li>Pontos que ainda exigem revisão manual</li>
          <li>Alertas de referências</li>
          <li>Alertas de metadados</li>
          <li>Alertas de coerência textual</li>
        </ul>
      </div>
      <label className="force-generate">
        <input type="checkbox" checked={generateAnyway} onChange={(event) => onToggleGenerateAnyway(event.target.checked)} />
        <span>Gerar rascunho mesmo com pendências</span>
      </label>
      <TextDiagnosticPanel fields={fields} editorText={editorText} />
      <div className="issue-list" aria-label="Erros de validação">
        <h2>Erros</h2>
        {errors.length ? errors.map((issue) => (
          <div className="issue error" key={issue.code} role="alert">
            <p className="issue-message">{issue.message}</p>
            {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
            {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
            {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
          </div>
        )) : <p className="empty-state" role="status">Nenhum erro essencial.</p>}
      </div>
      <div className="issue-list" aria-label="Alertas de validação">
        <h2>Alertas</h2>
        {warnings.length ? warnings.map((issue) => (
          <div className="issue warning" key={issue.code} role="status">
            <p className="issue-message">{issue.message}</p>
            {issue.what && <p className="issue-detail"><strong>O que é:</strong> {issue.what}</p>}
            {issue.why && <p className="issue-detail"><strong>Por que importa:</strong> {issue.why}</p>}
            {issue.action && <p className="issue-detail"><strong>Ação:</strong> {issue.action}</p>}
          </div>
        )) : <p className="empty-state" role="status">Nenhum alerta registrado.</p>}
      </div>
    </aside>
  );
}
