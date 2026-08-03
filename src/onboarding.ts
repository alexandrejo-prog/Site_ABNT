const ONBOARDING_KEY = "site-abnt:onboarding:first-use-v1";

export interface FirstUseGuideStep {
  title: string;
  description: string;
}

export const FIRST_USE_STEPS: FirstUseGuideStep[] = [
  { title: "Escolha o tipo", description: "Selecione monografia, dissertação, tese, projeto, artigo ou CPG. Isso define capa, folha de rosto, sumário e regras do DOCX." },
  { title: "Preencha e edite", description: "Informe os campos de dados, edite o texto no editor e as referências em Referências. Use 'Carregar exemplo' para ver um modelo pronto." },
  { title: "Valide, visualize e gere", description: "Clique em Validar trabalho, corrija os erros ('Corrigir'), visualize o resultado e gere o DOCX editável. Atualize o sumário no Word/LibreOffice (F9)." },
];

export function isOnboardingDismissed(storage: Storage): boolean {
  try {
    return storage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding(storage: Storage): void {
  try {
    storage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // armazenamento indisponível; o painel continua sendo exibido nesta sessão
  }
}