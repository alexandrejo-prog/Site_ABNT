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
import { normalizePdfTocHeading } from "./pdf-toc-eligibility";
import {
  decideLogicalVisualEmission,
  LogicalVisualEmission,
  PdfVisualAssetRegionEntry,
  pdfRegionCropKey,
  visualAssetEntriesForLogicalVisual,
} from "./pdf-visual-asset-integration";
import type { PdfTextDraftExportInput, PdfTextDraftLogoAsset, PdfTextDraftValidation } from "./pdf-text-draft-contract";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const CM_3_TWIP = 1701;
const CM_2_TWIP = 1134;
const MANCHA_WIDTH_TWIP = A4_WIDTH_TWIP - CM_3_TWIP - CM_2_TWIP;
const MANCHA_HEIGHT_TWIP = A4_HEIGHT_TWIP - CM_3_TWIP - CM_2_TWIP;
const TWIP_PER_PIXEL = 15;
const MAX_IMAGE_WIDTH_PX = Math.floor(MANCHA_WIDTH_TWIP / TWIP_PER_PIXEL);
const MAX_IMAGE_HEIGHT_PX = Math.floor(MANCHA_HEIGHT_TWIP / TWIP_PER_PIXEL);

function fitImageToMancha(width: number, height: number): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w <= MAX_IMAGE_WIDTH_PX && h <= MAX_IMAGE_HEIGHT_PX) return { width: w, height: h };
  const scale = Math.min(MAX_IMAGE_WIDTH_PX / w, MAX_IMAGE_HEIGHT_PX / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

const BODY_FIRST_LINE_TWIP = 850;
const LIST_HANGING_TWIP = 425;
const ONE_AND_HALF_LINE_TWIP = 360;
const SINGLE_LINE_TWIP = 240;
const ZERO_SPACING = { before: 0, after: 0 };
const FONT = "Times New Roman";
const UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";
const TITLE_PAGE_NATURE_LEFT_TWIP = 4535;

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

function left(text: string, options: { bold?: boolean; size?: number; italics?: boolean; before?: number; after?: number; keepNext?: boolean; keepLines?: boolean; widowControl?: boolean } = {}): Paragraph {
  return paragraph([run(cleanText(text) || " ", options.size ?? 24, { bold: options.bold, italics: options.italics })], {
    alignment: AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: SINGLE_LINE_TWIP },
    indent: { firstLine: 0 },
    keepNext: options.keepNext,
    keepLines: options.keepLines,
    widowControl: options.widowControl,
  });
}

function justified(text: string, firstLine = BODY_FIRST_LINE_TWIP): Paragraph {
  return paragraph([run(cleanText(text), 24)], {
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
  });
}

