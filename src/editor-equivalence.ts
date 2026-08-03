import { editorHtmlToMarkup, editorMarkupToHtml } from "./editor-markup";
import { tiptapHtmlToEditorMarkup } from "./tiptap-markup";

export interface RoundTripResult {
  input: string;
  legacy: string;
  tiptap: string;
  legacyMatchesSource: boolean;
  tiptapMatchesSource: boolean;
  enginesEquivalent: boolean;
}

/** Casos essenciais do markup já cobertos por testes dos exportadores. */
export function coreEquivalenceCases(): string[] {
  return [
    "Paragrafo simples e direto.",
    "# Titulo de primeiro nivel",
    "## Subtitulo",
    "### Sub-subtitulo",
    "> Citacao longa com leitura.",
    "**Negrito** e *italico* combinados.",
    "[REF] EMBRAPA. Manual de normalizacao. Lavras, 2020.",
    "Paragrafo com citacao et al. no corpo.",
    "Texto com numero 1.25 e pontos.",
  ];
}

/** Round-trip do motor legado (via DOM contenteditable) -> markup. */
export function legacyRoundTrip(markup: string, host?: HTMLElement): string {
  if (typeof document === "undefined") return "";
  const element = host ?? document.createElement("div");
  element.innerHTML = editorMarkupToHtml(markup);
  return editorHtmlToMarkup(element);
}

/** Round-trip do motor Tiptap (parse de HTML) -> markup. */
export function tiptapRoundTrip(markup: string): string {
  return tiptapHtmlToEditorMarkup(editorMarkupToHtml(markup));
}

/** Compara os dois motores caso a caso e aponta divergências. */
export function buildRoundTripReport(cases: string[], host?: HTMLElement): RoundTripResult[] {
  return cases.map((input) => {
    const legacy = legacyRoundTrip(input, host);
    const tiptap = tiptapRoundTrip(input);
    return {
      input,
      legacy,
      tiptap,
      legacyMatchesSource: legacy === input,
      tiptapMatchesSource: tiptap === input,
      enginesEquivalent: legacy === tiptap,
    };
  });
}

/**
 * Divergências documentadas e aceitas entre o markup de origem e o round-trip
 * (comportamento idêntico nos dois motores — não são diferenças entre engines).
 * - `et al.` é auto-envolvido em `*et al.*` (itálico) na saída, como requer a
 *   NBR? Resolvido: o markup canônico passa a normalizar `et al.` explícito em
 *   itálico; neste módulo apenas anotamos o comportamento para rastreabilidade.
 */
export const DOCUMENTED_MARKUP_TRANSFORMATIONS = [
  "et al. -> *et al.* (itálico automático aplicado por 'resolveEtAl' nos dois motores)",
  "linhas em branco são compactadas (ambos os motores removem blocos vazios)",
] as const;