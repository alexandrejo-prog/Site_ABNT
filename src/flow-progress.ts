import type { WorkTypeValue } from "./ufla-rules";
import { isCpgWork } from "./ufla-rules";

export type FlowStepKey = "tipo" | "dados" | "texto" | "referencias" | "revisao";

export interface FlowStep {
  key: FlowStepKey;
  label: string;
  complete: boolean;
}

export interface FlowProgress {
  steps: FlowStep[];
  currentIndex: number;
  allComplete: boolean;
  hasBlockingError: boolean;
}

export interface FlowProgressInput {
  workType: WorkTypeValue;
  title: string;
  author: string;
  editorText: string;
  referencias: string;
  hasBlockingErrors: boolean;
}

export const FLOW_STEP_LABELS: Record<FlowStepKey, string> = {
  tipo: "Tipo de trabalho",
  dados: "Dados",
  texto: "Texto",
  referencias: "Referências",
  revisao: "Revisão",
};

const ORDER: FlowStepKey[] = ["tipo", "dados", "texto", "referencias", "revisao"];

export function computeFlowProgress(input: FlowProgressInput): FlowProgress {
  const empty = (value: string) => value.trim().length === 0;

  const steps: FlowStep[] = ORDER.map((key) => {
    let complete = false;
    switch (key) {
      case "tipo":
        complete = Boolean(input.workType);
        break;
      case "dados":
        complete = !empty(input.title) && !empty(input.author);
        break;
      case "texto":
        complete = !empty(input.editorText);
        break;
      case "referencias":
        complete = !empty(input.referencias) || isCpgWork(input.workType);
        break;
      case "revisao":
        complete = !input.hasBlockingErrors;
        break;
    }
    return { key, label: FLOW_STEP_LABELS[key], complete };
  });

  const currentIndex = steps.findIndex((step) => !step.complete);

  return {
    steps,
    currentIndex: currentIndex === -1 ? steps.length : currentIndex,
    allComplete: currentIndex === -1,
    hasBlockingError: input.hasBlockingErrors,
  };
}