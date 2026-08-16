import {
  AlignmentType,
  BookmarkEnd,
  BookmarkStart,
  BorderStyle,
  InternalHyperlink,
  IParagraphOptions,
  Math as DocxMath,
  MathBase,
  MathFraction,
  MathFunction,
  MathIntegral,
  MathNAryProperties,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSubScriptElement,
  MathSum,
  MathSuperScript,
  MathSuperScriptElement,
  Paragraph,
  SimpleField,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  XmlComponent,
} from "docx";
import type { MathComponent } from "docx";
import { UFLA_RULES, cmToTwip } from "./ufla-rules";
import { cleanMojibakeText } from "./text-utils";
export { cleanMojibakeText };

/** Texto de um MathRun da lib docx: o run guarda em root[0] = { rootKey: "m:t", root: [texto] }. */
function mathRunText(c: unknown): string {
  const root = (c as { root?: Array<{ root?: unknown[] }> }).root;
  const t = root?.[0];
  const val = (t as { root?: unknown[] } | undefined)?.root?.[0];
  return typeof val === "string" ? val : "";
}

export function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function plainRun(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): TextRun {
  return new TextRun({
    text: cleanMojibakeText(text),
    font,
    size,
    color,
  });
}

export interface ParsedRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export function tokenizeMarkup(text: string): ParsedRun[] {
  const runs: ParsedRun[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }

    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    runs.push({ text: content, bold, italics: !bold });
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor) });
  }

  return applyEtAlItalic(runs.length ? runs : [{ text: "" }]);
}

function applyEtAlItalic(runs: ParsedRun[]): ParsedRun[] {
  const etAlPattern = /(et\s+al\.)/giu;
  const expanded = runs.flatMap((run) => {
    const pieces: ParsedRun[] = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = etAlPattern.exec(run.text)) !== null) {
      if (m.index > cursor) pieces.push({ text: run.text.slice(cursor, m.index), bold: run.bold, italics: run.italics });
      pieces.push({ text: m[0], bold: run.bold, italics: true });
      cursor = m.index + m[0].length;
    }
    if (cursor < run.text.length) pieces.push({ text: run.text.slice(cursor), bold: run.bold, italics: run.italics });
    return pieces.length ? pieces : [{ ...run }];
  });
  const merged: ParsedRun[] = [];
  for (const run of expanded.filter((item) => item.text.length > 0)) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italics === run.italics) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged.length ? merged : runs;
}

export function textRunsForSingleLine(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): TextRun[] {
  const runs: TextRun[] = [];
  for (const parsed of tokenizeMarkup(cleanMojibakeText(text))) {
    runs.push(
      new TextRun({
        text: parsed.text,
        bold: parsed.bold,
        italics: parsed.italics,
        font,
        size,
        color,
      }),
    );
  }
  return runs;
}

export function textRunsFromMarkup(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): Array<TextRun | InternalHyperlink> {
  const lineRuns = (line: string): Array<TextRun | InternalHyperlink> => {
    if (!/\[x:[^\]]*\]/.test(line)) return textRunsForSingleLine(line, size, font, color);
    const segments = line.split(/(\[x:[^\]]*\])/);
    const runs: Array<TextRun | InternalHyperlink> = [];
    for (const segment of segments) {
      if (!segment) continue;
      const xref = /^\[x:([^\]~]+)(?:~([^\]]*))?\]$/.exec(segment);
      if (xref) {
        const anchor = xref[1].trim();
        const visible = (xref[2] ?? "").trim();
        const target = resolveXrefTarget(anchor, visible);
        if (target && visible) {
          runs.push(
            new InternalHyperlink({
              anchor: target,
              children: [
                new TextRun({ text: cleanMojibakeText(visible), font, size, color }),
              ],
            }),
          );
        } else if (visible) {
          runs.push(...textRunsForSingleLine(visible, size, font, color));
        }
        continue;
      }
      runs.push(...textRunsForSingleLine(segment, size, font, color));
    }
    return runs;
  };

  return text.split(/\n/).flatMap((line, index) => {
    const runs = lineRuns(line);
    if (index === 0) return runs;
    return [new TextRun({ break: 1 }), ...runs];
  });
}

