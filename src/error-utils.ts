const GENERATION_ERROR_PREFIX = "[Site_ABNT]";

function describeError(err: unknown): string | null {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return null;
}

function messageSuggestsRepair(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("unable to read") || normalized.includes("corrupt") ||
    normalized.includes("the file cannot be opened") || normalized.includes("zip") ||
    normalized.includes("invalid") || normalized.includes("malformed");
}

/**
 * Converte uma exceção lançada durante a geração do DOCX em uma mensagem
 * amigável para o usuário. Nunca lança e sempre retorna uma string não vazia.
 */
export function friendlyGenerationError(err: unknown): string {
  const raw = describeError(err);
  if (!raw) return "Falha ao gerar o DOCX. Tente novamente; se o problema persistir, revise os campos e o texto do editor.";
  if (messageSuggestsRepair(raw)) {
    return `Não foi possível montar o arquivo DOCX: ${raw} Este erro costuma indicar conteúdo que o Word não consegue abrir. Revise tabelas, imagens e formatação importados e tente novamente.`;
  }
  return `Falha ao gerar o DOCX: ${raw}`;
}

/**
 * Registra um erro técnico de forma estruturada e estável para depuração,
 * mantendo a mensagem interna separada da mensagem exibida ao usuário.
 */
export function reportTechnicalError(context: string, err: unknown): void {
  const detail = describeError(err);
  // Firefox e trackers de erro estruturado podem interceptar aqui.
  console.error(`${GENERATION_ERROR_PREFIX} ${context}:`, detail ?? err);
}