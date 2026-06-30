import {
  ACADEMIC_FIELD_KEYS,
  AcademicFieldKey,
  AcademicFields,
  Confidence,
  WorkType,
  WORK_TYPES,
  emptyAcademicFields,
  emptyConfidenceMap,
} from "./ufla-rules";
import {
  DocxStructure,
  ImportedBlock,
  normalizeForDetection,
} from "./word-structure-extractor";

export interface FieldDetectionResult {
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  editorText: string;
  messages: string[];
}

interface TextLine {
  text: string;
  block: ImportedBlock;
  index: number;
}

const TITLE_STOP_WORDS = new Set(["LAVRAS", "LAVRAS - MG"]);
const GENERIC_COVER_WORDS = new Set([
  "UNIVERSIDADE FEDERAL DE LAVRAS",
  "UFLA",
  "AUTOR",
  "TITULO",
  "LOCAL",
  "ANO",
]);

function cleanValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function joinLines(lines: string[]): string {
  return lines.map(cleanValue).filter(Boolean).join("\n").trim();
}

function blockText(block: ImportedBlock): string {
  if (block.type === "pageBreak") return "";
  if (block.type === "image") {
    return `[Imagem detectada: ${block.relationshipId ?? "sem relacao"}]`;
  }
  if (block.type === "table") {
    return block.rows.map((row) => row.join("\t")).join("\n");
  }
  return block.text;
}

function blockLines(blocks: ImportedBlock[]): TextLine[] {
  return blocks
    .map((block, index) => ({ block, index, text: blockText(block).trim() }))
    .filter((line) => line.text);
}

function headingBase(text: string): string {
  return normalizeForDetection(text).replace(/^\d+(?:\.\d+)*\s*/, "");
}

function isPageHeading(block: ImportedBlock, targets: string[]): boolean {
  const normalized = headingBase(blockText(block));
  const normalizedTargets = targets.map(normalizeForDetection);
  return normalizedTargets.includes(normalized);
}

function looksLikePrimaryHeading(block: ImportedBlock, text = blockText(block)): boolean {
  const normalized = normalizeForDetection(text);
  return (
    (block.type === "heading" && block.level <= 1) ||
    /^\d+\s+\S+/.test(normalized) ||
    [
      "REFERENCIAS",
      "ANEXOS",
      "APENDICES",
      "CONCLUSAO",
      "CONSIDERACOES FINAIS",
    ].includes(headingBase(text))
  );
}

function isReferenceHeading(block: ImportedBlock): boolean {
  return isPageHeading(block, ["REFERENCIAS", "REFERÊNCIAS"]);
}

function isAnnexHeading(block: ImportedBlock): boolean {
  const normalized = headingBase(blockText(block));
  return normalized === "ANEXOS" || /^ANEXO\s+[A-Z0-9]/.test(normalized);
}

function isAppendixHeading(block: ImportedBlock): boolean {
  const normalized = headingBase(blockText(block));
  return normalized === "APENDICES" || /^APENDICE\s+[A-Z0-9]/.test(normalized);
}

function findHeadingIndex(
  blocks: ImportedBlock[],
  predicate: (block: ImportedBlock) => boolean,
): number {
  return blocks.findIndex((block) => predicate(block));
}

function textFromBlockForSection(block: ImportedBlock): string {
  if (block.type === "pageBreak") return "";
  if (block.type === "image") {
    return `[Imagem detectada: ${block.relationshipId ?? "sem relacao"}]`;
  }
  if (block.type === "table") {
    return block.rows.map((row) => row.join("\t")).join("\n");
  }
  return block.text;
}

function collectAfterHeading(
  blocks: ImportedBlock[],
  startIndex: number,
  shouldStop: (block: ImportedBlock) => boolean,
  includeHeadingAtStart = false,
): string {
  if (startIndex < 0) return "";
  const collected: string[] = [];

  if (includeHeadingAtStart) {
    const startText = textFromBlockForSection(blocks[startIndex]).trim();
    if (startText) collected.push(startText);
  }

  for (let index = startIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (shouldStop(block)) break;

    const text = textFromBlockForSection(block).trim();
    if (text) collected.push(text);
  }

  return joinLines(collected);
}

