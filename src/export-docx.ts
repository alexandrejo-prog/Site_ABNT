import {
  AlignmentType,
  BookmarkEnd,
  BookmarkStart,
  BorderStyle,
  Document,
  FootnoteReferenceRun,
  Header,
  ImageRun,
  InternalHyperlink,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  SimpleField,
  Tab,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type { IParagraphOptions, ISectionOptions } from "docx";
import "./docx-toc-field-patch";
import { pageMargins, ibgeTable, BODY_SIZE, SINGLE_LINE, ONE_AND_HALF_LINE, BLACK, AUTHOR_SIZE as COVER_AUTHOR_SIZE, TITLE_SIZE as COVER_TITLE_SIZE, unnumberedTitle } from "./docx-shared";
import { DOCUMENT_STYLES } from "./docx-styles";
import { AcademicFields, UFLA_RULES, cmToTwip } from "./ufla-rules";
import { ACADEMIC_PRODUCTION_TYPE_IDS } from "./academic-production-types";
import { getWorkTypeRequirements } from "./work-type-requirements";
import { normalizeReferences, type NormalizedReference, type ReferenceRun } from "./references-normalizer";
import { buildFlowingImpactText } from "./impact-indicators";
import { normalizeForDetection } from "./word-structure-extractor";
import { cleanMojibakeText, clearXrefRegistry, detectCaption, detectTabbedTableBlock, OMML_CONTENT_TOKEN_PATTERN, ommlContentTokenDecode, rawOmmlMarkerParagraph, registerXrefResolver, resolveXrefTarget, sectionBookmarkId, sourceParagraph, tabbedTableBlock, tokenizeMarkup, type CaptionKind, type XrefResolver } from "./docx-render-core";
import { ImportedDocumentImage, IMPORTED_IMAGE_MARKER_PATTERN } from "./imported-images";
import { ImportedTable, IMPORTED_TABLE_MARKER_PATTERN, buildStructuredTextFromTable } from "./imported-tables";

export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "longQuote"
  | "scheduleTable"
  | "markdownTable"
  | "plainScheduleTable"
  | "tabbedTable"
  | "importedImage"
  | "importedTable"
  | "source"
  | "reference"
  | "footnoteDefinition"
  | "equation";

export interface EditorBlock {
  type: EditorBlockType;
  text: string;
  /** OMML cru de uma equação importada de DOCX (token `\uF001OMML:...` no rascunho). */
  ommlXml?: string;
}

export interface DocxLogoAsset {
  data: ArrayBuffer | Uint8Array;
  width?: number;
  height?: number;
}

export interface DocxGenerationInput {
  fields: AcademicFields;
  editorText: string;
  logo?: DocxLogoAsset;
  /** Imagem (foto/scan) da ficha catalográfica oficial — Manual UFLA §6.1. */
  fichaCatalograficaImage?: DocxLogoAsset;
  importedImages?: ImportedDocumentImage[];
  importedTables?: ImportedTable[];
}

interface ScheduleRow {
  etapa: string;
  meses: string;
  periodo: string;
  atividades: string;
}

export const DEFAULT_UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";

const LONG_QUOTE_SIZE = UFLA_RULES.typography.longQuoteFontSizePt * 2;
const REFERENCE_FONT = UFLA_RULES.typography.fontFamily;
const REFERENCE_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
// Notas de rodapé: 11 pt (meio-pontos 22) — §3.2.1 do Manual UFLA.
const FOOTNOTE_SIZE = UFLA_RULES.typography.sourceFontSizePt * 2;
const UFLA_LOGO_WIDTH_PX = 265;
const UFLA_LOGO_HEIGHT_PX = 108;

// Mapa nota-editada → w:id do DOCX, construído em createDocxDocument antes da
// renderização dos runs (números únicos e consecutivos, 1-based, por ordem de
// primeira ocorrência). Usado por textRunsWithFootnotes para emitir
// FootnoteReferenceRun no corpo e pelas definições em word/footnotes.xml.
let currentFootnoteIdMap: ReadonlyMap<number, number> | null = null;

function headingTypeFromNumberedTitle(text: string, fallback: EditorBlockType): EditorBlockType {
  const normalized = text.trim();

  if (/^\d+(?:\.\d+){2,}(?:\s|$)/.test(normalized)) return "heading3";
  if (/^\d+\.\d+(?:\s|$)/.test(normalized)) return "heading2";
  if (/^\d+(?:\s|$)/.test(normalized)) return "heading1";

  return fallback;
}

function looksLikeScheduleRow(value: string): boolean {
  return /^[1-4][ºª]?\s+semestre\b/i.test(value.trim());
}

function shouldStartScheduleTable(value: string): boolean {
  return /^Quadro\s+\d+\s+-\s+Cronograma/i.test(value.trim());
}

function looksLikeMarkdownTableRow(value: string): boolean {
  const normalized = value.trim();
  if (!normalized.includes("|")) return false;
  const cells = normalized.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
  return cells.filter((cell) => cell.trim().length > 0).length >= 2;
}

function isMarkdownTableSeparator(value: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(value) && value.includes("-");
}

function shouldStartMarkdownTable(value: string): boolean {
  return looksLikeMarkdownTableRow(value) && !shouldStartScheduleTable(value);
}

function splitScheduleColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim()).filter(Boolean);
  // Mantém "Mês N" como uma única coluna (evita quebra em espaço simples).
  const merged = line.replace(/\b(m[eê]s)\s+(\d+)/gi, "$1$2");
  const splitter = / {2,}/.test(line) ? / {2,}/ : /\s+/;
  return merged
    .split(splitter)
    .map((cell) => cell.replace(/\b(m[eê]s)(\d+)/gi, "$1 $2").trim())
    .filter(Boolean);
}

function isPlainScheduleHeader(value: string): boolean {
  const cells = splitScheduleColumns(value.trim());
  if (cells.length < 3) return false;
  const first = cells[0].toLocaleLowerCase("pt-BR");
  const monthColumns = cells.filter((cell) => /^m[eê]s\s*\d+/i.test(cell)).length;
  return /^etapa\b/i.test(first) && monthColumns >= 2;
}

function shouldStartPlainScheduleTable(value: string): boolean {
  return isPlainScheduleHeader(value);
}

function isMarkdownTableLine(value: string): boolean {
  return /^\|.+\|$/.test(value.trim());
}

/** Checks if consecutive lines after startIndex have the same word count (tabular data heuristic). */
function looksLikeTabularData(lines: string[], startIndex: number): boolean {
  if (startIndex >= lines.length) return false;
  const first = lines[startIndex]?.trim();
  if (!first) return false;
  const wc = first.split(/\s+/).length;
  if (wc < 2) return false;
  for (let i = startIndex + 1; i < Math.min(startIndex + 5, lines.length); i++) {
    const line = lines[i]?.trim();
    if (!line) return false;
    if (/^(Fonte:|Quadro\s|Tabela\s)/i.test(line)) break;
    if (line.split(/\s+/).length !== wc) return false;
  }
  return true;
}

function shouldStartTabbedTable(value: string, lines: string[], index: number): boolean {
  const trimmed = value.trim();
  if (!/^(quadro|tabela)\s+\d+/i.test(trimmed)) return false;
  const next = lines[index + 1]?.trim() ?? "";
  if (next.includes("\t") || / {2,}/.test(next) || isMarkdownTableLine(next)) return true;
  return looksLikeTabularData(lines, index + 1);
}

export function parseEditorContent(editorText: string): EditorBlock[] {
  const rawLines = editorText.split(/\r?\n/);
  const lines = rawLines.map((line) => line.trim()).filter(Boolean);
  // Índice no array bruto (rawLines) de cada linha não vazia de `lines`.
  const rawIndexOfLine: number[] = [];
  rawLines.forEach((raw, rawIndex) => {
    if (raw.trim()) rawIndexOfLine.push(rawIndex);
  });
  const blocks: EditorBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index];

    if (shouldStartMarkdownTable(trimmed)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (!looksLikeMarkdownTableRow(nextLine) && !isMarkdownTableSeparator(nextLine)) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "markdownTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartScheduleTable(trimmed)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (/^Fonte:/i.test(nextLine)) break;
        if (/^5\.2\s+/i.test(nextLine)) break;
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "scheduleTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartPlainScheduleTable(trimmed)) {
      const tableLines: string[] = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (!nextLine.trim()) break;
        if (/^Fonte:/i.test(nextLine)) break;
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "plainScheduleTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartTabbedTable(trimmed, lines, index)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (/^Fonte:/i.test(nextLine)) {
          tableLines.push(nextLine);
          cursor += 1;
          break;
        }
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        const hasSeparator = nextLine.includes("\t") || / {2,}/.test(nextLine) || isMarkdownTableLine(nextLine) || isMarkdownTableSeparator(nextLine);
        const isTabular = !hasSeparator && looksLikeTabularData(lines, cursor);
        if (!hasSeparator && !isTabular) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "tabbedTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^###\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading3"), text });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^##\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading2"), text });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      const text = trimmed.replace(/^#\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading1"), text });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push({ type: "longQuote", text: trimmed.replace(/^>\s+/, "") });
      continue;
    }

    if (/^\[REF\]\s+/i.test(trimmed)) {
      blocks.push({ type: "reference", text: trimmed.replace(/^\[REF\]\s+/i, "") });
      continue;
    }

    if (/^\[EQ\]\s+/i.test(trimmed)) {
      const equationBody = trimmed.replace(/^\[EQ\]\s+/i, "");
      const ommlMatch = equationBody.match(OMML_CONTENT_TOKEN_PATTERN);
      if (ommlMatch) {
        blocks.push({
          type: "equation",
          text: equationBody.slice(0, ommlMatch.index).trim(),
          ommlXml: ommlContentTokenDecode(ommlMatch[1]),
        });
      } else {
        blocks.push({ type: "equation", text: equationBody });
      }
      continue;
    }

    const importedImageMatch = trimmed.match(IMPORTED_IMAGE_MARKER_PATTERN);
    if (importedImageMatch?.[1]) {
      blocks.push({ type: "importedImage", text: importedImageMatch[1] });
      continue;
    }

    const importedTableMatch = trimmed.match(IMPORTED_TABLE_MARKER_PATTERN);
    if (importedTableMatch?.[1]) {
      blocks.push({ type: "importedTable", text: importedTableMatch[1] });
      continue;
    }

    if (/^Fonte\s*:/i.test(trimmed)) {
      blocks.push({ type: "source", text: trimmed });
      continue;
    }

    const footnoteDefinitionMatch = trimmed.match(/^\[\^(\d+)\]:\s*(.*)$/);
    if (footnoteDefinitionMatch) {
      const id = footnoteDefinitionMatch[1];
      const bodyLines = [footnoteDefinitionMatch[2]];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const raw = rawLines[rawIndexOfLine[cursor]] ?? "";
        // Linhas de continuação da nota: começam com dois espaços ou tab no texto bruto.
        if (!/^\s{2,}\S|^\t/.test(raw)) break;
        bodyLines.push(raw.trim());
        cursor += 1;
      }
      blocks.push({ type: "footnoteDefinition", text: `${id}\t${bodyLines.join("\n")}` });
      index = cursor - 1;
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
  }

  return numberEquationsInBlocks(blocks);
}

/**
 * Numeração automática de equações por seção (Manual UFLA §3.2.8): equações
 * `[EQ]` sem número explícito `(n.n)` recebem `(seção.seq)` — a seção é o
 * número do último título primário (`# 1 Introdução` → "1"); sem seção
 * numerada, a sequência é simples `(1), (2)...`. Aplica-se a TODAS as linhas de
 * equação (inclusive as com OMML re-injetado da importação), e o número é
 * extraído pelo renderizador a partir do fim do texto — preview e DOCX
 * compartilham o mesmo resultado (parseEditorContent é a fonte única).
 */
