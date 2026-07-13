import type {
  PdfAbstractDiagnostic,
  PdfPageDiagnostic,
  PdfPretextualDiagnostic,
  PdfSourceLineReference,
} from "./imported-pdf-diagnostic";

type LineRef = PdfSourceLineReference & {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  pageWidth: number;
};

const PERSON_CONNECTORS = new Set(["DA", "DAS", "DE", "DO", "DOS", "E"]);
const TITLE_TERMS = /\b(?:ADMINISTRACAO|AMBIENTAL|ANALISE|BRASIL|DESAFIOS|DESEMPENHO|EDUCACAO|ESTUDO|GESTAO|IMPLEMENTACAO|INOVACAO|INSTITUICAO|ORGANIZACIONAL|ORGANIZACOES|PESQUISA|POLITICA|POLITICAS|PROGRAMA|PUBLICA|PUBLICAS|PUBLICO|PUBLICOS|SERVIDOR|SERVIDORES|TELETRABALHO|TRABALHO|UNIVERSIDADE)\b/u;
const PROGRAM_RE = /PROGRAMA DE POS-GRADUACAO|PROGRAMA DE PÓS-GRADUAÇÃO/iu;
const ADVISOR_RE = /\b(?:COORIENTADOR|ORIENTADOR)(?:A)?\b/iu;

function clean(text: string): string {
  let normalized = text
    .replace(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,})\1\b/g, "$1")
    .replace(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÇ]+){2,})\1\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  normalized = normalized.replace(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÇ]+){2,})\1\b/g, "$1");
  return normalized;
}

