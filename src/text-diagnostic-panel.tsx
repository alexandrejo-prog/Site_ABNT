import { AcademicFields } from "./ufla-rules";
import { buildTextDiagnostic } from "./text-diagnostics";

interface Props {
  fields: AcademicFields;
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

export function TextDiagnosticPanel({ fields }: Props) {
  const diag = buildTextDiagnostic(fields);
  return (
    <div className="diagnostic-panel">
      <h2>Diagnóstico textual</h2>
      <p className="diagnostic-disclaimer">Heurísticas locais de apoio. Não substituem a revisão humana.</p>
      <ul className="diagnostic-list">
        <Row ok={diag.titleResumeConsistent} label="Consistência Título ↔ Resumo" />
        <Row ok={diag.resumeAbstractConsistent} label="Consistência Resumo ↔ Abstract" />
        <Row ok={diag.hasObjective} label="Presença de objetivo" />
        <Row ok={diag.hasMethod} label="Presença de método" />
        <Row ok={diag.hasResultConclusion} label="Presença de resultado/conclusão" />
        <Row ok={diag.hasKeywords} label="Presença de palavras-chave (3 a 5)" />
      </ul>
    </div>
  );
}
