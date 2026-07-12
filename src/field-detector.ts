import {
  ACADEMIC_FIELD_KEYS,
  AcademicFieldKey,
  AcademicFields,
  Confidence,
  WorkType,
  WORK_TYPES,
  emptyAcademicFields,
  emptyConfidenceMap,
  isCpgWork,
} from "./ufla-rules";
import {
  ACADEMIC_PRODUCTION_TYPES,
} from "./academic-production-types";
import {
  DocxStructure,
  ImportedBlock,
  normalizeForDetection,
} from "./word-structure-extractor";
import { getSectionKeyFromTitle, isEquivalentSectionTitle } from "./section-aliases";

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

const INSTITUTIONAL_TERMS = new Set([
  "UNIVERSIDADE",
  "UNIVERSIDADE FEDERAL",
  "UFLA",
  "INSTITUTO",
  "INSTITUTO DE CIÊNCIAS",
  "INSTITUTO DE CIENCIAS",
  "DEPARTAMENTO",
  "FACULDADE",
  "ESCOLA",
  "PROGRAMA",
  "PROGRAMA DE PÓS-GRADUAÇÃO",
  "PROGRAMA DE POS-GRADUACAO",
  "PÓS-GRADUAÇÃO",
  "POS-GRADUACAO",
  "GRADUAÇÃO",
  "GRADUACAO",
  "CURSO",
  "ÁREA DE CONCENTRAÇÃO",
  "AREA DE CONCENTRACAO",
  "LINHA DE PESQUISA",
  "LAVRAS",
  "MINAS GERAIS",
  "MG",
  "BRASIL",
  "FICHA CATALOGRÁFICA",
  "FICHA CATALOGRAFICA",
  "RESUMO",
  "ABSTRACT",
  "SUMÁRIO",
  "SUMARIO",
  "ORIENTADOR",
  "ORIENTADORA",
  "COORIENTADOR",
  "COORIENTADORA",
]);

const GENERIC_COVER_WORDS = new Set([
  "UNIVERSIDADE FEDERAL DE LAVRAS",
  "UFLA",
  "AUTOR",
  "TITULO",
  "LOCAL",
  "ANO",
]);

const AMBIGUOUS_ALIASES = new Set(["artigo"]);

function buildAliasPattern(alias: string): RegExp {
  const parts = alias.split(/\s+/).filter(Boolean);
  const pattern = parts
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`\\b${pattern}\\b`, "i");
}

function cleanValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanAcademicCandidate(value: string): string {
  return value
    .replace(/\[Imagem detectada:[^\]]+\]/gi, " ")
    .replace(/\b(?:campo|placeholder|preencher|inserir)\b[^.\n]*(?:\.|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinLines(lines: string[]): string {
  return lines.map(cleanValue).filter(Boolean).join("\n").trim();
}

function blockText(block: ImportedBlock): string {
  if (block.type === "pageBreak") return "";
  if (block.type === "image") return "";
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

function sectionKeyForBlock(block: ImportedBlock): AcademicFieldKey | undefined {
  return getSectionKeyFromTitle(blockText(block));
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
    ].includes(headingBase(text)) ||
    Boolean(getSectionKeyFromTitle(text))
  );
}

function looksLikePersonalThanks(text: string): boolean {
  const normalized = normalizeForDetection(text);
  if (text.length < 25) return false;
  const startsWithThanks = /^(agrade[çc]o|a\s+deus|aos\s+meus|ao\s+meu|a\s+minha|[àa]\s+minha|a\s+todos|aos\s+|[àa]\s+luiza|[àa]\s+universidade|ao\s+programa)/i.test(normalized);
  if (!startsWithThanks) return false;
  const hasThanksContent = /(esposo|filhos|pais|familiares|orientador|agradecimento|dedicatoria|amigos|colegas|equipe|trabalho|apoio|incentivo|carinho|paci[eê]ncia|universidade|programa|sustentar|guiar|caminhada|oportunidade|vivenciar|colabora[cç][aã]o|contribui[cç][aã]o|parceria|companheirismo|est[íi]mulo|acolhimento|qualidade|forma|processo|ensin[oa]|aprendizado|experi[eê]ncia)/i.test(normalized);
  return hasThanksContent;
}

function isReferenceHeading(block: ImportedBlock): boolean {
  return isPageHeading(block, ["REFERENCIAS", "REFERÊNCIAS"]) || isEquivalentSectionTitle(blockText(block), "referencias");
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
  if (block.type === "image") return "";
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

  for (const type of ACADEMIC_PRODUCTION_TYPES) {
    for (const alias of type.sectionAliases) {
      if (AMBIGUOUS_ALIASES.has(alias.toLowerCase())) continue;
      if (buildAliasPattern(alias).test(normalized)) return type.id;
    }
  }

  if (/\bRELATORIO DE ESTAGIO\b|\bESTAGIO SUPERVISIONADO\b/.test(normalized)) return "relatorio_estagio_ufla";
  if (/\bPROPOSTA DE INTERVENCAO\b|\bINTERVENCAO CLINICA\b|\bINTERVENCAO EM SERVICO\b/.test(normalized)) return "proposta_intervencao_ufla";
  if (/\bSOFTWARE\b|\bAPLICATIVO\b|\bDESENVOLVIMENTO DE SOFTWARE\b/.test(normalized)) return "software_aplicativo_ufla";
  if (/\bPATENTE\b|\bPEDIDO DE PATENTE\b|\bREIVINDICACOES\b/.test(normalized)) return "patente_ufla";
  if (/\bREVISAO SISTEMATICA\b|\bREVISAO APROFUNDADA\b/.test(normalized)) return "revisao_sistematica_ufla";
  if (/\bESTUDO DE CASO\b|\bCASOS MULTIPLOS\b/.test(normalized)) return "estudo_caso_ufla";
  if (/\bCULTIVAR\b|\bMELHORAMENTO GENETICO\b/.test(normalized)) return "cultivar_ufla";
  if (/\bARTIGO CIENTIFICO\b/.test(normalized)) return "artigo_cientifico_ufla";
  if (/\bARTIGO\b/.test(normalized)) return "artigo";

  // CPG e projeto de pesquisa são cobertos por isCpgWork / isResearchProject no fluxo superior.
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

  // Rejeitar termos institucionais
  const upperValue = value.toUpperCase();
  for (const term of INSTITUTIONAL_TERMS) {
    if (upperValue.includes(term)) {
      return false;
    }
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

function hasUnsafeYearContext(value: string): boolean {
  return /\b(refer[êe]ncias?|doi|https?:\/\/|www\.|dispon[ií]vel em|acesso em|lei|decreto|portaria|resolu[cç][aã]o|cita[cç][aã]o)\b/i.test(
    value,
  );
}

export function detectYearFromCover(blocks: ImportedBlock[]): {
  value: string;
  confidence: Confidence;
} {
  const coverLines = coverTextLines(blocks);

  for (const line of coverLines) {
    const labelMatch = line.match(/^\s*ano\s*[:\-]\s*((?:19|20)\d{2})\s*$/i);
    if (labelMatch?.[1]) {
      return { value: labelMatch[1], confidence: "alta" };
    }
  }

  const candidates = coverLines.flatMap((line) => {
    if (hasUnsafeYearContext(line)) return [];
    return [...line.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => ({
      value: match[0],
      exactLine: line.trim() === match[0],
    }));
  });

  const lastCandidate = candidates.at(-1);
  if (lastCandidate) {
    return {
      value: lastCandidate.value,
      confidence: lastCandidate.exactLine ? "alta" : "media",
    };
  }

  return { value: new Date().getFullYear().toString(), confidence: "baixa" };
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
  const index = lines.findIndex((line) =>
    /apresentad[ao]\s+[aà]\s+universidade|obten[cç][aã]o\s+do\s+t[ií]tulo/i.test(line),
  );
  if (index < 0) return "";

  const parts: string[] = [];
  for (let i = index; i < lines.length; i += 1) {
    const text = cleanValue(lines[i]);
    if (!text) continue;
    if (/palavras[- ]chave\s*[:\-]/i.test(text) || /^keywords\s*[:\-]/i.test(text)) break;
    if (/^bibliografia$/i.test(text) || /^referencias$/i.test(text) || /^sumario$/i.test(text)) break;
    if (/^ficha catalogr/i.test(text) || /^folha de aprov/i.test(text)) break;
    if (parts.join(" ").length > 1200) break;
    parts.push(text);
  }

  return parts.join(" ").trim();
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

    const normalized = normalizeForDetection(text);
    const isNextPreTextual =
      isPageHeading(block, ["ABSTRACT", "SUMARIO", "SUMÁRIO"]) ||
      normalized === "AGRADECIMENTOS" ||
      normalized === "DEDICATORIA" ||
      normalized === "EPIGRAFE" ||
      normalized === "INDICADORES DE IMPACTO" ||
      normalized === "IMPACT INDICATORS" ||
      normalized === "LISTA DE QUADROS" ||
      normalized === "LISTA DE GRAFICOS" ||
      normalized === "LISTA DE SIGLAS" ||
      /^1\s+INTRODUCAO$/i.test(normalized);

    if (isNextPreTextual) break;
    if (looksLikePrimaryHeading(block, text) && collected.length) break;

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

    const normalized = normalizeForDetection(text);
    const isNextPreTextual =
      isPageHeading(block, [
        "INDICADORES DE IMPACTO",
        "IMPACT INDICATORS",
        "SUMARIO",
        "SUMÁRIO",
        "INTRODUCAO",
        "INTRODUÇÃO",
      ]) ||
      normalized === "AGRADECIMENTOS" ||
      normalized === "DEDICATORIA" ||
      normalized === "EPIGRAFE" ||
      normalized === "LISTA DE QUADROS" ||
      normalized === "LISTA DE GRAFICOS" ||
      normalized === "LISTA DE SIGLAS" ||
      /^1\s+INTRODUCAO$/i.test(normalized);

    if (isNextPreTextual) break;
    if (looksLikePrimaryHeading(block, text) && collected.length) break;

    collected.push(text);
  }

  return { abstractText: joinLines(collected), keywords };
}

function keywordValue(text: string, label: "palavras" | "keywords"): string {
  const pattern =
    label === "palavras"
      ? /^palavras[- ]chave\s*[:\-]\s*(.+)$/i
      : /^keywords\s*[:\-]\s*(.+)$/i;
  return cleanValue(text.match(pattern)?.[1] ?? "");
}

function isPalavrasChaveLine(text: string): boolean {
  return /^palavras[- ]chave\s*[:\-]/i.test(text.trim());
}

function isKeywordsLine(text: string): boolean {
  return /^keywords\s*[:\-]/i.test(text.trim());
}

function isLikelyDelimiterBoundary(block: ImportedBlock, text: string): boolean {
  const normalized = normalizeForDetection(text);
  return (
    block.type === "pageBreak" ||
    isPageHeading(block, [
      "RESUMO",
      "ABSTRACT",
      "AGRADECIMENTOS",
      "DEDICATORIA",
      "EPIGRAFE",
      "SUMARIO",
      "SUMÁRIO",
      "LISTA DE QUADROS",
      "LISTA DE GRÁFICOS",
      "LISTA DE GRAFICOS",
      "LISTA DE SIGLAS",
      "INDICADORES DE IMPACTO",
      "IMPACT INDICATORS",
    ]) ||
    /^(DEDICATORIA|AGRADECIMENTOS|EPIGRAFE|FICHA CATALOGR|FOLHA DE APROV|LISTA DE QUADROS|LISTA DE GRAFICOS|LISTA DE SIGLAS|INDICADORES DE IMPACTO|IMPACT INDICATORS)\b/i.test(normalized) ||
    /^APROVAD[AO]\b/.test(normalized) ||
    /^ORIENTADOR/.test(normalized) ||
    /^BIBLIOGRAFIA/.test(normalized) ||
    /^FICHA CATALOGR/i.test(normalized) ||
    /^FOLHA DE APROV/i.test(normalized)
  );
}

function collectBeforeDelimiter(
  blocks: ImportedBlock[],
  delimiterIndex: number,
  options: { afterIndex?: number; stopAtPalavrasChave?: boolean } = {},
): string {
  const collected: string[] = [];
  const minIndex = options.afterIndex ?? 0;

  for (let index = delimiterIndex - 1; index >= minIndex; index -= 1) {
    const block = blocks[index];
    const text = textFromBlockForSection(block).trim();
    if (!text) continue;
    if (options.stopAtPalavrasChave && isPalavrasChaveLine(text)) break;
    if (isKeywordsLine(text)) break;
    if (isLikelyDelimiterBoundary(block, text)) {
      if (collected.length) break;
      continue;
    }
    if (looksLikePrimaryHeading(block, text)) {
      if (collected.length) break;
      continue;
    }
    if (looksLikePersonalThanks(text)) {
      break;
    }
    if (text.startsWith("[Imagem detectada")) continue;
    collected.unshift(text);
  }

  return cleanAcademicCandidate(joinLines(collected));
}

function recoverResumoByDelimiter(blocks: ImportedBlock[]): {
  resumo: string;
  palavrasChave: string;
  confidence: Confidence;
} {
  const keywordIndex = blocks.findIndex((block) => isPalavrasChaveLine(textFromBlockForSection(block).trim()));
  if (keywordIndex < 0) return { resumo: "", palavrasChave: "", confidence: "nao-identificado" };

  const resumo = collectBeforeDelimiter(blocks, keywordIndex);
  return {
    resumo,
    palavrasChave: keywordValue(textFromBlockForSection(blocks[keywordIndex]).trim(), "palavras"),
    confidence: resumo ? "baixa" : "nao-identificado",
  };
}

function recoverAbstractByDelimiter(blocks: ImportedBlock[]): {
  abstractText: string;
  keywords: string;
  confidence: Confidence;
} {
  const keywordIndex = blocks.findIndex((block) => isKeywordsLine(textFromBlockForSection(block).trim()));
  if (keywordIndex < 0) return { abstractText: "", keywords: "", confidence: "nao-identificado" };

  let previousPalavrasIndex = -1;
  for (let index = keywordIndex - 1; index >= 0; index -= 1) {
    if (isPalavrasChaveLine(textFromBlockForSection(blocks[index]).trim())) {
      previousPalavrasIndex = index;
      break;
    }
  }
  const abstractText = collectBeforeDelimiter(blocks, keywordIndex, {
    afterIndex: previousPalavrasIndex >= 0 ? previousPalavrasIndex + 1 : 0,
    stopAtPalavrasChave: true,
  });

  return {
    abstractText,
    keywords: keywordValue(textFromBlockForSection(blocks[keywordIndex]).trim(), "keywords"),
    confidence: abstractText ? "baixa" : "nao-identificado",
  };
}

function stripAdvisorNoise(value: string): string {
  return cleanValue(
    value
      .replace(/\bBibliografia\b.*$/i, "")
      .replace(/\bFicha catalogr[aá]fica\b.*$/i, ""),
  );
}

function hasCatalogCard(lines: string[]): boolean {
  return lines.some((line) => /ficha catalogr[aá]fica|bibliografia\./i.test(line));
}

function hasApprovalSheet(lines: string[]): boolean {
  return lines.some((line) => /aprovad[ao]\s+em\s+\d{1,2}\s+de\s+\p{L}+\s+de\s+(?:19|20)\d{2}/iu.test(line));
}

function detectApprovalSheet(lines: string[]): { date: string; members: string[] } {
  const dateLine = lines.find((line) => /aprovad[ao]\s+em\s+(\d{1,2}\s+de\s+\p{L}+\s+de\s+(?:19|20)\d{2})/iu.test(line));
  const date = dateLine ? cleanValue(dateLine.replace(/^aprovad[ao]\s+em\s+/i, "").replace(/\.$/i, "").trim()) : "";

  const start = lines.findIndex((line) => /aprovad[ao]\s+em/i.test(line));
  const members: string[] = [];
  if (start >= 0) {
    for (let index = start + 1; index < lines.length; index += 1) {
      const text = lines[index].trim();
      if (!text) continue;
      if (/^(RESUMO|ABSTRACT|PALAVRAS[- ]CHAVE|KEYWORDS|AGRADECIMENTOS|DEDICATORIA|EPIGRAFE|INDICADORES|IMPACT|LISTA|SUMARIO|1\s+INTRODUCAO|REFERENCIAS|ANEXOS|APENDICES|CONCLUSAO)/i.test(text)) break;
      if (text.length > 250) continue;
      if (/^A\s+[A-ZÀÁÂÃÉÊÍÓÔÕÚÜÇ]/.test(text) && text.length > 80) continue;

      const hasTitle = /(?:prof|dra|dr)\.?\s+/i.test(text);
      if (hasTitle && text.length < 200) {
        const parts = text.split(/\s+(?=Prof\.|Dra\.|Dr\.)/i).filter(Boolean);
        members.push(...parts);
      }
    }
  }

  return { date, members };
}

function hasPreTextualLists(lines: string[]): boolean {
  const normalized = lines.map(normalizeForDetection).join("\n");
  return /LISTA DE (QUADROS|GRAFICOS|SIGLAS|ILUSTRACOES|TABELAS)/.test(normalized);
}

function looksLikePdfConvertedDocx(structure: DocxStructure, lines: string[]): boolean {
  const normalized = lines.map(normalizeForDetection).join("\n");
  const hasDelimiterWithoutHeading =
    (/PALAVRAS[- ]CHAVE:/.test(normalized) && !/^RESUMO$/m.test(normalized)) ||
    (/KEYWORDS:/.test(normalized) && !/^ABSTRACT$/m.test(normalized));
  const hasDisplacedPreTextual =
    /INDICADORES DE IMPACTO|IMPACT INDICATORS|LISTA DE QUADROS|LISTA DE GRAFICOS|LISTA DE SIGLAS/.test(normalized);
  return hasDelimiterWithoutHeading || (structure.images.length > 0 && hasDisplacedPreTextual);
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
    isPageHeading(block, ["CONCLUSAO", "CONCLUSÃO", "CONSIDERACOES FINAIS", "CONSIDERAÇÕES FINAIS"]) ||
    sectionKeyForBlock(block) === "conclusao",
  );
  if (start < 0) return "";
  return collectAfterHeading(blocks, start, (block) => isReferenceHeading(block));
}

function collectReferences(blocks: ImportedBlock[]): string {
  const referenceCandidates = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isReferenceHeading(block));

  const introductionIndex = findIntroductionIndex(blocks);
  const start = referenceCandidates
    .filter(({ index }) => introductionIndex < 0 || index > introductionIndex)
    .at(-1)?.index ?? -1;

  const collected: string[] = [];

  if (start >= 0) {
    for (let index = start + 1; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (isAnnexHeading(block) || isAppendixHeading(block)) break;
      const normalized = normalizeForDetection(blockText(block));
      if (/^1\s+INTRODUCAO$/i.test(normalized) || normalized === "INTRODUCAO") break;
      if (/^(OBJETIVO GERAL|OBJETIVOS ESPECIFICOS|JUSTIFICATIVAS|ORGANIZACAO DO TRABALHO|REFERENCIAL TEORICO|METODOLOGIA|RESULTADOS E DISCUSSAO|CONCLUSAO|CONSIDERACOES FINAIS)\b/.test(normalized)) break;
      if (/^(APENDICE|APÊNDICE|ANEXO)\b/i.test(normalized)) break;

      const text = textFromBlockForSection(block).trim();
      if (!text) continue;
      if (isLikelyNoiseReferenceItem(text)) continue;
      collected.push(text);
    }
  }

  return collected.join("\n\n").trim();
}

