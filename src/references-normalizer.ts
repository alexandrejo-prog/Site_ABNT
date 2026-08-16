import { UFLA_MANUAL_REFERENCE } from "./ufla-rules";
import { cleanMojibakeText } from "./docx-render-core";

export type ReferenceConfidence = "alta" | "media" | "baixa";

export interface ReferenceRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export interface NormalizedReference {
  original: string;
  text: string;
  runs: ReferenceRun[];
  confidence: ReferenceConfidence;
  warnings: string[];
  detectedHighlight?: string;
  detectedType:
    | "artigo"
    | "livro"
    | "capitulo"
    | "evento"
    | "tese-dissertacao"
    | "documento-institucional"
    | "legislacao"
    | "site"
    | "online"
    | "patente"
    | "jornal"
    | "periodico"
    | "correspondencia"
    | "audiovisual"
    | "sonoro"
    | "partitura"
    | "iconografico"
    | "cartografico"
    | "tridimensional"
    | "dados-pesquisa"
    | "desconhecido";
}

function clean(value: string): string {
  return cleanMojibakeText(value).replace(/\s+/g, " ").trim();
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function stripTrailingUrlPunctuation(value: string): string {
  return value.replace(/[.,;:]+$/u, "").trim();
}

function hasAccessPrefix(value: string): boolean {
  return /\bdispon[ií]vel\s+em\s*:/iu.test(value);
}

function normalizeDoi(value: string): string {
  return value.replace(/\bDOI\s*:\s*(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s<>\]]+)/giu, (_match, rawDoi: string) => {
    const doi = stripTrailingUrlPunctuation(rawDoi);
    return `DOI: ${doi}`;
  });
}

function normalizeMarkdownLinks(value: string): string {
  return value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/giu, (_match, rawLabel: string, rawUrl: string) => {
    const label = clean(rawLabel);
    const url = stripTrailingUrlPunctuation(rawUrl);
    if (!label || /^https?:\/\//iu.test(label) || label === url) return `Disponível em: ${url}`;
    return `${label}. Disponível em: ${url}`;
  });
}

function normalizeBracketedUrls(value: string): string {
  return value.replace(/<\s*(https?:\/\/[^>\s]+)\s*>/giu, (_match, rawUrl: string) => stripTrailingUrlPunctuation(rawUrl));
}

function ensureDisponivelEmForRawUrl(value: string): string {
  if (hasAccessPrefix(value)) return value;
  return value.replace(/(^|[\s.])((?:https?:\/\/|www\.)[^\s<>\]]+)/iu, (_match, prefix: string, rawUrl: string) => {
    const url = stripTrailingUrlPunctuation(rawUrl);
    const suffix = rawUrl.slice(url.length);
    return `${prefix}Disponível em: ${url}${suffix}`;
  });
}

function normalizeAccessLabels(value: string): string {
  return value
    .replace(/\bDisponivel\s+em\s*:/giu, "Disponível em:")
    .replace(/\bAcesso\s+em\s*:/giu, "Acesso em:");
}

function normalizeAcademicSeparator(value: string): string {
  return value.replace(/(\b(?:Tese|Dissertaç[aã]o|Monografia|Trabalho de Conclus[aã]o de Curso)\s*\([^)]+\)\s*)-\s*/giu, "$1– ");
}

function normalizeReferenceLinks(value: string): string {
  return clean(
    normalizeAcademicSeparator(
      ensureDisponivelEmForRawUrl(
        normalizeAccessLabels(
          normalizeBracketedUrls(
            normalizeMarkdownLinks(
              normalizeDoi(value),
            ),
          ),
        ),
      ),
    ),
  );
}

