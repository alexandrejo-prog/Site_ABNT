import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import { UFLA_RULES, cmToTwip } from "./ufla-rules";

const BLACK = "000000";
const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const SECTION_SIZE = UFLA_RULES.typography.coverTitleFontSizePt * 2;
const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const TWELVE_PT = 240;
const SIX_PT = 120;

type SummaryEntry = Pick<EditorBlock, "type" | "text">;

function run(text: string, options: { bold?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: UFLA_RULES.typography.fontFamily,
    size: options.size ?? BODY_SIZE,
    bold: options.bold,
    color: BLACK,
  });
}

function paragraph(text: string, bold = false, spacing: { before?: number; after?: number; line?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: SIX_PT, ...spacing },
    indent: { firstLine: cmToTwip(UFLA_RULES.typography.paragraphFirstLineCm) },
    children: [run(text || " ", { bold })],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: TWELVE_PT, after: TWELVE_PT, line: ONE_AND_HALF_LINE },
    children: [run(text.toUpperCase(), { size: SECTION_SIZE, bold: true })],
  });
}

function centeredParagraph(text: string, bold = false, size = BODY_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [run(text, { bold, size })],
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function summaryTitle(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: TWELVE_PT, after: TWELVE_PT, line: ONE_AND_HALF_LINE },
    children: [run("SUMÁRIO", { bold: true })],
  });
}

function summaryEntryParagraph(entry: SummaryEntry): Paragraph {
  const left = entry.type === "heading3" ? cmToTwip(1) : entry.type === "heading2" ? cmToTwip(0.5) : 0;

  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: SINGLE_LINE },
    indent: { left },
    children: [run(entry.text, { bold: entry.type === "heading1" })],
  });
}

function summaryEntries(bodyBlocks: EditorBlock[], references: string[], input: DocxGenerationInput): SummaryEntry[] {
  const entries: SummaryEntry[] = bodyBlocks
    .filter((block) => block.type === "heading1" || block.type === "heading2" || block.type === "heading3")
    .map((block) => ({ type: block.type, text: block.text }));

  if (references.length > 0) entries.push({ type: "heading1", text: "REFERÊNCIAS" });
  if (input.fields.apendices) entries.push({ type: "heading1", text: "APÊNDICES" });
  if (input.fields.anexos) entries.push({ type: "heading1", text: "ANEXOS" });

  return entries;
}

function buildSummary(bodyBlocks: EditorBlock[], references: string[], input: DocxGenerationInput): Paragraph[] {
  const entries = summaryEntries(bodyBlocks, references, input);
  if (!entries.length) return [];

  return [
    pageBreak(),
    summaryTitle(),
    ...entries.map((entry) => summaryEntryParagraph(entry)),
    new Paragraph({ spacing: { before: 240 } }),
    paragraph(
      "Após abrir o DOCX no Word ou LibreOffice, atualize o sumário para conferir a paginação final.",
      false,
      { line: SINGLE_LINE },
    ),
    pageBreak(),
  ];
}

function blockToParagraph(block: EditorBlock): Paragraph[] {
  if (block.type === "heading1") {
    return [sectionTitle(block.text)];
  }

  if (block.type === "heading2" || block.type === "heading3") {
    return [
      new Paragraph({
        heading: block.type === "heading2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        spacing: { before: TWELVE_PT, after: TWELVE_PT, line: ONE_AND_HALF_LINE },
        children: [run(block.text, { bold: true })],
      }),
    ];
  }

  if (block.type === "longQuote") {
    return [paragraph(block.text, false, { line: SINGLE_LINE })];
  }

  return [paragraph(block.text)];
}

function referenceParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: SINGLE_LINE },
    indent: { hanging: cmToTwip(0.5) },
    children: [run(text)],
  });
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function buildDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(input.editorText);
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((b) => b.type === "reference").map((b) => b.text),
  ];

  const specificSections: EditorBlock[] = [];

  if (hasValue(input.fields.tema)) {
    specificSections.push({ type: "heading1", text: "Tema" });
    specificSections.push({ type: "paragraph", text: input.fields.tema });
  }
  if (hasValue(input.fields.delimitacaoTema)) {
    specificSections.push({ type: "heading1", text: "Delimitação do Tema" });
    specificSections.push({ type: "paragraph", text: input.fields.delimitacaoTema });
  }
  if (hasValue(input.fields.problemaPesquisa)) {
    specificSections.push({ type: "heading1", text: "Problema de Pesquisa" });
    specificSections.push({ type: "paragraph", text: input.fields.problemaPesquisa });
  }
  if (hasValue(input.fields.hipotese)) {
    specificSections.push({ type: "heading1", text: "Hipótese" });
    specificSections.push({ type: "paragraph", text: input.fields.hipotese });
  }
  if (hasValue(input.fields.objetivoGeral)) {
    specificSections.push({ type: "heading1", text: "Objetivo Geral" });
    specificSections.push({ type: "paragraph", text: input.fields.objetivoGeral });
  }
  if (hasValue(input.fields.objetivosEspecificos)) {
    specificSections.push({ type: "heading1", text: "Objetivos Específicos" });
    specificSections.push({ type: "paragraph", text: input.fields.objetivosEspecificos });
  }
  if (hasValue(input.fields.justificativa)) {
    specificSections.push({ type: "heading1", text: "Justificativa" });
    specificSections.push({ type: "paragraph", text: input.fields.justificativa });
  }
  if (hasValue(input.fields.referencialTeorico)) {
    specificSections.push({ type: "heading1", text: "Referencial Teórico" });
    specificSections.push({ type: "paragraph", text: input.fields.referencialTeorico });
  }
  if (hasValue(input.fields.metodologia)) {
    specificSections.push({ type: "heading1", text: "Metodologia" });
    specificSections.push({ type: "paragraph", text: input.fields.metodologia });
  }
  if (hasValue(input.fields.cronograma)) {
    specificSections.push({ type: "heading1", text: "Cronograma" });
    specificSections.push({ type: "paragraph", text: input.fields.cronograma });
  }
  if (hasValue(input.fields.recursosOrcamento)) {
    specificSections.push({ type: "heading1", text: "Recursos/Orçamento" });
    specificSections.push({ type: "paragraph", text: input.fields.recursosOrcamento });
  }
  if (hasValue(input.fields.resultadosEsperados)) {
    specificSections.push({ type: "heading1", text: "Resultados Esperados" });
    specificSections.push({ type: "paragraph", text: input.fields.resultadosEsperados });
  }

  const bodyBlocks = specificSections.length > 0 ? specificSections : blocks;

  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Projeto de pesquisa",
    description: "Documento de projeto de pesquisa gerado conforme NBR 15287:2025 (suporte inicial).",
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: UFLA_RULES.page.widthTwip,
              height: UFLA_RULES.page.heightTwip,
            },
            margin: {
              top: cmToTwip(3),
              left: cmToTwip(3),
              bottom: cmToTwip(2),
              right: cmToTwip(2),
            },
          },
        },
        children: [
          // Capa simples
          new Paragraph({ spacing: { before: 2400 } }),
          centeredParagraph("UNIVERSIDADE FEDERAL DE LAVRAS", true, BODY_SIZE),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph((input.fields.title || "TÍTULO DO PROJETO").toUpperCase(), true, SECTION_SIZE),
          new Paragraph({ spacing: { before: 960 } }),
          centeredParagraph((input.fields.author || "AUTOR").toUpperCase(), true),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph(input.fields.location || "Lavras - MG", false, BODY_SIZE - 4),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph(input.fields.year || new Date().getFullYear().toString(), false, BODY_SIZE - 4),
          // Sumário estático de segurança para projeto de pesquisa
          ...buildSummary(bodyBlocks, references, input),
          // Corpo do texto
          new Paragraph({ spacing: { before: 720 } }),
          ...bodyBlocks.flatMap((block) => blockToParagraph(block)),
          // Referências
          ...(references.length > 0
            ? [
                new Paragraph({ spacing: { before: 480 } }),
                sectionTitle("Referências"),
                ...references.map((ref) => referenceParagraph(ref)),
              ]
            : []),
          // Apêndices/Anexos se houver
          ...(input.fields.apendices
            ? [
                new Paragraph({ spacing: { before: 480 } }),
                sectionTitle("Apêndices"),
                ...splitParagraphs(input.fields.apendices).map((line) => paragraph(line)),
              ]
            : []),
          ...(input.fields.anexos
            ? [
                new Paragraph({ spacing: { before: 480 } }),
                sectionTitle("Anexos"),
                ...splitParagraphs(input.fields.anexos).map((line) => paragraph(line)),
              ]
            : []),
        ],
      },
    ],
  });
}

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return Packer.toBlob(buildDocument(input));
}
