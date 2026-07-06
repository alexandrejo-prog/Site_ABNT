import { AcademicFields } from "./ufla-rules";
import { buildTextDiagnostic } from "./text-diagnostics";

interface Props {
  fields: AcademicFields;
  editorText?: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`diag-dot ${ok ? "ok" : "missing"}`} aria-hidden="true">{ok ? "✓" : "○"}</span>;
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="diag-row">
      <StatusDot ok={ok} />
      <span>{label}</span>
    </li>
  );
}

export function TextDiagnosticPanel({ fields, editorText = "" }: Props) {
  const diag = buildTextDiagnostic(fields, editorText);
  return (
    <div className="diagnostic-panel">
      <h2>Diagnóstico textual</h2>
      <p className="diagnostic-disclaimer">Análise heurística e preliminar. Não atesta conformidade final; exige revisão humana no DOCX.</p>
      <ul className="diagnostic-list">
        {diag.resumoMissing
          ? <li className="diag-row"><StatusDot ok={false} /><span>Resumo ainda não preenchido</span></li>
          : <Row ok={diag.resumoApproved} label="Resumo com objetivo, método e conclusão" />}
        {diag.abstractMissing
          ? <li className="diag-row"><StatusDot ok={false} /><span>Abstract ainda não preenchido</span></li>
          : <Row ok={diag.abstractApproved} label="Abstract coerente com o resumo (PT↔EN)" />}
        <Row ok={diag.titleResumeConsistent} label="Consistência Título ↔ Resumo" />
        <Row ok={diag.resumeAbstractConsistent} label="Consistência Resumo ↔ Abstract" />
        <Row ok={diag.hasObjective} label="Presença de objetivo" />
        <Row ok={diag.hasMethod} label="Presença de método" />
        <Row ok={diag.hasResultConclusion} label="Presença de resultado/conclusão" />
        <Row ok={diag.hasKeywords} label="Presença de palavras-chave (3 a 5)" />
        {diag.genericWarnings > 0
          ? <li className="diag-row diag-warning"><StatusDot ok={false} /><span>{diag.genericWarnings} trecho(s) com padrão de texto genérico/automático</span></li>
          : <Row ok={true} label="Sem padrão de texto genérico detectado" />}
      </ul>
    </div>
  );
}
