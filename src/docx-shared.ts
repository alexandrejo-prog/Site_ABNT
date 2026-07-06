import { AlignmentType, Header, ImageRun, PageBreak, PageNumber, Paragraph, TextRun } from "docx";
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