function findByLabel(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanValue(match[1]);
  }
  return "";
}

function detectWorkType(text: string): WorkType | "" {
  const normalized = normalizeForDetection(text);
  if (/\bTESE\b/.test(normalized)) return "tese";
  if (/\bDISSERTACAO\b/.test(normalized)) return "dissertacao";
  if (/\bMONOGRAFIA\b|\bTCC\b/.test(normalized)) return "monografia";
  if (/\bARTIGO\b/.test(normalized)) return "artigo";
  return "";
}

function isYear(value: string): boolean {
  return /^(19|20)\d{2}$/.test(value.trim());
}

function isLocation(value: string): boolean {
  const normalized = normalizeForDetection(value);
  return TITLE_STOP_WORDS.has(normalized) || /^LAVRAS\b/.test(normalized);
}

function isGenericCoverLine(value: string): boolean {
  const normalized = normalizeForDetection(value);
  return GENERIC_COVER_WORDS.has(normalized) || normalized.length < 2;
}

function isLikelyAuthorName(value: string): boolean {
  const normalized = normalizeForDetection(value);
  if (normalized === "NOME E SOBRENOME DO AUTOR") return true;
  if (isGenericCoverLine(value) || isLocation(value) || isYear(value)) return false;
  if (/[:;]|\d/.test(value)) return false;
  if (
    /\b(RESUMO|ABSTRACT|REFERENCIAS|INTRODUCAO|ANEXOS|APENDICES|SUMARIO)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 8;
}

function countTextOccurrences(lines: string[], value: string): number {
  const target = normalizeForDetection(value);
  return lines.filter((line) => normalizeForDetection(line) === target).length;
}

function coverTextLines(blocks: ImportedBlock[]): string[] {
  const firstBreak = blocks.findIndex((block) => block.type === "pageBreak");
  const coverBlocks = firstBreak >= 0 ? blocks.slice(0, firstBreak) : blocks.slice(0, 20);
  return blockLines(coverBlocks)
    .map((line) => line.text)
    .filter((line) => !line.startsWith("[Imagem detectada"));
}

function detectAuthorFromCover(blocks: ImportedBlock[], allLines: string[]): {
  value: string;
  confidence: Confidence;
} {
  const coverLines = coverTextLines(blocks);
  const candidate = coverLines.find(isLikelyAuthorName) ?? "";
  if (!candidate) return { value: "", confidence: "nao-identificado" };

  const occurrences = countTextOccurrences(allLines, candidate);
  return {
    value: candidate,
    confidence: occurrences > 1 ? "alta" : "media",
  };
}

function detectTitleFromCover(
  blocks: ImportedBlock[],
  author: string,
  allLines: string[],
): { value: string; confidence: Confidence } {
  const coverLines = coverTextLines(blocks);
  const authorIndex = author
    ? coverLines.findIndex(
        (line) => normalizeForDetection(line) === normalizeForDetection(author),
      )
    : -1;
  const titleLines: string[] = [];
  const startIndex = authorIndex >= 0 ? authorIndex + 1 : 0;

  for (let index = startIndex; index < coverLines.length; index += 1) {
    const line = coverLines[index];
    if (!line || isLocation(line) || isYear(line)) break;
    if (isGenericCoverLine(line)) continue;
    titleLines.push(line);
  }

  const value = cleanValue(titleLines.join(" "));
  if (!value) return { value: "", confidence: "nao-identificado" };

  return {
    value,
    confidence: countTextOccurrences(allLines, value) > 1 ? "alta" : "media",
  };
}

function findFollowingLabel(lines: string[], labels: string[]): string {
  const normalizedLabels = labels.map(normalizeForDetection);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = normalizeForDetection(line);
    const inlineLabel = normalizedLabels.find((label) => normalized.startsWith(`${label}:`));
    if (inlineLabel) {
      return cleanValue(line.slice(line.indexOf(":") + 1));
    }

    if (normalizedLabels.includes(normalized)) {
      const nextLine = lines[index + 1] ?? "";
      if (nextLine && !isPageHeading({ type: "paragraph", text: nextLine, rawText: nextLine, runs: [{ text: nextLine }] }, labels)) {
        return cleanValue(nextLine);
      }
    }
  }

  return "";
}

