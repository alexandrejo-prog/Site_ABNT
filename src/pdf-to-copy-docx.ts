import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import { parseEditorContent } from "./export-docx";
import type { EditorBlock } from "./export-docx";
import type { ImportedDocumentImage } from "./imported-images";
import type { ImportedTable } from "./imported-tables";
import { stabilizeImageRun } from "./docx-image-stabilizer";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const CM_3_TWIP = 1701;
const CM_2_TWIP = 1134;
const FONT = "Times New Roman";
const BODY_SIZE = 24;

function clean(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function bodyRun(text: string, options: { bold?: boolean; italics?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text: clean(text) || " ",
    font: FONT,
    size: options.size ?? BODY_SIZE,
    bold: options.bold,
    italics: options.italics,
  });
}

function headingParagraph(text: string, level: 1 | 2 | 3): Paragraph {
  const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { before: 240, after: 120, line: 360 },
    heading: headingLevel,
    children: [bodyRun(text, { bold: true })],
  });
}

function headingLevelForHeading(block: EditorBlock): 1 | 2 | 3 {
  if (block.type === "heading1") return 1;
  if (block.type === "heading3") return 3;
  return 2;
}

function bodyParagraph(text: string, options: { centered?: boolean; bold?: boolean; size?: number; firstLine?: boolean; italics?: boolean } = {}): Paragraph {
  const alignment = options.centered ? AlignmentType.CENTER : AlignmentType.JUSTIFIED;
  const indent = options.centered || options.firstLine === false ? { firstLine: 0 } : { firstLine: 720 };
  const spacing = { before: 0, after: 0, line: 360 };
  return new Paragraph({
    alignment,
    indent,
    spacing,
    children: [bodyRun(text, { bold: options.bold, italics: options.italics, size: options.size })],
  });
}

function referenceParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { firstLine: 0 },
    spacing: { before: 0, after: 120, line: 240 },
    children: [bodyRun(text, { size: 20 })],
  });
}

function buildTable(table: ImportedTable): Table {
  const columnCount = Math.max(1, table.columnCount);
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  };
  const rows: TableRow[] = table.rows.map((row, rowIndex) =>
    new TableRow({
      children: Array.from({ length: columnCount }, (_, colIndex) => {
        const cellText = row[colIndex]?.text ?? "";
        return new TableCell({
          borders,
          width: { size: Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: { firstLine: 0 },
              spacing: { before: 0, after: 0, line: 240 },
              children: [bodyRun(cellText, { bold: rowIndex === 0, size: 20 })],
            }),
          ],
        });
      }),
    }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows });
}

// Normaliza a legenda para o formato que o importador DOCX reconhece como
// figura acadêmica: "FIGURA N — descrição". Remove o número de página à direita
// (líderes "....28") e garante o separador canônico (espaço + hífen/dois-pontos),
// caso contrário o classificador de imagens do reimport (looksLikeAcademicImageCaption)
// não reconhece a legenda e a figura é perdida no fluxo Cópia → Reimport → ABNT.
function normalizeCaption(caption?: string): string | undefined {
  if (!caption) return undefined;
  let text = caption.replace(/\s*\.+\s*\d+\s*$/, "").trim();
  const m = text.match(/^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b\s+([0-9IVXLC]+)\s*([–—:.)]?)\s*(.*)$/i);
  if (m) {
    const sep = m[3] && m[3] !== ")" ? m[3] : "—";
    const rest = m[4] ? ` ${m[4]}` : "";
    text = `${m[1].toUpperCase()} ${m[2]} ${sep}${rest}`;
  }
  return text || undefined;
}

// Remove pontuação/espaços e normaliza para comparação de legendas duplicadas.
function normKey(text?: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Garante legendas únicas no DOCX cópia. O classificador de reimportação
  // (hasAmbiguousNeighbors) descarta imagens com a MESMA legenda exata em janela
// de ±3 blocos. Se um PDF rotula duas figuras distintas com a mesma legenda
// (ex.: subfiguras 6a/6b ambas como "FIGURA 6"), a segunda seria perdida.
// Anexamos um sufixo de desambiguação AO NÚMERO da figura ("FIGURA 6a", "FIGURA 6b"...)
// em vez de um parêntese ao final, porque o normalizador de reimportação (e/ou o
// parser OOXML) descarta parênteses finais das legendas, o que anularia o sufixo.
// O sufixo no número mantém as legendas distintas e preserva ambas as figuras.
const LETTERS = ["", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
function uniqueCaption(caption: string, counter: Map<string, number>): string {
  const key = normKey(caption);
  if (!key) return caption;
  const seen = counter.get(key) ?? 0;
  counter.set(key, seen + 1);
  if (seen === 0) return caption;
  const letter = LETTERS[seen] ?? String.fromCharCode(97 + (seen % 26));
  const m = caption.match(/^((?:FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b\s+[0-9IVXLC]+)/i);
  if (m) {
    return `${m[1]}${letter}${caption.slice(m[1].length)}`;
  }
  return `${caption} ${letter}`;
}

function buildFigureParagraphs(image: ImportedDocumentImage, captionCounter: Map<string, number>): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const rawCaption = normalizeCaption(image.caption);
  const caption = rawCaption ? uniqueCaption(rawCaption, captionCounter) : rawCaption;
  if (caption) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { firstLine: 0 },
        spacing: { before: 120, after: 60, line: 240 },
        children: [bodyRun(caption, { bold: true, size: 20 })],
      }),
    );
  }
  if (image.data && image.data.byteLength) {
    const width = image.width && image.width > 0 ? Math.min(image.width, 6000) : 4000;
    const height = image.height && image.height > 0 && image.width && image.width > 0
      ? Math.round((width * image.height) / image.width)
      : 3000;
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { firstLine: 0 },
        spacing: { before: 0, after: 60, line: 240 },
        children: [
          ((): ImageRun => {
            const run = new ImageRun({
              data: image.data,
              transformation: { width, height },
              altText: {
                title: caption || image.figureType || "Figura",
                description: [caption, image.ocrText ? `Texto na figura (OCR): ${image.ocrText}` : ""].filter(Boolean).join(" "),
                name: image.fileName || caption || "figura",
              },
            });
            return stabilizeImageRun(run, image.fileName || `${image.id || "figura"}.png`);
          })(),
        ],
      }),
    );
  }
  if (image.source) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { firstLine: 0 },
        spacing: { before: 0, after: 120, line: 240 },
        children: [bodyRun(image.source, { size: 20 })],
      }),
    );
  }
  return paragraphs;
}