export function numberEquationsInBlocks(blocks: EditorBlock[]): EditorBlock[] {
  let sectionNumber = "";
  let sectionOrdinal = 0;
  let eqIndex = 0;
  return blocks.map((block) => {
    if (block.type === "heading1") {
      sectionOrdinal += 1;
      const num = block.text.match(/^(\d+(?:\.\d+)*)/);
      sectionNumber = num ? num[1] : String(sectionOrdinal);
      eqIndex = 0;
      return block;
    }
    if (block.type === "heading2" || block.type === "heading3") return block;
    if (block.type === "equation") {
      const hasNumber = /\s*\(\d+(?:\.\d+)?\)\s*$/.test(block.text.trim());
      if (!hasNumber) {
        eqIndex += 1;
        const number = sectionNumber ? `${sectionNumber}.${eqIndex}` : String(eqIndex);
        return { ...block, text: `${block.text.replace(/\s+$/u, "")} (${number})` };
      }
      return block;
    }
    return block;
  });
}

function plainRun(text: string, size = BODY_SIZE): TextRun {
  return new TextRun({
    text,
    font: UFLA_RULES.typography.fontFamily,
    size,
    color: BLACK,
  });
}

function referenceRunToTextRun(run: ReferenceRun): TextRun {
  return new TextRun({
    text: cleanMojibakeText(run.text),
    bold: run.bold,
    italics: run.italics,
    font: REFERENCE_FONT,
    size: REFERENCE_SIZE,
    color: BLACK,
  });
}

function textRunsForSingleLine(text: string, size = BODY_SIZE): TextRun[] {
  const parsed = tokenizeMarkup(cleanMojibakeText(text));
  const runs = parsed.map((run) =>
    run.bold || run.italics
      ? new TextRun({
          text: run.text,
          bold: run.bold,
          italics: run.italics,
          font: UFLA_RULES.typography.fontFamily,
          size,
          color: BLACK,
        })
      : plainRun(run.text, size),
  );
  return runs.length ? runs : [plainRun("", size)];
}

function textRunsFromMarkup(text: string, size = BODY_SIZE): Array<TextRun | FootnoteReferenceRun | InternalHyperlink> {
  return text.split(/\n/).flatMap((line, index) => {
    const runs = textRunsWithFootnotes(line, currentFootnoteIdMap, size);
    if (index === 0) return runs;
    return [new TextRun({ break: 1 }), ...runs];
  });
}

/**
 * Converte marcadores [^N] (nota de rodapé real, word/footnotes.xml) em
 * FootnoteReferenceRun. Marcadores sem definição correspondente permanecem
 * como texto literal. Mecanismo distinto de "Fonte:" (parágrafo no corpo,
 * abaixo do elemento — nunca uma nota).
 */
export function textRunsWithFootnotes(
  text: string,
  footnoteIdMap: ReadonlyMap<number, number> | null,
  size = BODY_SIZE,
): Array<TextRun | FootnoteReferenceRun | InternalHyperlink> {
  const segments = text.split(/(\[\^\d+\]|\[x:[^\]]*\])/);
  const runs: Array<TextRun | FootnoteReferenceRun | InternalHyperlink> = [];
  for (const segment of segments) {
    if (!segment) continue;
    const footnote = /^\[\^(\d+)\]$/.exec(segment);
    if (footnote && footnoteIdMap) {
      const assignedId = footnoteIdMap.get(Number(footnote[1]));
      if (assignedId !== undefined) {
        runs.push(new FootnoteReferenceRun(assignedId));
        continue;
      }
    }
    const xref = /^\[x:([^\]~]+)(?:~([^\]]*))?\]$/.exec(segment);
    if (xref) {
      const anchor = xref[1].trim();
      const visible = (xref[2] ?? "").trim();
      const target = resolveXrefTarget(anchor, visible);
      if (target) {
        runs.push(
          new InternalHyperlink({
            anchor: target,
            children: [plainRun(visible, size)],
          }),
        );
        continue;
      }
      // sem alvo resolvido: degrada para texto plano (sem link quebrado)
      if (visible) {
        runs.push(...textRunsForSingleLine(visible, size));
        continue;
      }
      continue;
    }
    runs.push(...textRunsForSingleLine(segment, size));
  }
  return runs.length ? runs : [plainRun("", size)];
}

/**
 * Números únicos e consecutivos (1-based) por ordem de primeira ocorrência das
 * definições [^N]: no texto editado. O rótulo de exibição no Word segue a ordem
 * das chamadas no corpo; o w:id atribuído aqui mantém o DOCX válido mesmo com
 * numeração do autor fora de ordem.
 */
export function buildFootnoteIdMap(definitions: EditorBlock[]): ReadonlyMap<number, number> {
  const map = new Map<number, number>();
  let nextId = 1;
  for (const definition of definitions) {
    const separatorIndex = definition.text.indexOf("\t");
    const userNumber = Number(definition.text.slice(0, separatorIndex));
    if (!Number.isInteger(userNumber) || userNumber < 1) continue;
    if (!map.has(userNumber)) map.set(userNumber, nextId++);
  }
  return map;
}

/**
 * Parágrafo da nota em word/footnotes.xml: 11 pt (w:sz 22), espaço simples
 * (w:line 240), Times New Roman, alinhamento justificado, segunda linha abaixo
 * da primeira letra da primeira palavra (recuo esquerdo com avanço).
 */
export function footnoteParagraph(body: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE_LINE, after: 0 },
    indent: { left: 340, hanging: 340 },
    children: textRunsFromMarkup(cleanMojibakeText(body) || " ", FOOTNOTE_SIZE),
  });
}

function tableNoteParagraph(body: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE_LINE, after: 0 },
    indent: { left: 340, hanging: 340 },
    children: textRunsFromMarkup(cleanMojibakeText(body) || " ", FOOTNOTE_SIZE),
  });
}

export function buildFootnotes(
  parsedBlocks: EditorBlock[],
  footnoteIdMap: ReadonlyMap<number, number>,
): Record<string, { children: Paragraph[] }> {
  const footnotes: Record<string, { children: Paragraph[] }> = {};
  for (const definition of parsedBlocks) {
    if (definition.type !== "footnoteDefinition") continue;
    const separatorIndex = definition.text.indexOf("\t");
    const userNumber = Number(definition.text.slice(0, separatorIndex));
    const assignedId = footnoteIdMap.get(userNumber);
    if (assignedId === undefined) continue;
    footnotes[String(assignedId)] = {
      children: [footnoteParagraph(definition.text.slice(separatorIndex + 1))],
    };
  }
  return footnotes;
}

export function buildReferenceFootnoteDefinitions(references: string[]): EditorBlock[] {
  return references.map((ref, index) => ({
    type: "footnoteDefinition" as const,
    text: `${index + 1}\t${ref}`,
  }));
}

export function appendFootnoteMarkers(text: string, count: number): string {
  if (count <= 0) return text;
  const markers = Array.from({ length: count }, (_, i) => `[^${i + 1}]`).join("");
  const trimmed = text.trimEnd();
  if (!trimmed) return markers;
  return `${trimmed} ${markers}`;
}

export function looksLikeReferenceLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return false;
  const upper = trimmed.toUpperCase();
  if (/^(ANEXO|APÊNDICE|ANEXO\s+[A-Z]|APÊNDICE\s+[A-Z])/.test(upper)) return false;
  if (/^(REFERÊNCIAS|REFERENCIAS|BIBLIOGRAFIA|BIBLIOGRAPHY)/.test(upper)) return false;
  if (/^\d+\.\s*[A-ZÀ-Ú]/.test(trimmed)) return true;
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s.]+,\s*[A-ZÀ-Ú]/.test(trimmed)) return true;
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s.]+\.\s*\(\d{4}\)/.test(trimmed)) return true;
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s.]+,\s*\d{4}/.test(trimmed)) return true;
  return false;
}

export function extractReferencesFromText(text: string): { cleaned: string; references: string[] } {
  const lines = text.split(/\n+/);
  const cleanedLines: string[] = [];
  const references: string[] = [];
  for (const line of lines) {
    if (looksLikeReferenceLine(line)) {
      references.push(line.trim());
    } else {
      cleanedLines.push(line);
    }
  }
  return { cleaned: cleanedLines.join("\n"), references };
}

function textParagraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function simpleParagraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    style: "ufla_corpo_texto",
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function centeredParagraph(
  text: string,
  bold = false,
  size = BODY_SIZE,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: UFLA_RULES.spacing.afterPrimaryTitleTwip },
  style?: string,
): Paragraph {
  return new Paragraph({
    ...(style ? { style } : {}),
    alignment: AlignmentType.CENTER,
    spacing,
    children: [
      new TextRun({
        text,
        bold,
        font: UFLA_RULES.typography.fontFamily,
        size,
        color: BLACK,
      }),
    ],
  });
}

function logoParagraph(logo?: DocxLogoAsset): Paragraph[] {
  if (!logo) {
    return [
      centeredParagraph("UNIVERSIDADE FEDERAL DE LAVRAS", true, COVER_AUTHOR_SIZE, {
        after: 0,
        line: SINGLE_LINE,
      }),
    ];
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new ImageRun({
          data: logo.data,
          transformation: {
            width: logo.width ?? UFLA_LOGO_WIDTH_PX,
            height: logo.height ?? UFLA_LOGO_HEIGHT_PX,
          },
          altText: {
            title: "Logo UFLA",
            description: "Universidade Federal de Lavras",
            name: "Logo UFLA",
          },
        }),
      ],
    }),
  ];
}

function sectionTitle(text: string, style = "ufla_titulo_sem_indicativo"): Paragraph {
  return new Paragraph({
    style,
    alignment: AlignmentType.CENTER,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
    ],
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function parseScheduleRow(line: string): ScheduleRow | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(1º semestre|2º semestre|3º semestre|4º semestre)\s+(\d+\s+a\s+\d+)\s+(.+?\/\d{4}\s+a\s+.+?\/\d{4})(.*)$/i,
  );

  if (!match) return null;

  return {
    etapa: match[1],
    meses: match[2],
    periodo: match[3].trim(),
    atividades: match[4].trim(),
  };
}

function scheduleRowsFromBlock(text: string): { caption: string; rows: ScheduleRow[]; source: string; notes: string[] } {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const caption = lines[0] || "Quadro 1 - Cronograma de execução da pesquisa";
  const rows: ScheduleRow[] = [];
  let source = "Fonte: elaborado pelo autor (2026).";
  const notes: string[] = [];

  for (const line of lines.slice(1)) {
    if (/^Fonte:/i.test(line)) {
      source = line;
      continue;
    }

    if (/^Etapa\s+Meses\s+Per/i.test(line)) continue;

    if (/^(Nota|Obs|Observação):/i.test(line)) {
      notes.push(line);
      continue;
    }

    if (looksLikeScheduleRow(line)) {
      const row = parseScheduleRow(line);
      if (row) rows.push(row);
      continue;
    }

    if (rows.length) {
      rows[rows.length - 1].atividades = `${rows[rows.length - 1].atividades} ${line}`.trim();
    }
  }

  return { caption, rows, source, notes };
}