function detectWorkNature(lines: string[]): string {
  return (
    lines.find((line) =>
      /apresentad[ao]\s+[aà]\s+universidade|obten[cç][aã]o\s+do\s+t[ií]tulo/i.test(
        line,
      ),
    ) ?? ""
  );
}

function splitResumo(blocks: ImportedBlock[]): {
  resumo: string;
  palavrasChave: string;
} {
  const start = findHeadingIndex(blocks, (block) => isPageHeading(block, ["RESUMO"]));
  if (start < 0) return { resumo: "", palavrasChave: "" };

  const collected: string[] = [];
  let palavrasChave = "";

  for (let index = start + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = textFromBlockForSection(block).trim();
    if (!text) continue;

    const keywordMatch = text.match(/^palavras[- ]chave\s*[:\-]\s*(.+)$/i);
    if (keywordMatch?.[1]) {
      palavrasChave = cleanValue(keywordMatch[1]);
      break;
    }

    if (
      isPageHeading(block, ["ABSTRACT", "SUMARIO", "SUMÁRIO"]) ||
      (looksLikePrimaryHeading(block, text) && collected.length)
    ) {
      break;
    }

    collected.push(text);
  }

  return { resumo: joinLines(collected), palavrasChave };
}

function splitAbstract(blocks: ImportedBlock[]): {
  abstractText: string;
  keywords: string;
} {
  const start = findHeadingIndex(blocks, (block) => isPageHeading(block, ["ABSTRACT"]));
  if (start < 0) return { abstractText: "", keywords: "" };

  const collected: string[] = [];
  let keywords = "";

  for (let index = start + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = textFromBlockForSection(block).trim();
    if (!text) continue;

    const keywordMatch = text.match(/^keywords\s*[:\-]\s*(.+)$/i);
    if (keywordMatch?.[1]) {
      keywords = cleanValue(keywordMatch[1]);
      break;
    }

    if (
      isPageHeading(block, [
        "INDICADORES DE IMPACTO",
        "IMPACT INDICATORS",
        "SUMARIO",
        "SUMÁRIO",
        "INTRODUCAO",
        "INTRODUÇÃO",
      ]) ||
      /^1\s+INTRODUCAO$/.test(normalizeForDetection(text))
    ) {
      break;
    }

    collected.push(text);
  }

  return { abstractText: joinLines(collected), keywords };
}

function findIntroductionIndex(blocks: ImportedBlock[]): number {
  return findHeadingIndex(blocks, (block) => {
    const normalized = normalizeForDetection(blockText(block));
    return normalized === "1 INTRODUCAO" || headingBase(blockText(block)) === "INTRODUCAO";
  });
}

function collectIntroduction(blocks: ImportedBlock[]): string {
  const start = findIntroductionIndex(blocks);
  if (start < 0) return "";
  return collectAfterHeading(blocks, start, (block) => {
    const normalized = normalizeForDetection(blockText(block));
    return (
      /^2\s+\S+/.test(normalized) ||
      isReferenceHeading(block) ||
      isAnnexHeading(block) ||
      isAppendixHeading(block)
    );
  });
}

function collectConclusion(blocks: ImportedBlock[]): string {
  const start = findHeadingIndex(blocks, (block) =>
    isPageHeading(block, ["CONCLUSAO", "CONCLUSÃO", "CONSIDERACOES FINAIS", "CONSIDERAÇÕES FINAIS"]),
  );
  if (start < 0) return "";
  return collectAfterHeading(blocks, start, (block) => isReferenceHeading(block));
}

