import type {
  PdfBodyLayoutMetrics,
  PdfBodyStartDiagnostic,
  PdfHyphenationDiagnostic,
  PdfLayoutSensitiveRegionDiagnostic,
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
  confidence: "high" | "medium" | "low";
  reasons: string[];
  layoutRegionId?: string;
}

const NUMBERED_INTRODUCTION = /^\s*1(?:\.)?\s+INTRODU[CÇ][AÃ]O\s*$/iu;
const UNNUMBERED_INTRODUCTION = /^\s*INTRODU[CÇ][AÃ]O\s*$/iu;
const PRETEXTUAL_MARKER = /^(SUM[ÁA]RIO|LISTA DE|RESUMO|ABSTRACT|AGRADECIMENTOS|DEDICAT[ÓO]RIA|FICHA CATALOGR[ÁA]FICA)$/iu;
const CAPTION_RE = /^(Quadro|Tabela|Figura|Gr[áa]fico)\s+(\d+)\s*[-–—.:]/iu;
const SOURCE_RE = /^Fonte\s*:/iu;
const LIST_ITEM_RE = /^((?:[a-z]\))|(?:[IVXLCDM]+)\s*[-–—]|[-•])\s+/u;
const HEADING_RE = /^((?:\d+(?:\.\d+)*\.?\s+)?[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ0-9\s:.-]{2,}|REFER[ÊE]NCIAS|CONCLUS[ÃA]O|CONSIDERA[ÇC][ÕO]ES FINAIS)$/u;
const NUMBERED_HEADING_RE = /^\d+(?:\.\d+)*\.?\s+\S.{1,110}$/u;
const COMPOUND_PREFIX_RE = /(?:^|\s)(p[óo]s|pr[ée]|ex|n[ãa]o|rec[ée]m|vice|t[ée]cnico|pol[íi]tico|hist[óo]rico)-$/iu;

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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundedMode(values: number[], bucket = 6): number {
  if (values.length === 0) return 0;
  const groups = new Map<number, number>();
  for (const value of values) {
    const key = Math.round(value / bucket) * bucket;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
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

function pageLooksReferences(page: PdfPageDiagnostic): boolean {
  return page.lines.some((line) => /^REFER[ÊE]NCIAS$/iu.test(line.text.trim()))
    || page.lines.filter((line) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s.,;-]+/.test(line.text.trim())).length >= 4;
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

function kindFromCaption(text: string): PdfLayoutSensitiveRegionDiagnostic["kind"] {
  const match = CAPTION_RE.exec(text);
  if (!match) return "unknown";
  const kind = match[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (kind === "grafico") return "grafico";
  return kind as PdfLayoutSensitiveRegionDiagnostic["kind"];
}

function logicalIdFromCaption(text: string): string | undefined {
  const match = CAPTION_RE.exec(text);
  if (!match) return undefined;
  return `${kindFromCaption(text)}-${match[2]}`;
}

function isContinuationCaption(text: string): boolean {
  return /\b(continua|continua[çc][ãa]o|conclus[ãa]o)\b/iu.test(text);
}

function bridgeMultiPageRegions(regions: PdfLayoutSensitiveRegionDiagnostic[], pages: PdfPageDiagnostic[]): PdfLayoutSensitiveRegionDiagnostic[] {
  const result = [...regions];
  const pageMap = new Map(pages.map((page) => [page.pageNumber, page]));

  const groups = new Map<string, PdfLayoutSensitiveRegionDiagnostic[]>();
  for (const region of regions) {
    if (!region.logicalVisualId) continue;
    const list = groups.get(region.logicalVisualId) ?? [];
    list.push(region);
    groups.set(region.logicalVisualId, list);
  }



  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.pageStart - b.pageStart || a.startLineIndex - b.startLineIndex);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const bridgeStart = current.pageEnd + 1;
      const bridgeEnd = next.pageStart - 1;
      if (bridgeStart > bridgeEnd) continue;
      for (let bridgePage = bridgeStart; bridgePage <= bridgeEnd; bridgePage++) {
        const lastLineIndex = (pageMap.get(bridgePage)?.lines.length ?? 1) - 1;
        result.push({
          id: `layout-${bridgePage}-bridge-${current.logicalVisualId}`,
          pageStart: bridgePage,
          pageEnd: bridgePage,
          startLineIndex: 0,
          endLineIndex: lastLineIndex,
          kind: current.kind,
          caption: current.caption,
          source: undefined,
          confidence: "medium",
          reasons: ["Pagina intermediaria de elemento visual multietapa."],
          logicalVisualId: current.logicalVisualId,
        });
      }
    }
  }

  return result;
}

