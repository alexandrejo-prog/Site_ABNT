export interface AccessibilityCheck {
  id: string;
  label: string;
  method: "automatico" | "manual";
  status: "coberto" | "parcial" | "pendente";
}

export const ACCESSIBILITY_CHECKLIST: AccessibilityCheck[] = [
  { id: "regions", label: "Regioes principais com nomes acessiveis", method: "automatico", status: "coberto" },
  { id: "live-status", label: "Status e erros anunciaveis", method: "automatico", status: "coberto" },
  { id: "keyboard-focus", label: "Foco visivel em botoes, campos e editor", method: "automatico", status: "coberto" },
  { id: "keyboard-flow", label: "Fluxo completo por teclado", method: "manual", status: "parcial" },
  { id: "contrast", label: "Contraste visual em estados normais, erro e alerta", method: "manual", status: "parcial" },
  { id: "automated-audit", label: "Auditoria automatizada de acessibilidade", method: "automatico", status: "pendente" },
];

export function pendingAccessibilityChecks(): AccessibilityCheck[] {
  return ACCESSIBILITY_CHECKLIST.filter((check) => check.status !== "coberto");
}