export function textParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    style: "ufla_corpo_texto",
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.bodyLineTwip, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function simpleParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    style: "ufla_corpo_texto",
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.singleLineTwip, after: UFLA_RULES.spacing.afterParagraphTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function centeredParagraph(
  text: string,
  bold = false,
  size = 24,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: 240 },
  style?: string,
): Paragraph {
  return new Paragraph({
    ...(style ? { style } : {}),
    alignment: AlignmentType.CENTER,
    spacing,
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        bold,
        font: "Times New Roman",
        size,
        color: "000000",
      }),
    ],
  });
}

export function buildSimpleParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) => simpleParagraph(line));
}

export type CaptionKind = "illustration" | "table";

export interface CaptionInfo {
  kind: CaptionKind;
  number?: string;
  label?: string;
}

const CAPTION_PATTERN = /^(figura|quadro|gráfico|mapa|imagem|ilustração|tabela)\s+(\d+)([-:–—]?\s*.*)$/i;

export function detectCaption(text: string): CaptionInfo | null {
  const trimmed = text.trim();
  const match = trimmed.match(CAPTION_PATTERN);
  if (!match) return null;

  const label = match[1].toLowerCase();
  const kind: CaptionKind = label === "tabela" ? "table" : "illustration";

  return {
    kind,
    number: match[2],
    label: match[3].trim() || undefined,
  };
}

/**
 * ID de bookmark de legenda (`LISTA_<rótulo normalizado>`), compartilhado com
 * a exportação (captionBookmarkId) para que PAGEREF/hyperlinks resolvam.
 */
export function captionBookmarkIdFromText(cleanedText: string): string {
  const fonteMatch = cleanedText.match(/^(.*?)(\s*Fonte:.*)$/is);
  const base = fonteMatch ? fonteMatch[1].trim() : cleanedText.trim();
  const label =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^A-Z0-9]/g, "_")
      .slice(0, 60) || "ITEM";
  return `LISTA_${label}`;
}

let captionNumericId = 0;

function nextCaptionNumericId(): number {
  captionNumericId += 1;
  return captionNumericId;
}

export function captionParagraph(
  text: string,
  kind: CaptionKind = "illustration",
  bookmarkId?: string,
): Paragraph {
  const children = [];
  if (bookmarkId) {
    const numericId = nextCaptionNumericId();
    children.push(new BookmarkStart(bookmarkId, numericId));
    children.push(
      new TextRun({
        text: cleanMojibakeText(text),
        bold: true,
        font: "Times New Roman",
        size: UFLA_RULES.typography.captionFontSizePt * 2,
        color: "000000",
      }),
    );
    children.push(new BookmarkEnd(numericId));
  } else {
    children.push(
      new TextRun({
        text: cleanMojibakeText(text),
        bold: true,
        font: "Times New Roman",
        size: UFLA_RULES.typography.captionFontSizePt * 2,
        color: "000000",
      }),
    );
  }
  return new Paragraph({
    style: kind === "table" ? "ufla_legenda_tabela" : "ufla_legenda_ilustracao",
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: UFLA_RULES.spacing.singleLineTwip },
    indent: { left: 454, right: 454 },
    children,
  });
}

export function sourceParagraph(text: string, kind: CaptionKind = "illustration"): Paragraph {
  return new Paragraph({
    style: kind === "table" ? "ufla_fonte_tabela" : "ufla_fonte_ilustracao",
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 120, line: 240 },
    indent: { left: 454, right: 454 },
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        font: "Times New Roman",
        size: UFLA_RULES.typography.sourceFontSizePt * 2,
        color: "000000",
      }),
    ],
  });
}

export function longQuoteParagraph(text: string): Paragraph {
  return new Paragraph({
    style: "ufla_citacao_longa",
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.singleLineTwip, after: 120 },
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
    children: textRunsFromMarkup(text, UFLA_RULES.typography.longQuoteFontSizePt * 2),
  });
}

export interface TabbedTableBlockParts {
  caption: string;
  rows: string[][];
  sourceLine?: string;
}

function isSourceLine(line: string): boolean {
  return /^Fonte:/i.test(line.trim());
}

function isMarkdownSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function tabbedCells(line: string, singleSpaceSplit = false): string[] {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim()).filter(Boolean);
  const doubleSpaced = line.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
  if (doubleSpaced.length > 1) return doubleSpaced;
  if (singleSpaceSplit) return line.split(/\s+/).map((cell) => cell.trim()).filter(Boolean);
  return doubleSpaced;
}