function findLayoutRegions(pages: PdfPageDiagnostic[]): PdfLayoutSensitiveRegionDiagnostic[] {
  const regions: PdfLayoutSensitiveRegionDiagnostic[] = [];
  for (const page of pages) {
    let regionIndex = 0;
    for (let index = 0; index < page.lines.length; index += 1) {
      const line = page.lines[index];
      const captionMatch = CAPTION_RE.exec(line.text.trim());
      if (!captionMatch) continue;

      const nextCaptionIndex = page.lines.findIndex((candidate, candidateIndex) => candidateIndex > index && CAPTION_RE.test(candidate.text.trim()));
      const sourceIndex = page.lines.findIndex((candidate, candidateIndex) => candidateIndex > index && SOURCE_RE.test(candidate.text.trim()));
      let endLineIndex = sourceIndex > -1 ? sourceIndex - 1 : page.lines.length - 1;
      if (nextCaptionIndex > -1) endLineIndex = Math.min(endLineIndex, nextCaptionIndex - 1);
      if (sourceIndex < 0) {
        const paragraphAfterVisual = page.lines.findIndex((candidate, candidateIndex) => {
          const text = candidate.text.trim();
          return candidateIndex > index + 1
            && text.length >= 58
            && candidate.left < line.left + 36
            && !/%/.test(text)
            && !/(discordo|concordo|totalmente|parcialmente|n\/a|afirma[çc][õo]es)/iu.test(text)
            && !CAPTION_RE.test(text)
            && !SOURCE_RE.test(text);
        });
        if (paragraphAfterVisual > -1) endLineIndex = paragraphAfterVisual - 1;
      }

      if (endLineIndex <= index) continue;
      const source = sourceIndex > -1 && sourceIndex <= endLineIndex + 1 ? page.lines[sourceIndex].text.trim() : undefined;
      const id = `layout-${page.pageNumber}-${regionIndex + 1}`;
      regions.push({
        id,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        startLineIndex: index + 1,
        endLineIndex,
        kind: kindFromCaption(line.text),
        caption: line.text.trim(),
        source,
        confidence: source ? "high" : "medium",
        reasons: [
          "Legenda visual identificada.",
          source ? "Fonte compativel encerra a regiao." : "Regiao encerrada antes de novo texto ou fim da pagina.",
          isContinuationCaption(line.text) ? "Legenda indica continuacao ou conclusao." : "",
        ].filter(Boolean),
        logicalVisualId: logicalIdFromCaption(line.text),
      });
      regionIndex += 1;
      if (nextCaptionIndex > -1 && nextCaptionIndex <= endLineIndex + 1) index = nextCaptionIndex - 1;
    }

    const alreadyCovered = new Set<number>();
    for (const region of regions.filter((region) => region.pageStart === page.pageNumber)) {
      for (let lineIndex = region.startLineIndex; lineIndex <= region.endLineIndex; lineIndex += 1) alreadyCovered.add(lineIndex);
    }
    const candidates = page.lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line, lineIndex }) => !alreadyCovered.has(lineIndex) && line.text.trim().length > 0 && line.text.trim().length <= 46);
    const distinctLefts = new Set(candidates.map(({ line }) => Math.round(line.left / 28) * 28));
    if (candidates.length >= 8 && distinctLefts.size >= 3 && !pageLooksPretextual(page) && !pageLooksReferences(page)) {
      const first = candidates[0].lineIndex;
      const last = candidates[candidates.length - 1].lineIndex;
      regions.push({
        id: `layout-${page.pageNumber}-multicolumn`,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        startLineIndex: first,
        endLineIndex: last,
        kind: "multicolumn",
        confidence: "low",
        reasons: ["Linhas curtas com multiplas margens sugerem regiao multicoluna."],
      });
    }
  }
  return bridgeMultiPageRegions(regions, pages);
}