function markdownTableBlock(text: string): Array<Paragraph | Table> {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tableLines: string[] = [];
  const noteLines: string[] = [];
  let inTable = true;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (inTable && isMarkdownTableSeparator(line)) continue;
    if (inTable && line.includes("|")) {
      tableLines.push(line);
      continue;
    }
    inTable = false;
    if (/^(Nota|Obs|Observação|Fonte):/i.test(line)) {
      noteLines.push(line);
    }
  }

  const rows = tableLines
    .map((line) =>
      line
        .replace(/^\s*\|/, "")
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 2);

  if (!rows.length) return [simpleParagraph(text)];

  const columnCount = rows.reduce((max, cells) => Math.max(max, cells.length), 0);

  const tableRows = rows.map((cells, rowIndex) => {
    const tableCells = Array.from({ length: columnCount }, (_, columnIndex) => {
      const cellText = cells[columnIndex] ?? "";
      return new TableCell({
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: SINGLE_LINE, after: 0 },
            children: [
              new TextRun({
                text: cellText,
                bold: rowIndex === 0,
                font: UFLA_RULES.typography.fontFamily,
                size: BODY_SIZE,
                color: BLACK,
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({ ...(rowIndex === 0 ? { tableHeader: true } : {}), children: tableCells });
  });

  const result: Array<Paragraph | Table> = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: Array.from({ length: columnCount }, () => Math.floor(100 / columnCount)),
      rows: tableRows,
    }),
  ];

  for (const noteLine of noteLines) {
    result.push(tableNoteParagraph(noteLine));
  }

  return result;
}

const SOURCE_FONT_SIZE = UFLA_RULES.typography.sourceFontSizePt * 2;

function plainScheduleTableBlock(text: string): Array<Paragraph | Table> {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) return [simpleParagraph(text)];

  const multiColumn = /[\t]| {2,}/.test(text);
  const toCells = (line: string): string[] => (multiColumn ? splitScheduleColumns(line) : [line]);

  const tableLines: string[] = [];
  const noteLines: string[] = [];
  let inTable = true;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (inTable && /^(Nota|Obs|Observação|Fonte):/i.test(line)) {
      noteLines.push(line);
      continue;
    }
    if (inTable && (/^(Etapa|Meses|Per|Importar|Testar)/i.test(line) || looksLikeScheduleRow(line))) {
      tableLines.push(line);
      continue;
    }
    inTable = false;
  }

  const headerCells = toCells(tableLines[0] ?? rawLines[0]);
  const columnCount = Math.max(headerCells.length, 1);

  const tableRows = tableLines.map((line, rowIndex) => {
    const cells = toCells(line);
    const padded = Array.from({ length: columnCount }, (_, columnIndex) => cells[columnIndex] ?? "");
    const tableCells = padded.map((cellText) => {
      const cleaned = cleanMojibakeText(cellText);
      return new TableCell({
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: SINGLE_LINE, after: 0 },
            children: [
              new TextRun({
                text: cleaned,
                bold: rowIndex === 0,
                font: UFLA_RULES.typography.fontFamily,
                size: BODY_SIZE,
                color: BLACK,
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({ ...(rowIndex === 0 ? { tableHeader: true } : {}), children: tableCells });
  });

  const result: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120, line: SINGLE_LINE },
      children: [
        new TextRun({ text: "Quadro - Cronograma de execução da pesquisa", font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: Array.from({ length: columnCount }, () => Math.floor(100 / columnCount)),
      rows: tableRows,
    }),
  ];

  if (noteLines.length) {
    for (const noteLine of noteLines) {
      result.push(tableNoteParagraph(noteLine));
    }
  } else {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: "Fonte: elaborado pelo autor.", font: UFLA_RULES.typography.fontFamily, size: SOURCE_FONT_SIZE, color: BLACK })],
      }),
    );
  }

  return result;
}

function scheduleTableBlock(text: string): Array<Paragraph | Table> {
  const { caption, rows, source, notes } = scheduleRowsFromBlock(text);
  const ibge = ibgeTable({
    headerLabels: ["Etapa", "Meses", "Período", "Atividades principais"],
    columnWidths: [17, 13, 24, 46],
    rows: rows.map((row) => [row.etapa, row.meses, row.periodo, row.atividades]),
  });

  const result: Array<Paragraph | Table> = [
    bookmarkedCaptionParagraph(caption, "table", captionBookmarkId(cleanMojibakeText(caption))),
    ibge,
    new Paragraph({
      style: "ufla_fonte_tabela",
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120, line: SINGLE_LINE },
      children: [
        new TextRun({
          text: source,
          font: UFLA_RULES.typography.fontFamily,
          size: SOURCE_FONT_SIZE,
          color: BLACK,
        }),
      ],
    }),
  ];

  for (const note of notes) {
    result.push(tableNoteParagraph(note));
  }

  return result;
}

export function importedImageParagraph(
  image: ImportedDocumentImage | undefined,
  markerText?: string,
): Paragraph[] {
  if (!image) {
    // A3 do checklist-14: id inválido/stale NÃO pode sumir do DOCX — emite
    // placeholder visível (mantendo o id do marcador do rascunho).
    const id = markerText?.trim() ? ` (id: ${markerText.trim()})` : "";
    return [
      simpleParagraph(
        `[Imagem importada: dados originais indisponíveis${id} — reinsira manualmente esta imagem no documento final]`,
      ),
    ];
  }

  const result: Paragraph[] = [];

  if (image.data?.byteLength) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new ImageRun({
            data: image.data,
            transformation: {
              width: image.width ?? 420,
              height: image.height ?? 260,
            },
            altText: {
              title: image.caption || image.fileName || image.id,
              description: image.source || "Imagem importada do DOCX original",
              name: image.fileName || image.id,
            },
          }),
        ],
      }),
    );
  } else {
    result.push(
      simpleParagraph(
        `[IMAGEM DETECTADA] ${image.caption ? image.caption + ". " : ""}Reinsira manualmente esta imagem no documento final.`,
      ),
    );
  }

  if (image.caption) {
    const captionText = cleanMojibakeText(image.caption);
    const fonteMatch = captionText.match(/^(.*?)(\s*Fonte:.*)$/is);
    if (fonteMatch) {
      const captionPart = fonteMatch[1].trim();
      const fontePart = fonteMatch[2].trim();
      result.push(
        bookmarkedCaptionParagraph(captionPart, "illustration", captionBookmarkId(captionText)),
      );
      result.push(sourceParagraph(fontePart, "illustration"));
    } else {
      result.push(
        bookmarkedCaptionParagraph(captionText, "illustration", captionBookmarkId(captionText)),
      );
    }
  }

  if (image.source) {
    result.push(sourceParagraph(cleanMojibakeText(image.source)));
  }

  return result;
}

/**
 * Padrões de linha-título que precedem a linha de rótulos (header) em tabelas
 * convertidas de PDF (ex.: "Tema: ...", "Cronograma de ações...").
 */
const TABLE_TITLE_ROW_PATTERNS = [
  /^Tema\s*[:\\-–]/i,
  /^Tema\s+geral\s*[:\\-–]/i,
  /^Cronograma\s+de\s+ações/i,
  /^Cronograma\s+de\s+acoes/i,
  /^Avaliação\s+dos\s+repositórios/i,
  /^Avaliacao\s+dos\s+repositorios/i,
  /^Política\s+Institucional\s+de\s+Informação/i,
  /^Politica\s+Institucional\s+de\s+Informacao/i,
  /^Objetivos?\s+do\s+RI/i,
  /^Planejamento\s+para\s+a\s+implementação/i,
  /^Planejamento\s+para\s+a\s+implementacao/i,
  /^Quadro\s*\d+\s*[:\\-–]/i,
  /^Tabela\s*\d+\s*[:\\-–]/i,
];

function rowTextOf(cells: Array<{ text?: string } | string | undefined>): string {
  return cells
    .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeTableTitleRow(cells: Array<{ text?: string } | string | undefined>): boolean {
  const text = rowTextOf(cells);
  return TABLE_TITLE_ROW_PATTERNS.some((p) => p.test(text));
}

function looksLikeTableHeaderRow(cells: Array<{ text?: string } | string | undefined>): boolean {
  const text = rowTextOf(cells);
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  // rótulos curtos/uppercase — distingue de conteúdo de dados (frases longas)
  const shortCells = cells.filter((c) => (typeof c === "string" ? c.trim() : (c?.text ?? "").trim())).length;
  const avgLen = words.join("").length / words.length;
  return shortCells >= 2 && avgLen <= 14;
}

/**
 * Infere a linha de cabeçalho de tabela importada quando a origem não declara
 * w:tblHeader (baseline convertido de PDF): título na 1ª linha + rótulos na 2ª
 * → header na 2ª; rótulos na 1ª → header na 1ª; 1 linha → sem header
 * (WCAG 1.3.1 / DECISION-002: linha única não tem cabeçalho).
 */
export function inferTableHeaderRow(
  rows: ImportedTable["rows"],
  declaredIndex: number | undefined,
): number | undefined {
  if (declaredIndex !== undefined) return declaredIndex;
  if (rows.length < 2) return undefined;
  const first = rows[0];
  const second = rows[1];
  if (looksLikeTableTitleRow(first) && looksLikeTableHeaderRow(second)) {
    return 1;
  }
  if (looksLikeTableHeaderRow(first)) {
    return 0;
  }
  return undefined;
}

function normalizeConsecutiveRestarts(
  merges: ImportedTable["cellMerges"],
): ImportedTable["cellMerges"] {
  if (!merges?.length) return merges;

  const byColumn = new Map<number, Array<{ row: number; type: string }>>();
  for (const m of merges) {
    if (m.type !== "vMerge-restart") continue;
    const list = byColumn.get(m.col) || [];
    list.push({ row: m.row, type: m.type });
    byColumn.set(m.col, list);
  }

  const result = [...merges];
  for (const [col, restarts] of byColumn) {
    if (restarts.length <= 1) continue;
    restarts.sort((a, b) => a.row - b.row);
    for (let i = 1; i < restarts.length; i++) {
      const idx = result.findIndex((m) => m.row === restarts[i].row && m.col === col && m.type === "vMerge-restart");
      if (idx >= 0) {
        result[idx] = { ...result[idx], type: "vMerge-continue" };
      }
    }
  }

  return result;
}

function reconstructedColumnWidths(table: ImportedTable): number[] {
  const reconstructed = table.reconstructedTable;
  const count = reconstructed?.headers.length ?? 1;
  if (reconstructed?.pattern === "grouped-with-authors" || reconstructed?.pattern === "advantages-disadvantages" || reconstructed?.pattern === "critical-points" || reconstructed?.pattern === "generic-academic") {
    return count === 3 ? [20, 50, 30] : Array.from({ length: count }, () => Math.floor(100 / count));
  }
  if (reconstructed?.pattern === "chronological") {
    return count === 3 ? [15, 30, 55] : Array.from({ length: count }, () => Math.floor(100 / count));
  }
  return Array.from({ length: count }, () => Math.floor(100 / count));
}

export function semanticReconstructedTableParagraph(table: ImportedTable): Array<Paragraph | Table> {
  const reconstructed = table.reconstructedTable;
  if (!reconstructed || !reconstructed.rows.length) return [];

  const widths = reconstructedColumnWidths(table);
  const result: Array<Paragraph | Table> = [];

  if (table.caption || reconstructed.caption) {
    const captionCleaned = cleanMojibakeText(table.caption || reconstructed.caption || "");
    const fonteMatch = captionCleaned.match(/^(.*?)(\s*Fonte:.*)$/is);
    if (fonteMatch) {
      result.push(bookmarkedCaptionParagraph(fonteMatch[1].trim(), "table", captionBookmarkId(captionCleaned)));
      result.push(sourceParagraph(fonteMatch[2].trim(), "table"));
    } else {
      result.push(bookmarkedCaptionParagraph(captionCleaned, "table", captionBookmarkId(captionCleaned)));
    }
  }

  const hasRealHeaders = reconstructed.headers.some((header) => header.trim());
  const headerRow = hasRealHeaders
    ? new TableRow({
        tableHeader: true,
        children: reconstructed.headers.map((header, index) => new TableCell({
          width: { size: widths[index] ?? Math.floor(100 / reconstructed.headers.length), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: SINGLE_LINE, after: 0 },
              children: [new TextRun({ text: cleanMojibakeText(header), bold: true, font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK })],
            }),
          ],
        })),
      })
    : null;

  const bodyRows = reconstructed.rows.map((row, rowIndex) => {
    const cells = Array.from({ length: reconstructed.headers.length }, (_, index) => row.cells[index] ?? "");
    return new TableRow({
      children: cells.map((cellText, columnIndex) => {
        let displayText = cellText;
        if (columnIndex === 0 && rowIndex > 0 && cellText && reconstructed.rows[rowIndex - 1]?.cells[0] === cellText) {
          displayText = "";
        }
        return new TableCell({
          width: { size: widths[columnIndex] ?? Math.floor(100 / reconstructed.headers.length), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: SINGLE_LINE, after: 0 },
              children: [new TextRun({ text: cleanMojibakeText(displayText), font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK })],
            }),
          ],
        });
      }),
    });
  });

  const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
  result.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: SOLID_BORDER,
        bottom: SOLID_BORDER,
        left: SOLID_BORDER,
        right: SOLID_BORDER,
        insideHorizontal: SOLID_BORDER,
        insideVertical: SOLID_BORDER,
      },
      rows: [...(headerRow ? [headerRow] : []), ...bodyRows],
    }),
  );

  if (table.source || reconstructed.source) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(table.source || reconstructed.source || ""), font: UFLA_RULES.typography.fontFamily, size: SOURCE_FONT_SIZE, color: BLACK })],
      }),
    );
  }

  const warning = reconstructed.warnings[0] || table.layoutWarning;
  if (warning) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(warning), italics: true, font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK })],
      }),
    );
  }

  return result;
}