/** Checks if consecutive data lines (excluding source lines) all have the same word count. */
function hasConsistentWordCount(lines: string[]): boolean {
  const dataOnly = lines.filter((l) => !isSourceLine(l));
  if (dataOnly.length < 2) return false;
  const wc = dataOnly[0].split(/\s+/).length;
  if (wc < 2) return false;
  return dataOnly.slice(1).every((l) => l.split(/\s+/).length === wc);
}

export function detectTabbedTableBlock(text: string): TabbedTableBlockParts | null {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length < 2) return null;

  const caption = rawLines[0];
  if (!/^(quadro|tabela)\s+\d+\s*[-:?]?/i.test(caption)) return null;

  const rows: string[][] = [];
  let sourceLine: string | undefined;
  const dataLines = rawLines.slice(1);
  const useSingleSpace = hasConsistentWordCount(dataLines);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (isSourceLine(line)) {
      sourceLine = line;
      continue;
    }
    if (isMarkdownSeparator(line)) continue;

    const cells = line.includes("|") ? markdownCells(line) : tabbedCells(line, useSingleSpace);
    if (cells.length > 1) rows.push(cells);
  }

  if (rows.length === 0) return null;
  return { caption, rows, sourceLine };
}

export function tabbedTableBlock(
  text: string,
  options: {
    captionPrefix?: string;
    bodySize?: number;
    sourceSize?: number;
    font?: string;
    sourceFallback?: string;
  } = {},
): Array<Paragraph | Table> {
  const { captionPrefix = "", bodySize = 24, sourceSize = UFLA_RULES.typography.sourceFontSizePt * 2, font = "Times New Roman", sourceFallback } = options;
  const detected = detectTabbedTableBlock(text);
  if (!detected) return splitParagraphs(text).map((line) => simpleParagraph(line));

  const columnCount = Math.max(...detected.rows.map((row) => row.length), 1);
  const columnWidth = Math.max(1, Math.floor(100 / columnCount));

  const tableRows = detected.rows.map((cells, rowIndex) => {
    const padded = Array.from({ length: columnCount }, (_, i) => cells[i] ?? "");
    return new TableRow({
      ...(rowIndex === 0 ? { tableHeader: true } : {}),
      children: padded.map((cellText) => new TableCell({
        width: { size: columnWidth, type: WidthType.PERCENTAGE },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 240, after: 0 },
            children: [
              new TextRun({
                text: cleanMojibakeText(cellText),
                bold: rowIndex === 0,
                font,
                size: bodySize,
                color: "000000",
              }),
            ],
          }),
        ],
      })),
    });
  });

  const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

  const kind: CaptionKind = /^(quadro|tabela)\s+\d+/i.test(detected.caption.trim()) ? "table" : "illustration";
  const result: Array<Paragraph | Table> = [
    captionParagraph(captionPrefix + detected.caption, kind, captionBookmarkIdFromText(captionPrefix + detected.caption)),
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
  ];

  const sourceLine = detected.sourceLine ?? sourceFallback;
  if (sourceLine) {
    result.push(
      new Paragraph({
        style: "ufla_fonte_tabela",
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: 240 },
        children: [
          new TextRun({
            text: cleanMojibakeText(sourceLine),
            font,
            size: sourceSize,
            color: "000000",
          }),
        ],
      }),
    );
  }

  return result;
}

/**
 * Equação centralizada com numeração à direita (Manual UFLA §3.2.8).
 * Número opcional no formato `(N.N)`/`(NN)` ao final da linha; espaçamento
 * 1,5 acomoda expoentes e índices.
 */
export function equationParagraph(text: string): Paragraph {
  const equationText = cleanMojibakeText(text);
  const numberMatch = equationText.match(/\s*\((\d+(?:\.\d+)?)\)\s*$/);
  const body = numberMatch ? equationText.slice(0, numberMatch.index).trim() : equationText;
  const number = numberMatch ? `(${numberMatch[1]})` : "";
  const font = UFLA_RULES.typography.fontFamily;
  const size = UFLA_RULES.typography.bodyFontSizePt * 2;
  const children = [
    new TextRun({ text: body, font, size, color: "000000", italics: true }),
  ];
  if (number) {
    children.push(new TextRun({ text: "\t", font, size, color: "000000" }));
    children.push(new TextRun({ text: number, font, size, color: "000000" }));
  }
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, before: 120, after: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: cmToTwip(16) }],
    children,
  });
}