function regionForLine(entry: LineRef, regions: PdfLayoutSensitiveRegionDiagnostic[]): PdfLayoutSensitiveRegionDiagnostic | undefined {
  return regions.find((region) => (
    entry.pageNumber >= region.pageStart
    && entry.pageNumber <= region.pageEnd
    && entry.lineIndex >= region.startLineIndex
    && entry.lineIndex <= region.endLineIndex
  ));
}

function isObviousHeadingText(text: string): boolean {
  return (NUMBERED_INTRODUCTION.test(text) || HEADING_RE.test(text) || NUMBERED_HEADING_RE.test(text))
    && text.length <= 120
    && !/^\d+\s+\d{4}\b/.test(text);
}

function baseClassifyLines(pages: PdfPageDiagnostic[], regions: PdfLayoutSensitiveRegionDiagnostic[]): ClassifiedLine[] {
  const lines = flattenPages(pages);
  const pageNumberCandidates = lines.filter(isIsolatedPageNumberCandidate);
  const repeatedRoles = repeatedEdgeRoles(lines);

  return lines.map((entry) => {
    const key = `${entry.pageNumber}:${entry.lineIndex}`;
    if (isIsolatedPageNumberCandidate(entry) && isPlausiblePageSequence(entry, pageNumberCandidates)) {
      return { ...entry, role: "page-number", confidence: "high", reasons: ["Numero de pagina isolado em sequencia plausivel."] };
    }
    const repeatedRole = repeatedRoles.get(key);
    if (repeatedRole) return { ...entry, role: repeatedRole, confidence: "high", reasons: ["Linha repetida em borda de pagina."] };
    if (CAPTION_RE.test(entry.text)) return { ...entry, role: "caption", confidence: "high", reasons: ["Legenda visual detectada."] };
    if (SOURCE_RE.test(entry.text)) return { ...entry, role: "source", confidence: "high", reasons: ["Linha iniciada por Fonte:."] };
    const region = regionForLine(entry, regions);
    if (region) return { ...entry, role: "layout-sensitive", confidence: region.confidence, reasons: region.reasons, layoutRegionId: region.id };
    if (LIST_ITEM_RE.test(entry.text)) return { ...entry, role: "list-item", confidence: "medium", reasons: ["Padrao conservador de item de lista detectado."] };
    if (isObviousHeadingText(entry.text)) return { ...entry, role: "heading", confidence: NUMBERED_HEADING_RE.test(entry.text) ? "high" : "medium", reasons: ["Padrao textual de titulo detectado."] };
    return { ...entry, role: "body", confidence: "medium", reasons: [] };
  });
}

function lineGap(previous: LineRef, next: LineRef): number {
  if (previous.pageNumber !== next.pageNumber) return 0;
  return next.line.top - previous.line.bottom;
}

function calculateBodyLayoutMetrics(classified: ClassifiedLine[]): PdfBodyLayoutMetrics {
  const usable = classified.filter((entry) => (
    entry.role === "body"
    && !pageLooksPretextual(entry.page)
    && entry.text.length >= 35
    && entry.line.height > 0
  ));
  const lefts = usable.map((entry) => entry.line.left);
  const rights = usable.map((entry) => entry.line.right);
  const heights = usable.map((entry) => entry.line.height);
  const dominantLeft = roundedMode(lefts);
  const dominantRight = roundedMode(rights);
  const probableBodyFontHeight = median(heights);
  const gaps: number[] = [];
  for (let index = 1; index < usable.length; index += 1) {
    const previous = usable[index - 1];
    const current = usable[index];
    const gap = lineGap(previous, current);
    if (previous.pageNumber === current.pageNumber && gap >= 0 && gap <= Math.max(28, probableBodyFontHeight * 2.5)) gaps.push(gap);
  }
  const indents = lefts
    .filter((left) => left > dominantLeft + 8 && left <= dominantLeft + 96)
    .map((left) => left - dominantLeft);
  return {
    dominantLeft,
    dominantRight,
    medianLineHeight: probableBodyFontHeight,
    medianLineGap: median(gaps) || probableBodyFontHeight * 0.5,
    probableFirstLineIndent: roundedMode(indents, 4),
    probableBodyFontHeight,
    confidence: usable.length >= 40 ? "high" : usable.length >= 10 ? "medium" : "low",
  };
}

