import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  LeaderType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import type { PdfAbstractDiagnostic, PdfLayoutSensitiveRegionDiagnostic, PdfReconstructedBlockDiagnostic } from "./imported-pdf-diagnostic";
import { ensurePdfTextDraftTocFields } from "./pdf-text-draft-toc-field-patch";
import type { PdfTextDraftExportInput, PdfTextDraftLogoAsset, PdfTextDraftValidation } from "./pdf-text-draft-contract";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const CM_3_TWIP = 1701;
const CM_2_TWIP = 1134;
const BODY_FIRST_LINE_TWIP = 850;
const ONE_AND_HALF_LINE_TWIP = 360;
const SINGLE_LINE_TWIP = 240;
const ZERO_SPACING = { before: 0, after: 0 };
const FONT = "Times New Roman";
const UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";

type TocEntry = {
  title: string;
  bookmark: string;
  level: number;
};

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function run(text: string, size = 24, options: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, size, bold: options.bold, italics: options.italics });
}

function paragraph(children: Array<TextRun | ImageRun | Tab | PageBreak>, options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({ ...options, children });
}

function pageBreak(): Paragraph {
  return paragraph([new PageBreak()], { spacing: ZERO_SPACING });
}

function centered(text: string, options: { bold?: boolean; size?: number; before?: number; after?: number } = {}): Paragraph {
  return paragraph([run(cleanText(text) || " ", options.size ?? 24, { bold: options.bold })], {
    alignment: AlignmentType.CENTER,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: SINGLE_LINE_TWIP },
    indent: { firstLine: 0 },
  });
}

function left(text: string, options: { bold?: boolean; size?: number; italics?: boolean; before?: number; after?: number } = {}): Paragraph {
  return paragraph([run(cleanText(text) || " ", options.size ?? 24, { bold: options.bold, italics: options.italics })], {
    alignment: AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: SINGLE_LINE_TWIP },
    indent: { firstLine: 0 },
  });
}

function justified(text: string, firstLine = BODY_FIRST_LINE_TWIP): Paragraph {
  return paragraph([run(cleanText(text), 24)], {
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
  });
}

function singleJustified(text: string): Paragraph {
  return paragraph([run(cleanText(text), 24)], {
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: SINGLE_LINE_TWIP },
  });
}

function keywordParagraph(label: string, value?: string): Paragraph | undefined {
  const terms = cleanText(value ?? "");
  if (!terms) return undefined;
  const normalized = terms.endsWith(".") ? terms : `${terms}.`;
  return paragraph([run(`${label}:`, 24, { bold: true }), run(` ${normalized}`, 24)], {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: SINGLE_LINE_TWIP },
  });
}