function listItem(text: string): Paragraph {
  return paragraph([run(cleanText(text), 24)], {
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: BODY_FIRST_LINE_TWIP, hanging: LIST_HANGING_TWIP },
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
  children.push(run(normalizePdfTocHeading(cleanText(text)), 24, { bold: true }));
  if (entry) children.push(run(`__PDF_BM_END_${entry.bookmark}__`, 1));
  return paragraph(children, {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { ...ZERO_SPACING, line: ONE_AND_HALF_LINE_TWIP },
    keepNext: true,
    keepLines: true,
    widowControl: true,
  });
}

function normalizeHeadingKey(text: string): string {
  return cleanText(text)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function referenceParagraph(text: string): Paragraph {
  return paragraph([run(cleanText(text), 24)], {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { before: 0, after: SINGLE_LINE_TWIP, line: SINGLE_LINE_TWIP },
  });
}

function isGraphicLikeKind(kind?: PdfLayoutSensitiveRegionDiagnostic["kind"]): boolean {
  return kind === "grafico" || kind === "figura" || kind === "imagem" || kind === "mapa" || kind === "ilustracao";
}

function visualKindLabel(kind?: PdfLayoutSensitiveRegionDiagnostic["kind"]): string {
  if (kind === "quadro") return "Quadro";
  if (kind === "tabela") return "Tabela";
  if (kind === "figura") return "Figura";
  if (kind === "grafico") return "Gráfico";
  if (kind === "imagem") return "Imagem";
  if (kind === "mapa") return "Mapa";
  if (kind === "ilustracao") return "Ilustração";
  if (kind === "multicolumn") return "Conteúdo em colunas";
  return "Elemento visual não identificado";
}

function originalPagesLabel(pageStart: number, pageEnd: number): string {
  return pageStart === pageEnd ? `página original ${pageStart}` : `páginas originais ${pageStart}-${pageEnd}`;
}

const MARKER = "Elemento visual não inserido neste rascunho textual";

// Qualificadores de continuação/conclusão que podem acompanhar a legenda de
// uma parte de um elemento visual multipágina (ex.: "Quadro 16 – ... (continua)").
// A pontuação de fim de frase (ex.: o ponto final) NÃO é consumida — só o
// qualificador entre parênteses (ou similar) é removido, preservando a
// pontuação formal da legenda.
const CONTINUATION_QUALIFIER_RE =
  /\s*[([\]]?\s*(continua|continua[çc][ãa]o|conclus[ãa]o)\s*[)\]]?/iu;

function isContinuationCaptionText(text: string): boolean {
  return /\b(continua|continua[çc][ãa]o|conclus[ãa]o)\b/iu.test(text);
}

// Remove o qualificador de continuação/conclusão preservando o título-base
// formal do elemento (normalização estrutural segura, não inventa título).
function stripContinuationQualifier(text: string): string {
  return text.replace(CONTINUATION_QUALIFIER_RE, "").replace(/\s+/g, " ").trim();
}

// Seleção da legenda primária de um grupo lógico (logicalVisualId), usada para
// emitir UMA legenda formal externa antes da primeira imagem.
//
// Regras:
// - prefere a primeira legenda formal (sem qualificador de continuação);
// - uma legenda de continuação/conclusão NUNCA substitui uma formal anterior;
// - se só houver legendas com qualificador (o PDF original rotula todas as
//   partes como continuação/conclusão), usa o texto-base da primeira parte sem
//   o sufixo, desde que isso resulte de normalização estrutural segura.
function primaryCaptionForLogical(
  lid: string,
  regionsByLogical: Map<string, PdfLayoutSensitiveRegionDiagnostic[]>,
): string | undefined {
  const regions = regionsByLogical.get(lid);
  if (!regions || regions.length === 0) return undefined;
  const captions = [...regions]
    .sort((a, b) => a.pageStart - b.pageStart || a.startLineIndex - b.startLineIndex)
    .map((region) => region.caption)
    .filter((caption): caption is string => typeof caption === "string" && caption.trim().length > 0);
  if (captions.length === 0) return undefined;
  const formal = captions.find((caption) => !isContinuationCaptionText(caption));
  if (formal) return formal.trim();
  return stripContinuationQualifier(captions[0]);
}

function markerForBlock(block: PdfReconstructedBlockDiagnostic, regions: Map<string, PdfLayoutSensitiveRegionDiagnostic>, logicalRange?: { pageStart: number; pageEnd: number }): string {
  if (!block.layoutRegionId) return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  const region = regions.get(block.layoutRegionId);
  if (!region) return `[Conteúdo com estrutura visual não resolvida, página original ${block.pageStart}. Consulte o PDF.]`;
  const pageStart = logicalRange?.pageStart ?? region.pageStart;
  const pageEnd = logicalRange?.pageEnd ?? region.pageEnd;
  return `[${MARKER} - ${visualKindLabel(region.kind)}, ${originalPagesLabel(pageStart, pageEnd)}. Consulte o PDF original.]`;
}

interface LogicalVisualDecisions {
  emissionByLogical: Map<string, LogicalVisualEmission>;
  entriesByLogical: Map<string, PdfVisualAssetRegionEntry[]>;
  regionsByLogical: Map<string, PdfLayoutSensitiveRegionDiagnostic[]>;
}

// Calcula a decisão de emissão UMA vez por logicalVisualId. O exportador nunca
// decide região a região: todas as regiões que compartilham o mesmo identificador
// lógico são resolvidas em conjunto (todas as imagens ou um único marcador).
export function buildLogicalVisualDecisions(input: PdfTextDraftExportInput): LogicalVisualDecisions {
  const visualAssets = input.visualAssets ?? {};
  const allKeys = new Set(Object.keys(visualAssets));
  const regionsByLogical = new Map<string, PdfLayoutSensitiveRegionDiagnostic[]>();
  for (const region of input.reconstruction.layoutRegions) {
    const lid = region.logicalVisualId ?? region.id;
    const list = regionsByLogical.get(lid);
    if (list) list.push(region);
    else regionsByLogical.set(lid, [region]);
  }
  const emissionByLogical = new Map<string, LogicalVisualEmission>();
  const entriesByLogical = new Map<string, PdfVisualAssetRegionEntry[]>();
  for (const [lid, regs] of regionsByLogical) {
    const cropKeys = new Set(allKeys);
    for (const region of regs) {
      const vk = region.logicalVisualId ?? region.id;
      // Ativo legado (chave única visualKey) cobre regiões de página única.
      if (cropKeys.has(vk) && region.pageStart === region.pageEnd) {
        cropKeys.add(pdfRegionCropKey(vk, region.pageStart, region.id));
      }
    }
    let emission = decideLogicalVisualEmission(regs, cropKeys);
    const entries = visualAssetEntriesForLogicalVisual(regs, visualAssets);
    emissionByLogical.set(lid, emission);
    entriesByLogical.set(lid, entries);
  }
  return { emissionByLogical, entriesByLogical, regionsByLogical };
}

export interface EmissionPlan {
  markerLids: Set<string>;
  imageLids: Set<string>;
  ignoredLids: Set<string>;
  warnings: string[];
  markerText: string;
}

// Plano de emissão calculado UMA vez e compartilhado entre o sumário (nota de
// revisão) e o corpo do documento. Garante que a contagem de marcadores na nota
// seja exatamente a quantidade de marcadores efetivamente emitidos no corpo.
//
// O plano é centrado no identificador lógico (logicalVisualId) e NUNCA deixa um
// grupo elegível sem estado: ou todas as imagens esperadas são emitidas, ou um
// único marcador de fallback é emitido (ver garantia contra ausência silenciosa
// ao final da função).
export function planVisualEmissions(input: PdfTextDraftExportInput, decisions: LogicalVisualDecisions): EmissionPlan {
  const regions = new Map(input.reconstruction.layoutRegions.map((region) => [region.id, region]));
  const blocks = input.reconstruction.blocks;
  const regionSpans = buildRegionVisualSpans(input.reconstruction.layoutRegions);
  const imageLids = new Set<string>();
  const markerLids = new Set<string>();
  const warnings: string[] = [];
  const markerEmitted = new Set<string>();

  // Entradas da Lista de Quadros/Gráficos são deliberadamente ignoradas: são
  // blocos list-item dentro de spans visuais cujo único vínculo é a própria
  // lista (não geram imagem nem marcador).
  const ignoredLids = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "list-item") continue;
    if (!blockInsideRegionSpan(block, regionSpans)) continue;
    const lid = visualLidForBlock(block, regions, regionSpans);
    if (lid) ignoredLids.add(lid);
  }

  const lidFor = (block: PdfReconstructedBlockDiagnostic): string | undefined =>
    visualLidForBlock(block, regions, regionSpans);
  const hasUnresolvedForLid = (lid: string): boolean =>
    blocks.some((b) => b.type === "unresolved" && lidFor(b) === lid);

  for (const block of blocks) {
    if (block.type === "caption") {
      const lid = lidFor(block);
      if (!lid || markerEmitted.has(lid)) continue;
      const emission = decisions.emissionByLogical.get(lid);
      const groupRegions = decisions.regionsByLogical.get(lid) ?? [];
      const kind = groupRegions[0]?.kind;
      if (emission?.mode === "images") {
        imageLids.add(lid);
        markerEmitted.add(lid);
      } else if (!hasUnresolvedForLid(lid) && (isGraphicLikeKind(kind) || (decisions.entriesByLogical.get(lid)?.length ?? 0) > 0)) {
        markerLids.add(lid);
        markerEmitted.add(lid);
      }
    } else if (block.type === "unresolved") {
      const lid = lidFor(block)
        ?? `unresolved-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? 0}`;
      if (markerEmitted.has(lid)) continue;
      const emission = decisions.emissionByLogical.get(lid);
      if (emission?.mode === "images") {
        imageLids.add(lid);
        markerEmitted.add(lid);
      } else {
        markerLids.add(lid);
        markerEmitted.add(lid);
      }
    }
  }

  // Garantia contra ausência silenciosa: todo logicalVisualId elegível (com
  // região detectada E pelo menos um bloco de texto referenciando-o) deve
  // terminar como imagem ou marcador. Caso contrário, converte em marcador de
  // fallback e emite warning explícito (nunca silencioso).
  for (const [lid, emission] of decisions.emissionByLogical) {
    if (imageLids.has(lid) || markerLids.has(lid)) continue;
    if (ignoredLids.has(lid)) continue;
    const hasReferencingBlock = blocks.some((b) => lidFor(b) === lid);
    if (!hasReferencingBlock) continue;
    const groupRegions = decisions.regionsByLogical.get(lid) ?? [];
    const kind = groupRegions[0]?.kind;
    warnings.push(
      `[elemento-visual] id=${lid} tipo=${kind ?? "desconhecido"} ` +
      `estagio=emission-plan marcador=sim ` +
      `mensagem="Elemento visual sem estado de emissão definido; convertido em marcador de fallback para ${originalPagesLabel(emission.pageStart, emission.pageEnd)}."`,
    );
    markerLids.add(lid);
  }

  return { markerLids, imageLids, ignoredLids, warnings, markerText: MARKER };
}