export interface PdfCopyDocxInput {
  editorText: string;
  importedImages: ImportedDocumentImage[];
  importedTables: ImportedTable[];
  fileName: string;
}

export interface PdfCopyDocxResult {
  blob: Blob;
  figureCount: number;
  tableCount: number;
  blockCount: number;
}

export async function buildPdfCopyDocxBlob(input: PdfCopyDocxInput): Promise<PdfCopyDocxResult> {
  const blocks: EditorBlock[] = parseEditorContent(input.editorText);
  const figuresById = new Map(input.importedImages.map((image) => [image.id, image]));
  const tablesById = new Map(input.importedTables.map((table) => [table.id, table]));

  // Conjunto de legendas/fontes já emitidas pelos blocos de figura/tabela
  // (buildFigureParagraphs normaliza a legenda). Evita a dupla emissão da
  // legenda que já vem no editorText, o que corrompia a reimportação (o
  // classificador de imagens do DOCX detectava "vizinho ambíguo" e descartava
  // a figura no fluxo Cópia → Reimport → ABNT).
  const contextualKeys = new Set<string>();
  const captionCounter = new Map<string, number>();
  const addKey = (text?: string) => {
    if (!text) return;
    contextualKeys.add(normKey(text));
    const n = normalizeCaption(text);
    if (n) contextualKeys.add(normKey(n));
  };
  for (const image of input.importedImages) {
    addKey(image.caption);
    addKey(image.source);
  }
  for (const table of input.importedTables) {
    addKey(table.caption);
    addKey(table.source);
  }

  const children: Array<Paragraph | Table> = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading1":
      case "heading2":
      case "heading3":
        children.push(headingParagraph(block.text, headingLevelForHeading(block)));
        break;
      case "paragraph":
      case "reference":
        // Pula a legenda/fonte solta que já será emitida junto à figura/tabela.
        if (contextualKeys.has(normKey(block.text)) || contextualKeys.has(normKey(normalizeCaption(block.text) ?? ""))) break;
        if (block.type === "reference") children.push(referenceParagraph(block.text));
        else children.push(bodyParagraph(block.text));
        break;
      case "longQuote":
        children.push(bodyParagraph(block.text, { firstLine: false, italics: true }));
        break;
      case "importedImage": {
        const image = figuresById.get(block.text);
        if (image && (image.data?.byteLength || image.caption || image.source)) {
          children.push(...buildFigureParagraphs(image, captionCounter));
        } else if (image?.caption) {
          const cap = uniqueCaption(normalizeCaption(image.caption) ?? image.caption, captionCounter);
          children.push(bodyParagraph(cap, { centered: true, bold: true, size: 20 }));
        }
        break;
      }
      case "importedTable": {
        const table = tablesById.get(block.text);
        if (table && table.rows.length && table.columnCount > 0) {
          const tableCaption = normalizeCaption(table.caption);
          if (tableCaption) {
            const uniqueTableCaption = uniqueCaption(tableCaption, captionCounter);
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                indent: { firstLine: 0 },
                spacing: { before: 120, after: 60, line: 240 },
                children: [bodyRun(uniqueTableCaption, { bold: true, size: 20 })],
              }),
            );
          }
          children.push(buildTable(table));
          if (table.source) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                indent: { firstLine: 0 },
                spacing: { before: 0, after: 120, line: 240 },
                children: [bodyRun(table.source, { size: 20 })],
              }),
            );
          }
        }
        break;
      }
      case "markdownTable":
      case "scheduleTable":
      case "plainScheduleTable":
      case "tabbedTable":
        children.push(bodyParagraph(block.text));
        break;
      default:
        if (block.text) children.push(bodyParagraph(block.text));
        break;
    }
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
            margin: { top: CM_3_TWIP, left: CM_3_TWIP, bottom: CM_2_TWIP, right: CM_2_TWIP },
          },
        },
        children: children.length ? children : [bodyParagraph("Documento sem conteúdo extraível.")],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  return {
    blob: new Blob([blob], { type: DOCX_MIME }),
    figureCount: input.importedImages.filter((image) => image.data?.byteLength).length,
    tableCount: input.importedTables.filter((table) => table.rows.length > 0).length,
    blockCount: blocks.length,
  };
}

export function pdfCopyDocxFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "pdf"}-copia.docx`;
}