function bodyLikeAfter(lines: ClassifiedLine[], index: number): boolean {
  const next = lines.slice(index + 1).find((entry) => !["page-number", "repeated-header", "repeated-footer"].includes(entry.role));
  if (!next || next.role !== "body") return false;
  return next.text.length >= 45;
}

export function detectPdfBodyStartContextual(pages: PdfPageDiagnostic[], classified?: ClassifiedLine[]): PdfBodyStartDiagnostic {
  const effectiveClassified = classified ?? baseClassifyLines(pages, findLayoutRegions(pages));
  for (const [index, entry] of effectiveClassified.entries()) {
    const numbered = NUMBERED_INTRODUCTION.test(entry.text);
    const unnumbered = UNNUMBERED_INTRODUCTION.test(entry.text);
    if (!numbered && !unnumbered) continue;
    if (pageLooksPretextual(entry.page) || entry.page.lines.slice(0, entry.lineIndex).some((line) => /SUM[ÁA]RIO/i.test(line.text))) {
      continue;
    }
    if (!bodyLikeAfter(effectiveClassified, index)) continue;
    return {
      found: true,
      pageNumber: entry.pageNumber,
      lineIndex: entry.lineIndex,
      text: entry.text,
      matchType: numbered ? "numbered-introduction" : "unnumbered-introduction",
      reason: "Titulo de introducao seguido por texto corrido.",
    };
  }
  return { found: false, reason: "Nenhum titulo de introducao com contexto de corpo textual foi localizado." };
}

function terminalPunctuation(text: string): boolean {
  return /[.!?;:]["')\]]?$/.test(text.trim());
}

function isMixedCase(text: string): boolean {
  return /[a-záàâãéêíóôõúüç]/u.test(text) && /[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/u.test(text);
}

function lineFontName(entry: LineRef): string {
  return entry.line.items.find((item) => item.fontName)?.fontName ?? "";
}

function lineLooksBold(entry: LineRef): boolean {
  return /bold|black|semibold|demi/i.test(lineFontName(entry));
}

function isSummaryEntry(entry: ClassifiedLine): boolean {
  return pageLooksPretextual(entry.page) || /\.{2,}\s*\d+\s*$/.test(entry.text);
}

function isCitationLike(entry: ClassifiedLine, metrics: PdfBodyLayoutMetrics): boolean {
  return entry.line.left > metrics.dominantLeft + Math.max(40, metrics.probableFirstLineIndent + 12) && entry.text.length > 45;
}

function classifyHeadingsWithMetrics(classified: ClassifiedLine[], metrics: PdfBodyLayoutMetrics): ClassifiedLine[] {
  return classified.map((entry, index) => {
    if (entry.role !== "body" && entry.role !== "heading") return entry;
    if (isSummaryEntry(entry) || isCitationLike(entry, metrics) || /^\d+\s+\d{4}\b/.test(entry.text) || /^\d{4}[.,]?\s+\S/.test(entry.text)) {
      return entry.role === "heading" ? { ...entry, role: "body", confidence: "medium", reasons: [] } : entry;
    }

    const previous = classified.slice(0, index).reverse().find((candidate) => !["page-number", "repeated-header", "repeated-footer"].includes(candidate.role));
    const next = classified.slice(index + 1).find((candidate) => !["page-number", "repeated-header", "repeated-footer"].includes(candidate.role));
    const previousGap = previous && previous.pageNumber === entry.pageNumber ? entry.line.top - previous.line.bottom : metrics.medianLineGap;
    const nextGap = next && next.pageNumber === entry.pageNumber ? next.line.top - entry.line.bottom : metrics.medianLineGap;
    const short = entry.text.length >= 3 && entry.text.length <= 95;
    const noParagraphEnd = !terminalPunctuation(entry.text);
    const nearBodyColumn = Math.abs(entry.line.left - metrics.dominantLeft) <= Math.max(36, metrics.probableFirstLineIndent + 18)
      || Math.abs(((entry.line.left + entry.line.right) / 2) - ((entry.page.width || 595) / 2)) <= 70;
    const largerOrBold = entry.line.height >= metrics.probableBodyFontHeight * 1.08 || lineLooksBold(entry);
    const spaced = previousGap >= Math.max(metrics.medianLineGap * 1.35, metrics.medianLineHeight * 0.8)
      || nextGap >= Math.max(metrics.medianLineGap * 1.2, metrics.medianLineHeight * 0.65);
    const followedByBody = next?.role === "body" && next.text.length >= 35;
    const followedByHeadingCandidate = next?.role === "body"
      && next.text.length <= 80
      && !terminalPunctuation(next.text)
      && (lineLooksBold(next) || next.line.height >= metrics.probableBodyFontHeight * 1.08);
    const previousIsHeading = previous?.role === "heading";
    const looksLikeSentence = /\s/.test(entry.text)
      && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇA-Z]/u.test(entry.text)
      && /[a-záàâãéêíóôõúüç]/u.test(entry.text)
      && entry.text.length > 32;
    const numbered = NUMBERED_HEADING_RE.test(entry.text);
    const upper = HEADING_RE.test(entry.text);

    if ((numbered || upper) && short && nearBodyColumn) {
      return {
        ...entry,
        role: "heading",
        confidence: numbered || (largerOrBold && followedByBody) ? "high" : "medium",
        reasons: [numbered ? "Padrao numerico de secao." : "Titulo em caixa alta ou estrutural.", followedByBody ? "Linha seguinte parece corpo." : ""].filter(Boolean),
      };
    }
    if (short && noParagraphEnd && nearBodyColumn && (followedByBody || followedByHeadingCandidate) && (largerOrBold || (spaced && !previousIsHeading && !looksLikeSentence))) {
      return {
        ...entry,
        role: "heading",
        confidence: largerOrBold && spaced ? "high" : "medium",
        reasons: ["Titulo em caixa mista inferido por geometria e contexto."],
      };
    }
    return entry.role === "heading" ? { ...entry, role: "body", confidence: "medium", reasons: [] } : entry;
  });
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
    layoutRegionId: entry.layoutRegionId,
  };
}

