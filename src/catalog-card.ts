export type CatalogCardRequirement = "required" | "recommended" | "not_applicable";

export interface CatalogCardStatus {
  requirement: CatalogCardRequirement;
  hasContent: boolean;
  cutterDetected: boolean;
  blocking: boolean;
  message: string;
}

/**
 * Número de Cutter-Sanborn: letra inicial do sobrenome + 1 a 4 dígitos da
 * tabela Cutter + (opcional) letra minúscula do início do título. Toda ficha
 * catalográfica oficial da Biblioteca Universitária da UFLA traz esse código
 * (ex.: "S586f"). A validação aceita também o prefixo "CDU" (Classificação
 * Decimal Universal) com número de classificação.
 */
const CUTTER_NUMBER_RE = /\b[A-Z]\d{1,4}[a-z]?\b/i;
const CDU_NUMBER_RE = /\b(?:CDU\s*)?\d{2,3}(?:\.\d+){1,3}\b/i;

export function hasCutterNumber(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return CUTTER_NUMBER_RE.test(normalized) || CDU_NUMBER_RE.test(normalized);
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
  const cutterDetected = hasContent && hasCutterNumber(content);
  const blocking = requirement === "required" && !hasContent;

  if (blocking) {
    return {
      requirement,
      hasContent,
      cutterDetected,
      blocking,
      message: "Ficha catalografica obrigatoria ausente. Insira a ficha oficial da Biblioteca antes da versao final.",
    };
  }

  if (hasContent && !cutterDetected) {
    return {
      requirement,
      hasContent,
      cutterDetected,
      blocking: false,
      message: "Conteudo presente, mas sem numero de Cutter (ex.: S586f) ou classificacao CDU detectavel. Confira se a ficha oficial da Biblioteca foi colada integralmente.",
    };
  }

  return {
    requirement,
    hasContent,
    cutterDetected,
    blocking: false,
    message: hasContent ? "Ficha catalografica informada com numero de Cutter detectado." : "Ficha catalografica nao aplicavel.",
  };
}
