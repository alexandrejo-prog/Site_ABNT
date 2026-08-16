import { AlignmentType, type IParagraphStyleOptions, type IStylesOptions } from "docx";
import { UFLA_RULES } from "./ufla-rules";

/**
 * UFLA-044 — Estilos internos obrigatórios (Manual consolidado UFLA §28.1).
 * Fonte única dos estilos nomeados `ufla_*` para todos os exportadores DOCX.
 * Cada estilo declara herança (basedOn), fonte, tamanho, espaçamento, recuo e
 * alinhamento conforme o Manual (UFLA_MANUAL_INSTRUCOES_CONSOLIDADAS.md §28.1
 * + MANUAL_NORMALIZACAO_2024.md §17/§20/§25).
 */

export const UFLA_STYLE_BLACK = "000000";

export const UFLA_STYLE_IDS = [
  "ufla_capa_autor",
  "ufla_capa_titulo",
  "ufla_capa_subtitulo",
  "ufla_capa_local_ano",
  "ufla_folha_rosto_autor",
  "ufla_folha_rosto_titulo",
  "ufla_natureza",
  "ufla_titulo_sem_indicativo",
  "ufla_titulo_primario",
  "ufla_titulo_secundario",
  "ufla_titulo_terciario",
  "ufla_corpo_texto",
  "ufla_citacao_curta",
  "ufla_citacao_longa",
  "ufla_resumo",
  "ufla_ficha_catalografica",
  "ufla_palavras_chave",
  "ufla_abstract",
  "ufla_keywords",
  "ufla_referencia",
  "ufla_legenda_ilustracao",
  "ufla_fonte_ilustracao",
  "ufla_legenda_tabela",
  "ufla_fonte_tabela",
  "ufla_sumario_item",
  "ufla_lista_item",
  "ufla_anexo_titulo",
  "ufla_apendice_titulo",
] as const;

export type UflaStyleId = (typeof UFLA_STYLE_IDS)[number];

interface UflaStyleOptions {
  name: string;
  basedOn: string;
  size?: number;
  bold?: boolean;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: NonNullable<IParagraphStyleOptions["paragraph"]>["spacing"];
  indent?: NonNullable<IParagraphStyleOptions["paragraph"]>["indent"];
  outlineLevel?: number;
}

function uflaStyle(id: UflaStyleId, options: UflaStyleOptions): IParagraphStyleOptions {
  return {
    id,
    name: options.name,
    basedOn: options.basedOn,
    next: "Normal",
    quickFormat: true,
    run: {
      font: UFLA_RULES.typography.fontFamily,
      ...(options.size !== undefined ? { size: options.size } : {}),
      ...(options.bold !== undefined ? { bold: options.bold } : {}),
      color: UFLA_STYLE_BLACK,
    },
    paragraph: {
      ...(options.alignment !== undefined ? { alignment: options.alignment } : {}),
      ...(options.spacing !== undefined ? { spacing: options.spacing } : {}),
      ...(options.indent !== undefined ? { indent: options.indent } : {}),
      ...(options.outlineLevel !== undefined ? { outlineLevel: options.outlineLevel } : {}),
    },
  };
}