/**
/** N-ário OMML genérico (`m:nary` com m:chr arbitrário) — a lib docx só expõe
 * MathIntegral (∫) e MathSum (∑); com XmlComponent + MathNAryProperties
 * compomos ∏ (e qualquer operador) com limites acima/abaixo (undOvr). */
export class MathNary extends XmlComponent {
  constructor(
    chr: string,
    options: {
      children: MathComponent[];
      subScript?: MathComponent[];
      superScript?: MathComponent[];
    },
  ) {
    super("m:nary");
    this.root.push(new MathNAryProperties(chr, !!options.superScript, !!options.subScript));
    if (options.subScript) this.root.push(new MathSubScriptElement(options.subScript));
    if (options.superScript) this.root.push(new MathSuperScriptElement(options.superScript));
    this.root.push(new MathBase(options.children));
  }
}

/** Símbolos LaTeX comuns → glifos Unicode (para \lim_{x \to 0}, \cdot, \pi etc.). */
const MATH_SYMBOLS: Record<string, string> = {
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  gets: "←",
  cdot: "·",
  times: "×",
  pm: "±",
  mp: "∓",
  div: "÷",
  infty: "∞",
  pi: "π",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  sigma: "σ",
  omega: "ω",
  phi: "φ",
  epsilon: "ε",
  rho: "ρ",
  tau: "τ",
  psi: "ψ",
  Delta: "Δ",
  Gamma: "Γ",
  Lambda: "Λ",
  Omega: "Ω",
  Sigma: "Σ",
  Theta: "Θ",
  partial: "∂",
  nabla: "∇",
  geq: "≥",
  leq: "≤",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  supset: "⊃",
  cup: "∪",
  cap: "∩",
  forall: "∀",
  exists: "∃",
  neg: "¬",
  quad: " ",
  qquad: "  ",
};

/**
 * Parser LaTeX→OMML (fração, raiz, sobrescrito/subscrito, N-ÁRIO ∫/∑/∏ com
 * limites, \lim e símbolos) para equações digitadas no editor como
 * `[EQ] \int_0^1 x dx + \sum_{i=1}^n i (2.1)`.
 *
 * Retorna `null` quando o corpo não contém estrutura LaTeX — nesse caso a
 * equação permanece achatada (m:r/m:t), comportamento histórico preservado.
 *
 * Suporta: \frac{num}{den}, \sqrt[grau]{corpo} / \sqrt{corpo}, X^{sup} / X^c,
 * X_{sub} / X_c, \int_a^b, \sum_{i=1}^{n}, \prod, \lim_{x \to 0}, símbolos
 * comuns (\to, \cdot, \pi, \infty...), agrupamento por chaves e aninhamento.
 */