function technicalSummary(input: PdfTextDraftExportInput, plan: EmissionPlan): string[] {
  const stats = input.reconstruction.statistics;
  return [
    `Arquivo de origem: ${input.fileName}`,
    `Páginas do PDF: ${input.pageCount}`,
    `Parágrafos reconstruídos: ${stats.paragraphCount}`,
    `Títulos reconstruídos: ${stats.headingCount}`,
    `Regiões visuais detectadas: ${stats.layoutRegionCount}`,
    `Elementos visuais representados por marcadores: ${plan.markerLids.size}`,
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

function titlePageNatureParagraph(
  text: string,
  options: { before?: number; alignment?: IParagraphOptions["alignment"] } = {},
): Paragraph {
  const { before = 0, alignment = AlignmentType.JUSTIFIED } = options;
  return paragraph([run(cleanText(text) || " ", 24)], {
    alignment,
    spacing: { before, after: 0, line: SINGLE_LINE_TWIP },
    indent: { left: TITLE_PAGE_NATURE_LEFT_TWIP },
  });
}

function titlePageParagraphs(input: PdfTextDraftExportInput): Paragraph[] {
  const titlePage = input.pretextual?.titlePage;
  const cover = input.pretextual?.cover;
  const author = titlePage?.author ?? cover?.author ?? "[AUTOR AUSENTE]";
  const title = titlePage?.title ?? cover?.title ?? "[TÍTULO AUSENTE]";
  const city = titlePage?.city ?? cover?.city ?? "[LOCAL AUSENTE]";
  const year = titlePage?.year ?? cover?.year ?? "[ANO AUSENTE]";
  return [
    centered(author),
    centered(title, { bold: true, before: 1200 }),
    ...(titlePage?.subtitle ? [centered(titlePage.subtitle, { bold: true })] : []),
    ...(titlePage?.natureText
      ? [titlePageNatureParagraph(titlePage.natureText, { before: 900, alignment: AlignmentType.JUSTIFIED })]
      : []),
    ...(titlePage?.program
      ? [titlePageNatureParagraph(titlePage.program, { before: 0, alignment: AlignmentType.JUSTIFIED })]
      : []),
    ...(titlePage?.institution
      ? [titlePageNatureParagraph(titlePage.institution, { before: 0, alignment: AlignmentType.JUSTIFIED })]
      : []),
    ...(titlePage?.advisor
      ? [titlePageNatureParagraph(titlePage.advisor, { before: 240, alignment: AlignmentType.LEFT })]
      : []),
    ...(titlePage?.coadvisor
      ? [titlePageNatureParagraph(titlePage.coadvisor, { before: 0, alignment: AlignmentType.LEFT })]
      : []),
    centered(city, { before: 3600 }),
    centered(year),
    pageBreak(),
  ];
}

function noteParagraphs(input: PdfTextDraftExportInput, plan: EmissionPlan): Paragraph[] {
  return [
    centered("NOTA DE REVISÃO", { bold: true }),
    singleJustified("Este documento foi reconstruído automaticamente a partir de um PDF. Revise os pré-textuais, as citações, as hifenizações, os títulos e os elementos visuais antes do uso acadêmico."),
    ...technicalSummary(input, plan).map((line) => left(line, { size: 20 })),
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
    .filter((block) => /^(?:\d+(?:\.\d+)*\s*\S|REFER[ÊE]NCIAS|AP[ÊE]NDICE|ANEXO)/i.test(cleanText(block.text)))
    .map((block, index) => ({
      title: normalizePdfTocHeading(cleanText(block.text)),
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

// Intervalo estrutural de cada região visual, derivado diretamente de
// pageStart/pageEnd e startLineIndex/endLineIndex. Usado para suprimir o texto
// interno de tabelas/gráficos rejeitados, independentemente do comprimento do
// parágrafo ou de páginas com texto comum.
type RegionSpan = { startKey: number; endKey: number; logicalVisualId: string };

const CAPTION_REGION_SEARCH = 8;

function lineOrderKey(pageNumber: number, lineIndex: number): number {
  return pageNumber * 100000 + lineIndex;
}

function buildRegionVisualSpans(regions: PdfLayoutSensitiveRegionDiagnostic[]): RegionSpan[] {
  return regions.map((region) => ({
    startKey: lineOrderKey(region.pageStart, region.startLineIndex),
    endKey: lineOrderKey(region.pageEnd, region.endLineIndex),
    logicalVisualId: region.logicalVisualId ?? region.id,
  }));
}

function spanForBlock(block: PdfReconstructedBlockDiagnostic, spans: RegionSpan[]): RegionSpan | undefined {
  const lines = block.sourceLines;
  if (lines.length === 0) return undefined;
  for (const span of spans) {
    const within = lines.every((line) => {
      const key = lineOrderKey(line.pageNumber, line.lineIndex);
      return key >= span.startKey && key <= span.endKey;
    });
    if (within) return span;
  }
  return undefined;
}

function blockInsideRegionSpan(block: PdfReconstructedBlockDiagnostic, spans: RegionSpan[]): boolean {
  return spanForBlock(block, spans) !== undefined;
}

// Resolve o identificador lógico de um bloco visual (legenda/fonte/célula) a partir
// das próprias regiões, de forma robusta tanto para dados reais (onde a legenda e a
// fonte costumam trazer layoutRegionId) quanto para legendas posicionadas logo acima
// ou fontes logo abaixo da região sem vínculo explícito.
function visualLidForBlock(
  block: PdfReconstructedBlockDiagnostic,
  regions: Map<string, PdfLayoutSensitiveRegionDiagnostic>,
  spans: RegionSpan[],
): string | undefined {
  if (block.layoutRegionId) {
    const region = regions.get(block.layoutRegionId);
    return region?.logicalVisualId ?? block.layoutRegionId;
  }
  const span = spanForBlock(block, spans);
  if (span) return span.logicalVisualId;
  if (block.pageStart !== block.pageEnd) return undefined;
  const lineIndex = block.sourceLines[0]?.lineIndex ?? 0;
  let best: { lid: string; dist: number } | undefined;
  for (const region of regions.values()) {
    if (region.pageStart !== block.pageStart) continue;
    let dist: number;
    if (block.type === "caption") {
      if (region.startLineIndex < lineIndex) continue;
      dist = region.startLineIndex - lineIndex;
    } else if (block.type === "source") {
      if (region.endLineIndex > lineIndex) continue;
      dist = lineIndex - region.endLineIndex;
    } else {
      continue;
    }
    if (dist > CAPTION_REGION_SEARCH) continue;
    if (!best || dist < best.dist) best = { lid: region.logicalVisualId ?? region.id, dist };
  }
  return best?.lid;
}

function bodyParagraphs(
  input: PdfTextDraftExportInput,
  entries: TocEntry[],
  decisions: LogicalVisualDecisions,
  plan: EmissionPlan,
): Paragraph[] {
  const regions = new Map(input.reconstruction.layoutRegions.map((region) => [region.id, region]));
  const entryByTitle = new Map(entries.map((entry) => [entry.title, entry]));
  const paragraphs: Paragraph[] = [];
  const blocks = input.reconstruction.blocks;
  const regionSpans = buildRegionVisualSpans(input.reconstruction.layoutRegions);

  // Contagem de blocos de fonte por logicalVisualId para emitir a fonte uma
  // única vez (após a última imagem ou o marcador do grupo).
  const sourceCountByLid = new Map<string, number>();
  for (const block of blocks) {
    if (block.type !== "source") continue;
    const region = block.layoutRegionId ? regions.get(block.layoutRegionId) : undefined;
    const lid = region?.logicalVisualId ?? block.layoutRegionId
      ?? `source-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? 0}`;
    sourceCountByLid.set(lid, (sourceCountByLid.get(lid) ?? 0) + 1);
  }

  const emittedVisualAssetKeys = new Set<string>();
  const emittedMarkerKeys = new Set<string>();
  const emittedCaptionLids = new Set<string>();
  const emittedSourceLids = new Set<string>();
  const seenSourceByLid = new Map<string, number>();

  function emitVisualImagesForLogical(lid: string): number {
    const entries = decisions.entriesByLogical.get(lid) ?? [];
    if (entries.length === 0) return 0;
    let emitted = 0;
    for (const entry of entries) {
      if (emittedVisualAssetKeys.has(entry.key)) continue;
      const asset = entry.asset;
      const altText = {
        title: asset.altText?.title ?? "Elemento visual",
        description: asset.altText?.description ?? "Elemento visual",
        name: asset.altText?.name ?? "Elemento visual",
      };
      const fit = fitImageToMancha(asset.width, asset.height);
      paragraphs.push(paragraph([new ImageRun({
        data: asset.data,
        transformation: { width: fit.width, height: fit.height },
        altText,
      })], { alignment: AlignmentType.CENTER, spacing: ZERO_SPACING, keepNext: true, keepLines: true, widowControl: true }));
      emittedVisualAssetKeys.add(entry.key);
      emitted += 1;
    }
    return emitted;
  }

  let inReferences = false;

  for (const block of input.reconstruction.blocks) {
    const text = cleanText(block.text);
    if (!text && block.type !== "unresolved") continue;
    if (block.type === "heading") {
      const headingKey = normalizeHeadingKey(text);
      if (headingKey === "REFERENCIAS") inReferences = true;
      else if (headingKey.startsWith("APENDICE") || headingKey.startsWith("ANEXO")) inReferences = false;
      paragraphs.push(bodyHeading(text, entryByTitle.get(text)));
    }
    if (block.type === "paragraph") {
      if (blockInsideRegionSpan(block, regionSpans)) continue;
      paragraphs.push(inReferences ? referenceParagraph(text) : justified(text));
    }
    if (block.type === "list-item") {
      if (blockInsideRegionSpan(block, regionSpans)) continue;
      paragraphs.push(inReferences ? referenceParagraph(text) : listItem(text));
    }
    if (block.type === "caption") {
      const region = block.layoutRegionId ? regions.get(block.layoutRegionId) : undefined;
      const lid = visualLidForBlock(block, regions, regionSpans);
      if (!lid) {
        paragraphs.push(left(text, { size: 22, keepNext: true, keepLines: true, widowControl: true }));
        continue;
      }
      // Emite UMA legenda formal externa por logicalVisualId, antes da primeira
      // imagem. Para grupos multipágina, seleciona a legenda primária (formal se
      // houver; caso contrário, a primeira sem o qualificador de continuação).
      // Suprime as legendas seguintes (continuação/conclusão) para não duplicar.
      if (!emittedCaptionLids.has(lid)) {
        const primaryCaption = primaryCaptionForLogical(lid, decisions.regionsByLogical) ?? text;
        paragraphs.push(
          left(primaryCaption, {
            size: 22,
            keepNext: true,
            keepLines: true,
            widowControl: true,
          }),
        );
        emittedCaptionLids.add(lid);
      }
      if (region && !emittedMarkerKeys.has(lid)) {
        if (plan.imageLids.has(lid)) {
          emitVisualImagesForLogical(lid);
          emittedMarkerKeys.add(lid);
        } else if (plan.markerLids.has(lid)) {
          const range = decisions.emissionByLogical.get(lid) ?? undefined;
          paragraphs.push(left(markerForBlock(block, regions, range), { size: 20, italics: true }));
          emittedMarkerKeys.add(lid);
        }
      }
    }
    if (block.type === "source") {
      const lid = visualLidForBlock(block, regions, regionSpans)
        ?? `source-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? 0}`;
      // Emite a fonte uma única vez por logicalVisualId, após a última imagem
      // ou o marcador do grupo.
      const seen = (seenSourceByLid.get(lid) ?? 0) + 1;
      seenSourceByLid.set(lid, seen);
      const isLastSource = seen === (sourceCountByLid.get(lid) ?? 1);
      if (isLastSource && !emittedSourceLids.has(lid)) {
        paragraphs.push(left(text, { size: 22 }));
        emittedSourceLids.add(lid);
      }
    }
    if (block.type === "unresolved") {
      const region = block.layoutRegionId ? regions.get(block.layoutRegionId) : undefined;
      const lid = visualLidForBlock(block, regions, regionSpans)
        ?? `unresolved-${block.pageStart}-${block.sourceLines[0]?.lineIndex ?? paragraphs.length}`;
      if (region && plan.imageLids.has(lid)) {
        emitVisualImagesForLogical(lid);
        emittedMarkerKeys.add(lid);
      } else if (!emittedMarkerKeys.has(lid) && plan.markerLids.has(lid)) {
        const range = decisions.emissionByLogical.get(lid) ?? undefined;
        emittedMarkerKeys.add(lid);
        paragraphs.push(left(markerForBlock(block, regions, range), { size: 20, italics: true }));
      }
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
  if (stats.layoutRegionCount > 0) {
    if (input.visualAssets && Object.keys(input.visualAssets).length > 0) {
      warnings.push("Alguns elementos visuais podem permanecer como marcadores quando o recorte automático não estiver disponível.");
    } else {
      warnings.push("Elementos visuais serão representados por marcadores.");
    }
  }
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
  const decisions = buildLogicalVisualDecisions(input);
  const plan = planVisualEmissions(input, decisions);
  for (const warning of plan.warnings) console.warn(warning);
  const pretextualChildren = input.includeReconstructedPretextuals === false
    ? [...noteParagraphs(input, plan), ...tocParagraphs(entries)]
    : [
      ...coverParagraphs(input, logo),
      ...titlePageParagraphs(input),
      ...noteParagraphs(input, plan),
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
      children: bodyParagraphs(input, entries, decisions, plan),
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
