import type { FlowProgress } from "../flow-progress";

interface FlowProgressProps {
  progress: FlowProgress;
}

export function FlowProgress({ progress }: FlowProgressProps) {
  return (
    <nav className="flow-progress" aria-label="Progresso do fluxo">
      <ol className="flow-progress-list">
        {progress.steps.map((step, index) => {
          const stateClass = step.complete
            ? "is-complete"
            : index === progress.currentIndex
              ? "is-current"
              : "is-pending";
          return (
            <li key={step.key} className={`flow-step ${stateClass}`}>
              <span className="flow-step-marker" aria-hidden="true" />
              <span className="flow-step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <span className="flow-progress-status" role="status" aria-live="polite">
        {progress.allComplete
          ? "Fluxo completo: pronto para revisar e gerar."
          : progress.hasBlockingError
            ? "Fluxo parcial: há erros a corrigir."
            : `Fluxo: termine a etapa "${progress.steps[progress.currentIndex]?.label ?? ""}".`}
      </span>
    </nav>
  );
}