function findPostReferencesHeadingIndex(
  blocks: ImportedBlock[],
  predicate: (block: ImportedBlock) => boolean,
): number {
  const referencesIndex = findHeadingIndex(blocks, isReferenceHeading);
  if (referencesIndex < 0) return -1;
  return blocks.findIndex((block, index) => index > referencesIndex && predicate(block));
}

function collectAnnexes(blocks: ImportedBlock[]): string {
  const start = findPostReferencesHeadingIndex(blocks, isAnnexHeading);
  return collectAfterHeading(blocks, start, isAppendixHeading);
}

function collectAppendices(blocks: ImportedBlock[]): string {
  const start = findPostReferencesHeadingIndex(blocks, isAppendixHeading);
  return collectAfterHeading(blocks, start, isAnnexHeading);
}

function collectPreTextualSection(blocks: ImportedBlock[], headings: string[]): string {
  const start = findHeadingIndex(blocks, (block) => isPageHeading(block, headings));
  return collectAfterHeading(blocks, start, (block) => {
    if (block.type === "pageBreak") return false;
    const text = blockText(block);
    const normalizedText = normalizeForDetection(text);
    if (
      /^(A PRESENTE PESQUISA TEVE COMO OBJETIVO|THIS STUDY AIMED|PALAVRAS[- ]CHAVE|KEYWORDS)\b/.test(normalizedText)
    ) {
      return true;
    }
    if (!looksLikePrimaryHeading(block)) return false;
    const normalized = headingBase(blockText(block));
    const isTarget = headings.map(normalizeForDetection).includes(normalized);
    if (isTarget) return false;
    const isKnownPreTextual =
      normalized === "RESUMO" ||
      normalized === "ABSTRACT" ||
      normalized === "AGRADECIMENTOS" ||
      normalized === "DEDICATORIA" ||
      normalized === "EPIGRAFE" ||
      normalized === "SUMARIO" ||
      normalized === "SUMÁRIO" ||
      normalized === "LISTA DE ILUSTRACOES" ||
      normalized === "LISTA DE TABELAS" ||
      normalized === "LISTA DE QUADROS" ||
      normalized === "LISTA DE GRAFICOS" ||
      normalized === "LISTA DE SIGLAS" ||
      normalized === "INDICADORES DE IMPACTO" ||
      normalized === "IMPACT INDICATORS";
    const isIntro = normalized === "INTRODUCAO" || /^1\s+INTRODUCAO$/i.test(normalized);
    const isReference = normalized === "REFERENCIAS" || normalized === "ANEXOS" || normalized === "ANEXO" || normalized === "APENDICES" || normalized === "APENDICE";
    return isKnownPreTextual || isIntro || isReference;
  });
}

