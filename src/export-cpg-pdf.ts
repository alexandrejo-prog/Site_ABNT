import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CM_TO_PT = 28.3464567;
const MARGIN_LEFT = 3 * CM_TO_PT;
const MARGIN_RIGHT = 3 * CM_TO_PT;
const MARGIN_TOP = 3.5 * CM_TO_PT;
const MARGIN_BOTTOM = 2.5 * CM_TO_PT;
const ABSTRACT_INDENT = 0.8 * CM_TO_PT;
const REFERENCE_HANGING = 0.5 * CM_TO_PT;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const MIN_JUSTIFY_SPACES = 2;
const MAX_EXTRA_WORD_SPACING = 3.5;

type FontName = "Times-Roman" | "Times-Bold" | "Times-Italic" | "Courier" | "Helvetica-Bold";
type Align = "left" | "center" | "justify";

interface ParagraphOptions {
  font?: FontName;
  size?: number;
  boldLabel?: string;
  align?: Align;
  leftIndent?: number;
  rightIndent?: number;
  firstLineIndent?: number;
  hangingIndent?: number;
  spacingBefore?: number;
  lineHeight?: number;
}

interface PdfPage {
  commands: string[];
  yPositions: number[];
}

interface LayoutState {
  pages: PdfPage[];
  currentPage: PdfPage;
  cursorY: number;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripMarkup(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function latin1Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    bytes.push(code <= 255 ? code : "?".charCodeAt(0));
  }
  return bytes;
}

function escapePdfLiteral(value: string): string {
  const normalized = normalizePdfText(value);
  return latin1Bytes(normalized)
    .map((byte) => {
      if (byte === 0x28 || byte === 0x29 || byte === 0x5c) return `\\${String.fromCharCode(byte)}`;
      if (byte < 0x20 || byte > 0x7e) return `\\${byte.toString(8).padStart(3, "0")}`;
      return String.fromCharCode(byte);
    })
    .join("");
}

function normalizePdfText(value: string): string {
  return value
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-");
}

function glyphWidthFactor(char: string, isBold: boolean): number {
  if (char === " ") return 0.25;
  if (".,:;!|'`".includes(char)) return 0.28;
  if ("()[]{}".includes(char)) return 0.33;
  if ("ijlI".includes(char)) return isBold ? 0.35 : 0.28;
  if ("ft".includes(char)) return isBold ? 0.38 : 0.32;
  if ("r".includes(char)) return isBold ? 0.40 : 0.34;
  if ("-–—".includes(char)) return 0.33;
  if ("mwMW".includes(char)) return isBold ? 0.88 : 0.78;
  if ("ABCDEFGHKNOPQRSTUVXYZÁÂÃÀÉÊÍÓÔÕÚÇ".includes(char)) return isBold ? 0.72 : 0.66;
  if ("abcdghnopquvxyzáâãàéêíóôõúç".includes(char)) return isBold ? 0.55 : 0.50;
  if ("es".includes(char)) return isBold ? 0.50 : 0.44;
  return isBold ? 0.58 : 0.52;
}

function measureText(text: string, size: number, isBold: boolean = false): number {
  let width = 0;
  for (const char of normalizePdfText(text)) {
    width += size * glyphWidthFactor(char, isBold);
  }
  return width;
}

