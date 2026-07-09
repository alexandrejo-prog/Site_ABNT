import {
  AlignmentType,
  IParagraphOptions,
  Paragraph,
  TextRun,
} from "docx";

export function cleanMojibakeText(value: string): string {
  return value
    .replace(/([\p{L}\p{N}])[\u00ad\ufeff\ufffe\uffff\u2060]([\p{L}\p{N}])/gu, "$1-$2")
    .replace(/[\u00ad\ufeff\ufffe\uffff\u2060\u200b]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã“/g, "Ó")
    .replace(/Ã‡/g, "Ç");
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

  return runs.length ? runs : [{ text: "" }];
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
): TextRun[] {
  return text.split(/\n/).flatMap((line, index) => {
    const runs = textRunsForSingleLine(line, size, font, color);
    if (index === 0) return runs;
    return [new TextRun({ break: 1 }), ...runs];
  });
}

export function textParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: 360, after: 240 },
    indent: { firstLine: 283 },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function simpleParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: 240, after: 240 },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function centeredParagraph(
  text: string,
  bold = false,
  size = 24,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: 240 },
): Paragraph {
  return new Paragraph({
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

const CAPTION_PATTERN = /^(figura|quadro|gráfico|mapa|imagem|ilustração|tabela)\s+(\d+)([-:–]?\s*.*)$/i;

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

export function captionParagraph(
  text: string,
  _kind: CaptionKind = "illustration",
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: 240 },
    indent: { left: 454, right: 454 },
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        bold: true,
        font: "Times New Roman",
        size: 20,
        color: "000000",
      }),
    ],
  });
}