function bodyHeading(text: string, entry?: TocEntry): Paragraph {
  const children: TextRun[] = [];
  if (entry) children.push(run(`__PDF_BM_START_${entry.bookmark}__`, 1));
  children.push(run(cleanText(text), 24, { bold: true }));
  if (entry) children.push(run(`__PDF_BM_END_${entry.bookmark}__`, 1));
  return paragraph(children, {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
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

function markerForBlock(block: PdfReconstructedBlockDiagnostic, regions: Map<string, PdfLayoutSensitiveRegionDiagnostic>, logicalRange?: { pageStart: number; pageEnd: number }): string {
  if (!block.layoutRegionId) return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  const region = regions.get(block.layoutRegionId);
  if (!region) return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  const pageStart = logicalRange?.pageStart ?? region.pageStart;
  const pageEnd = logicalRange?.pageEnd ?? region.pageEnd;
  return `[Elemento visual não inserido neste rascunho textual - ${visualKindLabel(region.kind)}, ${originalPagesLabel(pageStart, pageEnd)}. Consulte o PDF original.]`;
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

async function defaultLogo(): Promise<PdfTextDraftLogoAsset | undefined> {
  if (typeof fetch !== "function") return undefined;
  try {
    const response = await fetch(UFLA_LOGO_PATH);
    if (!response.ok) return undefined;
    return { data: await response.arrayBuffer(), width: 170, height: 69 };
  } catch {
    return undefined;
  }
}

async function resolveLogo(input: PdfTextDraftExportInput): Promise<PdfTextDraftLogoAsset | undefined> {
  return input.logo ?? defaultLogo();
}

function coverParagraphs(input: PdfTextDraftExportInput, logo?: PdfTextDraftLogoAsset): Paragraph[] {
  const cover = input.pretextual?.cover;
  const institution = cover?.institution ?? "UNIVERSIDADE FEDERAL DE LAVRAS";
  const author = cover?.author ?? "[AUTOR AUSENTE]";
  const title = cover?.title ?? "[TÍTULO AUSENTE]";
  const subtitle = cover?.subtitle;
  const city = cover?.city ?? "[LOCAL AUSENTE]";
  const year = cover?.year ?? "[ANO AUSENTE]";
  const paragraphs: Paragraph[] = [];
  if (logo) {
    paragraphs.push(paragraph([new ImageRun({
      data: logo.data,
      transformation: { width: logo.width ?? 170, height: logo.height ?? 69 },
      altText: { title: "Logo UFLA", description: "Universidade Federal de Lavras", name: "Logo UFLA" },
    })], { alignment: AlignmentType.CENTER, spacing: ZERO_SPACING }));
  }
  paragraphs.push(centered(institution, { size: 24, before: logo ? 120 : 0 }));
  paragraphs.push(centered(author, { size: 24, before: 900 }));
  paragraphs.push(centered(title, { size: 24, bold: true, before: 900 }));
  if (subtitle) paragraphs.push(centered(subtitle, { size: 24, bold: true }));
  paragraphs.push(centered(city, { size: 24, before: 3600 }));
  paragraphs.push(centered(year, { size: 24 }));
  paragraphs.push(pageBreak());
  return paragraphs;
}

function titlePageParagraphs(input: PdfTextDraftExportInput): Paragraph[] {
  const titlePage = input.pretextual?.titlePage;
  const cover = input.pretextual?.cover;
  const author = titlePage?.author ?? cover?.author ?? "[AUTOR AUSENTE]";
  const title = titlePage?.title ?? cover?.title ?? "[TÍTULO AUSENTE]";
  const city = titlePage?.city ?? cover?.city ?? "[LOCAL AUSENTE]";
  const year = titlePage?.year ?? cover?.year ?? "[ANO AUSENTE]";
  const lines = [
    titlePage?.natureText,
    titlePage?.program,
    titlePage?.institution,
  ].filter((line): line is string => Boolean(line));
  return [
    centered(author),
    centered(title, { bold: true, before: 1200 }),
    ...(titlePage?.subtitle ? [centered(titlePage.subtitle, { bold: true })] : []),
    ...lines.map((line, index) => left(line, { before: index === 0 ? 900 : 0 })),
    ...(titlePage?.advisor ? [left(titlePage.advisor, { before: 240 })] : []),
    ...(titlePage?.coadvisor ? [left(titlePage.coadvisor)] : []),
    centered(city, { before: 3600 }),
    centered(year),
    pageBreak(),
  ];
}

function noteParagraphs(input: PdfTextDraftExportInput): Paragraph[] {
  return [
    centered("NOTA DE REVISÃO", { bold: true }),
    singleJustified("Este documento foi reconstruído automaticamente a partir de um PDF. Revise os pré-textuais, as citações, as hifenizações, os títulos e os elementos visuais antes do uso acadêmico."),
    ...technicalSummary(input).map((line) => left(line, { size: 20 })),
    pageBreak(),
  ];
}

function abstractParagraphs(abstract: PdfAbstractDiagnostic | undefined, title: "RESUMO" | "ABSTRACT"): Paragraph[] {
  if (!abstract) return [];
  const keyword = keywordParagraph(title === "RESUMO" ? "Palavras-chave" : "Keywords", abstract.keywords);
  return [
    centered(title, { bold: true }),
    singleJustified(abstract.text),
    ...(keyword ? [keyword] : []),
    pageBreak(),
  ];
}

function makeTocEntries(blocks: PdfReconstructedBlockDiagnostic[]): TocEntry[] {
  return blocks
    .filter((block) => block.type === "heading")
    .filter((block) => /^(?:\d+(?:\.\d+)*\s+\S|REFER[ÊE]NCIAS|AP[ÊE]NDICE|ANEXO)/i.test(cleanText(block.text)))
    .map((block, index) => ({
      title: cleanText(block.text),
      bookmark: `PDFBM${String(index + 1).padStart(3, "0")}`,
      level: /^\d+\.\d+/.test(cleanText(block.text)) ? 2 : 1,
    }));
}

function tocParagraphs(entries: TocEntry[]): Paragraph[] {
  return [
    centered("SUMÁRIO", { bold: true }),
    left("Atualize os campos do sumário no Word com Ctrl+A e F9.", { size: 20, italics: true }),
    ...entries.map((entry) => paragraph([
      run(entry.title, 24),
      new Tab(),
      run(`__PDF_PAGEREF_${entry.bookmark}__`, 1),
    ], {
      alignment: AlignmentType.LEFT,
      indent: { firstLine: 0, left: entry.level === 2 ? 425 : 0 },
      spacing: { ...ZERO_SPACING, line: SINGLE_LINE_TWIP },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: LeaderType.DOT }],
    })),
  ];
}

function bodyParagraphs(input: PdfTextDraftExportInput, entries: TocEntry[]): Paragraph[] {
  const emittedKeys = new Set<string>();
  const regions = new Map(input.reconstruction.layoutRegions.map((region) => [region.id, region]));
  const entryByTitle = new Map(entries.map((entry) => [entry.title, entry]));
  const paragraphs: Paragraph[] = [];

  const logicalVisualRanges = new Map<string, { pageStart: number; pageEnd: number }>();
  for (const region of input.reconstruction.layoutRegions) {
    if (!region.logicalVisualId) continue;
    const existing = logicalVisualRanges.get(region.logicalVisualId);
    if (existing) {
      existing.pageStart = Math.min(existing.pageStart, region.pageStart);
      existing.pageEnd = Math.max(existing.pageEnd, region.pageEnd);
    } else {
      logicalVisualRanges.set(region.logicalVisualId, { pageStart: region.pageStart, pageEnd: region.pageEnd });
    }
  }

  for (const block of input.reconstruction.blocks) {
    const text = cleanText(block.text);
    if (!text && block.type !== "unresolved") continue;
    if (block.type === "heading") paragraphs.push(bodyHeading(text, entryByTitle.get(text)));
    if (block.type === "paragraph") paragraphs.push(justified(text));
    if (block.type === "list-item") paragraphs.push(justified(text));
    if (block.type === "caption") paragraphs.push(left(text, { size: 22 }));
    if (block.type === "source") paragraphs.push(left(text, { size: 22 }));
    if (block.type === "unresolved") {
      const region = block.layoutRegionId ? regions.get(block.layoutRegionId) : undefined;
      const logicalId = region?.logicalVisualId;
      const dedupKey = logicalId ?? block.layoutRegionId ?? `unresolved-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? paragraphs.length}`;
      if (emittedKeys.has(dedupKey)) continue;
      emittedKeys.add(dedupKey);
      const range = logicalId ? logicalVisualRanges.get(logicalId) : undefined;
      paragraphs.push(left(markerForBlock(block, regions, range), { size: 20, italics: true }));
    }
  }
  return paragraphs;
}

function pageNumberHeader(): Header {
  return new Header({
    children: [
      paragraph([new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })], {
        alignment: AlignmentType.RIGHT,
        spacing: ZERO_SPACING,
      }),
    ],
  });
}

