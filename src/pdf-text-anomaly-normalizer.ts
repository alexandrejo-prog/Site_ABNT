export interface PdfTextAnomalyNormalizationContext {
  joinedAcrossLine?: boolean;
  joinedAcrossPage?: boolean;
}

// COVID-19-19 (ou cadeias repetidas de sufixo -19) colapsa para COVID-19.
// Independente de fronteira e seguro fora de identificadores protegidos, pois
// a correspondência é especifica da palavra COVID (nao toca URLs, leis, intervalos).
const COVID_HYPHEN_RE = /COVID-19(?:-19)+/gi;

// Compostos genuinamente hifenizados em portugues que a reconstrucao as vezes
// remonta sem hifen apos uma quebra de linha. Mantemos o hifen para estes.
const HYPHEN_KEEPING_COMPOUNDS = new Set([
  "quali-quantitativa",
  "quali-quantitativo",
  "quali-quantitativas",
  "quali-quantitativos",
  "servidor-pesquisador",
  "servidor-pesquisadora",
  "servidora-pesquisadora",
  "servidora-pesquisador",
]);

// Correcoes de palavras que chegaram fundidas apos quebra de linha, sem hifen.
// Aplicadas como rede de seguranca pos-reconstrucao; sao idempotentes.
const FUSED_COMPOUND_FIXES: ReadonlyArray<readonly [RegExp, string]> = [
  [/quali(?=quantitativa)/gi, "quali-"],
];

export function shouldKeepHyphenAtJoin(previousTokenWithHyphen: string, nextToken: string): boolean {
  const prefix = previousTokenWithHyphen.replace(/-$/, "");
  const firstNext = nextToken.split(/\s+/)[0] ?? nextToken;
  const candidate = `${prefix}-${firstNext}`.toLowerCase();
  return HYPHEN_KEEPING_COMPOUNDS.has(candidate);
}

export function normalizePdfTextAnomalies(
  text: string,
  _context?: PdfTextAnomalyNormalizationContext,
): string {
  if (!text) return text;
  let result = text.replace(COVID_HYPHEN_RE, "COVID-19");
  for (const [pattern, replacement] of FUSED_COMPOUND_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
