export type CatalogCardRequirement = "required" | "recommended" | "not_applicable";

export interface CatalogCardStatus {
  requirement: CatalogCardRequirement;
  hasContent: boolean;
  blocking: boolean;
  message: string;
}

export function catalogCardRequirement(workType: string): CatalogCardRequirement {
  if (workType === "monografia" || workType === "dissertacao" || workType === "tese") return "required";
  return "not_applicable";
}

export function hasCatalogCardContent(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (normalized.includes("INSERIR AQUI A FICHA CATALOGRAFICA")) return false;
  if (normalized.includes("NAO SUBSTITUA POR TEXTO MANUAL")) return false;
  return normalized.length >= 40;
}

export function catalogCardStatus(workType: string, content: string): CatalogCardStatus {
  const requirement = catalogCardRequirement(workType);
  const hasContent = hasCatalogCardContent(content);
  const blocking = requirement === "required" && !hasContent;

  if (blocking) {
    return {
      requirement,
      hasContent,
      blocking,
      message: "Ficha catalografica obrigatoria ausente. Insira a ficha oficial da Biblioteca antes da versao final.",
    };
  }

  return {
    requirement,
    hasContent,
    blocking: false,
    message: hasContent ? "Ficha catalografica informada." : "Ficha catalografica nao aplicavel.",
  };
}
