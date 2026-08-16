import type { FlowProgress as FlowProgressData } from "../flow-progress";

interface FlowProgressProps {
  progress: FlowProgressData;
  compact?: boolean;
}

function flowStatusText(progress: FlowProgressData): string {
  if (progress.allComplete) return "Pronto para revisar e gerar";
  if (progress.hasBlockingError) return "Corrija os itens em destaque";
  return `Próximo: ${progress.steps[progress.currentIndex]?.label ?? ""}`;
}

export function FlowProgress({ progress, compact = false }: FlowProgressProps) {
  if (compact) {
    return (
      <nav className="flow-progress flow-progress--compact" aria-label="Progresso do fluxo">
        <ol className="flow-progress-list">
          {progress.steps.map((step, index) => {
            const stateClass = step.complete
              ? "is-complete"
              : index === progress.currentIndex
                ? "is-current"
                : "is-pending";
            return (
              <li key={step.key} className={`flow-step ${stateClass}`} title={step.label}>
                <span className="flow-step-marker" aria-hidden="true" />
                <span className="flow-step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
        <span className="flow-progress-status" role="status" aria-live="polite">
          {flowStatusText(progress)}
        </span>
      </nav>
    );
  }

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
        {flowStatusText(progress)}
      </span>
    </nav>
  );
}