function compatibleFont(previous: ClassifiedLine, next: ClassifiedLine, metrics: PdfBodyLayoutMetrics): boolean {
  const previousFont = lineFontName(previous);
  const nextFont = lineFontName(next);
  const fontCompatible = !previousFont || !nextFont || previousFont === nextFont;
  const heightCompatible = Math.abs(previous.line.height - next.line.height) <= Math.max(3, metrics.medianLineHeight * 0.35);
  return fontCompatible && heightCompatible;
}

function isNearBodyLeft(entry: ClassifiedLine, metrics: PdfBodyLayoutMetrics): boolean {
  return Math.abs(entry.line.left - metrics.dominantLeft) <= Math.max(18, metrics.probableFirstLineIndent * 0.5);
}

function isFirstLineIndent(entry: ClassifiedLine, metrics: PdfBodyLayoutMetrics): boolean {
  if (!metrics.probableFirstLineIndent) return false;
  return Math.abs(entry.line.left - (metrics.dominantLeft + metrics.probableFirstLineIndent)) <= Math.max(10, metrics.probableFirstLineIndent * 0.35);
}

function looksLikeFirstLineReturningToBody(previous: ClassifiedLine, next: ClassifiedLine, currentParagraph: PdfReconstructedBlockDiagnostic | null, metrics: PdfBodyLayoutMetrics): boolean {
  if (currentParagraph?.sourceLines.length !== 1 || previous.pageNumber !== next.pageNumber) return false;
  const inferredIndent = previous.line.left - next.line.left;
  const metricIndent = isFirstLineIndent(previous, metrics) && isNearBodyLeft(next, metrics);
  return metricIndent || (inferredIndent >= 16 && inferredIndent <= 96 && !terminalPunctuation(previous.text));
}

