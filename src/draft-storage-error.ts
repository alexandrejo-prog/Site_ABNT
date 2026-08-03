export type DraftStorageErrorKind = "none" | "quota-exceeded" | "unavailable" | "unknown";

export interface DraftStorageErrorInfo {
  kind: DraftStorageErrorKind;
  message: string;
}

function errorName(error: unknown): string | undefined {
  if (error instanceof DOMException) return error.name;
  return (error as { name?: unknown } | null)?.name as string | undefined;
}

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? "").toLowerCase();
}

export function classifyStorageError(error: unknown): DraftStorageErrorKind {
  if (!error) return "unknown";

  const name = errorName(error) ?? "";
  const message = errorMessage(error);

  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return "quota-exceeded";
  if (message.includes("quota") || message.includes("exceeded") || message.includes("storage full")) return "quota-exceeded";

  if (name === "SecurityError" || name === "InvalidStateError") return "unavailable";
  if (message.includes("denied") || message.includes("unavailable") || message.includes("not available")) return "unavailable";

  return "unknown";
}

export function friendlyStorageError(kind: DraftStorageErrorKind): string {
  switch (kind) {
    case "quota-exceeded":
      return "Rascunho não salvo: o armazenamento local deste navegador está cheio. Libere espaço para que o salvamento automático volte a funcionar.";
    case "unavailable":
      return "Rascunho não salvo: o armazenamento local está indisponível neste navegador. Seu trabalho está seguro apenas nesta sessão.";
    case "unknown":
      return "Não foi possível salvar o rascunho automaticamente. Continue editando; o salvamento será reutilizado ao digitar.";
    case "none":
    default:
      return "Rascunho salvo neste navegador.";
  }
}