function isReferenceTitleNoise(value: string): boolean {
  const text = fold(value).replace(/[#*:.\-–—]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const noiseTitles = [
    "referencias",
    "referencia",
    "bibliograficas",
    "bibliografia",
    "referencias bibliograficas",
    "referencia bibliografica",
    "bibliograficas referencias",
  ];
  return noiseTitles.includes(text);
}

function isYearLeadingFragment(value: string): boolean {
  return /^(?:19|20)\d{2}\.?\s+/u.test(value);
}

function fragmentYear(value: string): string | undefined {
  return value.match(/^((?:19|20)\d{2})\.?\s+/u)?.[1];
}

function isInstitutionalNormativePrefix(value: string): boolean {
  const text = fold(value);
  return /^(brasil|minas gerais|lavras)\.\s+/.test(text) && /\b(lei|decreto|portaria|resolucao|instrucao normativa)\b/u.test(text);
}

function mergeNormativeYearFragment(prefix: string, fragment: string): string {
  const year = fragmentYear(fragment);
  if (!year) return `${prefix} ${fragment}`;
  if (!new RegExp(`\\b${year}\\b`, "u").test(prefix)) return `${prefix} ${fragment}`;
  const withoutRepeatedYear = fragment.replace(/^(?:19|20)\d{2}\.?\s*/u, "").trim();
  return withoutRepeatedYear ? `${prefix} ${withoutRepeatedYear}` : prefix;
}

function isOrphanYearFragment(value: string): boolean {
  return isYearLeadingFragment(value) && value.length < 120 && !/\p{Lu}{2,}[,.;]/u.test(value);
}

// Uma linha parece inicio de uma nova referencia quando comeca com o padrao de
// autor pessoal (SOBRENOME, A.), autor institucional (lista curta conhecida) ou
// nome de evento. Tudo o que nao se encaixa e tratado como continuacao da
// referencia anterior.
function isReferenceStartLine(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (/^[\p{Lu}A-ZÀ-Ú][\p{L}.\-' ]{1,60},\s*[\p{Lu}A-ZÀ-Ú][\p{L}.\-' ]{0,60}\./u.test(l)) return true;
  if (/^[\p{Lu}A-ZÀ-Ú][\p{L}.\-' ]{1,60};\s/u.test(l)) return true;
  if (/^(?:BRASIL|MINAS\s+GERAIS|LAVRAS|UNIVERSIDADE|INSTITUTO|MINISTERIO|ASSOCIACAO|FUNDACAO|CONSELHO|CAMARA|SECRETARIA|EUROPEAN|REGISTRY)\b/iu.test(l)) return true;
  if (/^[A-ZÀ-Ú][\p{Lu}A-ZÀ-Ú -]{3,45},\s*\d+\.?\s*,\s*(?:19|20)\d{2}/u.test(l)) return true;
  if (isAllCapsInstitutional(l)) return true;
  // Linha inteiramente em caixa alta (titulo/referencia sem virgula de autor)
    if (/^[\p{Lu}A-ZÀ-Ú0-9][\p{Lu}A-ZÀ-Ú0-9 .()&'/:-]{2,}[\p{Lu}A-ZÀ-Ú0-9.]$/u.test(l) && !/[a-zà-ú]/.test(l) && /\s/u.test(l)) return true;
  return false;
}

// Autor institucional em caixa alta (ex.: "OPEN ACCESS INFRASTRUCTURE RESEARCH
// FOR EUROPE. Open..."): prefixo com 2+ palavras sem minusculas antes de ponto,
// dois-pontos, virgula ou abre parenteses.
function isAllCapsInstitutional(line: string): boolean {
  const match = line.trim().match(/^([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .()&'/-]*?)(?:[.:,]\s|\s\()/u);
  if (!match) return false;
  const prefix = match[1].trim();
  const words = prefix.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.filter((word) => /[a-z]/.test(word)).length === 0;
}

// Rótulos que iniciam uma nova cláusula da referência: a linha seguinte não é
// continuação de URL mesmo que o grupo anterior termine em URL.
const URL_CLAUSE_START = /^(?:acesso\s+em\s*:|dispon[ií]vel\s+em\s*:|in\s*:|apud\s+)/iu;

// Junta uma linha de continuacao ao grupo anterior, reconstruindo URLs quebradas
// (sem inserir espaco quando o grupo termina no meio de uma URL, inclusive com
// esquema quebrado http:/ https:/ ou www.).
function appendContinuationLine(group: string, line: string): string {
  const g = group.trimEnd();
  const l = line.trim();
  const endsInPartialUrl = /(?:https?:\/{1,2}[^\s]*|www\.[^\s]*)$/iu.test(g);
  if (endsInPartialUrl && !/[.,;)\]]$/u.test(g) && !URL_CLAUSE_START.test(l)) return g + l;
  return `${g} ${l}`;
}

function splitItems(value: string): string[] {
  const items = value
    .split(/\n+/)
    .map(clean)
    .filter(Boolean)
    .filter((item) => !isReferenceTitleNoise(item));

  const merged: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const next = items[index + 1];
    if (isYearLeadingFragment(item) && next && isInstitutionalNormativePrefix(next)) {
      merged.push(mergeNormativeYearFragment(next, item));
      index += 1;
      continue;
    }
    const previous = merged[merged.length - 1];
    if (
      previous &&
      isYearLeadingFragment(item) &&
      !/^[A-ZÀ-Ú]/.test(item)
    ) {
      merged[merged.length - 1] = mergeNormativeYearFragment(previous, item);
      continue;
    }
    // Um fragmento que inicia com ano só é "órfão" (descartado) quando não há
    // referência anterior para ser sua continuação. Com `previous`, ele é a
    // continuação de uma referência (ex.: tese/dissertação: "2007. (Doutorado...)")
    // e jamais deve ser truncado.
    if (!previous && isOrphanYearFragment(item)) continue;
    if (previous && !isReferenceStartLine(item)) {
      merged[merged.length - 1] = appendContinuationLine(previous, item);
      continue;
    }
    merged.push(item);
  }

  return merged;
}

function hasYear(value: string): boolean {
  return /\b(19|20)\d{2}\b/u.test(value);
}

function isInstitutional(value: string): boolean {
  return /^(universidade|instituto|ministerio|associacao|fundacao|conselho|ufla|abnt)\b/u.test(fold(value));
}

function isLegislation(value: string): boolean {
  const text = fold(value);
  return /^(brasil|minas gerais|lavras)\./u.test(text) || /\b(lei|decreto|portaria|resolucao|instrucao normativa|norma|nbr)\b/u.test(text);
}

function sentenceIndexes(value: string): number[] {
  const indexes: number[] = [];
  const pattern = /\.\s+/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) indexes.push(match.index);
  return indexes;
}

function splitAuthor(value: string): { author: string; remainder: string } | undefined {
  for (const index of sentenceIndexes(value)) {
    const author = value.slice(0, index).trim();
    let remainder = clean(value.slice(index + 1));
    if (!author.includes(",")) continue;
    if (/^et\s+al\./iu.test(remainder)) remainder = clean(remainder.replace(/^et\s+al\.\s*/iu, ""));
    if (remainder.length > 3) return { author, remainder };
  }
  return undefined;
}

function splitInstitutionalAuthor(value: string): { author: string; remainder: string } | undefined {
  const indexes = sentenceIndexes(value);
  if (!indexes.length) return undefined;
  const author = value.slice(0, indexes[0]).trim();
  const remainder = clean(value.slice(indexes[0] + 1));
  if (!isInstitutional(author) || remainder.length <= 3) return undefined;
  return { author, remainder };
}

function pubInfo(value: string): boolean {
  return /^[\p{Lu}][\p{L}\s.'-]*(?:,\s*\p{Lu}{2})?\s*:\s*.+,\s*(?:19|20)\d{2}/u.test(value);
}

function bookTitle(remainder: string): string | undefined {
  for (const index of sentenceIndexes(remainder)) {
    const title = remainder.slice(0, index).trim();
    const tail = clean(remainder.slice(index + 1));
    if (title.length > 3 && pubInfo(tail)) return title.replace(/\.$/u, "").trim();
  }
  return undefined;
}

function institutionalTitle(value: string): string | undefined {
  const parsed = splitInstitutionalAuthor(value);
  if (!parsed) return undefined;
  const title = bookTitle(parsed.remainder);
  if (title) return title;
  const firstSentence = sentenceIndexes(parsed.remainder)[0];
  if (firstSentence === undefined) return undefined;
  const candidate = parsed.remainder.slice(0, firstSentence).trim();
  return candidate.length > 3 ? candidate : undefined;
}

function articleJournal(remainder: string): string | undefined {
  for (const index of sentenceIndexes(remainder)) {
    const tail = clean(remainder.slice(index + 1));
    const comma = tail.indexOf(",");
    if (comma < 0) continue;
    const journal = tail.slice(0, comma).trim();
    if (journal.length > 3 && /,\s*(?:[^,]{2,},\s*)?(?:v|n|p)\.\s*/iu.test(tail)) return journal;
  }
  return undefined;
}

function chapterBookTitle(remainder: string): string | undefined {
  const match = remainder.match(/\bIn\s*:\s*/iu);
  if (!match || match.index === undefined) return undefined;
  const afterIn = clean(remainder.slice(match.index + match[0].length));
  const parsedIn = splitAuthor(afterIn);
  const fromParsed = parsedIn ? bookTitle(parsedIn.remainder) : undefined;
  return fromParsed ?? bookTitle(afterIn);
}

function academicTitle(remainder: string): string | undefined {
  const marker = fold(remainder).search(/\b(tese|dissertacao|monografia|trabalho de conclusao de curso)\s*\(/u);
  if (marker < 0) return undefined;
  return remainder.slice(0, marker).replace(/\.\s*\d+\s*p\.?\s*$/iu, "").replace(/\.\s*(?:19|20)\d{2}\s*$/u, "").replace(/\.$/u, "").trim();
}

function legislationTitle(value: string): string | undefined {
  return value.split(/\.\s+/u).map((part) => part.trim()).find((part) => /^(Lei|Decreto|Portaria|Resolu|Instru|Norma|NBR)/iu.test(part));
}

function parseManual(text: string): { runs: ReferenceRun[]; highlighted?: string; hasManual: boolean } {
  const runs: ReferenceRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  let cursor = 0;
  let highlighted: string | undefined;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index) });
    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    if (!highlighted && content.trim()) highlighted = content.trim();
    runs.push({ text: content, bold, italics: !bold });
    cursor = match.index + token.length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return { runs: mergeRuns(runs.flatMap(splitEtAl)), highlighted, hasManual: Boolean(highlighted) };
}

function splitEtAl(run: ReferenceRun): ReferenceRun[] {
  return run.text.split(/(et\s+al\.)/giu).filter(Boolean).map((part) => ({ text: part, bold: run.bold, italics: /et\s+al\./iu.test(part) ? true : run.italics }));
}

function mergeRuns(runs: ReferenceRun[]): ReferenceRun[] {
  const merged: ReferenceRun[] = [];
  for (const run of runs.filter((item) => item.text.length > 0)) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italics === run.italics) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

// Normaliza para a forma canônica (6. ed., 2025) qualquer referência do Manual de
// Normalização da UFLA que venha com ano anterior (ex.: 2024) ou sem a edição.
function normalizeUflaManualReference(text: string): NormalizedReference | null {
  const folded = fold(text);
  if (!folded.includes("manual de normalizacao e estrutura de trabalhos academicos")) return null;
  if (!/lavras/.test(folded) || !/ufla/.test(folded)) return null;

  const authorTail = "UNIVERSIDADE FEDERAL DE LAVRAS. ";
  const title = "Manual de normalização e estrutura de trabalhos acadêmicos: TCCs, monografias, dissertações e teses";
  const tail = ". 6. ed. rev., atual. e ampl. Lavras: UFLA, 2025.";
  const runs: ReferenceRun[] = [
    { text: authorTail },
    { text: title, bold: true },
    { text: tail },
  ];

  return {
    original: text,
    text: UFLA_MANUAL_REFERENCE,
    runs,
    confidence: "alta",
    warnings: [],
    detectedHighlight: title,
    detectedType: "livro",
  };
}

function eventReference(remainder: string): boolean {
  return /in:\s/iu.test(remainder) && /(anais|congresso|simposio|seminario|encontro|conferencia|reuniao)/iu.test(fold(remainder));
}
function eventHighlight(remainder: string): string | undefined {
  const m = remainder.match(/In:\s*([^.:,;]+)/iu);
  return m ? m[1].trim() : undefined;
}

// === Tipos adicionais do Manual UFLA §25.14 (modelos mínimos de referência) ===

function patentMatch(value: string): boolean {
  const text = fold(value);
  return /\bpatente\b/.test(text) || /\bbr\s*\d{2}\s*\d{4,}/.test(text);
}

function newspaperMatch(value: string): boolean {
  // Data de jornal: dia + mês por extenso + ano (ex.: "15 maio 2025").
  const text = fold(value);
  return /\b\d{1,2}\s+(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\s+\d{4}\b/.test(text);
}

function periodicalMatch(value: string): boolean {
  const text = fold(value);
  return /\bissn\b/.test(text) || /,\s*(?:19|20)\d{2}\s*[-–]\s*\.?\s*$/.test(text);
}

function correspondenceMatch(value: string): boolean {
  const text = fold(value);
  return /\b(correspondencia|carta\b|oficio\b|memorando\b)\b/.test(text);
}

function audiovisualMatch(value: string): boolean {
  const text = fold(value);
  return /\b(filme\b|documentario\b|documentário\b|video\b|vídeo\b|dvd\b|blu-?ray|serie\b|série\b|episodio\b|episódio\b|podcast\b)\b/.test(text);
}

function sonoroMatch(value: string): boolean {
  const text = fold(value);
  return /\b(disco sonoro|\bcd\b|album\b|álbum\b|musica\b|música\b|faixa\b|gravacao sonora|gravação sonora)\b/.test(text);
}

function sheetMusicMatch(value: string): boolean {
  return /\bpartitura\b/iu.test(value);
}

function iconographicMatch(value: string): boolean {
  const text = fold(value);
  return /\b(fotografia\b|gravura\b|pintura\b|desenho\b|cartaz\b|icone\b|ícone\b|imagem\b|ilustracao\b|ilustração\b)\b/.test(text);
}

function cartographicMatch(value: string): boolean {
  const text = fold(value);
  return /\b(planta\b|mapa\b|carta geografica|carta geográfica|carta topografica|carta topográfica|atlas\b)\b/.test(text);
}

function tridimensionalMatch(value: string): boolean {
  const text = fold(value);
  return /\b(mapa em relevo|maquete\b|escultura\b|objeto tridimensional|modelo 3d)\b/.test(text);
}

function researchDataMatch(value: string): boolean {
  const text = fold(value);
  return /\b(dados de pesquisa|conjunto de dados|dataset\b|repositorio de dados|repositório de dados)\b/.test(text);
}

function genericTitle(remainder: string): string | undefined {
  return bookTitle(remainder) ?? remainder.split(/\.\s+/u).map((p) => p.trim()).find((p) => p.length > 3);
}

function isOnlineReference(value: string): boolean {
  const text = fold(value);
  // NBR 6023: documento em meio eletrônico tem "Disponível em: <URL>" e
  // (para material não-publicado) "Acesso em: <data>". URL avulsa (sem rótulo
  // no original — vira "Disponível em:" só na limpeza) é site com confiança
  // baixa; com rótulo explícito E conteúdo estruturado antes da URL (autor ou
  // título institucional), é online dedicado.
  const urlIndex = text.search(/\bhttps?:\/\//iu);
  if (urlIndex <= 0) return false;
  const beforeUrl = text.slice(0, urlIndex).trim();
  return /\bdispon[ií]vel\s+em\s*:/iu.test(text) && /\bhttps?:\/\//iu.test(text) && beforeUrl.length > 15;
}

export function hasAccessDate(value: string): boolean {
  const text = fold(value);
  // "Acesso em:" com ou sem dois-pontos ("Acesso em 28 set. 2012") — o padrão
  // com dois-pontos é o recomendado pela NBR 6023, mas o sem é frequente em
  // conversões de PDF.
  return /\bacesso\s+em\s*:?/iu.test(text) && /\b\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z.]*\s+\d{4}\b/iu.test(text);
}

/**
 * Indica se a linha é uma referência ONLINE (URL ou "Disponível em:") que ainda
 * não tem "Acesso em:" — o padrão é o mesmo do validator
 * (reference-access-missing): URL presente e nenhuma menção a "acesso em".
 */
function isOnlineReferenceMissingAccessDate(line: string): boolean {
  const text = fold(line);
  if (!/https?:\/\/|dispon[ií]vel\s+em\s*:/iu.test(text)) return false;
  if (/\bacesso\s+em\b/iu.test(text)) return false;
  return true;
}

/** Formata a data de acesso no padrão NBR 6023: "10 jan. 2026". */
export function formatAccessDate(date: Date): string {
  const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Quantas referências online (linhas) ainda estão sem "Acesso em:".
 * Usado pelo editor de referências para sugerir a correção automática.
 */
export function countOnlineReferencesMissingAccessDate(references: string): number {
  if (!references) return 0;
  return references
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isOnlineReferenceMissingAccessDate).length;
}

/**
 * Anexa "Acesso em: <data>" ao final de cada referência online sem data de
 * acesso (NBR 6023) — assistência no editor de referências: resolve o erro
 * reference-access-missing sem digitação manual. Preserva a formatação das
 * linhas que já têm acesso ou não são online.
 */
export function appendAccessDatesToOnlineReferences(references: string, accessDate?: Date): { text: string; fixed: number } {
  if (!references) return { text: references, fixed: 0 };
  const date = formatAccessDate(accessDate ?? new Date());
  let fixed = 0;
  const text = references
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || !isOnlineReferenceMissingAccessDate(trimmed)) return line;
      fixed += 1;
      // remove pontuação final e anexa a data de acesso
      return `${trimmed.replace(/[.;\s]+$/u, "")}. Acesso em: ${date}.`;
    })
    .join("\n");
  return { text, fixed };
}

function detect(value: string): { highlight?: string; confidence: ReferenceConfidence; detectedType: NormalizedReference["detectedType"] } {
  if (isLegislation(value)) return { highlight: legislationTitle(value), confidence: "media", detectedType: "legislacao" };
  // Referência online explícita (Disponível em: URL) tem tipo dedicado — antes
  // caía em "site" com confiança baixa mesmo para documentos formais online.
  // Conjuntos de dados mantêm prioridade sobre o rótulo online (são online E
  // dados de pesquisa; o tipo específico é mais informativo).
  if (researchDataMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "dados-pesquisa" };
  if (isOnlineReference(value)) {
    return { highlight: genericTitle(value), confidence: "media", detectedType: "online" };
  }
  const parsed = splitAuthor(value);
  if (!parsed) {
    if (/\bhttps?:\/\//iu.test(value)) return { confidence: "baixa", detectedType: "site" };
    if (researchDataMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "dados-pesquisa" };
    if (researchDataMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "dados-pesquisa" };
    if (patentMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "patente" };
    if (periodicalMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "periodico" };
    if (correspondenceMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "correspondencia" };
    if (audiovisualMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "audiovisual" };
    if (sonoroMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "sonoro" };
    if (sheetMusicMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "partitura" };
    if (cartographicMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "cartografico" };
    if (iconographicMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "iconografico" };
    if (tridimensionalMatch(value)) return { highlight: genericTitle(value), confidence: "baixa", detectedType: "tridimensional" };
    if (isInstitutional(value)) {
      const highlight = institutionalTitle(value);
      return { highlight, confidence: highlight ? "media" : "baixa", detectedType: "documento-institucional" };
    }
    return { confidence: "baixa", detectedType: "livro" };
  }
  if (eventReference(parsed.remainder)) return { highlight: eventHighlight(parsed.remainder), confidence: "media", detectedType: "evento" };
  const chapter = chapterBookTitle(parsed.remainder);
  if (chapter) return { highlight: chapter, confidence: "media", detectedType: "capitulo" };
  const article = articleJournal(parsed.remainder);
  if (article) return { highlight: article, confidence: "media", detectedType: "artigo" };
  const academic = academicTitle(parsed.remainder);
  if (academic || /\b(dissertacao|tese|monografia)\b/u.test(fold(value))) return { highlight: academic, confidence: academic ? "media" : "baixa", detectedType: "tese-dissertacao" };
  if (researchDataMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "dados-pesquisa" };
  if (patentMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "patente" };
  if (newspaperMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "jornal" };
  if (periodicalMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "periodico" };
  if (correspondenceMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "correspondencia" };
  if (audiovisualMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "audiovisual" };
  if (sonoroMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "sonoro" };
  if (sheetMusicMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "partitura" };
  if (cartographicMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "cartografico" };
  if (iconographicMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "iconografico" };
  if (tridimensionalMatch(value)) return { highlight: genericTitle(parsed.remainder), confidence: "baixa", detectedType: "tridimensional" };
  if (isInstitutional(value)) return { highlight: bookTitle(parsed.remainder) ?? institutionalTitle(value), confidence: "baixa", detectedType: "documento-institucional" };
  const book = bookTitle(parsed.remainder);
  if (book) return { highlight: book, confidence: "media", detectedType: "livro" };
  return { confidence: "baixa", detectedType: "desconhecido" };
}

function applyHighlight(text: string, highlight?: string): ReferenceRun[] {
  if (!highlight) return mergeRuns(splitEtAl({ text }));
  const start = fold(text).indexOf(fold(highlight));
  if (start < 0) return mergeRuns(splitEtAl({ text }));
  const end = start + highlight.length;
  return mergeRuns([{ text: text.slice(0, start) }, { text: text.slice(start, end), bold: true }, { text: text.slice(end) }].flatMap(splitEtAl));
}

export function normalizeReference(reference: string): NormalizedReference {
  const original = clean(reference);
  const manual = parseManual(original);
  const text = normalizeReferenceLinks(clean(manual.runs.map((run) => run.text).join("")));
  const warnings: string[] = [];

  const uflaManual = normalizeUflaManualReference(text);
  if (uflaManual) return uflaManual;
  if (!text) return { original: reference, text, runs: [], confidence: "baixa", warnings: ["empty"], detectedType: "desconhecido" };
  if (!hasYear(text)) warnings.push("missing year");
  const detected = detect(text);
  if (!detected.highlight && !manual.hasManual) warnings.push("review title");
  const detectedHighlight = manual.highlighted ?? detected.highlight;
  return { original: reference, text, runs: manual.hasManual ? parseManual(normalizeReferenceLinks(original)).runs : applyHighlight(text, detected.highlight), confidence: manual.hasManual ? "alta" : detected.confidence, warnings, detectedHighlight, detectedType: detected.detectedType };
}

export function normalizeReferencesText(value: string): NormalizedReference[] {
  return splitItems(value).map(normalizeReference);
}

export function normalizeReferences(references: string[]): NormalizedReference[] {
  return normalizeReferencesText(references.join("\n"));
}
