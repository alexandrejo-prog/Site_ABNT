export interface PdfTextAnomalyNormalizationContext {
  joinedAcrossLine?: boolean;
  joinedAcrossPage?: boolean;
}

// Compostos genuinamente hifenizados em portugues que a reconstrucao as vezes
// remonta sem hifen apos uma quebra de linha. Mantemos o hifen para estes,
// somente quando appendLineText comprova a fronteira (linha anterior termina em
// "quali-"/"servidor-" e a seguinte comeca com o fragmento), nunca por adivinhacao.
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

// Cadeias repetidas de sufixo (ex.: COVID-19-19) sao preservadas fielmente
// e NAO corrigidas. Em vez de alterar o texto, registramos um alerta para
// revisao humana, pois a duplicacao esta presente no documento original (PDF).
const COVID_DUPLICATION_RE = /COVID-19(?:-19)+/gi;

// Palavras que podem chegar fundidas (sem hifen) apos quebra de linha.
// Preservamos intactas e emitimos aviso de revisao, sem corrigir por adivinhacao.
const FUSED_COMPOUND_RE = /\b(qualiquantitativa|servidorpesquisador)\b/gi;

export function shouldKeepHyphenAtJoin(previousTokenWithHyphen: string, nextToken: string): boolean {
  const prefix = previousTokenWithHyphen.replace(/-$/, "").replace(/[^\p{L}\p{N}-]+$/u, "");
  const firstNext = (nextToken.split(/\s+/)[0] ?? nextToken).replace(/[^\p{L}\p{N}-]+$/u, "");
  const candidate = `${prefix}-${firstNext}`.toLowerCase();
  return HYPHEN_KEEPING_COMPOUNDS.has(candidate);
}

export function detectPdfTextAnomalyAlerts(text: string): string[] {
  const alerts: string[] = [];
  const covidMatches = text.match(COVID_DUPLICATION_RE);
  if (covidMatches) {
    for (const raw of new Set(covidMatches.map((match) => match))) {
      alerts.push(`Poss├¡vel duplica├º├úo textual presente no documento original: ${raw}.`);
    }
  }
  const fusedMatches = text.match(FUSED_COMPOUND_RE);
  if (fusedMatches) {
    for (const raw of new Set(fusedMatches.map((match) => match))) {
      alerts.push(`Poss├¡vel fus├úo lexical preservada (revis├úo humana): ${raw}.`);
    }
  }
  return alerts;
}

export function normalizePdfTextAnomalies(
  text: string,
  _context?: PdfTextAnomalyNormalizationContext,
): string {
  // O rascunho deve preservar fielmente o conteudo do PDF. Nenhuma
  // correcao lexical automatica (COVID-19-19, quali-quantitativa, etc.)
  // e aplicada aqui; apenas alertas sao emitidos por detectPdfTextAnomalyAlerts.
  return text;
}
