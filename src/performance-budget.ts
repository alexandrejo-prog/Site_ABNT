export interface PerformanceBudget {
  id: string;
  label: string;
  thresholdMs: number;
  action: string;
}

export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  {
    id: "docx-import-small",
    label: "Importação DOCX até 2 MB",
    thresholdMs: 3000,
    action: "Se ultrapassar o limite, revisar extração OOXML e reduzir leituras repetidas.",
  },
  {
    id: "docx-import-large",
    label: "Importação DOCX grande",
    thresholdMs: 8000,
    action: "Se ultrapassar o limite, mover parsing pesado para Web Worker e exibir progresso.",
  },
  {
    id: "docx-export",
    label: "Exportação DOCX",
    thresholdMs: 5000,
    action: "Se ultrapassar o limite, carregar exportadores sob demanda e reduzir reconstrução de blocos.",
  },
];

export function exceededBudget(id: string, elapsedMs: number): boolean {
  const budget = PERFORMANCE_BUDGETS.find((item) => item.id === id);
  if (!budget) return false;
  return elapsedMs > budget.thresholdMs;
}

export function performanceAction(id: string): string | undefined {
  return PERFORMANCE_BUDGETS.find((item) => item.id === id)?.action;
}