export function parseLatexMath(latex: string): MathComponent[] | null {
  if (!/\\[a-zA-Z]+|\^|_/.test(latex)) return null;

  let pos = 0;
  const src = latex;

  const readScriptArg = (kind: "_" | "^"): MathComponent[] | undefined => {
    skipSpace();
    if (src[pos] !== kind) return undefined;
    pos += 1;
    skipSpace();
    if (src[pos] === "{") return parseGroup();
    const single = src[pos] ?? "";
    pos += 1;
    return [new MathRun(single)];
  };

  const skipSpace = (): void => {
    while (pos < src.length && /\s/.test(src[pos])) pos += 1;
  };

  const parseGroup = (): MathComponent[] => {
    // src[pos] === "{"
    pos += 1;
    const inner = parseComponents();
    skipSpace();
    if (src[pos] === "}") pos += 1;
    if (inner.length === 1) return inner;
    const text = inner.map((c) => mathRunText(c)).join("");
    return text ? [new MathRun(text)] : [inner[0]];
  };

  const parseAtom = (): MathComponent | null => {
    skipSpace();
    if (pos >= src.length) return null;
    const ch = src[pos];
    if (ch === "\\") {
      const cmd = src.slice(pos + 1).match(/^[a-zA-Z]+/)?.[0] ?? "";
      pos += 1;
      if (cmd === "frac" || cmd === "sqrt") {
        pos += cmd.length;
        skipSpace();
        const readArg = (): MathComponent[] => {
          skipSpace();
          if (src[pos] === "{") return parseGroup();
          const single = src[pos] ?? "";
          pos += 1;
          return [new MathRun(single)];
        };
        if (cmd === "frac") {
          const numerator = readArg();
          const denominator = readArg();
          return new MathFraction({ numerator, denominator });
        }
        // sqrt
        skipSpace();
        let degree: MathComponent[] | undefined;
        if (src[pos] === "[") {
          pos += 1;
          degree = parseComponents();
          skipSpace();
          if (src[pos] === "]") pos += 1;
        }
        const body = readArg();
        return new MathRadical({ children: body, ...(degree ? { degree } : {}) });
      }
      if (cmd === "text") {
        // \text{...} → run de texto plano (não estrutura)
        pos += 4;
        skipSpace();
        if (src[pos] === "{") {
          const inner = parseGroup();
          const text = inner.map((c) => mathRunText(c)).join("");
          return new MathRun(text);
        }
        return new MathRun("");
      }
      // N-ÁRIO: \int, \sum, \prod (com limites _ ^) e \lim — o integrando/
      // argumento é o restante do grupo atual (parseComponents para em } / ] / fim).
      if (cmd === "int" || cmd === "sum" || cmd === "prod" || cmd === "lim") {
        pos += cmd.length;
        const sub = readScriptArg("_");
        const sup = readScriptArg("^");
        const children = parseComponents();
        if (cmd === "lim") {
          const name = sub
            ? [new MathSubScript({ children: [new MathRun("lim")], subScript: sub })]
            : [new MathRun("lim")];
          return new MathFunction({ name, children });
        }
        const options = {
          children,
          ...(sub ? { subScript: sub } : {}),
          ...(sup ? { superScript: sup } : {}),
        };
        if (cmd === "int") return new MathIntegral(options);
        if (cmd === "sum") return new MathSum(options);
        return new MathNary("∏", options);
      }
      const symbol = MATH_SYMBOLS[cmd];
      const text = symbol ?? (cmd ? cmd : src[pos] ?? "");
      pos += cmd.length;
      return new MathRun(symbol ?? `\\${text}`);
    }
    if (ch === "{") return parseGroup()[0] ?? new MathRun("");
    pos += 1;
    return new MathRun(ch);
  };

  const parseComponents = (): MathComponent[] => {
    const comps: MathComponent[] = [];
    while (pos < src.length && src[pos] !== "}" && src[pos] !== "]") {
      skipSpace();
      if (pos >= src.length || src[pos] === "}" || src[pos] === "]") break;
      if (src[pos] === "^" || src[pos] === "_") {
        // script sem base — mantém como literal
        comps.push(new MathRun(src[pos]));
        pos += 1;
        continue;
      }
      const atom = parseAtom();
      if (atom === null) break;
      comps.push(atom);
      // script (sobrescrito/subscrito) anexado ao átomo anterior
      skipSpace();
      if (pos < src.length && (src[pos] === "^" || src[pos] === "_")) {
        const script = src[pos];
        pos += 1;
        const last = comps.pop();
        if (last === undefined) continue;
        const arg = src[pos] === "{" ? parseGroup() : [new MathRun(src[pos] ?? "")];
        if (src[pos] !== "{") pos += 1;
        comps.push(
          script === "^"
            ? new MathSuperScript({ children: [last], superScript: arg })
            : new MathSubScript({ children: [last], subScript: arg }),
        );
      }
    }
    return comps;
  };

  return parseComponents();
}

/**
 * Equação como OMML nativo (UFLA-023, Manual UFLA §3.2.8): emite `<m:oMath>`
 * real no DOCX em vez de texto corrido, mantendo centralização e numeração
 * à direita via tab stop. O corpo é montado como `m:r/m:t`; se contiver LaTeX
 * (\frac, \sqrt, ^, _), vira estrutura OMML real (m:f, m:rad, m:sSup, m:sSub).
 */
