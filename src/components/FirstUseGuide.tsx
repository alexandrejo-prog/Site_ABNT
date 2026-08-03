import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { dismissOnboarding, FIRST_USE_STEPS } from "../onboarding";

interface FirstUseGuideProps {
  visible: boolean;
  onDismiss: () => void;
}

export function FirstUseGuide({ visible, onDismiss }: FirstUseGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const handleDismiss = useCallback(() => {
    dismissOnboarding(window.localStorage);
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <section className="first-use-guide" role="region" aria-label="Primeiros passos">
      <div className="first-use-guide-header">
        <h2>Comece por aqui</h2>
        <button className="first-use-guide-close" type="button" onClick={handleDismiss} aria-label="Fechar guia de primeiros passos"><X size={18} aria-hidden="true" /></button>
      </div>
      <ol className="first-use-guide-steps">
        {FIRST_USE_STEPS.map((s, index) => (
          <li key={s.title} className={index === stepIndex ? "is-active" : ""}>
            <span className="first-use-guide-number" aria-hidden="true">{index + 1}</span>
            <span><strong>{s.title}</strong> — {s.description}</span>
          </li>
        ))}
      </ol>
      <div className="first-use-guide-actions">
        <button className="secondary-action" type="button" onClick={() => setStepIndex((i) => (i + 1) % FIRST_USE_STEPS.length)}>Próximo passo</button>
        <button className="primary-action" type="button" onClick={handleDismiss}>Entendi, começar</button>
      </div>
    </section>
  );
}