function canJoinBodyLine(previous: ClassifiedLine, next: ClassifiedLine, currentParagraph: PdfReconstructedBlockDiagnostic | null, metrics: PdfBodyLayoutMetrics): { join: boolean; reason: string } {
  if (next.role !== "body") return { join: false, reason: "Separado por separador estrutural." };
  if (!compatibleFont(previous, next, metrics)) return { join: false, reason: "Separado por diferenca de fonte ou altura." };

  if (previous.pageNumber !== next.pageNumber) {
    const previousNearEnd = previous.relativeBottom >= 0.78;
    const nextNearStart = next.relativeTop <= 0.25;
    const marginCompatible = Math.abs(previous.line.left - next.line.left) <= Math.max(24, metrics.probableFirstLineIndent + 12);
    if (previousNearEnd && nextNearStart && marginCompatible && !terminalPunctuation(previous.text)) {
      return { join: true, reason: "Paragrafo unido atraves de quebra de pagina." };
    }
    return { join: false, reason: previousNearEnd ? "Separado por inicio de pagina sem continuidade segura." : "Separado porque a linha anterior termina longe do rodape." };
  }

  const verticalGap = lineGap(previous, next);
  const normalGapLimit = Math.max(metrics.medianLineGap * 1.8, metrics.medianLineHeight * 1.7, 22);
  if (verticalGap > normalGapLimit) return { join: false, reason: "Separado por intervalo vertical ampliado." };

  const sameColumn = Math.abs(previous.line.left - next.line.left) <= Math.max(20, metrics.probableFirstLineIndent * 0.45);
  const firstLineReturnsToBody = looksLikeFirstLineReturningToBody(previous, next, currentParagraph, metrics);
  if (!sameColumn && !firstLineReturnsToBody) return { join: false, reason: "Separado por mudanca de coluna." };
  if (currentParagraph && currentParagraph.sourceLines.length > 0 && isFirstLineIndent(next, metrics) && !firstLineReturnsToBody) {
    return { join: false, reason: "Separado por recuo provavel de primeira linha." };
  }
  return { join: true, reason: firstLineReturnsToBody ? "Unido por retorno da primeira linha recuada a margem do corpo." : "Unido por continuidade na margem do corpo." };
}

function appendLineText(current: string, next: string, entry: ClassifiedLine, hyphenation: PdfHyphenationDiagnostic[], reasons: string[]): string {
  if (!/-$/.test(current)) return `${current} ${next}`;
  const originalEnd = current.slice(Math.max(0, current.length - 24));
  const nextStart = next.slice(0, 24);
  const previousToken = current.split(/\s+/).pop() ?? current;
  const lowerNext = /^[a-záàâãéêíóôõúüç]/u.test(next);
  const digitOrUpper = /(?:\d|[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])-$/.test(previousToken);
  const compoundPrefix = COMPOUND_PREFIX_RE.test(previousToken);
  const uncertainPrefix = /(?:^|\s)(inter|intra|multi|semi|super)-$/iu.test(previousToken);
  if (lowerNext && !digitOrUpper && !compoundPrefix && !uncertainPrefix && previousToken.replace(/-$/, "").length >= 5) {
    hyphenation.push({
      pageNumber: entry.pageNumber,
      lineIndex: entry.lineIndex,
      originalEnd,
      nextStart,
      action: "joined-without-hyphen",
      reason: "Quebra de palavra recomposta com proximo fragmento minusculo.",
    });
    reasons.push("Hifenizacao conservadora recomposta entre linhas.");
    return `${current.slice(0, -1)}${next}`;
  }
  const action: PdfHyphenationDiagnostic["action"] = compoundPrefix || digitOrUpper ? "preserved-hyphen" : "uncertain";
  hyphenation.push({
    pageNumber: entry.pageNumber,
    lineIndex: entry.lineIndex,
    originalEnd,
    nextStart,
    action,
    reason: action === "preserved-hyphen" ? "Hifen preservado por padrao de composto, prefixo ou identificador." : "Hifen preservado por incerteza diagnostica.",
  });
  if (action === "uncertain") reasons.push("Hifenizacao incerta preservada.");
  return `${current}${next}`;
}