/**
 * Instrução do campo SEQ a partir do número da equação (Manual UFLA §3.2.8).
 * "2.1" → ` SEQ Eq \s 1 \* ARABIC ` (switch \s usa o heading nível 1);
 * "1" → ` SEQ Eq \* ARABIC ` (sequência simples); sem número → "".
 */
export function equationSeqInstruction(number: string | undefined): string {
  if (!number) return "";
  const match = /^\((\d+(?:\.\d+)?)\)$/.exec(number.trim());
  if (!match) return "";
  const parts = match[1].split(".");
  if (parts.length === 1) return " SEQ Eq \\* ARABIC ";
  return ` SEQ Eq \\s ${parts.length - 1} \\* ARABIC `;
}

export function ommlEquationParagraph(text: string): Paragraph {
  const equationText = cleanMojibakeText(text);
  const numberMatch = equationText.match(/\s*\((\d+(?:\.\d+)?)\)\s*$/);
  const body = numberMatch ? equationText.slice(0, numberMatch.index).trim() : equationText;
  const number = numberMatch ? `(${numberMatch[1]})` : "";
  const font = UFLA_RULES.typography.fontFamily;
  const size = UFLA_RULES.typography.bodyFontSizePt * 2;
  const parsed = parseLatexMath(body);
  const mathChildren: MathComponent[] = parsed ?? [new MathRun(body)];
  const children: Array<TextRun | DocxMath | SimpleField> = [
    new DocxMath({ children: mathChildren }),
  ];
  if (number) {
    children.push(new TextRun({ text: "\t", font, size, color: "000000" }));
    // Campo SEQ real (fldSimple): o Word recalcula ao abrir (updateFields=true);
    // o texto do número fica como resultado em cache até a atualização.
    const seqInstr = equationSeqInstruction(number);
    children.push(
      seqInstr
        ? new SimpleField(seqInstr, number)
        : new TextRun({ text: number, font, size, color: "000000" }),
    );
  }
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, before: 120, after: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: cmToTwip(16) }],
    children,
  });
}

/**
 * Equação importada com estrutura matemática avançada (frações, raízes,
 * somatórios). O OMML cru da origem é registrado e re-injetado no XML final
 * pelo patch pós-Packer; enquanto isso, o parágrafo emite um marcador único
 * que será substituído pelo `<m:oMathPara>` original. Sem OMML cru, cai no
 * OMML achatado (m:r/m:t).
 */
export interface ImportedEquation {
  text: string;
  ommlXml: string;
}

const RAW_OMML_MARKER = "\uF000UFLAOMML";
interface RawOmmlEntry {
  ommlXml: string;
  number: string;
  /** Instrução do campo SEQ (ex.: ` SEQ Eq \s 1 \* ARABIC `) — numeração real no OOXML. */
  seqInstr: string;
}
const rawOmmlRegistry = new Map<string, RawOmmlEntry>();
// Contador global MONOTÔNICO (nunca resetado): IDs de marcador são únicos
// entre gerações — dois `generateXxxDocxBlob` em paralelo não colidem nem
// apagam os registros um do outro (A4 do checklist-14).
let rawOmmlSeq = 0;

export function clearRawOmmlRegistry(): void {
  // Utilidade de reset (testes/limpeza manual). NÃO reseta rawOmmlSeq:
  // reutilizar IDs reintroduziria a corrida entre gerações paralelas.
  rawOmmlRegistry.clear();
}

export function rawOmmlRegistrySize(): number {
  return rawOmmlRegistry.size;
}

export function rawOmmlMarkerParagraph(
  text: string,
  ommlXml: string | undefined,
): Paragraph {
  if (!ommlXml) {
    return ommlEquationParagraph(text);
  }
  const equationText = cleanMojibakeText(text);
  const numberMatch = equationText.match(/\s*\((\d+(?:\.\d+)?)\)\s*$/);
  const number = numberMatch ? `(${numberMatch[1]})` : "";
  // Campo SEQ real no OOXML (Manual UFLA §3.2.8): o número da equação passa a
  // ser um campo Word calculado com o resultado em cache — o Word recalcula ao
  // abrir (updateFields=true). Instrução compartilhada com o caminho achatado.
  const seqInstr = equationSeqInstruction(number);
  const markerId = String(++rawOmmlSeq);
  rawOmmlRegistry.set(markerId, { ommlXml, number, seqInstr });
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, before: 120, after: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: cmToTwip(16) }],
    children: [new TextRun({ text: `${RAW_OMML_MARKER}_${markerId}\uF000` })],
  });
}