function collectReferences(blocks: ImportedBlock[]): string {
  const start = findHeadingIndex(blocks, isReferenceHeading);
  return collectAfterHeading(blocks, start, (block) => isAnnexHeading(block) || isAppendixHeading(block));
}

function collectAnnexes(blocks: ImportedBlock[]): string {
  const start = findHeadingIndex(blocks, isAnnexHeading);
  return collectAfterHeading(blocks, start, isAppendixHeading);
}

function collectAppendices(blocks: ImportedBlock[]): string {
  const start = findHeadingIndex(blocks, isAppendixHeading);
  return collectAfterHeading(blocks, start, () => false);
}

function collectPreTextualSection(blocks: ImportedBlock[], headings: string[]): string {
  const start = findHeadingIndex(blocks, (block) => isPageHeading(block, headings));
  return collectAfterHeading(blocks, start, (block) => {
    if (block.type === "pageBreak") return false;
    if (!looksLikePrimaryHeading(block)) return false;
    const normalized = headingBase(blockText(block));
    return !headings.map(normalizeForDetection).includes(normalized);
  });
}

function blocksToEditorText(blocks: ImportedBlock[]): string {
  const start = findIntroductionIndex(blocks);
  if (start < 0) return "";

  const lines: string[] = [];
  for (let index = start; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (isReferenceHeading(block) || isAnnexHeading(block) || isAppendixHeading(block)) break;
    if (block.type === "pageBreak") continue;

    if (block.type === "heading") {
      lines.push(`${block.level <= 1 ? "#" : "##"} ${block.text}`);
      continue;
    }

    if (block.type === "longQuote") {
      lines.push(`> ${block.text}`);
      continue;
    }

    const text = textFromBlockForSection(block).trim();
    if (text) lines.push(text);
  }

  return lines.join("\n\n").trim();
}

function structureFromText(text: string): DocxStructure {
  const blocks: ImportedBlock[] = text
    .split(/\r?\n/)
    .map((line): ImportedBlock | undefined => {
      const trimmed = line.trim();
      if (!trimmed) return undefined;
      const normalized = normalizeForDetection(trimmed);
      const isHeading =
        /^(\d+(?:\.\d+)*)\s+\S+/.test(normalized) ||
        [
          "RESUMO",
          "ABSTRACT",
          "REFERENCIAS",
          "ANEXOS",
          "APENDICES",
          "INTRODUCAO",
        ].includes(headingBase(trimmed));

      if (isHeading) {
        return {
          type: "heading",
          level: normalized.match(/^\d+\.\d+\s+/) ? 2 : 1,
          text: trimmed,
          rawText: trimmed,
          runs: [{ text: trimmed }],
        };
      }

      return { type: "paragraph", text: trimmed, rawText: trimmed, runs: [{ text: trimmed }] };
    })
    .filter((block): block is ImportedBlock => Boolean(block));

  return {
    blocks,
    paragraphs: [],
    images: [],
    relationships: {},
    styleNames: {},
    text,
    hasNumbering: false,
  };
}

function markConfidence(
  confidence: Record<AcademicFieldKey, Confidence>,
  key: AcademicFieldKey,
  value: string,
  level: Confidence,
): void {
  confidence[key] = value ? level : "nao-identificado";
}