function fold(text: string): string {
  return clean(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizedWords(text: string): string[] {
  return fold(text)
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isCentered(line: LineRef): boolean {
  const lineCenter = (line.left + line.right) / 2;
  return Math.abs(lineCenter - line.pageWidth / 2) <= Math.max(28, line.pageWidth * 0.08);
}

function isYear(text: string): boolean {
  return /^(?:19|20)\d{2}$/.test(clean(text));
}

function isLikelyInstitution(text: string): boolean {
  const normalized = fold(text);
  return normalized.includes("UNIVERSIDADE FEDERAL DE LAVRAS")
    || normalized === "UFLA"
    || normalized.includes("INSTITUTO FEDERAL");
}

function isNatureAnchor(text: string): boolean {
  const normalized = fold(text);
  const dissertationLike = /^(?:DISSERTACAO|TESE|MONOGRAFIA)\b/u.test(normalized)
    && /(?:APRESENTAD|SUBMETID|COMO PARTE|EXIGENCIAS|OBTENCAO|TITULO)/u.test(normalized);
  const workLike = /^TRABALHO\b/u.test(normalized)
    && /(?:APRESENTAD|SUBMETID|CONCLUSAO|EXIGENCIAS|OBTENCAO|TITULO)/u.test(normalized);
  return dissertationLike
    || workLike
    || /COMO PARTE DAS EXIGENCIAS/u.test(normalized)
    || /PARA (?:A )?OBTENCAO DO TITULO/u.test(normalized);
}

const HONORIFIC_ABBR = /\b(?:Prof|Dr|Dra|Sr|Sra|Srta)\./iu;

function isLikelyPersonName(text: string): boolean {
  const value = clean(text);
  if (!value || /\d/.test(value)) return false;
  const withoutHonorifics = value.replace(/\b(?:Prof|Dr|Dra|Sr|Sra|Srta)\./giu, "");
  if (/[.:;!?]/.test(withoutHonorifics)) return false;
  const words = value.split(/\s+/);
  if (words.length < 2 || words.length > 7) return false;
  const folded = fold(value);
  if (TITLE_TERMS.test(folded) || isLikelyInstitution(value) || isNatureAnchor(value) || PROGRAM_RE.test(value) || ADVISOR_RE.test(value)) {
    return false;
  }
  const lexicalWords = words.filter((word) => !PERSON_CONNECTORS.has(fold(word)));
  if (lexicalWords.length < 2 || lexicalWords.length > 5) return false;
  const namePattern = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç'.-]+$/u;
  return words.every((word) => {
    if (PERSON_CONNECTORS.has(fold(word))) return true;
    if (HONORIFIC_ABBR.test(word)) return true;
    return namePattern.test(word);
  });
}

function isAdministrativeOrApproval(text: string): boolean {
  return /(FICHA CATALOGRAFICA|FOLHA DE APROVACAO|BANCA EXAMINADORA|ATA DE DEFESA|CATALOGACAO)/u.test(fold(text));
}

function isProgramLine(text: string): boolean {
  return PROGRAM_RE.test(text);
}

function isAdvisorLine(text: string): boolean {
  return ADVISOR_RE.test(text);
}

function linesBeforeBody(pages: PdfPageDiagnostic[], bodyPage?: number): LineRef[] {
  return pages
    .filter((page) => !bodyPage || page.pageNumber < bodyPage)
    .flatMap((page) => page.lines.map((line, lineIndex) => ({
      pageNumber: page.pageNumber,
      lineIndex,
      text: clean(line.text),
      left: line.left,
      right: line.right,
      top: line.top,
      bottom: line.bottom,
      pageWidth: page.width,
    })))
    .filter((line) => line.text);
}

function pageLineRefs(page: PdfPageDiagnostic): LineRef[] {
  return page.lines.map((line, lineIndex) => ({
    pageNumber: page.pageNumber,
    lineIndex,
    text: clean(line.text),
    left: line.left,
    right: line.right,
    top: line.top,
    bottom: line.bottom,
    pageWidth: page.width,
  })).filter((line) => line.text);
}

function confidence(score: number): "high" | "medium" | "low" {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function findLikelyAuthor(lines: LineRef[]): LineRef | undefined {
  const scored = lines
    .map((line, index) => {
      if (!isLikelyPersonName(line.text)) return undefined;
      const previous = lines[index - 1];
      const next = lines[index + 1];
      let score = 1;
      if (isCentered(line)) score += 2;
      if (previous && isLikelyInstitution(previous.text)) score += 1;
      if (next && isCentered(next) && clean(next.text).length >= 18 && !isLikelyPersonName(next.text)) score += 1;
      if (line.top < 330) score += 1;
      return { line, score, index };
    })
    .filter((entry): entry is { line: LineRef; score: number; index: number } => Boolean(entry));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0]?.line;
}

function titleBlock(lines: LineRef[], afterIndex: number, beforeLine?: LineRef): string | undefined {
  const start = Math.max(0, afterIndex + 1);
  const beforeIndex = beforeLine ? lines.indexOf(beforeLine) : lines.length;
  const candidates = lines
    .slice(start, beforeIndex < 0 ? lines.length : beforeIndex)
    .filter((line) => isCentered(line))
    .filter((line) => !isYear(line.text) && !isLikelyInstitution(line.text) && !isLikelyPersonName(line.text))
    .filter((line) => !isNatureAnchor(line.text) && !isProgramLine(line.text) && !isAdvisorLine(line.text))
    .filter((line) => clean(line.text).length >= 12);
  if (!candidates.length) return undefined;
  return clean(candidates.map((line) => line.text).join(" "));
}

function coverHasTitlePageSignals(lines: LineRef[]): boolean {
  return lines.some((line) => isNatureAnchor(line.text) || isAdvisorLine(line.text) || isProgramLine(line.text));
}

function detectCover(pages: PdfPageDiagnostic[], bodyPage?: number): PdfPretextualDiagnostic["cover"] {
  const candidates = pages.filter((page) => !bodyPage || page.pageNumber < bodyPage).slice(0, 4);
  let best: { page: PdfPageDiagnostic; score: number; lines: LineRef[] } | undefined;

  for (const page of candidates) {
    const lines = pageLineRefs(page);
    if (lines.some((line) => isAdministrativeOrApproval(line.text)) || coverHasTitlePageSignals(lines)) continue;
    const centeredCount = lines.filter(isCentered).length;
    const hasInstitution = lines.some((line) => isLikelyInstitution(line.text));
    const authorLine = findLikelyAuthor(lines);
    const hasYear = lines.some((line) => isYear(line.text));
    const verticalGaps = lines.slice(1).map((line, index) => line.top - lines[index].bottom).filter((gap) => gap > 0);
    const hasLargeGap = verticalGaps.some((gap) => gap > 38);
    const yearLine = [...lines].reverse().find((line) => isYear(line.text));
    const cityLine = yearLine
      ? [...lines.slice(0, lines.indexOf(yearLine))].reverse().find((line) => isCentered(line) && !isLikelyInstitution(line.text) && !isLikelyPersonName(line.text))
      : undefined;
    const authorIndex = authorLine ? lines.indexOf(authorLine) : -1;
    const probableTitle = titleBlock(lines, authorIndex, cityLine ?? yearLine);
    const score = (hasInstitution ? 2 : 0)
      + (authorLine ? 2 : 0)
      + (hasYear ? 1 : 0)
      + (centeredCount >= Math.max(3, lines.length * 0.45) ? 1 : 0)
      + (hasLargeGap ? 1 : 0)
      + (probableTitle ? 1 : 0);
    if (!best || score > best.score) best = { page, score, lines };
  }

  if (!best || best.score < 5) return undefined;
  const institutionLine = best.lines.find((line) => isLikelyInstitution(line.text));
  const authorLine = findLikelyAuthor(best.lines);
  const authorIndex = authorLine ? best.lines.indexOf(authorLine) : -1;
  const yearLine = [...best.lines].reverse().find((line) => isYear(line.text));
  const cityLine = yearLine
    ? [...best.lines.slice(0, best.lines.indexOf(yearLine))].reverse().find((line) => isCentered(line) && !isLikelyInstitution(line.text) && !isLikelyPersonName(line.text))
    : undefined;
  const title = titleBlock(best.lines, authorIndex, cityLine ?? yearLine);

  return {
    institution: institutionLine?.text,
    author: authorLine?.text,
    title,
    city: cityLine && !isYear(cityLine.text) ? cityLine.text : undefined,
    year: yearLine?.text,
    confidence: confidence(best.score),
    sourceLines: best.lines.map(({ pageNumber, lineIndex }) => ({ pageNumber, lineIndex })),
  };
}

function overlapWordCount(left: string[], right: string[]): number {
  const max = Math.min(left.length, right.length);
  for (let size = max; size >= 1; size -= 1) {
    if (left.slice(left.length - size).join(" ") === right.slice(0, size).join(" ")) return size;
  }
  return 0;
}

function containsNormalizedText(container: string, candidate: string): boolean {
  const containerWords = normalizedWords(container);
  const candidateWords = normalizedWords(candidate);
  if (!candidateWords.length || candidateWords.length > containerWords.length) return false;
  return containerWords.join(" ").includes(candidateWords.join(" "));
}

export function deduplicateNatureLines(lines: string[]): string {
  const output: string[] = [];
  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    const accumulated = clean(output.join(" "));
    if (accumulated && containsNormalizedText(accumulated, line)) continue;
    if (!accumulated) {
      output.push(line);
      continue;
    }
    const accumulatedWords = normalizedWords(accumulated);
    const lineWords = normalizedWords(line);
    const overlap = overlapWordCount(accumulatedWords, lineWords);
    const overlapText = lineWords.slice(0, overlap).join(" ");
    if (overlap >= 3 && overlapText.length >= 15) {
      const originalWords = line.split(/\s+/);
      const remainder = originalWords.slice(overlap).join(" ");
      if (remainder) output.push(remainder);
      continue;
    }
    output.push(line);
  }
  return clean(output.join(" "));
}

function isCityOrYear(line: LineRef): boolean {
  return isYear(line.text) || /^(?:LAVRAS|LAVRAS-MG|[A-Z\s-]+)$/iu.test(clean(line.text));
}

function findAdvisorNameLine(lines: LineRef[], advisorLine: LineRef): LineRef | undefined {
  const index = lines.indexOf(advisorLine);
  const next = index < lines.length - 1 ? lines[index + 1] : undefined;
  const prev = index > 0 ? lines[index - 1] : undefined;
  if (next && isLikelyPersonName(next.text) && !isCityOrYear(next) && !isProgramLine(next.text) && !isAdvisorLine(next.text) && !isNatureAnchor(next.text)) return next;
  if (prev && isLikelyPersonName(prev.text) && !isCityOrYear(prev) && !isProgramLine(prev.text) && !isAdvisorLine(prev.text) && !isNatureAnchor(prev.text)) return prev;
  return undefined;
}

function extractAdvisor(lines: LineRef[], advisorLine: LineRef | undefined): string | undefined {
  if (!advisorLine) return undefined;
  const index = lines.indexOf(advisorLine);
  const text = clean(advisorLine.text);
  const afterColon = text.split(":").slice(1).join(":").trim();
  if (afterColon.length >= 3) return text;

  const next = lines[index + 1];
  const prev = index > 0 ? lines[index - 1] : undefined;

  if (next && isLikelyPersonName(next.text) && !isCityOrYear(next) && !isProgramLine(next.text) && !isAdvisorLine(next.text) && !isNatureAnchor(next.text)) {
    return `${text.replace(/\s*:?\s*$/, "")}: ${next.text}`;
  }
  if (prev && isLikelyPersonName(prev.text) && !isCityOrYear(prev) && !isProgramLine(prev.text) && !isAdvisorLine(prev.text) && !isNatureAnchor(prev.text)) {
    return `${text.replace(/\s*:?\s*$/, "")}: ${prev.text}`;
  }
  return text;
}

function detectTitlePage(pages: PdfPageDiagnostic[], coverPage?: number, bodyPage?: number): PdfPretextualDiagnostic["titlePage"] {
  const candidates = pages.filter((page) => page.pageNumber !== coverPage && (!bodyPage || page.pageNumber < bodyPage)).slice(0, 8);
  let best: { page: PdfPageDiagnostic; score: number; lines: LineRef[] } | undefined;

  for (const page of candidates) {
    const lines = pageLineRefs(page);
    if (lines.some((line) => isAdministrativeOrApproval(line.text))) continue;
    const hasNature = lines.some((line) => isNatureAnchor(line.text));
    const hasAdvisor = lines.some((line) => isAdvisorLine(line.text));
    const hasProgram = lines.some((line) => isProgramLine(line.text));
    const hasYear = lines.some((line) => isYear(line.text));
    const hasPerson = Boolean(findLikelyAuthor(lines));
    const score = (hasNature ? 4 : 0) + (hasAdvisor ? 2 : 0) + (hasProgram ? 2 : 0) + (hasYear ? 1 : 0) + (hasPerson ? 1 : 0);
    if (!best || score > best.score) best = { page, score, lines };
  }

  if (!best || best.score < 4) return undefined;
  const authorLine = findLikelyAuthor(best.lines);
  const authorIndex = authorLine ? best.lines.indexOf(authorLine) : -1;
  const natureLine = best.lines.find((line) => isNatureAnchor(line.text));
  const natureStart = natureLine ? best.lines.indexOf(natureLine) : -1;
  const advisorLine = best.lines.find((line) => /\bORIENTADOR(?:A)?\b/iu.test(fold(line.text)));
  const coadvisorLine = best.lines.find((line) => /\bCOORIENTADOR(?:A)?\b/iu.test(fold(line.text)));
  const programLine = best.lines.find((line) => isProgramLine(line.text));
  const institutionLine = best.lines.find((line) => isLikelyInstitution(line.text) && line !== natureLine);
  const yearLine = [...best.lines].reverse().find((line) => isYear(line.text));
  const cityLine = yearLine
    ? [...best.lines.slice(0, best.lines.indexOf(yearLine))].reverse().find((line) => isCentered(line) && !isNatureAnchor(line.text) && !isProgramLine(line.text) && !isAdvisorLine(line.text))
    : undefined;
  const advisorNameLine = advisorLine
    ? findAdvisorNameLine(best.lines, advisorLine)
    : undefined;
  const extractedAdvisor = advisorNameLine
    ? clean(advisorNameLine.text)
    : extractAdvisor(best.lines, advisorLine);
  // Stop nature extraction before the institution line so a standalone institution name is
  // not absorbed into natureText (which would otherwise make the institution deduplication
  // check below incorrectly drop a legitimate institution).
  const stopCandidates = [advisorLine, advisorNameLine, coadvisorLine, institutionLine, cityLine, yearLine]
    .filter((line): line is LineRef => Boolean(line))
    .map((line) => best.lines.indexOf(line))
    .filter((index) => index > natureStart);
  const natureEnd = stopCandidates.length ? Math.min(...stopCandidates) : best.lines.length;
  const natureLines = natureStart >= 0 ? best.lines.slice(natureStart, natureEnd).map((line) => line.text) : [];
  const natureText = natureLines.length ? deduplicateNatureLines(natureLines) : undefined;
  const title = titleBlock(best.lines, authorIndex, natureLine);

  let program: string | undefined;
  if (programLine) {
    const programIndex = best.lines.indexOf(programLine);
    // Stop program extraction before the advisor name line so a standalone advisor
    // name is not captured as part of the program text.
    const programEnd = [advisorLine, advisorNameLine, coadvisorLine, cityLine, yearLine]
      .filter((line): line is LineRef => Boolean(line))
      .map((line) => best.lines.indexOf(line))
      .filter((index) => index > programIndex)
      .sort((a, b) => a - b)[0] ?? Math.min(programIndex + 2, best.lines.length);

    let programLines = best.lines.slice(programIndex, programEnd).map((line) => line.text);

    if (advisorNameLine) {
      const advisorName = clean(advisorNameLine.text);
      programLines = programLines.filter((line) => !clean(line).includes(advisorName));
    }

    const programText = deduplicateNatureLines(programLines);

    // Only keep program text when it is not a repetition of the nature text and does
    // not merely duplicate the advisor name.
    const advisorTextForCheck = extractedAdvisor ? fold(extractedAdvisor) : "";
    if (
      programText &&
      !(natureText && containsNormalizedText(natureText, programText)) &&
      !(advisorTextForCheck && containsNormalizedText(programText, advisorTextForCheck))
    ) {
      program = programText;
    }
  }

  const institution = institutionLine && !(natureText && containsNormalizedText(natureText, institutionLine.text))
    ? institutionLine.text
    : undefined;

  return {
    author: authorLine?.text,
    title,
    natureText: natureText || undefined,
    program,
    institution,
    advisor: extractAdvisor(best.lines, advisorLine),
    coadvisor: extractAdvisor(best.lines, coadvisorLine),
    city: cityLine && !isYear(cityLine.text) ? cityLine.text : undefined,
    year: yearLine?.text,
    confidence: confidence(best.score),
    sourceLines: best.lines.map((line) => ({ pageNumber: line.pageNumber, lineIndex: line.lineIndex })),
  };
}

function paragraphFromLines(lines: LineRef[]): string {
  return clean(lines.map((line) => line.text).join(" "));
}

function detectAbstract(lines: LineRef[], title: "RESUMO" | "ABSTRACT"): PdfAbstractDiagnostic | undefined {
  const titleIndex = lines.findIndex((line) => fold(line.text) === title);
  if (titleIndex < 0) return undefined;
  const keywordPattern = title === "RESUMO" ? /^PALAVRAS[-\s]?CHAVE\s*:?/i : /^KEYWORDS\s*:?/i;
  const stopPattern = title === "RESUMO"
    ? /^(ABSTRACT|SUMARIO|LISTA DE|AGRADECIMENTOS|1\s+INTRODU)/i
    : /^(SUMARIO|LISTA DE|1\s+INTRODU|INDICADORES|IMPACT INDICATORS)/i;
  const body: LineRef[] = [];
  let keywordsLine: LineRef | undefined;

  for (const line of lines.slice(titleIndex + 1)) {
    const normalized = fold(line.text);
    if (keywordPattern.test(line.text)) {
      keywordsLine = line;
      break;
    }
    if (stopPattern.test(normalized)) break;
    body.push(line);
  }

  if (!body.length) return undefined;
  const keywordsLabel = keywordsLine?.text.match(keywordPattern)?.[0]?.replace(/\s+$/, "");
  const keywords = keywordsLine ? clean(keywordsLine.text.replace(keywordPattern, "")) : undefined;
  const sourceLines = [...body, ...(keywordsLine ? [keywordsLine] : [])].map(({ pageNumber, lineIndex }) => ({ pageNumber, lineIndex }));

  return {
    title,
    text: paragraphFromLines(body),
    keywordsLabel,
    keywords,
    pageNumber: lines[titleIndex].pageNumber,
    confidence: keywordsLine ? "high" : "medium",
    sourceLines,
  };
}

export function detectPdfPretextual(pages: PdfPageDiagnostic[], bodyPage?: number): PdfPretextualDiagnostic {
  const warnings: string[] = [];
  const cover = detectCover(pages, bodyPage);
  const titlePage = detectTitlePage(pages, cover?.sourceLines[0]?.pageNumber, bodyPage);
  const lines = linesBeforeBody(pages, bodyPage);
  const resumo = detectAbstract(lines, "RESUMO");
  const abstract = detectAbstract(lines, "ABSTRACT");

  if (!cover) warnings.push("Capa não localizada com segurança.");
  if (cover && (!cover.author || !cover.title || !cover.city || !cover.year)) warnings.push("Capa localizada com campos essenciais ausentes.");
  if (!titlePage) warnings.push("Folha de rosto não localizada com segurança.");
  if (titlePage && (!titlePage.author || !titlePage.title || !titlePage.natureText)) warnings.push("Folha de rosto localizada com campos essenciais ausentes.");
  if (!resumo) warnings.push("Resumo não localizado com segurança.");
  if (resumo && !resumo.keywords) warnings.push("Palavras-chave não localizadas junto ao resumo.");
  if (!abstract) warnings.push("Abstract não localizado com segurança.");
  if (abstract && !abstract.keywords) warnings.push("Keywords não localizadas junto ao abstract.");

  return { cover, titlePage, resumo, abstract, warnings };
}
