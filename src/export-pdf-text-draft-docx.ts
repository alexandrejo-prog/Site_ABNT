import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import type { PdfLayoutSensitiveRegionDiagnostic, PdfReconstructedBlockDiagnostic } from "./imported-pdf-diagnostic";
import type { PdfTextDraftExportInput, PdfTextDraftValidation } from "./pdf-text-draft-contract";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const CM_3_TWIP = 1701;
const CM_2_TWIP = 1134;
const BODY_FIRST_LINE_TWIP = 850;
const ONE_AND_HALF_LINE_TWIP = 360;
const ZERO_SPACING = { before: 0, after: 0 };
const FONT = "Times New Roman";
type ParagraphAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function paragraphTextRun(text: string, size = 24, options: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size,
    bold: options.bold,
    italics: options.italics,
  });
}

function paragraph(children: TextRun[], options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({
    ...options,
    children,
  });
}

function technicalParagraph(text: string, bold = false, alignment: ParagraphAlignment = AlignmentType.LEFT): Paragraph {
  return paragraph([paragraphTextRun(text, 20, { bold })], {
    alignment,
    spacing: { ...ZERO_SPACING, line: 240 },
    indent: { firstLine: 0 },
  });
}

function bodyParagraph(text: string): Paragraph {
  return paragraph([paragraphTextRun(cleanText(text), 24)], {
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: BODY_FIRST_LINE_TWIP },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
  });
}

function headingParagraph(text: string): Paragraph {
  return paragraph([paragraphTextRun(cleanText(text), 24, { bold: true })], {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
  });
}

function smallParagraph(text: string, italics = false, alignment: ParagraphAlignment = AlignmentType.LEFT): Paragraph {
  return paragraph([paragraphTextRun(cleanText(text), 20, { italics })], {
    alignment,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: 240 },
  });
}

function visualKindLabel(kind?: PdfLayoutSensitiveRegionDiagnostic["kind"]): string {
  if (kind === "quadro") return "Quadro";
  if (kind === "tabela") return "Tabela";
  if (kind === "figura") return "Figura";
  if (kind === "grafico") return "Gráfico";
  if (kind === "multicolumn") return "Conteúdo em colunas";
  return "Elemento visual não identificado";
}

function originalPagesLabel(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd ? `página original ${pageStart}` : `páginas originais ${pageStart}-${pageEnd}`;
}

function markerForBlock(block: PdfReconstructedBlockDiagnostic, regions: Map<string, PdfLayoutSensitiveRegionDiagnostic>): string {
  if (!block.layoutRegionId) {
    return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  }
  const region = regions.get(block.layoutRegionId);
  if (!region) {
    return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  }
  return `[Elemento visual não inserido neste rascunho textual — ${visualKindLabel(region.kind)}, ${originalPagesLabel(region.pageStart, region.pageEnd)}. Consulte o PDF original.]`;
}

function technicalSummary(input: PdfTextDraftExportInput): string[] {
  const stats = input.reconstruction.statistics;
  return [
    `Arquivo de origem: ${input.fileName}`,
    `Páginas do PDF: ${input.pageCount}`,
    `Parágrafos reconstruídos: ${stats.paragraphCount}`,
    `Títulos reconstruídos: ${stats.headingCount}`,
    `Elementos visuais não inseridos: ${stats.layoutRegionCount}`,
    `Hifenizações incertas: ${stats.uncertainHyphenationCount}`,
  ];
}

function buildParagraphs(input: PdfTextDraftExportInput): Paragraph[] {
  const emittedRegions = new Set<string>();
  const regions = new Map(input.reconstruction.layoutRegions.map((region) => [region.id, region]));
  const paragraphs: Paragraph[] = [
    paragraph([paragraphTextRun("Rascunho textual extraído de PDF", 24, { bold: true })], {
      alignment: AlignmentType.CENTER,
      spacing: ZERO_SPACING,
      indent: { firstLine: 0 },
    }),
    technicalParagraph("Este arquivo foi reconstruído automaticamente a partir de um PDF. Revise a estrutura, as citações, as hifenizações, os títulos e os elementos visuais antes do uso acadêmico."),
    ...technicalSummary(input).map((line) => technicalParagraph(line)),
  ];

  for (const block of input.reconstruction.blocks) {
    const text = cleanText(block.text);
    if (!text && block.type !== "unresolved") continue;
    if (block.type === "heading") paragraphs.push(headingParagraph(text));
    if (block.type === "paragraph") paragraphs.push(bodyParagraph(text));
    if (block.type === "list-item") paragraphs.push(bodyParagraph(text));
    if (block.type === "caption") paragraphs.push(smallParagraph(text));
    if (block.type === "source") paragraphs.push(smallParagraph(text));
    if (block.type === "unresolved") {
      const key = block.layoutRegionId ?? `unresolved-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? paragraphs.length}`;
      if (emittedRegions.has(key)) continue;
      emittedRegions.add(key);
      paragraphs.push(smallParagraph(markerForBlock(block, regions), true, AlignmentType.CENTER));
    }
  }
  return paragraphs;
}

export function validatePdfTextDraftExport(input: PdfTextDraftExportInput): PdfTextDraftValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (input.sourceKind !== "pdf") blockers.push("A fonte precisa ser PDF.");
  if (input.documentMode !== "pdf-text-draft") blockers.push("O modo de exportação precisa ser pdf-text-draft.");
  if (!input.reconstruction.bodyStart.found) blockers.push("O início do corpo textual não foi identificado.");
  if (input.reconstruction.blocks.length === 0) blockers.push("Nenhum bloco reconstruído foi encontrado.");
  if (!input.reconstruction.blocks.some((block) => block.type === "paragraph")) blockers.push("Nenhum parágrafo reconstruído foi encontrado.");
  if (input.reconstruction.blocks.some((block) => block.type === "paragraph" && block.pageEnd - block.pageStart > 1)) {
    blockers.push("Há parágrafo atravessando mais de duas páginas.");
  }
  const stats = input.reconstruction.statistics;
  if (stats.unresolvedCount > 0) warnings.push("Há blocos visuais não resolvidos que serão representados por marcadores.");
  if (stats.uncertainHyphenationCount > 0) warnings.push("Há hifenizações incertas para revisão.");
  if (stats.lowConfidenceBlockCount > 0) warnings.push("Há blocos de baixa confiança.");
  if (stats.layoutRegionCount > 0) warnings.push("Elementos visuais serão representados por marcadores.");
  if (!input.reconstruction.layoutRegions.some((region) => region.kind === "figura" || region.kind === "grafico")) {
    warnings.push("Nenhuma figura ou gráfico foi detectado textualmente.");
  }
  if (stats.multiPageParagraphCount > 0) warnings.push("Há parágrafos atravessando até duas páginas.");
  return { canExport: blockers.length === 0, blockers, warnings };
}

export async function buildPdfTextDraftDocxBlob(input: PdfTextDraftExportInput): Promise<Blob> {
  const validation = validatePdfTextDraftExport(input);
  if (!validation.canExport) throw new Error(validation.blockers.join(" "));
  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
          margin: { top: CM_3_TWIP, left: CM_3_TWIP, bottom: CM_2_TWIP, right: CM_2_TWIP },
        },
      },
      children: buildParagraphs(input),
    }],
  });
  const blob = await Packer.toBlob(document);
  return new Blob([blob], { type: DOCX_MIME });
}

export function pdfTextDraftFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "pdf"}-rascunho-textual.docx`;
}