function preTextualRecoveryNotice(): string {
  return "Seção detectada no arquivo importado, mas o conteúdo não pôde ser preservado automaticamente. Revise manualmente.";
}

function cleanPreTextualList(value: string, labels: string[]): string {
  const lines = splitLines(value);
  const labelPattern = labels.map((label) => normalizeForDetection(label)).join("|");
  const allowUnpagedTerminalEntry = labels.some((label) => normalizeForDetection(label) === "QUADRO");
  const entryStart = new RegExp(`^(?:${labelPattern})\\s+\\d+\\b`, "i");
  const entryNumber = new RegExp(`^(?:${labelPattern})\\s+(\\d+)\\b`, "i");
  const stopPattern =
    /^(LISTA DE GRAFICOS|LISTA DE GRÁFICOS|LISTA DE SIGLAS|LISTA DE QUADROS|LISTA DE TABELAS|SUMARIO|SUMÁRIO|INTRODUCAO|INTRODUÇÃO|CONCLUSÃO|REFERENCIAS)\b/i;

  const kept: string[] = [];
  let pending: { text: string; number: number } | null = null;
  let highestNumber = 0;

  const hasTrailingPage = (text: string): boolean => /\b\d{1,4}\s*$/.test(text.replace(/[.]+$/, "").trim());

  const flushPending = (force = false): void => {
    if (pending !== null) {
      const text = pending.text.replace(/\s+/g, " ").trim();
      if (force || hasTrailingPage(text)) {
        kept.push(text);
        highestNumber = Math.max(highestNumber, pending.number);
      }
      pending = null;
    }
  };

  for (const line of lines) {
    if (/^Fonte\s*:/i.test(line)) {
      flushPending(allowUnpagedTerminalEntry && (pending?.number ?? 0) > highestNumber);
      break;
    }

    const normalized = normalizeForDetection(line);
    if (stopPattern.test(normalized)) {
      flushPending(allowUnpagedTerminalEntry && (pending?.number ?? 0) > highestNumber);
      break;
    }

    if (entryStart.test(normalized)) {
      const number = Number(normalized.match(entryNumber)?.[1] ?? 0);
      if (number > 0 && highestNumber > 1 && number <= highestNumber) {
        flushPending();
        break;
      }
      flushPending(true);
      pending = { text: line, number };
      continue;
    }

    if (pending !== null) {
      pending.text = `${pending.text} ${line}`.replace(/\s+/g, " ").trim();
      continue;
    }
  }

  flushPending(allowUnpagedTerminalEntry && (pending?.number ?? 0) > highestNumber);

  return kept.join("\n").trim();
}

function looksLikeThanksBlock(text: string): boolean {
  const normalized = normalizeForDetection(text);
  if (text.length < 25) return false;
  const startsWithThanks = /^(agrade[çc]o|a\s+deus|aos\s+meus|ao\s+meu|a\s+minha|[àa]\s+minha|a\s+todos|aos\s+|[àa]\s+luiza|[àa]\s+universidade|ao\s+programa)/i.test(normalized);
  if (!startsWithThanks) return false;
  const hasThanksContent = /(esposo|filhos|pais|familiares|orientador|agradecimento|dedicatoria|amigos|colegas|equipe|trabalho|apoio|incentivo|carinho|paci[eê]ncia|universidade|programa|sustentar|guiar|caminhada|oportunidade|vivenciar|colabora[cç][aã]o|contribui[cç][aã]o|parceria|companheirismo|est[íi]mulo|acolhimento|qualidade|forma|processo|ensin[oa]|aprendizado|experi[eê]ncia)/i.test(normalized);
  return hasThanksContent;
}