export function validatePdfTextDraftExport(input: PdfTextDraftExportInput): PdfTextDraftValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const includePretextuals = input.includeReconstructedPretextuals !== false;
  if (input.sourceKind !== "pdf") blockers.push("A fonte precisa ser PDF.");
  if (input.documentMode !== "pdf-text-draft") blockers.push("O modo de exportação precisa ser pdf-text-draft.");
  if (!input.reconstruction.bodyStart.found) blockers.push("O início do corpo textual não foi identificado.");
  if (input.reconstruction.blocks.length === 0) blockers.push("Nenhum bloco reconstruído foi encontrado.");
  if (!input.reconstruction.blocks.some((block) => block.type === "paragraph")) blockers.push("Nenhum parágrafo reconstruído foi encontrado.");
  if (input.reconstruction.blocks.some((block) => block.type === "paragraph" && block.pageEnd - block.pageStart > 1)) blockers.push("Há parágrafo atravessando mais de duas páginas.");
  if (includePretextuals && !input.allowMissingPretextualFields) {
    const cover = input.pretextual?.cover;
    const titlePage = input.pretextual?.titlePage;
    if (!cover?.author || !cover.title || !cover.city || !cover.year) blockers.push("A capa tem campos essenciais ausentes. Confirme gerar com campos ausentes.");
    if (!titlePage?.author || !titlePage.title || !titlePage.natureText) blockers.push("A folha de rosto tem campos essenciais ausentes. Confirme gerar com campos ausentes.");
  }
  const stats = input.reconstruction.statistics;
  if (stats.unresolvedCount > 0) warnings.push("Há blocos visuais não resolvidos que serão representados por marcadores.");
  if (stats.uncertainHyphenationCount > 0) warnings.push("Há hifenizações incertas para revisão.");
  if (stats.lowConfidenceBlockCount > 0) warnings.push("Há blocos de baixa confiança.");
  if (stats.layoutRegionCount > 0) warnings.push("Elementos visuais serão representados por marcadores.");
  if (!input.pretextual?.abstract) warnings.push("Abstract ausente: nenhum texto será inventado.");
  if (!input.reconstruction.layoutRegions.some((region) => region.kind === "figura" || region.kind === "grafico")) warnings.push("Nenhuma figura ou gráfico foi detectado textualmente.");
  if (stats.multiPageParagraphCount > 0) warnings.push("Há parágrafos atravessando até duas páginas.");
  return { canExport: blockers.length === 0, blockers, warnings };
}