function combineHeadingLines(classified: ClassifiedLine[], startIndex: number, metrics: PdfBodyLayoutMetrics): { block: PdfReconstructedBlockDiagnostic; endIndex: number } {
  const first = classified[startIndex];
  const entries = [first];
  let index = startIndex + 1;
  while (index < classified.length) {
    const next = classified[index];
    const previous = entries[entries.length - 1];
    const afterNext = classified.slice(index + 1).find((candidate) => !["page-number", "repeated-header", "repeated-footer"].includes(candidate.role));
    const smallGap = previous.pageNumber === next.pageNumber && lineGap(previous, next) <= Math.max(metrics.medianLineGap * 1.4, metrics.medianLineHeight * 1.4, 22);
    const compatible = next.role === "heading"
      && smallGap
      && Math.abs(previous.line.left - next.line.left) <= Math.max(36, metrics.probableFirstLineIndent + 18)
      && compatibleFont(previous, next, metrics)
      && !terminalPunctuation(previous.text)
      && !(NUMBERED_HEADING_RE.test(previous.text) && NUMBERED_HEADING_RE.test(next.text))
      && (afterNext?.role === "body" || next.text.length <= 80);
    if (!compatible) break;
    entries.push(next);
    index += 1;
  }
  return {
    block: {
      type: "heading",
      text: entries.map((entry) => entry.text).join(" "),
      pageStart: first.pageNumber,
      pageEnd: entries[entries.length - 1].pageNumber,
      sourceLines: entries.map((entry) => ({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex })),
      confidence: entries.some((entry) => entry.confidence === "high") ? "high" : "medium",
      reasons: [
        ...new Set(entries.flatMap((entry) => entry.reasons)),
        entries.length > 1 ? "Titulo multilinha combinado por alinhamento, fonte e intervalo." : "",
      ].filter(Boolean),
    },
    endIndex: index - 1,
  };
}

function buildAlerts(blocks: PdfReconstructedBlockDiagnostic[], statistics: PdfTextReconstructionDiagnostic["statistics"], pageCount: number): string[] {
  const alerts: string[] = [];
  if (statistics.paragraphCount > 0 && statistics.singleLineParagraphCount / statistics.paragraphCount > 0.45) alerts.push("Quantidade elevada de paragrafos de uma linha.");
  if (pageCount >= 60 && statistics.headingCount < 12) alerts.push("Quantidade de titulos baixa para documento longo.");
  if (blocks.some((block) => block.type === "unresolved" && block.sourceLines.length > 45)) alerts.push("Bloco nao resolvido com texto excessivamente longo.");
  if (blocks.some((block) => block.type === "paragraph" && block.pageEnd - block.pageStart > 1)) alerts.push("Paragrafo atravessa mais de duas paginas.");
  if (blocks.length > 0 && statistics.lowConfidenceBlockCount / blocks.length > 0.2) alerts.push("Proporcao elevada de blocos de baixa confianca.");
  return alerts;
}