function collectPreTextualByContent(blocks: ImportedBlock[]): {
  agradecimentos: string;
  listaQuadros: string;
  listaGraficos: string;
  listaTabelas: string;
  listaSiglas: string;
} {
  let agradecimentosStart = -1;
  let agradecimentosEnd = -1;
  const quadroEntries: string[] = [];
  const graficoEntries: string[] = [];
  const tabelaEntries: string[] = [];
  const siglaEntries: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = blockText(block).trim();
    if (!text) continue;

    const normalized = normalizeForDetection(text);

    if (agradecimentosStart < 0 && looksLikeThanksBlock(text)) {
      agradecimentosStart = i;
      continue;
    }

    if (agradecimentosStart >= 0 && agradecimentosEnd < 0) {
      if (
        /^(PALAVRAS[- ]CHAVE|KEYWORDS|RESUMO|ABSTRACT|INDICADORES DE IMPACTO|IMPACT INDICATORS|LISTA DE|SUMARIO|1\s+INTRODUCAO|INTRODUCAO|REFERENCIAS)/i.test(normalized) ||
        /^(A PRESENTE PESQUISA TEVE COMO OBJETIVO|THIS STUDY AIMED)\b/.test(normalized)
      ) {
        agradecimentosEnd = i;
      }
      continue;
    }

    const quadroMatch = text.match(/^(Quadro|QUADRO)\s+(\d+)\s*[-–—]\s*(.+)$/);
    if (quadroMatch) {
      quadroEntries.push(`Quadro ${quadroMatch[2]} - ${cleanValue(quadroMatch[3])}`);
      continue;
    }

    const graficoMatch = text.match(/^(Gr[aá]fico|GRAFICO)\s+(\d+)\s*[-–—]\s*(.+)$/);
    if (graficoMatch) {
      graficoEntries.push(`Gráfico ${graficoMatch[2]} - ${cleanValue(graficoMatch[3])}`);
      continue;
    }

    const tabelaMatch = text.match(/^(Tabela|TABELA)\s+(\d+)\s*[-–—]\s*(.+)$/);
    if (tabelaMatch) {
      tabelaEntries.push(`Tabela ${tabelaMatch[2]} - ${cleanValue(tabelaMatch[3])}`);
      continue;
    }
  }

  const agradecimentos = agradecimentosStart >= 0 && agradecimentosEnd >= 0
    ? joinLines(blocks.slice(agradecimentosStart, agradecimentosEnd).map(blockText).filter(Boolean))
    : "";

  return {
    agradecimentos,
    listaQuadros: quadroEntries.join("\n"),
    listaGraficos: graficoEntries.join("\n"),
    listaTabelas: tabelaEntries.join("\n"),
    listaSiglas: siglaEntries.join("\n"),
  };
}