export function detectAcademicFieldsFromStructure(
  structure: DocxStructure,
): FieldDetectionResult {
  const fields = emptyAcademicFields();
  const confidence = emptyConfidenceMap();
  const lines = blockLines(structure.blocks).map((line) => line.text);
  const text = structure.text || lines.join("\n");
  const messages: string[] = [];

  const detectedWorkType = detectWorkType(text);
  if (detectedWorkType && WORK_TYPES.includes(detectedWorkType)) {
    fields.workType = detectedWorkType;
  }

  fields.author = findByLabel(text, [/^\s*(?:autor(?:a)?|discente|aluno(?:a)?)\s*[:\-]\s*(.+)$/im]);
  fields.title = findByLabel(text, [/^\s*t[íi]tulo\s*[:\-]\s*(.+)$/im]);
  fields.subtitle = findByLabel(text, [/^\s*subt[íi]tulo\s*[:\-]\s*(.+)$/im]);
  fields.course = findByLabel(text, [/^\s*curso\s*[:\-]\s*(.+)$/im]);
  fields.program = findByLabel(text, [/^\s*programa\s*[:\-]\s*(.+)$/im]);
  fields.location = findByLabel(text, [/^\s*(?:local|cidade)\s*[:\-]\s*(.+)$/im]);
  fields.year = findByLabel(text, [/^\s*ano\s*[:\-]\s*((?:19|20)\d{2})\s*$/im]);

  for (const key of ACADEMIC_FIELD_KEYS) {
    if (fields[key]) {
      confidence[key] = "alta";
    }
  }

  const coverAuthor = detectAuthorFromCover(structure.blocks, lines);
  if (!fields.author && coverAuthor.value) {
    fields.author = coverAuthor.value;
    confidence.author = coverAuthor.confidence;
  }

  const coverTitle = detectTitleFromCover(structure.blocks, fields.author, lines);
  if (!fields.title && coverTitle.value) {
    fields.title = coverTitle.value;
    confidence.title = coverTitle.confidence;
  }

  if (!fields.location) {
    fields.location = coverTextLines(structure.blocks).find(isLocation) ?? "";
  }

  if (!fields.year) {
    const years = text.match(/\b(19|20)\d{2}\b/g) ?? [];
    fields.year = years.length ? years[years.length - 1] : "";
  }

  fields.advisor =
    findByLabel(text, [/^\s*orientador(?:a)?\s*[:\-]\s*(.+)$/im]) ||
    findFollowingLabel(lines, ["Orientador", "Orientadora"]);
  fields.coadvisor =
    findByLabel(text, [/^\s*coorientador(?:a)?\s*[:\-]\s*(.+)$/im]) ||
    findFollowingLabel(lines, ["Coorientador", "Coorientadora"]);
  fields.workNature = detectWorkNature(lines);

  if (!fields.program && fields.workNature) {
    fields.program =
      fields.workNature.match(/programa de p[óo]s-gradua[cç][aã]o em ([^,]+)/i)?.[1]?.trim() ?? "";
  }

  const resumo = splitResumo(structure.blocks);
  fields.resumo = resumo.resumo;
  fields.palavrasChave = resumo.palavrasChave;

  const abstract = splitAbstract(structure.blocks);
  fields.abstractText = abstract.abstractText;
  fields.keywords = abstract.keywords;

  fields.introducao = collectIntroduction(structure.blocks);
  fields.conclusao = collectConclusion(structure.blocks);
  fields.referencias = collectReferences(structure.blocks);
  fields.anexos = collectAnnexes(structure.blocks);
  fields.apendices = collectAppendices(structure.blocks);
  fields.agradecimentos = collectPreTextualSection(structure.blocks, ["AGRADECIMENTOS"]);
  fields.indicadoresImpacto = collectPreTextualSection(structure.blocks, [
    "INDICADORES DE IMPACTO",
  ]);
  fields.impactIndicators = collectPreTextualSection(structure.blocks, ["IMPACT INDICATORS"]);

  const imageBlocks = structure.blocks.filter((block) => block.type === "image");
  if (imageBlocks.length) {
    fields.imageWarnings = `${imageBlocks.length} imagem(ns) detectada(s). Textos e legendas foram preservados; confira imagens antes da versão final.`;
    messages.push(fields.imageWarnings);
  }

  for (const key of ACADEMIC_FIELD_KEYS) {
    if (confidence[key] !== "nao-identificado") continue;
    markConfidence(
      confidence,
      key,
      fields[key],
      fields[key] ? (["resumo", "abstractText", "introducao", "referencias"].includes(key) ? "alta" : "media") : "nao-identificado",
    );
  }

  return {
    fields,
    confidence,
    editorText: blocksToEditorText(structure.blocks),
    messages,
  };
}

export function detectAcademicFieldsFromText(text: string): FieldDetectionResult {
  return detectAcademicFieldsFromStructure(structureFromText(text));
}