export function reconstructPdfParagraphBlocks(pages: PdfPageDiagnostic[]): PdfTextReconstructionDiagnostic {
  const layoutRegions = findLayoutRegions(pages);
  const baseClassified = baseClassifyLines(pages, layoutRegions);
  const initialMetrics = calculateBodyLayoutMetrics(baseClassified);
  const classified = classifyHeadingsWithMetrics(baseClassified, initialMetrics);
  const bodyLayoutMetrics = calculateBodyLayoutMetrics(classified);
  const bodyStart = detectPdfBodyStartContextual(pages, classified);
  const ignoredLines = classified
    .filter((entry) => ["page-number", "repeated-header", "repeated-footer"].includes(entry.role))
    .map((entry) => ({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex, role: entry.role, text: entry.text }));
  const startOrdinal = bodyStart.found
    ? classified.findIndex((entry) => entry.pageNumber === bodyStart.pageNumber && entry.lineIndex === bodyStart.lineIndex)
    : 0;
  const blocks: PdfReconstructedBlockDiagnostic[] = [];
  const hyphenation: PdfHyphenationDiagnostic[] = [];
  let currentParagraph: PdfReconstructedBlockDiagnostic | null = null;
  let previousBodyLine: ClassifiedLine | null = null;
  let pendingSeparationReason = "";

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
      const combined = combineHeadingLines(classified, index, bodyLayoutMetrics);
      blocks.push(combined.block);
      index = combined.endIndex;
      pendingSeparationReason = "";
      continue;
    }
    if (entry.role === "list-item") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "list-item", "medium", entry.reasons));
      pendingSeparationReason = "";
      continue;
    }
    if (entry.role === "caption") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "caption", "high", entry.reasons));
      pendingSeparationReason = "";
      continue;
    }
    if (entry.role === "source") {
      flushParagraph();
      blocks.push(blockFromLine(entry, "source", "high", entry.reasons));
      pendingSeparationReason = "";
      continue;
    }
    if (entry.role === "layout-sensitive") {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "unresolved" && last.pageEnd === entry.pageNumber && last.layoutRegionId === entry.layoutRegionId) {
        last.text = appendLineText(last.text, entry.text, entry, hyphenation, last.reasons);
        last.pageEnd = entry.pageNumber;
        last.sourceLines.push({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex });
      } else {
        blocks.push(blockFromLine(entry, "unresolved", "low", ["Conteudo marcado como sensivel a layout; nao foi convertido em paragrafo."]));
      }
      pendingSeparationReason = "";
      continue;
    }

    const joinDecision: { join: boolean; reason: string } = previousBodyLine
      ? canJoinBodyLine(previousBodyLine, entry, currentParagraph, bodyLayoutMetrics)
      : { join: false, reason: pendingSeparationReason };
    if (!currentParagraph || (previousBodyLine && !joinDecision.join)) {
      flushParagraph();
      currentParagraph = {
        type: "paragraph",
        text: entry.text,
        pageStart: entry.pageNumber,
        pageEnd: entry.pageNumber,
        sourceLines: [{ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex }],
        confidence: "medium",
        reasons: ["Linhas visuais compativeis foram unidas como paragrafo diagnostico.", joinDecision.reason || pendingSeparationReason].filter(Boolean),
      };
    } else {
      currentParagraph.text = appendLineText(currentParagraph.text, entry.text, entry, hyphenation, currentParagraph.reasons);
      currentParagraph.pageEnd = entry.pageNumber;
      currentParagraph.sourceLines.push({ pageNumber: entry.pageNumber, lineIndex: entry.lineIndex });
      currentParagraph.reasons.push(joinDecision.reason);
    }
    pendingSeparationReason = joinDecision.reason;
    previousBodyLine = entry;
  }
  flushParagraph();

  const paragraphLineCounts = blocks.filter((block) => block.type === "paragraph").map((block) => block.sourceLines.length);
  const statistics: PdfTextReconstructionDiagnostic["statistics"] = {
    paragraphCount: blocks.filter((block) => block.type === "paragraph").length,
    headingCount: blocks.filter((block) => block.type === "heading").length,
    listItemCount: blocks.filter((block) => block.type === "list-item").length,
    captionCount: blocks.filter((block) => block.type === "caption").length,
    sourceCount: blocks.filter((block) => block.type === "source").length,
    unresolvedCount: blocks.filter((block) => block.type === "unresolved").length,
    removedPageNumberCount: ignoredLines.filter((line) => line.role === "page-number").length,
    removedHeaderCount: ignoredLines.filter((line) => line.role === "repeated-header").length,
    removedFooterCount: ignoredLines.filter((line) => line.role === "repeated-footer").length,
    averageLinesPerParagraph: paragraphLineCounts.length ? Number((paragraphLineCounts.reduce((sum, count) => sum + count, 0) / paragraphLineCounts.length).toFixed(2)) : 0,
    medianLinesPerParagraph: median(paragraphLineCounts),
    singleLineParagraphCount: paragraphLineCounts.filter((count) => count === 1).length,
    multiPageParagraphCount: blocks.filter((block) => block.type === "paragraph" && block.pageEnd > block.pageStart).length,
    lowConfidenceBlockCount: blocks.filter((block) => block.confidence === "low").length,
    uncertainHyphenationCount: hyphenation.filter((entry) => entry.action === "uncertain").length,
    layoutRegionCount: layoutRegions.length,
    mixedCaseHeadingCount: blocks.filter((block) => block.type === "heading" && isMixedCase(block.text)).length,
    combinedHeadingCount: blocks.filter((block) => block.type === "heading" && block.sourceLines.length > 1).length,
  };

  return {
    blocks,
    ignoredLines,
    bodyStart,
    bodyLayoutMetrics,
    layoutRegions,
    hyphenation,
    alerts: buildAlerts(blocks, statistics, pages.length),
    statistics,
  };
}
