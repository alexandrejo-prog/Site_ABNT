export interface PdfTextAnomalyContext {
  previousFragment?: string;
  nextFragment?: string;
  joinedAcrossLine?: boolean;
  joinedAcrossPage?: boolean;
  hyphenationDecision?: "joined-without-hyphen" | "preserved-hyphen" | "uncertain" | string;
}

export interface PdfTextAnomalyResult {
  text: string;
  changed: boolean;
  reasons: string[];
}

// Reconhece prefixos morfologicos compostos portugueses/espanhois comuns.
// Usado apenas para reconstruir hifens morfologicos (nunca para segmentar palavras).
const MORPHOLOGICAL_PREFIX_RE = /^(?:quali|qual|multi|inter|intra|semi|super|anti|p[óo]s|pr[ée]|ex|n[ãa]o|rec[ée]m|vice|t[ée]cnico|pol[íi]tico|hist[óo]rico|pr[óo]|contra|supra|ultra|sub|auto|bio|geo|hidro|micro|macro|neuro|psico|socio|eco|agro|pr[ée]texto|infra|paleo|arqui|retro)$/iu;

// Identificadores que devem ser preservados exatamente (URL, DOI, ISBN, e-mail, dominio).
// Nenhuma correcao agressiva e aplicada sobre eles.
const IDENTIFIER_RE = /(https?:\/\/|doi|www\.|isbn|urn:|10\.\d{4,}|@[a-z0-9]|[-a-z0-9]+\.(?:com|br|org|edu|gov)|\bet al\b|\((?:19|20)\d{2}\))/iu;

export function normalizePdfTextAnomalies(
  text: string,
  context: PdfTextAnomalyContext = {},
): PdfTextAnomalyResult {
  const reasons: string[] = [];
  let current = text;
  const original = text;

  if (IDENTIFIER_RE.test(current)) {
    return { text: current, changed: false, reasons };
  }

  // Regra 1 — sufixo numerico repetido apos palavra: COVID-19-19 -> COVID-19.
  // Exige palavra alfabetica precedendo o separador e repeticao exata do ultimo segmento.
  const repeatedSuffixRe = /([A-Za-zÀ-ÿ]{2,})-(\d{1,4})-(\2)(?![-\d])/g;
  current = current.replace(repeatedSuffixRe, (match, word: string, num: string) => {
    reasons.push(`Sufixo numerico repetido "${match}" reduzido para "${word}-${num}".`);
    return `${word}-${num}`;
  });

  // Regras 2 e 3 atuam apenas na recomposicao entre linhas (contexto de quebra).
  // Entre paginas, o comportamento e conservador: nao se corrige automaticamente.
  const prev = context.previousFragment;
  const nxt = context.nextFragment;
  if (context.joinedAcrossLine && prev != null && nxt != null) {
    const prevEndsHyphen = /-$/.test(prev);
    if (prevEndsHyphen) {
      // Regra 2 — reconstrói hifen morfologico quando o fragmento anterior terminava com '-'
      // e o nucleo e um prefixo reconhecido, continuado em minuscula.
      const core = prev.slice(0, -1);
      if (
        MORPHOLOGICAL_PREFIX_RE.test(core)
        && /^[a-záàâãéêíóôõúüç]/u.test(nxt)
        && current.endsWith(`${core}${nxt}`)
      ) {
        const boundary = `${core}${nxt}`;
        current = current.slice(0, current.length - boundary.length) + `${core}-${nxt}`;
        reasons.push(`Hifen morfologico reconstruido entre "${prev}" e "${nxt}".`);
      }
    } else {
      // Regra 3 — reinsire espaco quando dois fragmentos distintos foram fundidos sem separador.
      // Nao atua sobre inicio de nome proprio, sigla ou numero (preservacao).
      const startsProperOrNumber = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\d]/.test(nxt);
      const prevStartsUpper = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(prev);
      const boundary = `${prev}${nxt}`;
      if (!startsProperOrNumber && !prevStartsUpper && current.endsWith(boundary)) {
        current = current.slice(0, current.length - boundary.length) + `${prev} ${nxt}`;
        reasons.push(`Espaco reinserido entre fragmentos unidos "${prev}" e "${nxt}".`);
      }
    }
  }

  const changed = current !== original;
  return { text: current, changed, reasons };
}
