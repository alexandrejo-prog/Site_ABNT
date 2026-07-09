import { AcademicFields } from "../ufla-rules";
import {
  EDITABLE_DRAFT_NOTICE,
  FINAL_VERSION_PENDENCIES_TITLE,
  TOC_UPDATE_GUIDANCE,
  finalVersionPendencies,
  needsTocUpdateGuidance,
  projectLanguageWarning,
} from "../graduate-draft-guidance";
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
  const finalPendencies = finalVersionPendencies(fields);
  const projectLanguage = projectLanguageWarning(fields, editorText);
  const tocUpdateGuidance = needsTocUpdateGuidance(fields.workType);
  const draftNotice = finalPendencies.length > 0
    ? EDITABLE_DRAFT_NOTICE
    : "Este DOCX é um rascunho editável. Revise campos, referências, paginação e formatação no Word/LibreOffice antes da versão final.";

  return (
    <aside className="validation-pane" aria-label="Validação">
      <section className="validation-summary" aria-label="Resumo da validação">
        <p className="section-kicker">Etapa 3</p>
        <h2>Revisar antes de gerar</h2>
        <div className="status-line" aria-live="polite">{status}</div>
        <div className="validation-counters" aria-label="Contadores de revisão">
          <div className={errors.length ? "counter-card error" : "counter-card ok"}>
            <strong>{errors.length}</strong>
            <span>erro(s) que impedem geração</span>
          </div>
          <div className={warnings.length ? "counter-card warning" : "counter-card ok"}>
            <strong>{warnings.length}</strong>
            <span>alerta(s) para revisar</span>
          </div>
          <div className={finalPendencies.length ? "counter-card warning" : "counter-card ok"}>
            <strong>{finalPendencies.length}</strong>
            <span>pendência(s) de versão final</span>
          </div>
        </div>
      </section>

      <div className="post-generation-note">
        <strong>Após gerar o DOCX:</strong> {draftNotice} {tocUpdateGuidance ? TOC_UPDATE_GUIDANCE : "Abra no Word ou LibreOffice, confira paginação e exporte para PDF quando necessário."}
        <ul className="conformance-report">
          <li>Erros essenciais precisam ser corrigidos antes da geração.</li>
          <li>Alertas não impedem o rascunho, mas exigem revisão humana.</li>
          <li>Pendências de versão final permitem rascunho, mas impedem submissão final.</li>
        </ul>
      </div>

      {finalPendencies.length > 0 && (
        <div className="issue-list" aria-label={FINAL_VERSION_PENDENCIES_TITLE}>
          <h2>{FINAL_VERSION_PENDENCIES_TITLE}</h2>
          <div className="issue warning" role="status">
            <p className="issue-message">Este arquivo ainda não deve ser tratado como pronto para submissão.</p>
            <ul className="conformance-report">
              {finalPendencies.map((pendency) => (
                <li key={pendency}>{pendency}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {projectLanguage && (
        <div className="issue-list" aria-label="Alerta de linguagem de projeto">
          <h2>Alerta de linguagem</h2>
          <div className="issue warning" role="status">
            <p className="issue-message">{projectLanguage}</p>
            <p className="issue-detail"><strong>Ação:</strong> Revise o texto manualmente. O sistema não altera esse conteúdo automaticamente.</p>
          </div>
        </div>
      )}

      <label className="force-generate">
        <input type="checkbox" checked={generateAnyway} onChange={(event) => onToggleGenerateAnyway(event.target.checked)} />
        <span><strong>Gerar rascunho mesmo com pendências</strong><small>Use apenas para revisar no Word/LibreOffice. Não significa versão final.</small></span>
      </label>

      <TextDiagnosticPanel fields={fields} editorText={editorText} />

      <div className="issue-list" aria-label="Erros de validação">
        <h2>Erros essenciais</h2>
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