function isLikelyNoiseReferenceItem(text: string): boolean {
  const normalized = normalizeForDetection(text);
  const looksLikeSentence = /^(O|A|Os|As|Um|Uma|Nest|Neste|Esta|Este|Conforme|Segundo|Para|Quanto|Esse|Essa|Esses|Essas|O panorama|Resultados|Portanto|Esse estudo|A necessidade|A universidade|O governo|A pesquisa|O atual|A atual|Um estudo|Estudos afirmam|O panorama da|Na Introdução|Na seção|Nos Resultados|Já na Conclusão|Apresenta-se uma contextualização|A presente pesquisa|O tema se enquadra|Os resultados desta pesquisa|Espera-se portanto|A importância|O panorama da pesquisa|A contribuições científicas|A necessidade de compreender|A implementação do PGD na Universidade|O teletrabalho|A implementação do Programa|Este trabalho|A atual crise|O sistema de gestão|Os dados foram|A análise dos dados|A pesquisa é de|Os participantes|Os servidores|Os gestores|A universidade é|O ambiente|O presente trabalho|A pesquisa qualitativa|A pesquisa quantitativa)\b/i.test(text.trim());
  if (looksLikeSentence && !/^[A-Z][A-Z\s,;.\-]+$/.test(text.trim())) return true;
  if (/^(APENDICE|APÊNDICE|ANEXO|TCLE|TERMO|CONVITE|PESQUISADOR|CARGO|FUNÇÃO|SIGILO|PRIVACIDADE|RESULTADOS|VOLUNTÁRIA|PARTICIPAR|UNIVERSIDADE FEDERAL|PREZADO|SENHOR|VOCÊ)\b/i.test(normalized)) return true;
  if (/^(TÍTULO DO TRABALHO EXPERIMENTAL)/i.test(normalized)) return true;
  return (
    /^(APROVAD|DISSERTACAO|MESTRADO|BIBLIOGRAFIA|FICHA CATALOGRAFICA|FOLHA DE APROV|SUMARIO|LISTA|INDICADORES|IMPACT|AGRADECIMENTOS|DEDICATORIA|EPIGRAFE|REFERENCIAS|ANEXOS|APENDICES|INTRODUCAO|CONCLUSAO|RESUMO|ABSTRACT|PALAVRAS|KEYWORDS|OBJETIVO GERAL|OBJETIVOS ESPECIFICOS|JUSTIFICATIVAS|ORGANIZACAO DO TRABALHO|REFERENCIAL TEORICO|METODOLOGIA|RESULTADOS E DISCUSSAO)\b/.test(normalized) ||
    /^(–|-|•|\*)/.test(text.trim()) ||
    /^\d+$/.test(text.trim()) ||
    /(aprimorar|modalidades|regimes|vedacoes|Gr[aá]fico\s+\d+|Quadro\s+\d+|Fonte:|percentual|4,4%|teletrabalho na administracao|as modalidades|roteiro preliminar|termo de consentimento|tc le|pesquisador responsável|cargo função|sigilo privacidade)/i.test(text)
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanReferences(references: string): string {
  return splitLines(references)
    .filter((item) => !isLikelyNoiseReferenceItem(item))
    .join("\n")
    .trim();
}

function collectSectionByAlias(blocks: ImportedBlock[], key: AcademicFieldKey): string {
  const start = findHeadingIndex(blocks, (block) => sectionKeyForBlock(block) === key);
  return collectAfterHeading(blocks, start, (block) => {
    if (block.type === "pageBreak") return false;
    if (isReferenceHeading(block) || isAnnexHeading(block) || isAppendixHeading(block)) return true;
    return looksLikePrimaryHeading(block) && sectionKeyForBlock(block) !== key;
  });
}

function blocksToEditorText(blocks: ImportedBlock[]): string {
  const start = findIntroductionIndex(blocks);
  if (start < 0) return "";

  const lines: string[] = [];
  for (let index = start; index < blocks.length; index += 1) {
    const block = blocks[index];
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
        ].includes(headingBase(trimmed)) ||
        Boolean(getSectionKeyFromTitle(trimmed));

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

  if (isCpgWork(fields.workType) || looksLikeCpgDocument(structure.blocks)) {
    const cpgResult = detectCpgAcademicFieldsFromStructure(structure);
    if (cpgResult.fields.title || cpgResult.fields.author || cpgResult.fields.abstractText) {
      cpgResult.fields.workType = fields.workType || cpgResult.fields.workType;
      return cpgResult;
    }
  }

  fields.author = findByLabel(text, [/^\s*(?:autor(?:a)?|discente|aluno(?:a)?)\s*[:\-]\s*(.+)$/im]);
  fields.title = findByLabel(text, [/^\s*t[íi]tulo\s*[:\-]\s*(.+)$/im]);
  fields.subtitle = findByLabel(text, [/^\s*subt[íi]tulo\s*[:\-]\s*(.+)$/im]);
  fields.course = findByLabel(text, [/^\s*curso\s*[:\-]\s*(.+)$/im]);
  fields.program = findByLabel(text, [/^\s*programa\s*[:\-]\s*(.+)$/im]);
  fields.location = findByLabel(text, [/^\s*(?:local|cidade)\s*[:\-]\s*(.+)$/im]);

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

  const coverYear = detectYearFromCover(structure.blocks);
  fields.year = coverYear.value;
  confidence.year = coverYear.confidence;

  fields.advisor = stripAdvisorNoise(
    findByLabel(text, [/^\s*orientador(?:a)?\s*[:\-]\s*(.+)$/im]) ||
      findFollowingLabel(lines, ["Orientador", "Orientadora"]),
  );
  fields.coadvisor =
    findByLabel(text, [/^\s*coorientador(?:a)?\s*[:\-]\s*(.+)$/im]) ||
    findFollowingLabel(lines, ["Coorientador", "Coorientadora"]);
  fields.workNature = detectWorkNature(lines);

  if (!fields.program && fields.workNature) {
    fields.program =
      fields.workNature.match(/programa de p[óo]s-gradua[cç][aã]o em ([^,]+)/i)?.[1]?.trim() ?? "";
  }

  const approval = detectApprovalSheet(lines);
  fields.aprovalDate = approval.date;
  fields.approvalMembers = approval.members;

  const resumo = splitResumo(structure.blocks);
  fields.resumo = resumo.resumo;
  fields.palavrasChave = resumo.palavrasChave;
  const recoveredResumo = recoverResumoByDelimiter(structure.blocks);
  if (!fields.resumo && recoveredResumo.resumo) {
    fields.resumo = recoveredResumo.resumo;
    confidence.resumo = recoveredResumo.confidence;
  }
  if (!fields.palavrasChave && recoveredResumo.palavrasChave) {
    fields.palavrasChave = recoveredResumo.palavrasChave;
    confidence.palavrasChave = recoveredResumo.confidence === "baixa" ? "media" : recoveredResumo.confidence;
  }

  const abstract = splitAbstract(structure.blocks);
  fields.abstractText = abstract.abstractText;
  fields.keywords = abstract.keywords;
  const recoveredAbstract = recoverAbstractByDelimiter(structure.blocks);
  if (!fields.abstractText && recoveredAbstract.abstractText) {
    fields.abstractText = recoveredAbstract.abstractText;
    confidence.abstractText = recoveredAbstract.confidence;
  }
  if (!fields.keywords && recoveredAbstract.keywords) {
    fields.keywords = recoveredAbstract.keywords;
    confidence.keywords = recoveredAbstract.confidence === "baixa" ? "media" : recoveredAbstract.confidence;
  }

  fields.introducao = collectIntroduction(structure.blocks);
  fields.conclusao = collectConclusion(structure.blocks);
  fields.referencias = cleanReferences(collectReferences(structure.blocks));
  fields.objetivoGeral = collectSectionByAlias(structure.blocks, "objetivoGeral");
  fields.objetivosEspecificos = collectSectionByAlias(structure.blocks, "objetivosEspecificos");
  fields.referencialTeorico = collectSectionByAlias(structure.blocks, "referencialTeorico");
  fields.metodologia = collectSectionByAlias(structure.blocks, "metodologia");
  fields.cronograma = collectSectionByAlias(structure.blocks, "cronograma");
  fields.resultadosEsperados = collectSectionByAlias(structure.blocks, "resultadosEsperados");
  fields.anexos = collectAnnexes(structure.blocks);
  fields.apendices = collectAppendices(structure.blocks);
  fields.agradecimentos = collectPreTextualSection(structure.blocks, ["AGRADECIMENTOS"]);
  fields.listaQuadros = collectPreTextualSection(structure.blocks, ["LISTA DE QUADROS"]);
  fields.listaGraficos = collectPreTextualSection(structure.blocks, ["LISTA DE GRÁFICOS", "LISTA DE GRAFICOS"]);
  fields.listaTabelas = collectPreTextualSection(structure.blocks, ["LISTA DE TABELAS"]);
  fields.listaSiglas = collectPreTextualSection(structure.blocks, ["LISTA DE SIGLAS"]);
  fields.indicadoresImpacto = collectPreTextualSection(structure.blocks, [
    "INDICADORES DE IMPACTO",
  ]);
  fields.impactIndicators = collectPreTextualSection(structure.blocks, ["IMPACT INDICATORS"]);
  fields.listaQuadros = cleanPreTextualList(fields.listaQuadros, ["Quadro"]);
  fields.listaGraficos = cleanPreTextualList(fields.listaGraficos, ["GrÃ¡fico", "Grafico"]);
  fields.listaTabelas = cleanPreTextualList(fields.listaTabelas, ["Tabela"]);

  if (!fields.agradecimentos || !fields.listaQuadros || !fields.listaGraficos || !fields.listaSiglas) {
    const inferred = collectPreTextualByContent(structure.blocks);
    if (!fields.agradecimentos && inferred.agradecimentos) {
      fields.agradecimentos = inferred.agradecimentos;
      messages.push("Agradecimentos detectados por inferência de conteúdo (sem heading explícito). Revise antes de gerar.");
    }
    if (!fields.listaQuadros && inferred.listaQuadros) {
      fields.listaQuadros = inferred.listaQuadros;
      messages.push("Lista de quadros inferida a partir dos títulos de quadro no texto. Revise antes de gerar.");
    }
    if (!fields.listaGraficos && inferred.listaGraficos) {
      fields.listaGraficos = inferred.listaGraficos;
      messages.push("Lista de gráficos inferida a partir dos títulos de gráfico no texto. Revise antes de gerar.");
    }
    if (!fields.listaTabelas && inferred.listaTabelas) {
      fields.listaTabelas = inferred.listaTabelas;
      messages.push("Lista de tabelas inferida a partir dos títulos de tabela no texto. Revise antes de gerar.");
    }
    if (!fields.listaSiglas && inferred.listaSiglas) {
      fields.listaSiglas = inferred.listaSiglas;
      messages.push("Lista de siglas inferida a partir do texto. Revise antes de gerar.");
    }
  }
  fields.listaQuadros = cleanPreTextualList(fields.listaQuadros, ["Quadro"]);
  fields.listaGraficos = cleanPreTextualList(fields.listaGraficos, ["GrÃ¡fico", "Grafico"]);
  fields.listaTabelas = cleanPreTextualList(fields.listaTabelas, ["Tabela"]);
  const convertedPdfLikely = looksLikePdfConvertedDocx(structure, lines);
  if (convertedPdfLikely && (fields.workType === "dissertacao" || fields.workType === "tese")) {
    if (!fields.indicadoresImpacto) {
      fields.indicadoresImpacto = preTextualRecoveryNotice();
      messages.push("Indicadores de impacto parecem existir no documento convertido, mas nÃ£o foram preservados como texto editÃ¡vel.");
    }
    if (!fields.impactIndicators) {
      fields.impactIndicators = preTextualRecoveryNotice();
      messages.push("Impact indicators parecem existir no documento convertido, mas nÃ£o foram preservados como texto editÃ¡vel.");
    }
    if (!fields.listaSiglas) {
      fields.listaSiglas = preTextualRecoveryNotice();
      messages.push("Lista de siglas parece existir no documento convertido, mas nÃ£o foi preservada como texto editÃ¡vel.");
    }
  }

  if (hasCatalogCard(lines)) {
    messages.push("Ficha catalografica detectada no documento importado; preserve os dados reais e revise antes de gerar.");
  }
  if (hasApprovalSheet(lines)) {
    messages.push("Folha de aprovacao detectada no documento importado; preserve os dados reais e revise antes de gerar.");
  }
  if (fields.indicadoresImpacto || fields.impactIndicators) {
    messages.push("Indicadores de impacto detectados no documento importado.");
  }
  if (hasPreTextualLists(lines)) {
    messages.push("Listas pre-textuais detectadas no documento importado.");
  }
  if (convertedPdfLikely) {
    messages.push(
      "Este DOCX parece ter sido convertido de PDF. Alguns títulos, caixas de texto, imagens, quadros e elementos pré-textuais podem ter sido deslocados para cabeçalhos, rodapés ou objetos ancorados. Revise os campos extraídos antes de gerar o DOCX.",
    );
  }

  const imageBlocks = structure.blocks.filter((block) => block.type === "image" && !block.isDecorative);
  if (imageBlocks.length) {
    fields.imageWarnings = `${imageBlocks.length} imagem(ns) detectada(s), mas nem todas puderam ser preservadas automaticamente. Reinsira manualmente as imagens ausentes e confira legendas e fontes.`;
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

function looksLikeCpgDocument(blocks: ImportedBlock[]): boolean {
  const normalized = blocks
    .map((block) => normalizeForDetection(blockText(block)))
    .filter(Boolean)
    .join("\n");

  const hasAbstractBeforeResumo = /ABSTRACT[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*RESUMO/i.test(normalized);
  const hasKeywordsBeforePalavras = /KEYWORDS[^\n]*\n[^\n]*\n[^\n]*PALAVRAS[- ]CHAVE/i.test(normalized);
  const hasNumberedIntro = /^1\s+INTRODUCAO$/m.test(normalized);
  const hasAuthorMarkers = /¹|²|³/.test(normalized);

  return (hasAbstractBeforeResumo && hasKeywordsBeforePalavras) || (hasNumberedIntro && hasAuthorMarkers);
}

function findBlockIndex(blocks: ImportedBlock[], predicate: (block: ImportedBlock) => boolean): number {
  return blocks.findIndex(predicate);
}

function blockTextTrimmed(block: ImportedBlock): string {
  return blockText(block).trim();
}

function isLikelyCpgAuthor(text: string): boolean {
  const normalized = normalizeForDetection(text);
  const upper = text.toUpperCase();
  if (/¹|²|³/.test(text)) return true;
  if (upper === text && text.length > 20) return false;
  if (isGenericCoverLine(text)) return false;
  if (isLocation(text) || isYear(text)) return false;
  if (/[:;]|\d/.test(text)) return false;
  if (
    /\b(RESUMO|ABSTRACT|REFERENCIAS|INTRODUCAO|ANEXOS|APENDICES|SUMARIO|PALAVRAS[- ]CHAVE|KEYWORDS)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  const upperValue = text.toUpperCase();
  for (const term of INSTITUTIONAL_TERMS) {
    if (upperValue.includes(term)) {
      return false;
    }
  }

  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 8;
}

function isLikelyCpgAffiliation(text: string): boolean {
  const normalized = normalizeForDetection(text);
  const trimmed = text.trim();
  if (/^[¹²³]$/.test(trimmed)) return true;
  if (/UNIVERSIDADE FEDERAL DE LAVRAS|UFLA|PROGRAMA DE P[ÓO]S[- ]GRADUA[CÇ][AÃ]O/.test(normalized)) return true;
  return false;
}

function isEmailLine(text: string): boolean {
  return /^[^\s]+@[^\s]+$/.test(text.trim());
}

function detectCpgAcademicFieldsFromStructure(structure: DocxStructure): FieldDetectionResult {
  const blocks = structure.blocks.filter((block) => block.type !== "pageBreak");
  if (!blocks.length) {
    return {
      fields: emptyAcademicFields(),
      confidence: emptyConfidenceMap(),
      editorText: "",
      messages: [],
    };
  }

  const fields = emptyAcademicFields();
  const confidence = emptyConfidenceMap();
  const messages: string[] = [];

  let cursor = 0;

  const titleLines: string[] = [];
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text || isLikelyCpgAuthor(text) || isLikelyCpgAffiliation(text) || isEmailLine(text)) break;
    if (/^(RESUMO|ABSTRACT|KEYWORDS|PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(text)) break;
    titleLines.push(text);
    cursor += 1;
  }
  const title = cleanValue(titleLines.join(" "));
  if (title) {
    fields.title = title;
    confidence.title = "alta";
  }

  const authorLines: string[] = [];
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    if (isLikelyCpgAffiliation(text) || isEmailLine(text)) break;
    if (/^(RESUMO|ABSTRACT|KEYWORDS|PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(text)) break;
    if (isLikelyCpgAuthor(text)) {
      authorLines.push(text);
      cursor += 1;
    } else if (authorLines.length && /¹|²|³/.test(text) && !isLikelyCpgAffiliation(text)) {
      authorLines[authorLines.length - 1] += ` ${text}`.trim();
      cursor += 1;
    } else {
      break;
    }
  }
  if (authorLines.length) {
    fields.author = cleanValue(authorLines.join(", "));
    confidence.author = "alta";
  }

  const affiliationLines: string[] = [];
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    if (isEmailLine(text)) break;
    if (/^(RESUMO|ABSTRACT|KEYWORDS|PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(text)) break;
    if (isLikelyCpgAffiliation(text)) {
      affiliationLines.push(text);
      cursor += 1;
    } else if (affiliationLines.length && /¹|²|³/.test(text)) {
      affiliationLines[affiliationLines.length - 1] += ` ${text}`.trim();
      cursor += 1;
    } else {
      break;
    }
  }
  if (affiliationLines.length) {
    fields.program = cleanValue(affiliationLines.join("\n"));
    confidence.program = "alta";
  }

  const emailLines: string[] = [];
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    if (!isEmailLine(text)) break;
    emailLines.push(text);
    cursor += 1;
  }
  if (emailLines.length) {
    fields.course = cleanValue(emailLines.join(", "));
    confidence.course = "alta";
  }

  const abstractTexts: string[] = [];
  let abstractFound = false;
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    const normalized = normalizeForDetection(text);
    if (!abstractFound) {
      if (/^ABSTRACT[.:\-]?\s*$/.test(normalized)) {
        abstractFound = true;
        cursor += 1;
        continue;
      }
      if (/^(KEYWORDS|PALAVRAS[- ]CHAVE|RESUMO|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    }
    if (/^(KEYWORDS|PALAVRAS[- ]CHAVE|RESUMO|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    if (abstractFound) abstractTexts.push(text);
    cursor += 1;
  }
  fields.abstractText = joinLines(abstractTexts);
  if (fields.abstractText) confidence.abstractText = "alta";

  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    const normalized = normalizeForDetection(text);
    const keywordMatch = text.match(/^KEYWORDS[.:\-]?\s*(.+)$/i);
    if (keywordMatch?.[1]) {
      fields.keywords = cleanValue(keywordMatch[1]);
      confidence.keywords = "alta";
      cursor += 1;
      break;
    }
    if (/^(RESUMO|PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    cursor += 1;
  }

  const resumoTexts: string[] = [];
  let resumoFound = false;
  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    const normalized = normalizeForDetection(text);
    if (!resumoFound) {
      if (/^RESUMO[.:\-]?\s*$/.test(normalized)) {
        resumoFound = true;
        cursor += 1;
        continue;
      }
      if (/^(PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    }
    if (/^(PALAVRAS[- ]CHAVE|REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    if (resumoFound) resumoTexts.push(text);
    cursor += 1;
  }
  fields.resumo = joinLines(resumoTexts);
  if (fields.resumo) confidence.resumo = "alta";

  while (cursor < blocks.length) {
    const text = blockTextTrimmed(blocks[cursor]);
    if (!text) { cursor += 1; continue; }
    const normalized = normalizeForDetection(text);
    const palavrasMatch = text.match(/^PALAVRAS[- ]CHAVE[.:\-]?\s*(.+)$/i);
    if (palavrasMatch?.[1]) {
      fields.palavrasChave = cleanValue(palavrasMatch[1]);
      confidence.palavrasChave = "alta";
      cursor += 1;
      break;
    }
    if (/^(REFERÊNCIAS|REFERENCIAS|INTRODUÇÃO|INTRODUCAO)/i.test(normalized)) break;
    cursor += 1;
  }

  const introductionIndex = findBlockIndex(blocks, (block) => {
    const normalized = normalizeForDetection(blockTextTrimmed(block));
    return /^1\s+INTRODUCAO$/.test(normalized) || /^INTRODUCAO$/.test(normalized);
  });
  if (introductionIndex >= 0) {
    const collected: string[] = [];
    for (let index = introductionIndex; index < blocks.length; index += 1) {
      const text = blockTextTrimmed(blocks[index]);
      if (!text) continue;
      const normalized = normalizeForDetection(text);
      if (/^2\s+\S+/.test(normalized) || /^REFERENCIAS|^REFERÊNCIAS|^ANEXOS|^APENDICES/i.test(normalized)) break;
      collected.push(text);
    }
    fields.introducao = joinLines(collected);
    if (fields.introducao) confidence.introducao = "alta";
  }

  const referenceStart = findBlockIndex(blocks, (block) => {
    const normalized = normalizeForDetection(blockTextTrimmed(block));
    return /^REFERENCIAS/.test(normalized) || /^REFERÊNCIAS/.test(normalized);
  });
  if (referenceStart >= 0) {
    const collected: string[] = [];
    for (let index = referenceStart + 1; index < blocks.length; index += 1) {
      const text = blockTextTrimmed(blocks[index]);
      if (!text) continue;
      collected.push(text);
    }
    fields.referencias = joinLines(collected);
    if (fields.referencias) confidence.referencias = "alta";
  }

  return {
    fields,
    confidence,
    editorText: blocksToEditorTextForCpg(blocks, referenceStart),
    messages,
  };
}

function blocksToEditorTextForCpg(blocks: ImportedBlock[], referenceStart: number): string {
  const start = findBlockIndex(blocks, (block) => {
    const normalized = normalizeForDetection(blockTextTrimmed(block));
    return /^1\s+INTRODUCAO$/.test(normalized) || /^INTRODUCAO$/.test(normalized);
  });
  if (start < 0) return "";

  const lines: string[] = [];
  for (let index = start; index < blocks.length; index += 1) {
    if (index === referenceStart) break;
    const block = blocks[index];
    if (block.type === "pageBreak") continue;
    if (block.type === "heading") {
      lines.push(`${block.level <= 1 ? "#" : "##"} ${block.text}`);
      continue;
    }
    if (block.type === "longQuote") {
      lines.push(`> ${block.text}`);
      continue;
    }
    const text = blockTextTrimmed(block);
    if (text) lines.push(text);
  }
  return lines.join("\n\n").trim();
}

export function detectAcademicFieldsFromText(text: string): FieldDetectionResult {
  return detectAcademicFieldsFromStructure(structureFromText(text));
}