function wrapText(text: string, width: number, size: number, isBold: boolean = false): string[] {
  const words = stripMarkup(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureText(next, size, isBold) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function countSpaces(text: string): number {
  return (text.match(/ /g) ?? []).length;
}

function justifyWordSpacing(line: string, lineWidth: number, targetWidth: number): number | undefined {
  const spaceCount = countSpaces(line);
  if (spaceCount < MIN_JUSTIFY_SPACES) return undefined;

  const extraSpacing = (targetWidth - lineWidth) / spaceCount;
  if (extraSpacing <= 0 || extraSpacing > MAX_EXTRA_WORD_SPACING) return undefined;

  return extraSpacing;
}

function newPage(): PdfPage {
  return { commands: [], yPositions: [] };
}

function createLayoutState(): LayoutState {
  const page = newPage();
  return {
    pages: [page],
    currentPage: page,
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
  };
}

function addPage(state: LayoutState): void {
  const page = newPage();
  state.pages.push(page);
  state.currentPage = page;
  state.cursorY = PAGE_HEIGHT - MARGIN_TOP;
}

function ensureSpace(state: LayoutState, heightNeeded: number): void {
  if (state.cursorY - heightNeeded < MARGIN_BOTTOM) {
    addPage(state);
  }
}

function setFont(page: PdfPage, font: FontName, size: number): void {
  const fontMap: Record<FontName, string> = {
    "Times-Roman": "F1",
    "Times-Bold": "F2",
    "Times-Italic": "F3",
    Courier: "F4",
    "Helvetica-Bold": "F5",
  };
  page.commands.push(`/${fontMap[font]} ${size} Tf`);
}

function addTextLine(
  state: LayoutState,
  text: string,
  x: number,
  y: number,
  font: FontName,
  size: number,
  wordSpacing?: number,
): void {
  setFont(state.currentPage, font, size);
  if (wordSpacing !== undefined) {
    state.currentPage.commands.push(`${wordSpacing.toFixed(3)} Tw`);
  }
  state.currentPage.commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfLiteral(normalizePdfText(text))}) Tj`);
  if (wordSpacing !== undefined) {
    state.currentPage.commands.push("0 Tw");
  }
  state.currentPage.yPositions.push(Number(y.toFixed(2)));
}

function addParagraph(state: LayoutState, text: string, options: ParagraphOptions = {}): void {
  const size = options.size ?? 12;
  const baseFont = options.font ?? "Times-Roman";
  const isBoldBase = baseFont === "Times-Bold" || baseFont === "Helvetica-Bold";
  const lineHeight = options.lineHeight ?? size * 1.15;
  const spacingBefore = options.spacingBefore ?? 6;
  const leftIndent = options.leftIndent ?? 0;
  const rightIndent = options.rightIndent ?? 0;
  const firstLineIndent = options.firstLineIndent ?? 0;
  const width = CONTENT_WIDTH - leftIndent - rightIndent;
  const label = options.boldLabel ?? "";
  const plainText = label && text.startsWith(label) ? text.slice(label.length).trimStart() : text;
  const lines = label
    ? wrapText(`${label} ${plainText}`, width, size)
    : wrapText(text, width, size, isBoldBase);

  ensureSpace(state, spacingBefore + lineHeight);
  state.cursorY -= spacingBefore;

  lines.forEach((line, index) => {
    ensureSpace(state, lineHeight);
    const isLastLine = index === lines.length - 1;
    const indent = index === 0 ? firstLineIndent : options.hangingIndent ? options.hangingIndent : 0;
    const availableLineWidth = Math.max(0, width - indent);
    const lineWidth = measureText(line, size, isBoldBase);
    let x = MARGIN_LEFT + leftIndent + indent;
    let wordSpacing: number | undefined;

    if (options.align === "center") {
      x = MARGIN_LEFT + leftIndent + Math.max(0, (width - lineWidth) / 2);
    } else if (options.align === "justify" && !isLastLine) {
      wordSpacing = justifyWordSpacing(line, lineWidth, availableLineWidth);
    }

    if (label && index === 0 && line.startsWith(label)) {
      const labelWidth = measureText(label, size, true) + 6;
      addTextLine(state, label, x, state.cursorY, "Times-Bold", size);
      addTextLine(state, line.slice(label.length), x + labelWidth, state.cursorY, baseFont, size);
    } else {
      addTextLine(state, line, x, state.cursorY, baseFont, size, wordSpacing);
    }
    state.cursorY -= lineHeight;
  });
}

function addTitleBlock(state: LayoutState, input: DocxGenerationInput): void {
  addParagraph(state, input.fields.title || "Titulo do trabalho", {
    font: "Times-Bold",
    size: 16,
    align: "center",
    spacingBefore: 12,
    lineHeight: 19,
  });
  addParagraph(state, input.fields.author || "Autores", {
    font: "Times-Bold",
    size: 12,
    align: "center",
    spacingBefore: 12,
  });
  for (const affiliation of splitParagraphs(input.fields.program)) {
    addParagraph(state, affiliation, { align: "center", spacingBefore: 0 });
  }
  if (hasText(input.fields.course)) {
    addParagraph(state, input.fields.course, {
      font: "Courier",
      size: 10,
      align: "center",
      spacingBefore: 6,
      lineHeight: 13,
    });
  }
}

function addEditorBlocks(state: LayoutState, blocks: EditorBlock[]): void {
  let firstParagraphInSection = true;

  for (const block of blocks) {
    if (block.type === "reference") continue;
    if (block.type === "heading1") {
      addParagraph(state, block.text, { font: "Times-Bold", size: 13, spacingBefore: 12 });
      firstParagraphInSection = true;
      continue;
    }
    if (block.type === "heading2" || block.type === "heading3") {
      addParagraph(state, block.text, { font: "Times-Bold", size: 12, spacingBefore: 12 });
      firstParagraphInSection = true;
      continue;
    }
    if (/^(figura|imagem|tabela|quadro)\s+\d+/i.test(block.text)) {
      addParagraph(state, block.text, {
        font: "Helvetica-Bold",
        size: 10,
        align: "center",
        leftIndent: ABSTRACT_INDENT,
        rightIndent: ABSTRACT_INDENT,
      });
      continue;
    }

    addParagraph(state, block.text, {
      align: "justify",
      firstLineIndent: firstParagraphInSection ? 0 : 1.27 * CM_TO_PT,
      leftIndent: 0,
      rightIndent: 0,
    });
    firstParagraphInSection = false;
  }
}

function isReferenceTitleNoise(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^(REFERENCIAS|REFERÊNCIAS|BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(normalized);
}

function referenceTitleFor(references: string[]): string {
  const upper = references.map((r) => r.trim().toUpperCase());
  const hasRef = upper.some((r) => /^(REFERENCIAS|REFERÊNCIAS)$/.test(r));
  const hasBiblio = upper.some((r) => /^(BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(r));
  if (hasRef && hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  if (hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  return "Referencias";
}

function filterReferenceNoise(reference: string): boolean {
  return !isReferenceTitleNoise(reference);
}

function addReferences(state: LayoutState, references: string[]): void {
  const cleanReferences = (Array.isArray(references) ? references : [])
    .map((item) => stripMarkup(item).trim())
    .filter(Boolean)
    .filter(filterReferenceNoise);
  if (!cleanReferences.length) return;

  const title = referenceTitleFor(Array.isArray(references) ? references : []);
  addParagraph(state, title, { font: "Times-Bold", size: 13, spacingBefore: 12 });
  for (const reference of cleanReferences.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))) {
    addParagraph(state, reference, {
      spacingBefore: 6,
      firstLineIndent: 0,
      hangingIndent: REFERENCE_HANGING,
      leftIndent: 0,
      rightIndent: 0,
    });
  }
}

function addAbstractGroup(state: LayoutState, input: DocxGenerationInput): void {
  if (hasText(input.fields.abstractText)) {
    addParagraph(state, `Abstract. ${input.fields.abstractText}`, {
      boldLabel: "Abstract.",
      align: "justify",
      leftIndent: ABSTRACT_INDENT,
      rightIndent: ABSTRACT_INDENT,
    });
  }
  if (hasText(input.fields.keywords)) {
    addParagraph(state, `Keywords: ${input.fields.keywords}`, {
      boldLabel: "Keywords:",
      leftIndent: ABSTRACT_INDENT,
      rightIndent: ABSTRACT_INDENT,
    });
  }
  if (hasText(input.fields.resumo)) {
    addParagraph(state, `Resumo. ${input.fields.resumo}`, {
      boldLabel: "Resumo.",
      align: "justify",
      leftIndent: ABSTRACT_INDENT,
      rightIndent: ABSTRACT_INDENT,
    });
  }
  if (hasText(input.fields.palavrasChave)) {
    addParagraph(state, `Palavras-chave: ${input.fields.palavrasChave}`, {
      boldLabel: "Palavras-chave:",
      leftIndent: ABSTRACT_INDENT,
      rightIndent: ABSTRACT_INDENT,
    });
  }
}

function buildLayout(input: DocxGenerationInput): LayoutState {
  const state = createLayoutState();
  const blocks = parseEditorContent(input.editorText);
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];

  addTitleBlock(state, input);

  if (input.fields.workType === "resumo_cpg") {
    addAbstractGroup(state, input);
    if (hasText(input.fields.agradecimentos)) {
      addParagraph(state, "Agradecimentos", { font: "Times-Bold", size: 13, spacingBefore: 12 });
      addParagraph(state, input.fields.agradecimentos, { align: "justify" });
    }
    return state;
  }

  addAbstractGroup(state, input);

  // O template CPG separa a primeira página do corpo textual:
  // título, autores, afiliação, abstract, keywords, resumo e palavras-chave
  // ficam na primeira página; a Introdução começa na página seguinte.
  addPage(state);

  addEditorBlocks(state, blocks);
  addReferences(state, references);
  return state;
}

function pageObject(pageNumber: number, contentObjectNumber: number): string {
  return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R /F5 7 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
}

function contentObject(page: PdfPage): string {
  const content = ["BT", ...page.commands, "ET"].join("\n");
  return `<< /Length ${latin1Bytes(content).length} >>\nstream\n${content}\nendstream`;
}

function toPdfBytes(objects: string[]): Uint8Array {
  const bytes: number[] = [];
  const offsets = [0];

  function append(value: string): void {
    bytes.push(...latin1Bytes(value));
  }

  append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  objects.forEach((object, index) => {
    offsets.push(bytes.length);
    append(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = bytes.length;
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    append(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Uint8Array(bytes);
}

function makePdf(input: DocxGenerationInput): Uint8Array {
  const layout = buildLayout(input);
  const contentStart = 8 + layout.pages.length;
  const pageObjects = layout.pages.map((_, index) => pageObject(index + 1, contentStart + index));
  const contentObjects = layout.pages.map(contentObject);
  const pageRefs = pageObjects.map((_, index) => `${8 + index} 0 R`).join(" ");
  return toPdfBytes([
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${layout.pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ...pageObjects,
    ...contentObjects,
  ]);
}

export async function generateCpgPdfBlob(input: DocxGenerationInput): Promise<Blob> {
  const bytes = makePdf(input);
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  return new Blob([data], { type: "application/pdf" });
}

export function inspectCpgPdfLayout(input: DocxGenerationInput): { pageCount: number; duplicateYPositions: number } {
  const layout = buildLayout(input);
  const duplicateYPositions = layout.pages.reduce((total, page) => {
    const seen = new Set<number>();
    let duplicates = 0;
    for (const y of page.yPositions) {
      if (seen.has(y)) duplicates += 1;
      seen.add(y);
    }
    return total + duplicates;
  }, 0);
  return { pageCount: layout.pages.length, duplicateYPositions };
}