export function importedTableParagraph(table: ImportedTable | undefined): Array<Paragraph | Table> {
  if (!table || !table.rows.length) return [];

  if (table.renderMode === "semantic-reconstructed-table") {
    return semanticReconstructedTableParagraph(table);
  }

  if (table.status === "rendered-as-structured-text") {
    const result: Array<Paragraph | Table> = [];
    if (table.caption) {
      const captionCleaned = cleanMojibakeText(table.caption);
      const fonteMatch = captionCleaned.match(/^(.*?)(\s*Fonte:.*)$/is);
      if (fonteMatch) {
        result.push(bookmarkedCaptionParagraph(fonteMatch[1].trim(), "table", captionBookmarkId(captionCleaned)));
        result.push(sourceParagraph(fonteMatch[2].trim(), "table"));
      } else {
        result.push(bookmarkedCaptionParagraph(captionCleaned, "table", captionBookmarkId(captionCleaned)));
      }
    }

    const structuredText = buildStructuredTextFromTable(table);
    for (const line of structuredText.split("\n")) {
      if (!line.trim()) continue;
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: SINGLE_LINE, after: 120 },
          children: [
            new TextRun({
              text: cleanMojibakeText(line),
              font: UFLA_RULES.typography.fontFamily,
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    if (table.source) {
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 120, after: 120, line: SINGLE_LINE },
          children: [
            new TextRun({
              text: cleanMojibakeText(table.source),
              font: UFLA_RULES.typography.fontFamily,
              size: SOURCE_FONT_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    if (table.layoutWarning) {
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 120, after: 120, line: SINGLE_LINE },
          children: [
            new TextRun({
              text: cleanMojibakeText(table.layoutWarning),
              italics: true,
              font: UFLA_RULES.typography.fontFamily,
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    return result;
  }

  const columnCount = Math.max(table.columnCount, 1);
  const widths = table.estimatedColumnWidths ?? Array.from({ length: columnCount }, () => Math.floor(100 / columnCount));
  const safeWidths = widths.map((w) => Math.max(5, w));
  const widthTotal = safeWidths.reduce((sum, w) => sum + w, 0);
  const normalizedWidths = safeWidths.map((w) => Math.round((w / widthTotal) * 100));

  const normalizedMerges = normalizeConsecutiveRestarts(table.cellMerges);

  // Linha de cabeçalho semântica: usa o headerRowIndex da origem quando
  // presente; senão INFERE pela estrutura (tabelas importadas de DOCX sem
  // w:tblHeader explícito, como o baseline convertido de PDF):
  //  - 1ª linha = título ("Tema:...", "Cronograma...") + 2ª linha = rótulos →
  //    header na 2ª linha;
  //  - 1ª linha = rótulos → header na 1ª linha;
  //  - 1 linha única → sem header (WCAG 1.3.1 / DECISION-002).
  const inferredHeaderRowIndex = inferTableHeaderRow(table.rows, table.headerRowIndex);

  const tableRows = table.rows.map((cells, rowIndex) => {
    const padded = Array.from({ length: columnCount }, (_, i) => (cells[i]?.text ?? "").trim());
    return new TableRow({
      ...(inferredHeaderRowIndex !== undefined && rowIndex === inferredHeaderRowIndex ? { tableHeader: true } : {}),
      children: padded.map((cellText, columnIndex) => {
        const originalMerge = normalizedMerges?.find(
          (m) => m.row === rowIndex && m.col === columnIndex,
        );
        let verticalMerge: "continue" | "restart" | undefined;
        if (originalMerge) {
          if (originalMerge.type === "vMerge-restart") verticalMerge = "restart";
          else if (originalMerge.type === "vMerge-continue") verticalMerge = "continue";
        } else if (
          table.groupColumnIndex === 0 &&
          columnIndex === 0 &&
          table.groupSpans &&
          table.hasReconstructedVerticalMerge
        ) {
          const inSpan = table.groupSpans.find((s) => rowIndex >= s.rowStart && rowIndex <= s.rowEnd);
          if (inSpan) {
            verticalMerge = rowIndex === inSpan.rowStart ? "restart" : "continue";
          }
        }

        return new TableCell({
          width: { size: normalizedWidths[columnIndex] ?? Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          ...(verticalMerge ? { verticalMerge } : {}),
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: SINGLE_LINE, after: 0 },
              children: [
                new TextRun({
                  text: cleanMojibakeText(cellText),
                  bold: rowIndex === 0,
                  font: UFLA_RULES.typography.fontFamily,
                  size: BODY_SIZE,
                  color: BLACK,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  const result: Array<Paragraph | Table> = [];
  if (table.caption) {
    const captionCleaned = cleanMojibakeText(table.caption);
    const fonteMatch = captionCleaned.match(/^(.*?)(\s*Fonte:.*)$/is);
    if (fonteMatch) {
      result.push(bookmarkedCaptionParagraph(fonteMatch[1].trim(), "table", captionBookmarkId(captionCleaned)));
      result.push(sourceParagraph(fonteMatch[2].trim(), "table"));
    } else {
      result.push(bookmarkedCaptionParagraph(captionCleaned, "table", captionBookmarkId(captionCleaned)));
    }
  }

  const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
  result.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: SOLID_BORDER,
        bottom: SOLID_BORDER,
        left: SOLID_BORDER,
        right: SOLID_BORDER,
        insideHorizontal: SOLID_BORDER,
        insideVertical: SOLID_BORDER,
      },
      rows: tableRows,
    }),
  );

  if (table.source) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new TextRun({
            text: cleanMojibakeText(table.source),
            font: UFLA_RULES.typography.fontFamily,
            size: SOURCE_FONT_SIZE,
            color: BLACK,
          }),
        ],
      }),
    );
  }

  return result;
}

/** Largura útil do retrato A4 (11906 − margem esq. 1701 − dir. 1134 twips). */
const PORTRAIT_CONTENT_TWIP = UFLA_RULES.page.widthTwip - 1701 - 1134;
const LANDSCAPE_MIN_COLUMNS = 6;

function editorTableColumnCount(block: EditorBlock): number {
  if (block.type === "markdownTable") {
    let max = 0;
    for (const line of block.text.split(/\n+/)) {
      const trimmed = line.trim();
      if (!trimmed.includes("|")) continue;
      if (isMarkdownTableSeparator(trimmed)) continue;
      const cells = trimmed.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
      if (cells.length >= 2) max = Math.max(max, cells.length);
    }
    return max;
  }
  if (block.type === "tabbedTable") {
    const detected = detectTabbedTableBlock(block.text);
    if (detected) return Math.max(...detected.rows.map((r) => r.length), 1);
  }
  return 1;
}

/**
 * Decide se um bloco exige seção paisagem (tabela larga): tabela importada de
 * seção landscape na origem, largura OOXML maior que o retrato útil, ou tabela
 * do editor com 6+ colunas (Manual/NBR 14724: elementos extensos em paisagem).
 */
export function tableNeedsLandscape(block: EditorBlock, importedTables: ImportedTable[] = []): boolean {
  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    if (!table) return false;
    if (table.orientation === "landscape") return true;
    if (table.tableWidthTwips && table.tableWidthTwips > PORTRAIT_CONTENT_TWIP) return true;
    return table.columnCount >= LANDSCAPE_MIN_COLUMNS;
  }
  if (block.type === "markdownTable" || block.type === "tabbedTable") {
    return editorTableColumnCount(block) >= LANDSCAPE_MIN_COLUMNS;
  }
  return false;
}

function blockToParagraph(
  block: EditorBlock,
  isFirstTextualBlock: boolean = false,
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): Array<Paragraph | Table> {
  if (block.type === "heading1") {
    const bookmarkId = sectionBookmarkId(block.text);
    const numericId = nextListBookmarkNumericId();
    const title = new Paragraph({
      style: "ufla_titulo_primario",
      alignment: AlignmentType.LEFT,
      spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
      children: [
        new BookmarkStart(bookmarkId, numericId),
        new TextRun({
          text: block.text.toUpperCase(),
          bold: true,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
        new BookmarkEnd(numericId),
      ],
    });

    return isFirstTextualBlock ? [title] : [pageBreak(), title];
  }

  if (block.type === "heading2") {
    const bookmarkId = sectionBookmarkId(block.text);
    const numericId = nextListBookmarkNumericId();
    return [
      new Paragraph({
        style: "ufla_titulo_secundario",
        spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
        children: [
          new BookmarkStart(bookmarkId, numericId),
          new TextRun({
            text: block.text,
            font: UFLA_RULES.typography.fontFamily,
            size: BODY_SIZE,
            color: BLACK,
          }),
          new BookmarkEnd(numericId),
        ],
      }),
    ];
  }

  if (block.type === "heading3") {
    const bookmarkId = sectionBookmarkId(block.text);
    const numericId = nextListBookmarkNumericId();
    return [
      new Paragraph({
        style: "ufla_titulo_terciario",
        spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
        children: [
          new BookmarkStart(bookmarkId, numericId),
          new TextRun({
            text: block.text,
            bold: true,
            font: UFLA_RULES.typography.fontFamily,
            size: BODY_SIZE,
            color: BLACK,
          }),
          new BookmarkEnd(numericId),
        ],
      }),
    ];
  }

  if (block.type === "equation") {
    return [rawOmmlMarkerParagraph(block.text, block.ommlXml)];
  }

  if (block.type === "longQuote") {
    return [
      new Paragraph({
        style: "ufla_citacao_longa",
        alignment: AlignmentType.BOTH,
        spacing: { line: SINGLE_LINE, after: 120 },
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
        children: textRunsFromMarkup(block.text, LONG_QUOTE_SIZE),
      }),
    ];
  }

  if (block.type === "scheduleTable") {
    return scheduleTableBlock(block.text);
  }

  if (block.type === "plainScheduleTable") {
    return plainScheduleTableBlock(block.text);
  }

  if (block.type === "markdownTable") {
    return markdownTableBlock(block.text);
  }

  if (block.type === "tabbedTable") {
    return tabbedTableBlock(block.text);
  }

  if (block.type === "importedImage") {
    return importedImageParagraph(
      importedImages.find((image) => image.id === block.text),
      block.text,
    );
  }

  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    if (table) return importedTableParagraph(table);
    return [simpleParagraph("[Tabela importada: dados originais indisponíveis — reinsira manualmente]")];
  }

  if (block.type === "source") {
    return [sourceParagraph(block.text)];
  }

  const cleanedText = cleanMojibakeText(block.text);

  if (IMPORTED_TABLE_MARKER_PATTERN.test(cleanedText) || IMPORTED_IMAGE_MARKER_PATTERN.test(cleanedText)) {
    return [simpleParagraph("[Elemento importado: dados originais indisponíveis — reinsira manualmente]")];
  }

  const caption = detectCaption(cleanedText);
  if (caption) {
    const captionText = cleanedText;
    const fonteMatch = captionText.match(/^(.*?)(\s*Fonte:.*)$/is);
    if (fonteMatch) {
      const captionPart = fonteMatch[1].trim();
      const fontePart = fonteMatch[2].trim();
      return [
        bookmarkedCaptionParagraph(captionPart, caption.kind, captionBookmarkId(captionText)),
        sourceParagraph(fontePart, caption.kind),
      ];
    }
    return [bookmarkedCaptionParagraph(cleanedText, caption.kind, captionBookmarkId(cleanedText))];
  }

  if (/^Fonte\s*:/i.test(cleanedText)) {
    return [sourceParagraph(cleanedText)];
  }

  if (isShortCitationParagraph(cleanedText)) {
    return [
      new Paragraph({
        style: "ufla_citacao_curta",
        alignment: AlignmentType.BOTH,
        spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
        indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
        children: textRunsFromMarkup(cleanedText),
      }),
    ];
  }

  return [textParagraph(cleanedText)];
}

/** Citação direta curta (Manual §20.1): até 3 linhas, iniciada entre aspas duplas e fechada adiante no parágrafo. */
function isShortCitationParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\n+/).length > 3) return false;
  return /^[“"]/.test(trimmed) && /[”"][\s\S]*$/.test(trimmed.slice(1));
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSimpleParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) => simpleParagraph(line));
}

interface SummaryEntry {
  text: string;
  level: 1 | 2 | 3;
}

function summaryLevelForBlock(block: EditorBlock): SummaryEntry["level"] | null {
  if (block.type === "heading1") return 1;
  if (block.type === "heading2") return 2;
  if (block.type === "heading3") return 3;
  return null;
}

function summaryEntryParagraph(entry: SummaryEntry): Paragraph {
  return new Paragraph({
    style: "ufla_sumario_item",
    spacing: { before: 0, after: 0, line: SINGLE_LINE },
    indent: { left: (entry.level - 1) * 360 },
    children: [
      new TextRun({
        text: cleanMojibakeText(entry.text),
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
        bold: entry.level === 1,
      }),
    ],
  });
}

function addSummaryEntry(entries: SummaryEntry[], seen: Set<string>, text: string, level: SummaryEntry["level"]): void {
  const cleaned = cleanMojibakeText(text).trim();
  const key = normalizeForDetection(cleaned);
  if (!cleaned || key === "SUMARIO" || seen.has(key)) return;
  seen.add(key);
  entries.push({ text: cleaned, level });
}

function collectSummaryEntries(bodyBlocks: EditorBlock[], references: string[], fields: AcademicFields): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  const seen = new Set<string>();

  for (const block of bodyBlocks) {
    const level = summaryLevelForBlock(block);
    if (level) addSummaryEntry(entries, seen, level === 1 ? block.text.toUpperCase() : block.text, level);
  }

  if (references.length > 0) addSummaryEntry(entries, seen, "REFERÊNCIAS", 1);
  if (fields.anexos) addSummaryEntry(entries, seen, "ANEXOS", 1);
  if (fields.apendices) addSummaryEntry(entries, seen, appendixTitle(fields), 1);
  if (fields.indice) addSummaryEntry(entries, seen, "ÍNDICE", 1);

  return entries;
}

function getAuthorKey(ref: NormalizedReference): string {
  const text = ref.text.trim();
  const commaIndex = text.indexOf(",");
  if (commaIndex > 0) {
    return text.substring(0, commaIndex).trim();
  }
  const firstSpace = text.search(/\s/);
  return firstSpace > 0 ? text.substring(0, firstSpace) : text;
}

function buildReferences(references: string[]): Paragraph[] {
  const normalized = normalizeReferences(references);
  const seen = new Set<string>();
  const deduped = normalized.filter((ref) => {
    const key = ref.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped
    .sort((a, b) => {
      const aKey = getAuthorKey(a);
      const bKey = getAuthorKey(b);
      return aKey.localeCompare(bKey, "pt-BR", { sensitivity: "base" });
    })
    .map(
      (reference) =>
        new Paragraph({
          style: "ufla_referencia",
          alignment: AlignmentType.LEFT,
          spacing: { line: SINGLE_LINE, after: SINGLE_LINE },
          indent: { left: cmToTwip(0.5), hanging: cmToTwip(0.5) },
          children: reference.runs.length
            ? reference.runs.map(referenceRunToTextRun)
            : [referenceRunToTextRun({ text: reference.text || " " })],
        }),
    );
}

function hasEditorHeading(blocks: EditorBlock[], heading: string): boolean {
  const target = normalizeForDetection(heading);
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      normalizeForDetection(block.text).includes(target),
  );
}

function normalizedHeadingBase(text: string): string {
  return normalizeForDetection(text).replace(/^\d+(?:\.\d+)*\s*/, "");
}

function isReferencesSectionHeading(block: EditorBlock): boolean {
  if (block.type !== "heading1" && block.type !== "heading2") return false;
  const base = normalizedHeadingBase(block.text);
  return base === "REFERENCIAS" || base === "REFERENCIAS BIBLIOGRAFICAS" || base === "BIBLIOGRAFICAS";
}

// Extrai a seção REFERÊNCIAS/BIBLIOGRÁFICAS que o usuário digitou no editor
// (heading + parágrafos de referência), removendo-a do corpo e devolvendo os
// textos como referências para a seção dedicada. Evita duplicação quando o
// mesmo conteúdo também existe no campo `referencias`.
export function extractReferencesSection(bodyBlocks: EditorBlock[]): {
  bodyBlocks: EditorBlock[];
  references: string[];
} {
  const filtered: EditorBlock[] = [];
  const references: string[] = [];
  let inReferences = false;

  for (const block of bodyBlocks) {
    if (!inReferences) {
      if (isReferencesSectionHeading(block)) {
        inReferences = true;
        continue;
      }
      filtered.push(block);
      continue;
    }
    if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") {
      inReferences = false;
      filtered.push(block);
      continue;
    }
    if (block.type === "paragraph" || block.type === "reference" || block.type === "source") {
      if (block.text.trim()) references.push(block.text);
      continue;
    }
    filtered.push(block);
  }

  return { bodyBlocks: filtered, references };
}

function isConclusionEquivalentHeading(text: string): boolean {
  return ["CONCLUSAO", "CONSIDERACOES FINAIS"].includes(normalizedHeadingBase(text));
}

function hasEditorConclusionHeading(blocks: EditorBlock[]): boolean {
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      isConclusionEquivalentHeading(block.text),
  );
}

function usesFinalConsiderationsHeading(blocks: EditorBlock[]): boolean {
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      normalizedHeadingBase(block.text) === "CONSIDERACOES FINAIS",
  );
}

function fieldSectionBlocks(fields: AcademicFields, bodyBlocks: EditorBlock[]): EditorBlock[] {
  const nextBlocks = [...bodyBlocks];

  if (fields.introducao && !hasEditorHeading(nextBlocks, "INTRODUCAO")) {
    nextBlocks.unshift(
      { type: "heading1", text: "1 INTRODUÇÃO" },
      ...splitParagraphs(fields.introducao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  if (fields.conclusao && !hasEditorConclusionHeading(nextBlocks)) {
    nextBlocks.push(
      {
        type: "heading1",
        text: usesFinalConsiderationsHeading(nextBlocks) ? "5 CONSIDERAÇÕES FINAIS" : "5 CONCLUSÃO",
      },
      ...splitParagraphs(fields.conclusao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  return nextBlocks;
}

function isImpactIndicatorsHeading(block: EditorBlock): boolean {
  if (block.type !== "heading1" && block.type !== "heading2") return false;
  return normalizeForDetection(block.text).includes("INDICADORES DE IMPACTO");
}

// Tese/dissertação já geram os indicadores como bloco pré-textual (parágrafo único).
// Para não duplicar em lista no corpo textual, removemos a seção "INDICADORES DE IMPACTO"
// importada/escrita no editor quando o bloco pré-textual é gerado.
function renumberBodySections(blocks: EditorBlock[], removedImpactNumber?: number): EditorBlock[] {
  if (!removedImpactNumber) return blocks;

  return blocks.map((block) => {
    if (block.type === "heading1") {
      const match = block.text.match(/^(\d+)\s+(.*)$/);
      if (match && Number(match[1]) > removedImpactNumber) {
        return { ...block, text: `${Number(match[1]) - 1} ${match[2]}` };
      }
    }
    if (block.type === "heading2") {
      const match = block.text.match(/^(\d+)\.(\d+)\s+(.*)$/);
      if (match && Number(match[1]) > removedImpactNumber) {
        return { ...block, text: `${Number(match[1]) - 1}.${match[2]} ${match[3]}` };
      }
    }
    return block;
  });
}

function removeDuplicateIndicatorsSection(blocks: EditorBlock[], fields: AcademicFields): { blocks: EditorBlock[]; removedImpactNumber?: number } {
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";
  const hasPreTextualIndicators =
    isGraduateThesis || hasText(fields.indicadoresImpacto) || hasText(fields.impactoSocial) || hasText(fields.impactoCientifico);
  if (!hasPreTextualIndicators) return { blocks };

  const result: EditorBlock[] = [];
  let skipping = false;
  let removedImpactNumber: number | undefined;
  for (const block of blocks) {
    if (isImpactIndicatorsHeading(block)) {
      const match = block.text.match(/^(\d+)\s+/);
      if (match) removedImpactNumber = Number(match[1]);
      skipping = true;
      continue;
    }
    if (skipping) {
      const isNextHeading = block.type === "heading1" || block.type === "heading2";
      if (isNextHeading) skipping = false;
      else continue;
    }
    result.push(block);
  }
  return { blocks: result, removedImpactNumber };
}

function appendixTitle(fields: AcademicFields): string {
  const normalized = normalizeForDetection(fields.apendices);
  if (normalized.includes("ROTEIRO") && normalized.includes("ENTREVISTA")) {
    return "APÊNDICE A - ROTEIRO PRELIMINAR DE ENTREVISTA";
  }
  return "APÊNDICE A";
}

interface ListItem {
  kind: "illustration" | "table";
  type: string;
  number: string;
  title: string;
  bookmarkId: string;
}

function captionTypeOf(text: string): string {
  const match = text.trim().match(/^([a-záéíóúãõç]+)/i);
  return match ? match[1] : "";
}

function captionListItem(
  text: string,
  kind: "illustration" | "table",
  bookmarkId: string,
): ListItem | null {
  const caption = detectCaption(text);
  if (!caption) return null;
  const type = captionTypeOf(text).toUpperCase();
  if (!type) return null;
  const title = (caption.label ?? "").replace(/\s*Fonte:.*$/is, "").trim();
  return {
    kind,
    type,
    number: caption.number ?? "",
    title,
    bookmarkId,
  };
}

function importedImageListItem(image: ImportedDocumentImage | undefined): ListItem | null {
  if (!image?.caption) return null;
  const type = captionTypeOf(image.caption);
  if (!type) return null;
  const isTable = /^tabela/i.test(type);
  return captionListItem(image.caption, isTable ? "table" : "illustration", captionBookmarkId(cleanMojibakeText(image.caption)));
}

function importedTableListItem(table: ImportedTable | undefined): ListItem | null {
  if (!table?.caption) return null;
  return captionListItem(table.caption, "table", captionBookmarkId(cleanMojibakeText(table.caption)));
}

function bookmarkSafeLabel(text: string): string {
  return normalizeForDetection(text).replace(/[^A-Z0-9]/g, "_").slice(0, 60) || "ITEM";
}

/**
 * Gera o ID de bookmark usado tanto pelo PAGEREF da lista quanto pelo BookmarkStart
 * do corpo. Sempre normaliza a legenda (remove "Fonte:" etc.) para que os dois pontos
 * gerem exatamente o mesmo ID — caso contrário o PAGEREF aponta para um bookmark
 * inexistente e o Word exibe "Erro! Indicador não definido.".
 */
function captionBookmarkId(cleanedText: string): string {
  const fonteMatch = cleanedText.match(/^(.*?)(\s*Fonte:.*)$/is);
  const base = fonteMatch ? fonteMatch[1].trim() : cleanedText.trim();
  return `LISTA_${bookmarkSafeLabel(base)}`;
}

let listBookmarkNumericId = 0;

function nextListBookmarkNumericId(): number {
  listBookmarkNumericId += 1;
  return listBookmarkNumericId;
}

function bookmarkedCaptionParagraph(text: string, kind: CaptionKind, bookmarkId: string): Paragraph {
  const numericId = nextListBookmarkNumericId();
  return new Paragraph({
    style: kind === "table" ? "ufla_legenda_tabela" : "ufla_legenda_ilustracao",
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: SINGLE_LINE },
    indent: { left: 454, right: 454 },
    children: [
      new BookmarkStart(bookmarkId, numericId),
      new TextRun({
        text: cleanMojibakeText(text),
        bold: true,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
      new BookmarkEnd(numericId),
    ],
  });
}

/**
 * Resolve referências cruzadas do rascunho (`[x:ANCHOR|texto]`) para o bookmark
 * vigente do documento exportado (religação por label, resiliente a edições de
 * legenda/título):
 * 1. âncora já gerada (LISTA_/SECAO_) → usa direto;
 * 2. texto visível referencia legenda (Tabela 3, Figura 2, Quadro 5...) →
 *    bookmark LISTA_ da legenda correspondente;
 * 3. texto visível referencia seção → bookmark SECAO_ do heading;
 * 4. sem alvo → null (texto plano, sem link quebrado).
 */
export function buildXrefResolver(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): XrefResolver {
  const headings = bodyBlocks
    .filter((b) => b.type === "heading1" || b.type === "heading2" || b.type === "heading3")
    .map((b) => b.text);
  const captions = collectListItems(bodyBlocks, importedImages, importedTables);

  return (anchor: string, visible: string): string | null => {
    if (/^(LISTA_|SECAO_)/.test(anchor)) return anchor;

    const captionRef = visible.match(/^(Tabela|Quadro|Figura|Gr[áa]fico|Ilustra[çc][ãa]o)\s+(\d+(?:\.\d+)*)/i);
    if (captionRef) {
      const type = captionRef[1];
      const number = captionRef[2].replace(/^0+/, "");
      const match = captions.find(
        (item) => item.type.toLowerCase() === type.toLowerCase() && item.number.replace(/^0+/, "") === number,
      );
      if (match) return match.bookmarkId;
    }

    const normalizedVisible = normalizeForDetection(visible);
    if (normalizedVisible) {
      const heading = headings.find((h) => normalizeForDetection(h) === normalizedVisible);
      if (heading) return sectionBookmarkId(heading);
    }

    return null;
  };
}

function collectListItems(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  const push = (item: ListItem | null): void => {
    if (!item) return;
    const key = `${item.kind}:${item.type}:${item.number}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const block of bodyBlocks) {
    if (block.type === "paragraph") {
      const cleaned = cleanMojibakeText(block.text);
      const caption = detectCaption(cleaned);
      if (caption) {
        push(captionListItem(cleaned, caption.kind === "table" ? "table" : "illustration", captionBookmarkId(cleaned)));
      }
      continue;
    }
    if (block.type === "importedImage") {
      push(importedImageListItem(importedImages.find((image) => image.id === block.text)));
      continue;
    }
    if (block.type === "importedTable") {
      push(importedTableListItem(importedTables.find((table) => table.id === block.text)));
      continue;
    }
    if (block.type === "tabbedTable") {
      // legenda de tabela tabulada: primeira linha "Tabela/Quadro N - título"
      const detected = detectTabbedTableBlock(block.text);
      if (detected?.caption) {
        push(captionListItem(detected.caption, "table", captionBookmarkId(cleanMojibakeText(detected.caption))));
      }
      continue;
    }
  }

  return items;
}

function listEntryParagraph(item: ListItem): Paragraph {
  const normalizedTitle = item.title.replace(/^[\s\-–—:.]+\s*/, "").trim();
  const label = `${item.type} ${item.number} - ${normalizedTitle}`;
  return new Paragraph({
    style: "ufla_lista_item",
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9071, leader: "dot" }],
    indent: { left: 709, hanging: 709 },
    children: [
      new TextRun({
        text: cleanMojibakeText(label),
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
      new TextRun({ children: [new Tab()] }),
      new SimpleField(`PAGEREF ${item.bookmarkId} \\h`, "00"),
    ],
  });
}

function listPage(
  title: string,
  items: ListItem[],
  filter: (item: ListItem) => boolean,
): Paragraph[] {
  const filtered = items.filter(filter);
  if (!filtered.length) return [];
  return [
    unnumberedTitle(title),
    ...filtered.map(listEntryParagraph),
  ];
}

function buildListaIlustracoes(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): Paragraph[] {
  const items = collectListItems(bodyBlocks, importedImages, importedTables);
  return listPage("Lista de ilustrações", items, (item) => item.kind === "illustration");
}

function buildListaTabelas(
  bodyBlocks: EditorBlock[],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): Paragraph[] {
  const items = collectListItems(bodyBlocks, importedImages, importedTables);
  return listPage("Lista de tabelas", items, (item) => item.kind === "table");
}

function buildSummary(
  bodyBlocks: EditorBlock[],
  references: string[],
  fields: AcademicFields,
  textualStartPage: number,
): Array<Paragraph | TableOfContents> {
  void textualStartPage;

  const entries = collectSummaryEntries(bodyBlocks, references, fields);
  if (!entries.length) return [];

  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";

  if (isGraduateThesis) {
    return [
      pageBreak(),
      unnumberedTitle("Sumário"),
      new TableOfContents("", {
        headingStyleRange: "1-3",
        hyperlink: true,
        hideTabAndPageNumbersInWebView: true,
        useAppliedParagraphOutlineLevel: true,
      }),
    ];
  }

  return [
    pageBreak(),
    unnumberedTitle("Sumário"),
    ...entries.map(summaryEntryParagraph),
  ];
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function ensureTrailingPeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith(".")) return trimmed;
  return `${trimmed.replace(/[;\s]+$/, "")}.`;
}

function hasApprovalPage(fields: AcademicFields): boolean {
  return fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
}

export function calculateTextualStartPage(
  fields: AcademicFields,
  hasSummary: boolean,
  bodyBlocks: EditorBlock[] = [],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): number {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  let countedPreTextualPages = 1; // Folha de rosto. Capa e ficha catalográfica não contam.

  if (hasApprovalPage(fields)) countedPreTextualPages += 1;
  if (hasText(fields.dedicatoria)) countedPreTextualPages += 1;
  if (hasText(fields.agradecimentos)) countedPreTextualPages += 1;
  if (hasText(fields.epigrafe)) countedPreTextualPages += 1;

  countedPreTextualPages += 1; // Resumo gerado pelo exportador.
  countedPreTextualPages += 1; // Abstract gerado pelo exportador.

  if (hasText(fields.indicadoresImpacto) || impactRequired) countedPreTextualPages += 1;
  if (hasText(fields.impactIndicators)) countedPreTextualPages += 1;

  const autoListItems = collectListItems(bodyBlocks, importedImages, importedTables);
  if (autoListItems.some((item) => item.kind === "illustration")) countedPreTextualPages += 1;
  if (autoListItems.some((item) => item.kind === "table")) countedPreTextualPages += 1;

  const hasAnyList = hasText(fields.listaQuadros) || hasText(fields.listaGraficos) || hasText(fields.listaTabelas) || hasText(fields.listaSiglas) || hasText(fields.listaAbreviaturas) || hasText(fields.listaSimbolos) || hasText(fields.glossario);
  if (hasAnyList) countedPreTextualPages += 1;
  if (hasText(fields.listaQuadros)) countedPreTextualPages += 1;
  if (hasText(fields.listaGraficos)) countedPreTextualPages += 1;
  if (hasText(fields.listaTabelas)) countedPreTextualPages += 1;
  if (hasText(fields.listaSiglas)) countedPreTextualPages += 1;
  if (hasText(fields.listaAbreviaturas)) countedPreTextualPages += 1;
  if (hasText(fields.listaSimbolos)) countedPreTextualPages += 1;
  if (hasText(fields.glossario)) countedPreTextualPages += 1;

  if (hasSummary) countedPreTextualPages += 1;

  return countedPreTextualPages + 1;
}

function natureParagraph(text: string): Paragraph {
  return new Paragraph({
    style: "ufla_natureza",
    alignment: AlignmentType.BOTH,
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
    spacing: { line: SINGLE_LINE, after: 180 },
    children: textRunsFromMarkup(text || " "),
  });
}

function normalizeNatureForWorkType(nature: string, fields: AcademicFields): string {
  const provided = cleanMojibakeText(nature).trim();
  if (!provided || isInternalWorkNature(provided)) {
    return fallbackWorkNature(fields);
  }
  return provided;
}

function coverChildren(fields: AcademicFields, logo?: DocxLogoAsset): Paragraph[] {
  return [
    ...logoParagraph(logo),
    new Paragraph({ spacing: { before: 1100 } }),
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }, "ufla_capa_autor"),
    new Paragraph({ spacing: { before: 1700 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, COVER_TITLE_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }, "ufla_capa_titulo"),
    ...(fields.subtitle
      ? [
          centeredParagraph(cleanMojibakeText(fields.subtitle.toUpperCase()), false, COVER_TITLE_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }, "ufla_capa_subtitulo"),
        ]
      : []),
    // Local + ano na parte inferior da capa (terço inferior da página): o
    // espaçamento antes do bloco garante a posição física exigida pelo Manual
    // UFLA §3.1.1 (verificado por validate-cover-layout.ts no PDF renderizado).
    new Paragraph({ spacing: { before: 3600 } }),
    centeredParagraph(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }, "ufla_capa_local_ano"),
    centeredParagraph(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }, "ufla_capa_local_ano"),
  ];
}

function buildTitlePageSupplementalLines(fields: AcademicFields, nature: string): string[] {
  const normalizedNature = normalizeForDetection(nature);
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";

  return [
    !isGraduateThesis && fields.course && !normalizedNature.includes("CURSO")
      ? cleanMojibakeText(`Curso: ${fields.course}`)
      : "",
    fields.program && !normalizedNature.includes("PROGRAMA") ? cleanMojibakeText(`Programa: ${fields.program}`) : "",
    fields.advisor && !normalizedNature.includes("ORIENTADOR") ? cleanMojibakeText(`Orientador(a): ${fields.advisor}`) : "",
    fields.coadvisor && !normalizedNature.includes("COORIENTADOR")
      ? cleanMojibakeText(`Coorientador(a): ${fields.coadvisor}`)
      : "",
  ].filter(Boolean);
}

function isInternalWorkNature(value: string): boolean {
  const normalized = normalizeForDetection(cleanMojibakeText(value));
  return (
    normalized.includes("COLECAO PRODUCAO ACADEMICA") ||
    normalized.includes("SUPORTE INICIAL NO SISTEMA") ||
    normalized.includes("SOFTWARE E APLICATIVOS UFLA")
  );
}

function stripTrailingAdvisorLocationYear(value: string): string {
  const cleaned = cleanMojibakeText(value).trim();
  if (!cleaned) return cleaned;

  const normalized = normalizeForDetection(cleaned);
  const advisorPatterns = [
    /prof\.?\s*dr\.?\s+[a-zà-úç\s]+orientador(?:a)?(?:\s*uf)?(?:\s*-?\s*ufla)?/i,
    /dra\.?\s+[a-zà-úç\s]+uf(?:c?g|mg)/i,
    /dr\.?\s+[a-zà-úç\s]+uf(?:c?g|mg)/i,
    /orientador(?:a)?\s*[:-]?\s*[a-zà-úç\s]+/i,
    /lavras\s*-\s*mg\s*\d{4}/i,
    /\b(?:19|20)\d{2}\b/,
  ];

  let earliestMatch: number | undefined;
  for (const pattern of advisorPatterns) {
    const match = normalized.match(pattern);
    if (match && match.index !== undefined) {
      const startIndex = cleaned.slice(0, match.index).trim().length;
      if (earliestMatch === undefined || startIndex < earliestMatch) {
        earliestMatch = startIndex;
      }
    }
  }

  if (earliestMatch !== undefined && earliestMatch > 20) {
    return cleaned.slice(0, earliestMatch).trim();
  }

  return cleaned;
}

function workTypeSpecificNature(fields: AcademicFields): string {
  const prog = fields.program || fields.course || "Programa de Pós-Graduação";
  switch (fields.workType) {
    case "tese":
      return `Tese apresentada ao ${prog} da Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Doutor.`;
    case "dissertacao":
      return `Dissertação apresentada ao ${prog} da Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Mestre.`;
    case "monografia":
      return `Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos para obtenção do título de ${fields.course || "graduação"}.`;
    case "projeto_pesquisa":
      return "Projeto de pesquisa apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
    default:
      return "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
  }
}

function fallbackWorkNature(fields: AcademicFields): string {
  if (fields.workType === "projeto_pesquisa") {
    return "Projeto de pesquisa apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
  }
  return "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
}

function workNature(fields: AcademicFields): string {
  const providedNature = cleanMojibakeText(fields.workNature).trim();
  const safeNature = providedNature && !isInternalWorkNature(providedNature) ? providedNature : workTypeSpecificNature(fields);
  const cleaned = stripTrailingAdvisorLocationYear(safeNature);

  return cleanMojibakeText(normalizeNatureForWorkType(cleaned || safeNature, fields));
}

function titlePageChildren(fields: AcademicFields): Paragraph[] {
  const nature = workNature(fields);
  const supplementalLines = buildTitlePageSupplementalLines(fields, nature);

  return [
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }, "ufla_folha_rosto_autor"),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, BODY_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }, "ufla_folha_rosto_titulo"),
    ...(fields.subtitle
      ? [
          centeredParagraph(cleanMojibakeText(fields.subtitle.toUpperCase()), false, BODY_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }, "ufla_folha_rosto_titulo"),
        ]
      : []),
    // Natureza do trabalho na metade inferior da folha de rosto (Manual UFLA
    // §3.1.2); o espaçamento garante a posição física verificada por
    // validate-cover-layout.ts no PDF renderizado.
    new Paragraph({ spacing: { before: 3200 } }),
    natureParagraph(cleanMojibakeText(nature)),
    ...supplementalLines.map((line) =>
      centeredParagraph(cleanMojibakeText(line), false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    ),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), false, BODY_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), true, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
  ];
}

function formatApprovalDate(value: string): string {
  const cleaned = cleanMojibakeText(value).trim();
  if (!cleaned) return "";
  return cleaned.replace(/^Aprovad[ao]\s+em\s*/i, "").replace(/\.$/, "").trim();
}

function splitApprovalMembers(members: string[]): string[] {
  const split: string[] = [];
  for (const member of members) {
    const cleaned = cleanMojibakeText(member).trim();
    if (!cleaned) continue;
    const parts = extractMembersFromString(cleaned);
    if (parts.length > 0) {
      split.push(...parts);
    } else {
      split.push(cleaned);
    }
  }
  return mergeLooseApprovalTitles(split);
}

function isLooseApprovalTitle(value: string): boolean {
  return /^(Prof|Profa|Dr|Dra)\.$/i.test(cleanMojibakeText(value).trim());
}

function mergeLooseApprovalTitles(members: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < members.length; index += 1) {
    const current = cleanMojibakeText(members[index]).trim();
    const next = cleanMojibakeText(members[index + 1] ?? "").trim();

    if (isLooseApprovalTitle(current) && next) {
      merged.push(`${current} ${next}`.trim());
      index += 1;
      continue;
    }

    if (current) merged.push(current);
  }

  return merged.filter((member) => !isLooseApprovalTitle(member));
}

function extractMembersFromString(text: string): string[] {
  const results: string[] = [];
  const titleRegex = /((?:Prof|Dra|Dr)\.(?:\s+(?:Prof|Dra|Dr)\.)?)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let currentTitle = "";

  while ((match = titleRegex.exec(text)) !== null) {
    if (currentTitle && match.index > lastIndex) {
      const name = text.slice(lastIndex, match.index).trim();
      results.push(`${currentTitle}${name ? " " + name : ""}`.trim());
    }
    currentTitle = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (currentTitle || lastIndex < text.length) {
    const name = text.slice(lastIndex).trim();
    results.push(`${currentTitle}${name ? " " + name : ""}`.trim());
  }

  return results.filter(Boolean);
}

function normalizeApprovalMember(member: string): string {
  const cleaned = cleanMojibakeText(member).trim();
  if (!cleaned) return "";

  const titleMatch = cleaned.match(/^(Prof\.|Dra\.|Dr\.)(?:\s+(Prof\.|Dra\.|Dr\.))?\s*/i);
  const titles = titleMatch ? titleMatch[0].trim() : "";
  const rest = titleMatch ? cleaned.slice(titleMatch[0].length).trim() : cleaned;

  const institutionMatch = rest.match(/\b(UFCG|UFMG|UFLA|UTFPR|UNESP|USP|UFRJ|UFRGS|UFSC|UFPE|UFPEL|UFPB|UFBA|UFC|UFMA|UFPA|UFRR|UFRN|UFAL|UFES|UFG|UFMT|UFRR|UnB|UTF|UNIFESP|FIOCRUZ|EMBRAPA|CNPEN|Instituto|Universidade|Centro|Faculdade|Escola)\b.*$/i);
  const institution = institutionMatch ? institutionMatch[0].trim() : "";

  let name = rest;
  let role = "";
  if (institution) {
    name = rest.slice(0, institutionMatch!.index).trim();
    role = institution;
  } else if (/\bOrientador(a)?\b/i.test(rest)) {
    role = rest.match(/\bOrientador(a)?\b/i)?.[0] ?? "";
    name = rest.replace(new RegExp(`\\s*${role}\\s*`, "i"), "").trim();
  }

  if (role) {
    return `${titles}${name ? " " + name : ""} — ${role}`;
  }
  return `${titles}${name ? " " + name : ""}`;
}

function approvalPageChildren(fields: AcademicFields): Paragraph[] {
  if (!hasApprovalPage(fields)) return [];

  const isGraduate = fields.workType === "dissertacao" || fields.workType === "tese";

  const orientationLines: Paragraph[] = [
    ...(fields.advisor
      ? [
          centeredParagraph(cleanMojibakeText(fields.advisor), false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
          centeredParagraph("Orientador(a) - UFLA", false, BODY_SIZE, { after: 360, line: SINGLE_LINE }),
        ]
      : []),
    ...(fields.coadvisor
      ? [
          centeredParagraph(cleanMojibakeText(fields.coadvisor), false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
          centeredParagraph("Coorientador(a) - UFLA", false, BODY_SIZE, { after: 360, line: SINGLE_LINE }),
        ]
      : []),
  ];

  const formattedDate = formatApprovalDate(fields.aprovalDate || "");
  const bancaLines: Paragraph[] = [
    new Paragraph({ spacing: { before: 360, after: 240, line: SINGLE_LINE } }),
    ...(formattedDate
      ? [
          centeredParagraph(
            cleanMojibakeText(`APROVADO EM: ${formattedDate}.`),
            false,
            BODY_SIZE,
            { after: 240, line: SINGLE_LINE },
          ),
        ]
      : [
          centeredParagraph(
            "APROVADO EM: ____ de ____________________ de ______.",
            false,
            BODY_SIZE,
            { after: 240, line: SINGLE_LINE },
          ),
        ]),
    ...(fields.approvalMembers?.length
      ? splitApprovalMembers(fields.approvalMembers).map((member) =>
          centeredParagraph(cleanMojibakeText(normalizeApprovalMember(member)), false, BODY_SIZE, { after: 120, line: SINGLE_LINE }),
        )
      : [
          centeredParagraph("Prof.(a) Dr.(a) ______________________________", false, BODY_SIZE, {
            after: 0,
            line: SINGLE_LINE,
          }),
          centeredParagraph("Instituição: ________________________________", false, BODY_SIZE, {
            after: 240,
            line: SINGLE_LINE,
          }),
        ]),
  ];

  return [
    pageBreak(),
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 900 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, BODY_SIZE, {
      after: 600,
      line: ONE_AND_HALF_LINE,
    }),
    ...(isGraduate && fields.englishTitle?.trim()
      ? [
          centeredParagraph(cleanMojibakeText(fields.englishTitle.trim()), false, BODY_SIZE, {
            after: 600,
            line: ONE_AND_HALF_LINE,
          }),
        ]
      : []),
    natureParagraph(cleanMojibakeText(workNature(fields))),
    ...orientationLines,
    ...bancaLines,
  ];
}

function optionalPage(title: string, content: string): Paragraph[] {
  if (!content.trim()) return [];
  return [unnumberedTitle(title, true), ...buildSimpleParagraphs(content)];
}

function optionalUntitledRightPage(content: string, italics = false): Paragraph[] {
  if (!content.trim()) return [];
  return [
    pageBreak(),
    new Paragraph({ spacing: { before: 4200 } }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      spacing: { line: SINGLE_LINE, after: 0 },
      children: [
        new TextRun({
          text: content,
          italics,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
      ],
    }),
  ];
}

function preTextualChildren(
  fields: AcademicFields,
  bodyBlocks: EditorBlock[] = [],
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
  fichaCatalograficaImage?: DocxLogoAsset,
): Paragraph[] {
  const requirements = getWorkTypeRequirements(fields.workType);
  const consolidated = buildFlowingImpactText(fields);
  const indicadores = consolidated;
  const impactIndicators = cleanMojibakeText(fields.impactIndicators?.trim() || "");

  const children: Paragraph[] = [];

  if (requirements.requiresCatalogCard) {
    children.push(pageBreak(), unnumberedTitle("Ficha catalográfica"));
    const fichaText = cleanMojibakeText(fields.fichaCatalografica?.trim() || "");
    if (fichaCatalograficaImage?.data?.byteLength) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 360, after: 360, line: SINGLE_LINE },
          children: [
            new ImageRun({
              data: fichaCatalograficaImage.data,
              transformation: {
                width: fichaCatalograficaImage.width ?? 460,
                height: fichaCatalograficaImage.height ?? 300,
              },
              altText: {
                title: "Ficha catalográfica",
                description: "Ficha catalográfica oficial da Biblioteca Universitária da UFLA",
                name: "ficha-catalografica",
              },
            }),
          ],
        }),
      );
    } else if (fichaText) {
      children.push(
        new Paragraph({
          style: "ufla_ficha_catalografica",
          alignment: AlignmentType.BOTH,
          spacing: { line: SINGLE_LINE, after: 0 },
          children: textRunsFromMarkup(fichaText),
        }),
      );
    } else {
      children.push(
        simpleParagraph(
          cleanMojibakeText(
            "Ficha catalográfica detectada no arquivo importado. Preserve ou substitua manualmente pela ficha oficial da Biblioteca Universitária da UFLA.",
          ),
        ),
      );
    }
  }

  children.push(
    ...approvalPageChildren(fields),
    ...optionalPage("Errata", cleanMojibakeText(fields.errata)),
    ...optionalUntitledRightPage(cleanMojibakeText(fields.dedicatoria)),
    ...optionalPage("Agradecimentos", cleanMojibakeText(fields.agradecimentos)),
    ...optionalUntitledRightPage(cleanMojibakeText(fields.epigrafe), true),
    unnumberedTitle("Resumo", true),
    new Paragraph({
      style: "ufla_resumo",
      alignment: AlignmentType.BOTH,
      spacing: { line: SINGLE_LINE, after: 0 },
      children: textRunsFromMarkup(cleanMojibakeText(fields.resumo || " ")),
    }),
    ...(fields.palavrasChave
      ? [
          new Paragraph({
            style: "ufla_palavras_chave",
            alignment: AlignmentType.BOTH,
            spacing: { line: ONE_AND_HALF_LINE, after: 0 },
            indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
            children: [
              new TextRun({ text: `Palavras-chave: `, bold: true }),
              new TextRun({ text: cleanMojibakeText(ensureTrailingPeriod(fields.palavrasChave)) }),
            ],
          }),
        ]
      : []),
    unnumberedTitle("Abstract", true),
    new Paragraph({
      style: "ufla_abstract",
      alignment: AlignmentType.BOTH,
      spacing: { line: SINGLE_LINE, after: 0 },
      children: textRunsFromMarkup(cleanMojibakeText(fields.abstractText || " ")),
    }),
    ...(fields.keywords
      ? [
          new Paragraph({
            style: "ufla_keywords",
            alignment: AlignmentType.BOTH,
            spacing: { line: ONE_AND_HALF_LINE, after: 0 },
            children: [new TextRun({ text: cleanMojibakeText(`Keywords: ${ensureTrailingPeriod(fields.keywords)}`) })],
          }),
        ]
      : []),
  );
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  if (impactRequired || hasText(indicadores)) {
    children.push(unnumberedTitle("Indicadores de impacto", true));
    if (hasText(indicadores)) {
      children.push(simpleParagraph(cleanMojibakeText(indicadores)));
    } else {
      children.push(
        simpleParagraph(
          cleanMojibakeText(
            "Indicadores de impacto não preenchidos. Consulte o Manual UFLA 6ª ed. p. 51 para orientações sobre este elemento obrigatório.",
          ),
        ),
      );
    }
  }
  children.push(
    ...(hasText(impactIndicators)
      ? [unnumberedTitle("Impact indicators"), simpleParagraph(cleanMojibakeText(impactIndicators))]
      : []),
  );

  children.push(
    ...buildListaIlustracoes(bodyBlocks, importedImages, importedTables),
    ...buildListaTabelas(bodyBlocks, importedImages, importedTables),
  );

  if (hasText(fields.listaQuadros)) {
    children.push(...optionalPage("Lista de quadros", cleanMojibakeText(fields.listaQuadros)));
  }
  if (hasText(fields.listaGraficos)) {
    children.push(...optionalPage("Lista de gráficos", cleanMojibakeText(fields.listaGraficos)));
  }
  if (hasText(fields.listaTabelas)) {
    children.push(...optionalPage("Lista de tabelas", cleanMojibakeText(fields.listaTabelas)));
  }
  if (hasText(fields.listaSiglas)) {
    children.push(...optionalPage("Lista de siglas", cleanMojibakeText(fields.listaSiglas)));
  }
  if (hasText(fields.listaAbreviaturas)) {
    children.push(...optionalPage("Lista de abreviaturas", cleanMojibakeText(fields.listaAbreviaturas)));
  }
  if (hasText(fields.listaSimbolos)) {
    children.push(...optionalPage("Lista de símbolos", cleanMojibakeText(fields.listaSimbolos)));
  }
  if (hasText(fields.glossario)) {
    children.push(...optionalPage("Glossário", cleanMojibakeText(fields.glossario)));
  }

  return children;
}

export function createDocxDocument(input: DocxGenerationInput): Document {
  let { fields } = input;
  let editorText = input.editorText;
  const parsedBlocks = parseEditorContent(editorText);

  let annexReferenceFootnoteDefinitions: EditorBlock[] = [];
  let _bodyFootnoteMarkers = 0;

  if (hasText(fields.anexos)) {
    const { cleaned, references: annexRefs } = extractReferencesFromText(fields.anexos);
    if (annexRefs.length > 0) {
      fields = { ...fields, anexos: appendFootnoteMarkers(cleaned, annexRefs.length) };
      annexReferenceFootnoteDefinitions = buildReferenceFootnoteDefinitions(annexRefs);
      _bodyFootnoteMarkers += annexRefs.length;
    }
  }

  if (fields.referencesPlacement === "footnote") {
    const editorRefs = parsedBlocks.filter((block) => block.type === "reference").map((block) => block.text);
    const fieldRefs = splitParagraphs(fields.referencias);
    const allRefs = [...fieldRefs, ...editorRefs];
    if (allRefs.length > 0) {
      const defs = buildReferenceFootnoteDefinitions(allRefs);
      annexReferenceFootnoteDefinitions = [...annexReferenceFootnoteDefinitions, ...defs];
      _bodyFootnoteMarkers += allRefs.length;
      fields = { ...fields, referencias: "" };
      editorText = appendFootnoteMarkers(editorText, allRefs.length);
    }
  }

  const finalParsedBlocks = parseEditorContent(editorText);
  const allFootnoteDefinitions = [
    ...annexReferenceFootnoteDefinitions,
    ...finalParsedBlocks.filter((block) => block.type === "footnoteDefinition"),
  ];
  const footnoteIdMap = buildFootnoteIdMap(allFootnoteDefinitions);
  currentFootnoteIdMap = footnoteIdMap;
  const { blocks: dedupedBlocks, removedImpactNumber } = removeDuplicateIndicatorsSection(
    fieldSectionBlocks(
      fields,
      finalParsedBlocks.filter((block) => block.type !== "reference" && block.type !== "footnoteDefinition"),
    ),
    fields,
  );
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";
  const bodyBlocks = renumberBodySections(
    dedupedBlocks,
    isGraduateThesis ? removedImpactNumber : undefined,
  );
  const editorReferences = finalParsedBlocks
    .filter((block) => block.type === "reference")
    .map((block) => block.text);
  const extractedReferencesSection = extractReferencesSection(bodyBlocks);
  const bodyBlocksWithoutReferences = extractedReferencesSection.bodyBlocks;

  // Religação de referências cruzadas: o resolver precisa estar registrado ANTES
  // de os runs serem materializados (bodyBlocks → blockToParagraph → textRuns).
  registerXrefResolver(
    buildXrefResolver(bodyBlocksWithoutReferences, input.importedImages ?? [], input.importedTables ?? []),
  );
  const references = [
    ...splitParagraphs(fields.referencias),
    ...editorReferences,
    ...extractedReferencesSection.references,
  ];
  const hasSummary =
    bodyBlocksWithoutReferences.some(
      (block) =>
        block.type === "heading1" || block.type === "heading2" || block.type === "heading3",
    ) ||
    references.length > 0 ||
    Boolean(fields.apendices || fields.anexos);
  const textualStartPage = calculateTextualStartPage(
    fields,
    hasSummary,
    bodyBlocksWithoutReferences,
    input.importedImages ?? [],
    input.importedTables ?? [],
  );
  const summaryChildren = buildSummary(bodyBlocksWithoutReferences, references, fields, textualStartPage);

  const preTextualChildrenList: Array<Paragraph | TableOfContents> = [
    ...coverChildren(fields, input.logo),
    pageBreak(),
    ...titlePageChildren(fields),
    ...preTextualChildren(fields, bodyBlocksWithoutReferences, input.importedImages ?? [], input.importedTables ?? [], input.fichaCatalograficaImage),
    ...summaryChildren,
  ];

  const hasApendices = Boolean(fields.apendices?.trim());
  const hasAnexos = Boolean(fields.anexos?.trim());
  const showReferences = fields.referencesPlacement !== "footnote";

  // Runs de seção: tabelas largas exigem seção paisagem própria (gap P0). Cada
  // run contíguo de mesma orientação vira uma seção; o restante permanece
  // retrato, preservando a numeração (folha de rosto = 1, DECISION-010).
  interface SectionRun {
    landscape: boolean;
    children: Array<Paragraph | Table>;
  }
  const sectionRuns: SectionRun[] = [];
  const pushRun = (children: Array<Paragraph | Table>, landscape: boolean): void => {
    if (!children.length) return;
    const last = sectionRuns[sectionRuns.length - 1];
    if (last && last.landscape === landscape) last.children.push(...children);
    else sectionRuns.push({ landscape, children: [...children] });
  };

  bodyBlocksWithoutReferences.forEach((block, index) => {
    pushRun(
      blockToParagraph(block, index === 0, input.importedImages ?? [], input.importedTables ?? []),
      tableNeedsLandscape(block, input.importedTables ?? []),
    );
  });

  pushRun(showReferences ? [pageBreak()] : [], false);
  pushRun(
    showReferences &&
    (hasEditorHeading(bodyBlocksWithoutReferences, "REFERÊNCIAS") ||
      bodyBlocksWithoutReferences.some((b) =>
        ["REFERENCIAS", "REFERENCIAS BIBLIOGRAFICAS", "BIBLIOGRAFICAS"].includes(
          normalizeForDetection(b.text).replace(/^\d+(?:\.\d+)*\s*/, ""),
        ),
      ))
      ? []
      : [sectionTitle("Referências")],
    false,
  );
  pushRun(showReferences ? buildReferences(references) : [], false);
  pushRun(
    hasApendices
      ? [pageBreak(), sectionTitle(appendixTitle(fields), "ufla_apendice_titulo"), ...buildSimpleParagraphs(fields.apendices)]
      : [],
    false,
  );
  pushRun(
    hasAnexos
      ? [pageBreak(), sectionTitle("Anexos", "ufla_anexo_titulo"), ...buildSimpleParagraphs(fields.anexos)]
      : [],
    false,
  );
  const hasIndice = Boolean(fields.indice?.trim());
  pushRun(
    hasIndice
      ? [pageBreak(), sectionTitle("Índice"), ...buildSimpleParagraphs(fields.indice)]
      : [],
    false,
  );

  const pageNumberHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: UFLA_RULES.typography.fontFamily,
            size: UFLA_RULES.typography.pageNumberFontSizePt * 2,
            color: BLACK,
          }),
        ],
      }),
    ],
  });

  const footnotes = buildFootnotes(allFootnoteDefinitions, footnoteIdMap);
  currentFootnoteIdMap = null;

  const portraitPage = {
    size: {
      orientation: PageOrientation.PORTRAIT,
      width: UFLA_RULES.page.widthTwip,
      height: UFLA_RULES.page.heightTwip,
    },
    margin: pageMargins(),
  };
  // A lib docx troca w/h automaticamente quando orientation = LANDSCAPE
  // (PageSize constrói w:w=height, w:h=width); passamos as dimensões retrato.
  const landscapePage = {
    size: {
      orientation: PageOrientation.LANDSCAPE,
      width: UFLA_RULES.page.widthTwip,
      height: UFLA_RULES.page.heightTwip,
    },
    margin: pageMargins(),
  };

  const sections: ISectionOptions[] = [
    {
      properties: { page: portraitPage },
      children: preTextualChildrenList,
    },
  ];

  sectionRuns.forEach((run, index) => {
    const isFirstTextual = index === 0;
    sections.push({
      properties: {
        page: {
          ...(run.landscape ? landscapePage : portraitPage),
          ...(isFirstTextual ? { pageNumbers: { start: textualStartPage } } : {}),
        },
      },
      ...(isFirstTextual ? { headers: { default: pageNumberHeader } } : {}),
      children: run.children,
    });
  });

  const document = new Document({
    creator: "UFLA DOCX Acadêmico",
    title: fields.title || "Trabalho acadêmico",
    description: "Documento acadêmico gerado conforme regras centrais da UFLA.",
    features: {
      updateFields: true,
    },
    styles: DOCUMENT_STYLES,
    footnotes,
    sections,
  });
  clearXrefRegistry();
  return document;
}

export async function loadDefaultLogoAsset(): Promise<DocxLogoAsset | undefined> {
  if (typeof fetch !== "function") return undefined;

  // Em ambiente Node/Vitest não há documento nem base URL para resolver o caminho
  // relativo /assets/ufla-logo.jpeg; o fetch lançaria Invalid URL apenas para poluir
  // o stderr. O navegador mantém o carregamento real; fora dele usamos fallback silencioso.
  if (typeof window === "undefined" || import.meta.env.MODE === "test") return undefined;

  try {
    const response = await fetch(DEFAULT_UFLA_LOGO_PATH);
    if (!response.ok) return undefined;
    return {
      data: await response.arrayBuffer(),
      width: UFLA_LOGO_WIDTH_PX,
      height: UFLA_LOGO_HEIGHT_PX,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Falha ao carregar o logo padrão da UFLA.", error);
    }
    return undefined;
  }
}

export async function generateDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  // SEM clearRawOmmlRegistry() aqui: os marcadores OMML usam IDs únicos e são
  // consumidos pelo patch pós-Packer. Limpar no início limparia os registros de
  // outra geração em voo — corrida em geração paralela (A4 do checklist-14).
  // Todos os formatos da Coleção Produção Acadêmica UFLA são estruturados como
  // artigo (sem capa/folha de rosto/ficha/aprovação) — DOCUMENT_TYPE_MATRIX.
  const isArticleStructured =
    input.fields.workType === "artigo" ||
    (ACADEMIC_PRODUCTION_TYPE_IDS as readonly string[]).includes(input.fields.workType);
  if (isArticleStructured) {
    const { generateArticleDocxBlob } = await import("./export-article-docx");
    return generateArticleDocxBlob(input);
  }

  const logo = input.logo ?? (await loadDefaultLogoAsset());
  return Packer.toBlob(createDocxDocument({ ...input, logo }));
}
