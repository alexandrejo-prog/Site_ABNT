import type { PdfAbstractDiagnostic, PdfPageDiagnostic, PdfPretextualDiagnostic, PdfSourceLineReference } from "./imported-pdf-diagnostic";

type LineRef = PdfSourceLineReference & {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  pageWidth: number;
};

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
  return clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
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
  return normalized.includes("UNIVERSIDADE FEDERAL DE LAVRAS") || normalized === "UFLA";
}

function isLikelyPersonName(text: string): boolean {
  if (clean(text) === fold(text) && clean(text).length > 45) return false;
  const words = clean(text).split(/\s+/);
  if (words.length < 2 || words.length > 8) return false;
  if (/[.:;]/.test(text)) return false;
  return words.every((word) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç'-]+$/.test(word));
}

function isAdministrativeOrApproval(text: string): boolean {
  return /(ficha catalografica|folha de aprovacao|banca examinadora|ata de defesa|catalogacao)/i.test(fold(text));
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
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function titleBlock(lines: LineRef[], afterIndex: number, beforeLine?: LineRef): string | undefined {
  const start = Math.max(0, afterIndex + 1);
  const beforeIndex = beforeLine ? lines.indexOf(beforeLine) : lines.length;
  const candidates = lines
    .slice(start, beforeIndex < 0 ? lines.length : beforeIndex)
    .filter((line) => isCentered(line) && !isYear(line.text) && !isLikelyInstitution(line.text))
    .filter((line) => clean(line.text).length >= 12);
  if (!candidates.length) return undefined;
  return candidates.map((line) => line.text).join(" ");
}

function detectCover(pages: PdfPageDiagnostic[], bodyPage?: number): PdfPretextualDiagnostic["cover"] {
  const candidates = pages.filter((page) => !bodyPage || page.pageNumber < bodyPage).slice(0, 4);
  let best: { page: PdfPageDiagnostic; score: number; lines: LineRef[] } | undefined;

  for (const page of candidates) {
    const lines = pageLineRefs(page);
    if (lines.some((line) => isAdministrativeOrApproval(line.text))) continue;
    const centeredCount = lines.filter(isCentered).length;
    const hasInstitution = lines.some((line) => isLikelyInstitution(line.text));
    const hasPerson = lines.some((line) => isLikelyPersonName(line.text));
    const hasYear = lines.some((line) => isYear(line.text));
    const verticalGaps = lines.slice(1).map((line, index) => line.top - lines[index].bottom).filter((gap) => gap > 0);
    const hasLargeGap = verticalGaps.some((gap) => gap > 38);
    const score = (hasInstitution ? 1 : 0) + (hasPerson ? 1 : 0) + (hasYear ? 1 : 0) + (centeredCount >= Math.max(3, lines.length * 0.45) ? 1 : 0) + (hasLargeGap ? 1 : 0);
    if (!best || score > best.score) best = { page, score, lines };
  }

  if (!best || best.score < 2) return undefined;
  const institutionLine = best.lines.find((line) => isLikelyInstitution(line.text));
  const authorLine = best.lines.find((line) => isLikelyPersonName(line.text));
  const authorIndex = authorLine ? best.lines.indexOf(authorLine) : -1;
  const yearLine = [...best.lines].reverse().find((line) => isYear(line.text));
  const cityLine = yearLine ? [...best.lines.slice(0, best.lines.indexOf(yearLine))].reverse().find((line) => isCentered(line) && !isLikelyInstitution(line.text) && !isLikelyPersonName(line.text)) : undefined;
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

function detectTitlePage(pages: PdfPageDiagnostic[], coverPage?: number, bodyPage?: number): PdfPretextualDiagnostic["titlePage"] {
  const candidates = pages.filter((page) => page.pageNumber !== coverPage && (!bodyPage || page.pageNumber < bodyPage)).slice(0, 8);
  let best: { page: PdfPageDiagnostic; score: number; lines: LineRef[] } | undefined;

  for (const page of candidates) {
    const lines = pageLineRefs(page);
    if (lines.some((line) => isAdministrativeOrApproval(line.text))) continue;
    const hasNature = lines.some((line) => /(DISSERTACAO|TESE|MONOGRAFIA|TRABALHO)/.test(fold(line.text)));
    const hasAdvisor = lines.some((line) => /ORIENTADOR/.test(fold(line.text)));
    const hasProgram = lines.some((line) => /PROGRAMA DE POS-GRADUACAO|PROGRAMA DE PÓS-GRADUAÇÃO/i.test(line.text));
    const hasYear = lines.some((line) => isYear(line.text));
    const hasPerson = lines.some((line) => isLikelyPersonName(line.text));
    const score = (hasNature ? 2 : 0) + (hasAdvisor ? 1 : 0) + (hasProgram ? 1 : 0) + (hasYear ? 1 : 0) + (hasPerson ? 1 : 0);
    if (!best || score > best.score) best = { page, score, lines };
  }

  if (!best || best.score < 2) return undefined;
  const authorLine = best.lines.find((line) => isLikelyPersonName(line.text));
  const authorIndex = authorLine ? best.lines.indexOf(authorLine) : -1;
  const natureLine = best.lines.find((line) => /(DISSERTACAO|TESE|MONOGRAFIA|TRABALHO)/.test(fold(line.text)));
  const title = titleBlock(best.lines, authorIndex, natureLine);
  const natureStart = natureLine ? best.lines.indexOf(natureLine) : -1;
  const advisorNameLine = best.lines.find((line, index) => index > natureStart && /PROF|DR|DRA/i.test(line.text));
  const programLine = best.lines.find((line) => /PROGRAMA DE POS-GRADUACAO|PROGRAMA DE PÓS-GRADUAÇÃO/i.test(line.text));
  const advisorLine = best.lines.find((line) => /ORIENTADOR/.test(fold(line.text)));
  const coadvisorLine = best.lines.find((line) => /COORIENTADOR/.test(fold(line.text)));
  const institutionLine = best.lines.find((line) => isLikelyInstitution(line.text));
  const yearLine = [...best.lines].reverse().find((line) => isYear(line.text));
  const cityLine = yearLine ? [...best.lines.slice(0, best.lines.indexOf(yearLine))].reverse().find((line) => isCentered(line)) : undefined;

  const advisorIndex = advisorLine ? best.lines.indexOf(advisorLine) : best.lines.length;
  const natureText = natureStart >= 0
    ? best.lines.slice(natureStart, Math.max(natureStart + 1, advisorNameLine ? best.lines.indexOf(advisorNameLine) : advisorIndex)).map((line) => line.text).join(" ")
    : undefined;
  const programIndex = programLine ? best.lines.indexOf(programLine) : -1;
  const program = programIndex >= 0
    ? best.lines.slice(programIndex, Math.min(programIndex + 2, advisorNameLine ? best.lines.indexOf(advisorNameLine) : best.lines.length)).map((line) => line.text).join(" ")
    : undefined;
  const advisor = advisorNameLine && advisorLine ? `${advisorLine.text}: ${advisorNameLine.text}` : advisorLine?.text;

  return {
    author: authorLine?.text,
    title,
    natureText,
    program,
    institution: institutionLine?.text,
    advisor,
    coadvisor: coadvisorLine?.text,
    city: cityLine && !isYear(cityLine.text) ? cityLine.text : undefined,
    year: yearLine?.text,
    confidence: confidence(best.score),
    sourceLines: best.lines.map(({ pageNumber, lineIndex }) => ({ pageNumber, lineIndex })),
  };
}

function paragraphFromLines(lines: LineRef[]): string {
  return lines.map((line) => line.text).join(" ").replace(/\s+/g, " ").trim();
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
