import { AlignmentType, BorderStyle, Header, ImageRun, PageBreak, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { IParagraphOptions } from "docx";
import type { DocxLogoAsset } from "./export-docx";
import { UFLA_RULES } from "./ufla-rules";

export const BLACK = "000000";
export const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
export const TITLE_SIZE = UFLA_RULES.typography.coverTitleFontSizePt * 2;
export const AUTHOR_SIZE = UFLA_RULES.typography.coverAuthorFontSizePt * 2;
export const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
export const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;

export function pageMargins() {
  return {
    top: UFLA_RULES.margins.topTwip,
    left: UFLA_RULES.margins.leftTwip,
    bottom: UFLA_RULES.margins.bottomTwip,
    right: UFLA_RULES.margins.rightTwip,
    header: UFLA_RULES.header.distanceFromTopTwip,
    footer: UFLA_RULES.footer.distanceFromBottomTwip,
  };
}

export function run(text: string, bold = false, size = BODY_SIZE): TextRun {
  return new TextRun({ text, bold, size, font: UFLA_RULES.typography.fontFamily, color: BLACK });
}

export function paragraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: [run(text || " ")],
    ...options,
  });
}

export function centered(text: string, bold = false, size = BODY_SIZE, before = 0, after = 240): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before, after, line: SINGLE_LINE },
    children: [run(text || " ", bold, size)],
  });
}

export function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

export function unnumberedTitle(text: string): Paragraph {
  return centered(text.toUpperCase(), true, BODY_SIZE, 240, 240);
}

export function logoParagraph(logo?: DocxLogoAsset): Paragraph[] {
  if (!logo) return [centered("UNIVERSIDADE FEDERAL DE LAVRAS", true, AUTHOR_SIZE, 0, 0)];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new ImageRun({
          data: logo.data,
          transformation: { width: logo.width ?? 265, height: logo.height ?? 108 },
          altText: { title: "Logo UFLA", description: "Universidade Federal de Lavras", name: "Logo UFLA" },
        }),
      ],
    }),
  ];
}

export function pageNumberHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: UFLA_RULES.typography.fontFamily, size: UFLA_RULES.typography.pageNumberFontSizePt * 2, color: BLACK })],
      }),
    ],
  });
}

export interface IbgeTableOptions {
  caption?: string;
  headerLabels: string[];
  rows: string[][];
  columnWidths?: number[];
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

export function ibgeTable(options: IbgeTableOptions): Table {
  const widths = options.columnWidths ?? options.headerLabels.map(() => Math.floor(100 / options.headerLabels.length));
  const headerRow = new TableRow({
    tableHeader: true,
    children: options.headerLabels.map(
      (label, index) =>
        new TableCell({
          width: { size: widths[index], type: WidthType.PERCENTAGE },
          shading: { fill: "D9E2F3" },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: UFLA_RULES.typography.fontFamily, size: 20, color: BLACK })] })],
        }),
    ),
  });

  const bodyRows = options.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell, index) =>
            new TableCell({
              width: { size: widths[index], type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [new Paragraph({ children: [new TextRun({ text: cell, font: UFLA_RULES.typography.fontFamily, size: 20, color: BLACK })] })],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      insideVertical: NO_BORDER,
    },
    rows: [headerRow, ...bodyRows],
  });
}