/** Localiza o OMML cru registrado pelo marcador (usado pelo patch pós-Packer). */
export function rawOmmlForMarker(markerId: string): RawOmmlEntry | undefined {
  return rawOmmlRegistry.get(markerId);
}

/** Remove a entrada do marcador após o consumo pelo patch pós-Packer (A4). */
export function rawOmmlDeleteMarker(markerId: string): void {
  rawOmmlRegistry.delete(markerId);
}

/**
 * Codifica o OMML cru num token ASCII seguro para viajar dentro do texto do
 * editor (rascunho). O token é `\uF001OMML:<base64>\uF001`, invisível para o
 * usuário e preservado por `cleanText`/`parseEditorContent`.
 */
export function ommlContentToken(ommlXml: string): string {
  const bytes = new TextEncoder().encode(ommlXml);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `\uF001OMML:${btoa(binary)}\uF001`;
}

/**
 * Decodifica um token `ommlContentToken` de volta para o XML OMML cru.
 * Token editado/corrompido (base64 inválido) NÃO lança: degrada para `""`
 * e o chamador cai no OMML achatado (m:r/m:t) — export e preview seguem
 * sem crash (A1 do checklist-14).
 */
export function ommlContentTokenDecode(token: string): string {
  try {
    const binary = atob(token);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    console.warn(
      "Token OMML inválido (base64 corrompido) — equação será emitida como texto achatado.",
      error,
    );
    return "";
  }
}

/** Padrão que localiza o token OMML no final de uma linha `[EQ]` do rascunho. */
export const OMML_CONTENT_TOKEN_PATTERN = /\uF001OMML:([A-Za-z0-9+/=]+)\uF001$/;

// ---------------------------------------------------------------------------
// Religação de referências cruzadas (bookmarks/PAGEREF no round-trip)
// ---------------------------------------------------------------------------

/**
 * Token de referência cruzada no rascunho: `[x:ANCHOR~texto visível]` (ou
 * `[x:ANCHOR]` quando não há texto próprio). O separador `~` evita colisão com
 * a sintaxe de tabela markdown (`|`) usada pelo `parseEditorContent`. Produzido
 * na importação para hiperlinks internos (`w:hyperlink w:anchor`) e resolvido
 * na exportação para um `InternalHyperlink` apontando ao bookmark atual
 * (religação por label).
 */
export const XREF_TOKEN_PATTERN = /\[x:([^\]~]+)(?:~([^\]]*))?\]/g;

/**
 * Resolve a âncora de uma referência cruzada para o bookmark vigente do DOCX
 * que está sendo exportado. Registrado por exportador (escopo de documento);
 * sem resolver registrado, `resolveXrefTarget` retorna null (texto plano).
 */
export type XrefResolver = (anchor: string, visible: string) => string | null;

let xrefResolver: XrefResolver | null = null;

export function clearXrefRegistry(): void {
  xrefResolver = null;
}

export function registerXrefResolver(resolver: XrefResolver): void {
  xrefResolver = resolver;
}

export function resolveXrefTarget(anchor: string, visible: string): string | null {
  return xrefResolver ? xrefResolver(anchor, visible) : null;
}

/**
 * ID estável de bookmark para títulos de seção (`SECAO_<label normalizado>`),
 * usado tanto pelo BookmarkStart dos headings quanto pela resolução de
 * referências cruzadas que apontam para seções.
 */
export function sectionBookmarkId(text: string): string {
  const base = cleanMojibakeText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  return `SECAO_${base || "ITEM"}`;
}

/** Extrai os tokens `[x:...]` de um texto, devolvendo (anchor, visible). */
export function extractXrefTokens(text: string): Array<{ anchor: string; visible: string }> {
  const tokens: Array<{ anchor: string; visible: string }> = [];
  let match: RegExpExecArray | null;
  XREF_TOKEN_PATTERN.lastIndex = 0;
  while ((match = XREF_TOKEN_PATTERN.exec(text)) !== null) {
    tokens.push({ anchor: match[1].trim(), visible: (match[2] ?? "").trim() });
  }
  return tokens;
}
