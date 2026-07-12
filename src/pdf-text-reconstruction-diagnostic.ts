import type {
  PdfBodyStartDiagnostic,
  PdfLineDiagnostic,
  PdfLineRole,
  PdfPageDiagnostic,
  PdfReconstructedBlockDiagnostic,
  PdfTextReconstructionDiagnostic,
} from "./imported-pdf-diagnostic";

interface LineRef {
  page: PdfPageDiagnostic;
  line: PdfLineDiagnostic;
  pageNumber: number;
  lineIndex: number;
  text: string;
  relativeTop: number;
  relativeBottom: number;
}

interface ClassifiedLine extends LineRef {
  role: PdfLineRole;
}

const NUMBERED_INTRODUCTION = /^\s*1(?:\.)?\s+INTRODU[CÇ][AÃ]O\s*$/iu;
const UNNUMBERED_INTRODUCTION = /^\s*INTRODU[CÇ][AÃ]O\s*$/iu;
const PRETEXTUAL_MARKER = /^(SUM[ÁA]RIO|LISTA DE|RESUMO|ABSTRACT|AGRADECIMENTOS|DEDICAT[ÓO]RIA|FICHA CATALOGR[ÁA]FICA)$/iu;
const CAPTION_RE = /^(Quadro|Tabela|Figura|Gr[áa]fico)\s+\d+\s*[-–—.:]/iu;
const SOURCE_RE = /^Fonte\s*:/iu;
const LIST_ITEM_RE = /^((?:[a-z]\))|(?:[IVXLCDM]+)\s*[-–—]|[-•])\s+/u;
const HEADING_RE = /^((?:\d+(?:\.\d+)*\.?\s+)?[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ0-9\s:.-]{2,}|REFER[ÊE]NCIAS|CONCLUS[ÃA]O|CONSIDERA[ÇC][ÕO]ES FINAIS)$/u;

function flattenPages(pages: PdfPageDiagnostic[]): LineRef[] {
  return pages.flatMap((page) => page.lines.map((line, lineIndex) => ({
    page,
    line,
    pageNumber: page.pageNumber,
    lineIndex,
    text: line.text.trim(),
    relativeTop: page.height ? line.top / page.height : 0,
    relativeBottom: page.height ? line.bottom / page.height : 0,
  }))).filter((entry) => entry.text.length > 0);
}

