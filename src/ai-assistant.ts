export type AiProvider = "none" | "groq" | "gemini" | "deepseek" | "openrouter";

export interface AiAssistantConfig {
  provider: AiProvider;
  apiKey?: string;
}

export interface AiSuggestionRequest {
  instruction: string;
  text: string;
  allowCitationChanges: false;
  allowReferenceChanges: false;
  allowImageChanges: false;
}

export interface AiSuggestionResult {
  status: "disabled" | "not-implemented";
  message: string;
  suggestedText?: string;
}

export const AI_PROVIDERS: Array<{ value: AiProvider; label: string }> = [
  { value: "none", label: "Sem IA" },
  { value: "groq", label: "Groq com chave própria" },
  { value: "gemini", label: "Gemini com chave própria" },
  { value: "deepseek", label: "DeepSeek com chave própria" },
  { value: "openrouter", label: "OpenRouter com chave própria" },
];

export async function requestAiSuggestion(
  config: AiAssistantConfig,
  _request: AiSuggestionRequest,
): Promise<AiSuggestionResult> {
  if (config.provider === "none") {
    return {
      status: "disabled",
      message: "A IA está desligada.",
    };
  }

  if (!config.apiKey?.trim()) {
    return {
      status: "not-implemented",
      message: "Informe uma chave própria para uso futuro da IA.",
    };
  }

  return {
    status: "not-implemented",
    message:
      "Estrutura segura criada. Esta primeira versão não chama APIs externas.",
  };
}