const FONT = UFLA_RULES.typography.fontFamily;
const BODY = UFLA_RULES.typography.bodyFontSizePt * 2; // 24 half-points (12 pt)
const SMALL = UFLA_RULES.typography.longQuoteFontSizePt * 2; // 22 half-points (11 pt)
const SINGLE = UFLA_RULES.spacing.singleLineTwip;
const ONE_AND_HALF = UFLA_RULES.spacing.bodyLineTwip;
const NO_SPACE = UFLA_RULES.spacing.afterParagraphTwip;
export const UFLA_STYLE_DEFINITIONS: IParagraphStyleOptions[] = [
  // Capa (§4.2 do Manual)
  uflaStyle("ufla_capa_autor", {
    name: "Capa — autor (UFLA)",
    basedOn: "Normal",
    size: UFLA_RULES.typography.coverAuthorFontSizePt * 2,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { line: SINGLE },
  }),
  uflaStyle("ufla_capa_titulo", {
    name: "Capa — título (UFLA)",
    basedOn: "Normal",
    size: UFLA_RULES.typography.coverTitleFontSizePt * 2,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { line: ONE_AND_HALF },
  }),
  uflaStyle("ufla_capa_subtitulo", {
    name: "Capa — subtítulo (UFLA)",
    basedOn: "Normal",
    size: UFLA_RULES.typography.coverTitleFontSizePt * 2,
    bold: false,
    alignment: AlignmentType.CENTER,
    spacing: { line: ONE_AND_HALF },
  }),
  uflaStyle("ufla_capa_local_ano", {
    name: "Capa — local e ano (UFLA)",
    basedOn: "Normal",
    size: UFLA_RULES.typography.coverAuthorFontSizePt * 2,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { line: SINGLE },
  }),
  // Folha de rosto (§5 do Manual)
  uflaStyle("ufla_folha_rosto_autor", {
    name: "Folha de rosto — autor (UFLA)",
    basedOn: "Normal",
    size: UFLA_RULES.typography.coverAuthorFontSizePt * 2,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { line: SINGLE },
  }),
  uflaStyle("ufla_folha_rosto_titulo", {
    name: "Folha de rosto — título (UFLA)",
    basedOn: "Normal",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { line: ONE_AND_HALF },
  }),
  uflaStyle("ufla_natureza", {
    name: "Folha de rosto — natureza do trabalho (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE, after: 180 },
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
  }),
  // Títulos (§18 do Manual)
  uflaStyle("ufla_titulo_sem_indicativo", {
    name: "Título sem indicativo numérico (UFLA)",
    basedOn: "Heading1",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 0,
  }),
  uflaStyle("ufla_titulo_primario", {
    name: "Título de seção primária (UFLA)",
    basedOn: "Heading1",
    size: BODY,
    bold: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 0,
  }),
  uflaStyle("ufla_titulo_secundario", {
    name: "Título de seção secundária (UFLA)",
    basedOn: "Heading2",
    size: BODY,
    bold: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 1,
  }),
  uflaStyle("ufla_titulo_terciario", {
    name: "Título de seção terciária (UFLA)",
    basedOn: "Heading3",
    size: BODY,
    bold: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 2,
  }),
  // Corpo textual (§17 do Manual)
  uflaStyle("ufla_corpo_texto", {
    name: "Corpo de texto (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF, after: NO_SPACE },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
  }),
  // Ficha catalográfica (§6.1 do Manual) — espaço simples, sem recuo de parágrafo
  uflaStyle("ufla_ficha_catalografica", {
    name: "Ficha catalográfica (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE, after: NO_SPACE },
    indent: { firstLine: 0 },
  }),
  // Citações (§20 do Manual)
  uflaStyle("ufla_citacao_curta", {
    name: "Citação direta curta (UFLA)",
    basedOn: "ufla_corpo_texto",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF, after: NO_SPACE },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
  }),
  uflaStyle("ufla_citacao_longa", {
    name: "Citação direta longa (UFLA)",
    basedOn: "Normal",
    size: SMALL,
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE, after: 120 },
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
  }),
  // Resumo / palavras-chave / abstract / keywords (§12/§13 do Manual)
  uflaStyle("ufla_resumo", {
    name: "Resumo (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE, after: NO_SPACE },
  }),
  uflaStyle("ufla_palavras_chave", {
    name: "Palavras-chave (UFLA)",
    basedOn: "ufla_resumo",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF, after: NO_SPACE },
  }),
  uflaStyle("ufla_abstract", {
    name: "Abstract (UFLA)",
    basedOn: "ufla_resumo",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE, after: NO_SPACE },
  }),
  uflaStyle("ufla_keywords", {
    name: "Keywords (UFLA)",
    basedOn: "ufla_palavras_chave",
    size: BODY,
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF, after: NO_SPACE },
  }),
  // Referências (§25 do Manual / NBR 6023)
  uflaStyle("ufla_referencia", {
    name: "Referência bibliográfica (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE, after: SINGLE },
    indent: { left: 284, hanging: 284 },
  }),
  // Legendas e fontes de ilustrações/tabelas (§23/§24 do Manual)
  uflaStyle("ufla_legenda_ilustracao", {
    name: "Legenda de ilustração (UFLA)",
    basedOn: "Normal",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: SINGLE },
    indent: { left: 454, right: 454 },
  }),
  uflaStyle("ufla_fonte_ilustracao", {
    name: "Fonte de ilustração (UFLA)",
    basedOn: "Normal",
    size: SMALL,
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 120, line: SINGLE },
    indent: { left: 454, right: 454 },
  }),
  uflaStyle("ufla_legenda_tabela", {
    name: "Legenda de tabela (UFLA)",
    basedOn: "Normal",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: SINGLE },
    indent: { left: 454, right: 454 },
  }),
  uflaStyle("ufla_fonte_tabela", {
    name: "Fonte de tabela (UFLA)",
    basedOn: "Normal",
    size: SMALL,
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 120, line: SINGLE },
    indent: { left: 454, right: 454 },
  }),
  // Sumário e listas (§15/§16 do Manual)
  uflaStyle("ufla_sumario_item", {
    name: "Item de sumário (UFLA)",
    basedOn: "TOC1",
    size: BODY,
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE },
  }),
  uflaStyle("ufla_lista_item", {
    name: "Item de lista de ilustrações/tabelas (UFLA)",
    basedOn: "Normal",
    size: BODY,
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE, after: 120 },
    indent: { left: 709, hanging: 709 },
  }),
  // Anexos e apêndices (§26 do Manual)
  uflaStyle("ufla_anexo_titulo", {
    name: "Título de Anexo (UFLA)",
    basedOn: "ufla_titulo_sem_indicativo",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 0,
  }),
  uflaStyle("ufla_apendice_titulo", {
    name: "Título de Apêndice (UFLA)",
    basedOn: "ufla_titulo_sem_indicativo",
    size: BODY,
    bold: true,
    alignment: AlignmentType.CENTER,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF },
    outlineLevel: 0,
  }),
];

/**
 * Estilos de documento compartilhados por todos os exportadores (UFLA-044 §28.1).
 * Inclui TOC1-3 e Heading1-3 (usados pelo TOC do Word) e os 27 estilos ufla_*.
 */
export const DOCUMENT_STYLES: IStylesOptions = {
  paragraphStyles: [
    {
      id: "TOC1",
      name: "toc 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: true, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    {
      id: "TOC2",
      name: "toc 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: true, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    {
      id: "TOC3",
      name: "toc 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: false, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: true, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: true, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT, size: BODY, bold: true, color: UFLA_STYLE_BLACK },
      paragraph: { spacing: { before: NO_SPACE, after: NO_SPACE } },
    },
    ...UFLA_STYLE_DEFINITIONS,
  ],
};