function normalizedComparisonText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b\d{1,4}\b/g, "#")
    .replace(/^[\s.,;:()[\]-]+|[\s.,;:()[\]-]+$/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function isRomanNumeral(text: string): boolean {
  return /^[ivxlcdm]{1,8}$/iu.test(text.trim());
}

function isIsolatedPageNumberCandidate(entry: LineRef): boolean {
  if (!/^(\d{1,4}|[ivxlcdm]{1,8})$/iu.test(entry.text)) return false;
  if (entry.line.items.length > 1) return false;
  return entry.relativeTop <= 0.12 || entry.relativeBottom >= 0.88;
}

function isPlausiblePageSequence(entry: LineRef, candidates: LineRef[]): boolean {
  if (isRomanNumeral(entry.text)) {
    return candidates.filter((candidate) => isRomanNumeral(candidate.text) && Math.abs(candidate.line.left - entry.line.left) <= 18).length >= 2;
  }
  const value = Number(entry.text);
  if (!Number.isFinite(value)) return false;
  if (Math.abs(value - entry.pageNumber) <= 2 || Math.abs(value - (entry.pageNumber - 1)) <= 2) return true;
  return candidates.some((candidate) => {
    const candidateValue = Number(candidate.text);
    return Number.isFinite(candidateValue)
      && candidate.pageNumber !== entry.pageNumber
      && Math.abs(candidate.pageNumber - entry.pageNumber) <= 2
      && Math.abs(candidateValue - value) <= 2
      && Math.abs(candidate.line.left - entry.line.left) <= 18;
  });
}

function pageLooksPretextual(page: PdfPageDiagnostic): boolean {
  return page.lines.some((line) => PRETEXTUAL_MARKER.test(line.text.trim()) || /SUM[ÁA]RIO/i.test(line.text));
}

function pageLooksLayoutSensitive(page: PdfPageDiagnostic): boolean {
  const hasCaption = page.lines.some((line) => CAPTION_RE.test(line.text.trim()));
  const shortLines = page.lines.filter((line) => line.text.trim().length > 0 && line.text.trim().length <= 42);
  const distinctLefts = new Set(shortLines.map((line) => Math.round(line.left / 24) * 24));
  return hasCaption || (shortLines.length >= 8 && distinctLefts.size >= 3);
}

function repeatedEdgeRoles(lines: LineRef[]): Map<string, PdfLineRole> {
  const groups = new Map<string, LineRef[]>();
  for (const entry of lines) {
    if (entry.relativeTop > 0.08 && entry.relativeBottom < 0.90) continue;
    const key = `${entry.relativeTop <= 0.08 ? "header" : "footer"}:${Math.round(entry.relativeTop * 20)}:${normalizedComparisonText(entry.text)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(entry);
  }

  const roles = new Map<string, PdfLineRole>();
  for (const [key, group] of groups) {
    const uniquePages = new Set(group.map((entry) => entry.pageNumber));
    if (uniquePages.size < 3) continue;
    const role: PdfLineRole = key.startsWith("header:") ? "repeated-header" : "repeated-footer";
    for (const entry of group) roles.set(`${entry.pageNumber}:${entry.lineIndex}`, role);
  }
  return roles;
}

function lineIsInLayoutSensitiveRegion(entry: LineRef, layoutSensitivePage: boolean): boolean {
  if (!layoutSensitivePage) return false;
  const captionIndex = entry.page.lines.findIndex((line) => CAPTION_RE.test(line.text.trim()));
  if (captionIndex < 0) return true;
  const sourceIndex = entry.page.lines.findIndex((line, index) => index > captionIndex && SOURCE_RE.test(line.text.trim()));
  if (entry.lineIndex <= captionIndex) return false;
  return sourceIndex < 0 ? true : entry.lineIndex < sourceIndex;
}

function classifyTextualRole(entry: LineRef, layoutSensitiveLine: boolean): PdfLineRole {
  if (CAPTION_RE.test(entry.text)) return "caption";
  if (SOURCE_RE.test(entry.text)) return "source";
  if (layoutSensitiveLine) return "layout-sensitive";
  if (LIST_ITEM_RE.test(entry.text)) return "list-item";
  if ((NUMBERED_INTRODUCTION.test(entry.text) || HEADING_RE.test(entry.text)) && entry.text.length <= 90 && !/^\d+\s+\d{4}\b/.test(entry.text)) return "heading";
  return "body";
}

function classifyLines(pages: PdfPageDiagnostic[]): ClassifiedLine[] {
  const lines = flattenPages(pages);
  const pageNumberCandidates = lines.filter(isIsolatedPageNumberCandidate);
  const repeatedRoles = repeatedEdgeRoles(lines);
  const layoutPages = new Set(pages.filter(pageLooksLayoutSensitive).map((page) => page.pageNumber));

  return lines.map((entry) => {
    const key = `${entry.pageNumber}:${entry.lineIndex}`;
    if (isIsolatedPageNumberCandidate(entry) && isPlausiblePageSequence(entry, pageNumberCandidates)) return { ...entry, role: "page-number" };
    const repeatedRole = repeatedRoles.get(key);
    if (repeatedRole) return { ...entry, role: repeatedRole };
    return { ...entry, role: classifyTextualRole(entry, lineIsInLayoutSensitiveRegion(entry, layoutPages.has(entry.pageNumber))) };
  });
}

function bodyLikeAfter(lines: ClassifiedLine[], index: number): boolean {
  const next = lines.slice(index + 1).find((entry) => !["page-number", "repeated-header", "repeated-footer"].includes(entry.role));
  if (!next || next.role !== "body") return false;
  return next.text.length >= 45;
}

export function detectPdfBodyStartContextual(pages: PdfPageDiagnostic[], classified = classifyLines(pages)): PdfBodyStartDiagnostic {
  for (const [index, entry] of classified.entries()) {
    const numbered = NUMBERED_INTRODUCTION.test(entry.text);
    const unnumbered = UNNUMBERED_INTRODUCTION.test(entry.text);
    if (!numbered && !unnumbered) continue;
    if (pageLooksPretextual(entry.page) || entry.page.lines.slice(0, entry.lineIndex).some((line) => /SUM[ÁA]RIO/i.test(line.text))) {
      continue;
    }
    if (!bodyLikeAfter(classified, index)) continue;
    return {
      found: true,
      pageNumber: entry.pageNumber,
      lineIndex: entry.lineIndex,
      text: entry.text,
      matchType: numbered ? "numbered-introduction" : "unnumbered-introduction",
      reason: "Título de introdução seguido por texto corrido.",
    };
  }
  return { found: false, reason: "Nenhum título de introdução com contexto de corpo textual foi localizado." };
}

function blockFromLine(entry: ClassifiedLine, type: PdfReconstructedBlockDiagnostic["type"], confidence: PdfReconstructedBlockDiagnostic["confidence"], reasons: string[]): PdfReconstructedBlockDiagnostic {
  return {
    type,
    text: entry.text,
    pageStart: entry.pageNumber,
    pageEnd: entry.pageNumber,
    sourceLines: [{ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex }],
    confidence,
    reasons,
  };
}

function terminalPunctuation(text: string): boolean {
  return /[.!?;:]["')\]]?$/.test(text.trim());
}

function canJoinBodyLine(previous: ClassifiedLine, next: ClassifiedLine, currentParagraph: PdfReconstructedBlockDiagnostic | null): boolean {
  if (next.role !== "body") return false;
  if (previous.pageNumber !== next.pageNumber && terminalPunctuation(previous.text)) return false;
  const sameColumn = Math.abs(previous.line.left - next.line.left) <= Math.max(28, previous.line.height * 2.2);
  const verticalGap = previous.pageNumber === next.pageNumber ? next.line.top - previous.line.bottom : previous.line.height * 1.2;
  const firstLineIndent = currentParagraph?.sourceLines.length === 1
    && previous.pageNumber === next.pageNumber
    && previous.line.left > next.line.left
    && previous.line.left - next.line.left <= Math.max(72, previous.line.height * 5)
    && !terminalPunctuation(previous.text);
  return (sameColumn || firstLineIndent) && verticalGap <= Math.max(32, previous.line.height * 2.8);
}

function appendLineText(current: string, next: string, reasons: string[]): string {
  if (/-$/.test(current) && /^[a-záàâãéêíóôõúüç]/u.test(next) && !/(?:\d|[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])-$/.test(current)) {
    reasons.push("Hifenização conservadora recomposta entre linhas.");
    return `${current.slice(0, -1)}${next}`;
  }
  return `${current} ${next}`;
}

export function reconstructPdfParagraphBlocks(pages: PdfPageDiagnostic[]): PdfTextReconstructionDiagnostic {
  const classified = classifyLines(pages);
  const bodyStart = detectPdfBodyStartContextual(pages, classified);
  const ignoredLines = classified
    .filter((entry) => ["page-number", "repeated-header", "repeated-footer"].includes(entry.role))
    .map((entry) => ({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex, role: entry.role, text: entry.text }));
  const startOrdinal = bodyStart.found
    ? classified.findIndex((entry) => entry.pageNumber === bodyStart.pageNumber && entry.lineIndex === bodyStart.lineIndex)
    : 0;
  const blocks: PdfReconstructedBlockDiagnostic[] = [];
  let currentParagraph: PdfReconstructedBlockDiagnostic | null = null;
  let previousBodyLine: ClassifiedLine | null = null;

  function flushParagraph() {
    if (currentParagraph) blocks.push(currentParagraph);
    currentParagraph = null;
    previousBodyLine = null;
  }

  for (let index = Math.max(0, startOrdinal); index < classified.length; index += 1) {
    const entry = classified[index];
    if (["page-number", "repeated-header", "repeated-footer"].includes(entry.role)) continue;

    if (entry.role === "heading") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "heading", "high", ["Padrão estrutural de título detectado."]));
      continue;
    }
    if (entry.role === "list-item") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "list-item", "medium", ["Padrão conservador de item de lista detectado."]));
      continue;
    }
    if (entry.role === "caption") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "caption", "high", ["Legenda de quadro/tabela/figura/gráfico detectada."]));
      continue;
    }
    if (entry.role === "source") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "source", "high", ["Linha iniciada por Fonte:."]));
      continue;
    }
    if (entry.role === "layout-sensitive") {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "unresolved" && last.pageEnd === entry.pageNumber) {
        last.text = appendLineText(last.text, entry.text, last.reasons);
        last.pageEnd = entry.pageNumber;
        last.sourceLines.push({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex });
      } else {
        blocks.push(blockFromLine(entry, "unresolved", "low", ["Conteúdo marcado como sensível a layout; não foi convertido em parágrafo."]));
      }
      continue;
    }

    if (!currentParagraph || (previousBodyLine && !canJoinBodyLine(previousBodyLine, entry, currentParagraph))) {
      flushParagraph();
      currentParagraph = {
        type: "paragraph",
        text: entry.text,
        pageStart: entry.pageNumber,
        pageEnd: entry.pageNumber,
        sourceLines: [{ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex }],
        confidence: "medium",
        reasons: ["Linhas visuais compatíveis foram unidas como parágrafo diagnóstico."],
      };
    } else {
      currentParagraph.text = appendLineText(currentParagraph.text, entry.text, currentParagraph.reasons);
      currentParagraph.pageEnd = entry.pageNumber;
      currentParagraph.sourceLines.push({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex });
    }
    previousBodyLine = entry;
  }
  flushParagraph();

  return {
    blocks,
    ignoredLines,
    bodyStart,
    statistics: {
      paragraphCount: blocks.filter((block) => block.type === "paragraph").length,
      headingCount: blocks.filter((block) => block.type === "heading").length,
      listItemCount: blocks.filter((block) => block.type === "list-item").length,
      captionCount: blocks.filter((block) => block.type === "caption").length,
      sourceCount: blocks.filter((block) => block.type === "source").length,
      unresolvedCount: blocks.filter((block) => block.type === "unresolved").length,
      removedPageNumberCount: ignoredLines.filter((line) => line.role === "page-number").length,
      removedHeaderCount: ignoredLines.filter((line) => line.role === "repeated-header").length,
      removedFooterCount: ignoredLines.filter((line) => line.role === "repeated-footer").length,
    },
  };
}