export async function buildPdfTextDraftDocxBlob(input: PdfTextDraftExportInput): Promise<Blob> {
  const validation = validatePdfTextDraftExport(input);
  if (!validation.canExport) throw new Error(validation.blockers.join(" "));
  const logo = input.includeReconstructedPretextuals === false ? undefined : await resolveLogo(input);
  const entries = makeTocEntries(input.reconstruction.blocks);
  const pretextualChildren = input.includeReconstructedPretextuals === false
    ? [...noteParagraphs(input), ...tocParagraphs(entries)]
    : [
      ...coverParagraphs(input, logo),
      ...titlePageParagraphs(input),
      ...noteParagraphs(input),
      ...abstractParagraphs(input.pretextual?.resumo, "RESUMO"),
      ...abstractParagraphs(input.pretextual?.abstract, "ABSTRACT"),
      ...tocParagraphs(entries),
    ];
  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
          margin: { top: CM_3_TWIP, left: CM_3_TWIP, bottom: CM_2_TWIP, right: CM_2_TWIP },
        },
      },
      children: pretextualChildren,
    }, {
      properties: {
        page: {
          size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
          margin: { top: CM_3_TWIP, left: CM_3_TWIP, bottom: CM_2_TWIP, right: CM_2_TWIP },
          pageNumbers: { start: 1 },
        },
      },
      headers: { default: pageNumberHeader() },
      children: bodyParagraphs(input, entries),
    }],
  });
  const blob = await Packer.toBlob(document);
  const patched = await ensurePdfTextDraftTocFields(blob);
  return new Blob([patched], { type: DOCX_MIME });
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
