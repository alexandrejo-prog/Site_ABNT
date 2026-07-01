export const WORK_TYPES = [
  "artigo",
  "monografia",
  "dissertacao",
  "tese",
  "outro",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];
export type WorkTypeValue = WorkType | "";

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  artigo: "Artigo",
  monografia: "Monografia",
  dissertacao: "Dissertação",
  tese: "Tese",
  outro: "Outro",
};

export type Confidence = "alta" | "media" | "baixa" | "nao-identificado";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  alta: "alta",
  media: "média",
  baixa: "baixa",
  "nao-identificado": "não identificado",
};

export const ACADEMIC_FIELD_KEYS = [
  "author",
  "title",
  "subtitle",
  "workNature",
  "course",
  "program",
  "advisor",
  "coadvisor",
  "location",
  "year",
  "resumo",
  "palavrasChave",
  "abstractText",
  "keywords",
  "introducao",
  "conclusao",
  "referencias",
  "anexos",
  "apendices",
  "dedicatoria",
  "agradecimentos",
  "epigrafe",
  "indicadoresImpacto",
  "impactIndicators",
  "imageWarnings",
] as const;

export type AcademicFieldKey = (typeof ACADEMIC_FIELD_KEYS)[number];

export interface AcademicFields {
  workType: WorkTypeValue;
  author: string;
  title: string;
  subtitle: string;
  workNature: string;
  course: string;
  program: string;
  advisor: string;
  coadvisor: string;
  location: string;
  year: string;
  resumo: string;
  palavrasChave: string;
  abstractText: string;
  keywords: string;
  introducao: string;
  conclusao: string;
  referencias: string;
  anexos: string;
  apendices: string;
  dedicatoria: string;
  agradecimentos: string;
  epigrafe: string;
  indicadoresImpacto: string;
  impactIndicators: string;
  imageWarnings: string;
}

const TWIPS_PER_CM = 1440 / 2.54;

export function cmToTwip(valueInCm: number): number {
  return Math.round(valueInCm * TWIPS_PER_CM);
}

// Regras extraídas do Manual de normalização da UFLA e mantidas aqui como
// fonte única para evitar números mágicos no gerador DOCX e nos testes.
export const UFLA_RULES = {
  source:
    "Manual de normalização e estrutura de trabalhos acadêmicos da UFLA, 6. ed.",
  page: {
    format: "A4",
    widthTwip: 11906,
    heightTwip: 16838,
  },
  margins: {
    topCm: 3,
    leftCm: 3,
    bottomCm: 2,
    rightCm: 2,
    topTwip: cmToTwip(3),
    leftTwip: cmToTwip(3),
    bottomTwip: cmToTwip(2),
    rightTwip: cmToTwip(2),
  },
  header: {
    distanceFromTopCm: 2,
    distanceFromTopTwip: cmToTwip(2),
    pageNumberAlignment: "right",
  },
  footer: {
    distanceFromBottomCm: 2,
    distanceFromBottomTwip: cmToTwip(2),
  },
  typography: {
    fontFamily: "Times New Roman",
    bodyFontSizePt: 12,
    coverAuthorFontSizePt: 14,
    coverTitleFontSizePt: 16,
    longQuoteFontSizePt: 11,
    noteFontSizePt: 11,
    captionFontSizePt: 12,
    captionDescriptionFontSizePt: 11,
    sourceFontSizePt: 11,
    pageNumberFontSizePt: 11,
    lineSpacing: 1.5,
    simpleLineSpacing: 1,
    // O template/Manual UFLA usa recuo de primeira linha de 1,25 cm no corpo textual.
    paragraphFirstLineCm: 1.25,
    paragraphFirstLineTwip: cmToTwip(1.25),
    paragraphFirstLineTemplateCm: 1.25,
    paragraphFirstLineTemplateTwip: cmToTwip(1.25),
    longQuoteLeftIndentCm: 4,
    longQuoteLeftIndentTwip: cmToTwip(4),
  },
  spacing: {
    bodyLineTwip: 360,
    singleLineTwip: 240,
    afterParagraphTwip: 0,
    beforePrimaryTitleTwip: 240,
    afterPrimaryTitleTwip: 240,
  },
  structure: {
    preTextualOrder: [
      "capa",
      "folha de rosto",
      "ficha catalográfica",
      "folha de aprovação",
      "dedicatória",
      "agradecimentos",
      "epígrafe",
      "resumo",
      "abstract",
      "indicadores de impacto",
      "impact indicators",
      "lista de ilustrações",
      "lista de tabelas",
      "sumário",
    ],
    textualOrder: ["introdução", "desenvolvimento", "conclusão"],
    postTextualOrder: ["referências", "glossário", "apêndices", "anexos", "índice"],
  },
  titles: {
    primaryUppercase: true,
    primaryBold: true,
    unnumberedUppercase: true,
    unnumberedCentered: true,
    maxProgressiveLevel: 5,
  },
  pagination: {
    preTextualCountedFromTitlePage: true,
    coverCounted: false,
    catalogCardCounted: false,
    visibleFromFirstTextualPage: true,
    firstTextualElement: "INTRODUÇÃO",
    format: "arabic",
  },
  illustrations: {
    labels: ["Figura", "Quadro", "Gráfico", "Mapa", "Imagem", "Ilustração"],
    titleAbove: true,
    sourceBelow: true,
    sourceRequired: true,
    centered: true,
    titleFontSizePt: 12,
    sourceFontSizePt: 11,
  },
  tables: {
    titleLabel: "Tabela",
    titleAbove: true,
    sourceBelow: true,
    sourceRequired: true,
    centered: true,
    titleFontSizePt: 12,
    sourceFontSizePt: 11,
  },
  references: {
    title: "REFERÊNCIAS",
    alignment: "left",
    lineSpacing: 1,
    separatedBySingleBlankLine: true,
    highlight: "bold",
    etAlItalic: true,
  },
  implementedRules: [
    "Página A4 com margens superior/esquerda de 3 cm e inferior/direita de 2 cm.",
    "Fonte Times New Roman ou similar, texto 12, citações longas/notas/fontes 11.",
    "Espaçamento 1,5 no corpo e simples em referências, citações longas, legendas e fontes.",
    "Capa, folha de rosto, resumo, abstract, indicadores, listas, sumário, corpo, referências, anexos e apêndices no fluxo DOCX.",
    "Sumário com campo atualizável pelo Word.",
    "Numeração visível apenas na seção textual/pós-textual, no cabeçalho superior direito.",
    "Detecção de runs OOXML com negrito, itálico e sublinhado.",
  ],
} as const;

export function isAdvisorRequired(workType: WorkTypeValue): boolean {
  return workType === "monografia" || workType === "dissertacao" || workType === "tese";
}

export function requiresImpactIndicators(workType: WorkTypeValue): boolean {
  return workType === "dissertacao" || workType === "tese";
}

export function emptyAcademicFields(): AcademicFields {
  return {
    workType: "",
    author: "",
    title: "",
    subtitle: "",
    workNature: "",
    course: "",
    program: "",
    advisor: "",
    coadvisor: "",
    location: "Lavras - MG",
    year: new Date().getFullYear().toString(),
    resumo: "",
    palavrasChave: "",
    abstractText: "",
    keywords: "",
    introducao: "",
    conclusao: "",
    referencias: "",
    anexos: "",
    apendices: "",
    dedicatoria: "",
    agradecimentos: "",
    epigrafe: "",
    indicadoresImpacto: "",
    impactIndicators: "",
    imageWarnings: "",
  };
}
