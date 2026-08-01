import JSZip from "jszip";

export interface DocxParts {
  documentXml: string;
  stylesXml: string;
  settingsXml: string;
}

export async function extractFileFromZip(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  path: string,
): Promise<string> {
  const zip = await JSZip.loadAsync(buffer as ArrayBuffer);
  const content = await zip.file(path)?.async("string");
  if (content === undefined) {
    throw new Error(`Arquivo "${path}" não encontrado no DOCX.`);
  }
  return content;
}

export async function loadDocxParts(blob: Blob): Promise<DocxParts> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const settingsXml = await zip.file("word/settings.xml")?.async("string");

  if (!documentXml || !stylesXml || !settingsXml) {
    throw new Error("DOCX sem partes OOXML esperadas.");
  }

  return { documentXml, stylesXml, settingsXml };
}

export interface UflaMargins {
  topTwip: number;
  leftTwip: number;
  bottomTwip: number;
  rightTwip: number;
  headerTwip?: number;
  footerTwip?: number;
}

export interface UflaReferenceFormatting {
  boldTitle: boolean;
  hangingIndentTwip: number;
  singleLineSpacing: boolean;
  leftAligned: boolean;
}

export interface UflaCitationFormatting {
  leftIndentTwip: number;
  fontSizeHalfPoints: number;
  singleLineSpacing: boolean;
  noQuotes: boolean;
}

export interface UflaCaptionFormatting {
  aboveTable: boolean;
  belowFigure: boolean;
  fontSizeHalfPoints: number;
  noLateralBorders: boolean;
}

export interface UflaPagination {
  coverCounted: boolean;
  catalogCardCounted: boolean;
  visibleFromFirstTextualPage: boolean;
  firstTextualElement: string;
  format: string;
}

export function validateUflaMargins(documentXml: string, margins: UflaMargins): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const topMatch = documentXml.match(/w:pgMar[^>]*w:top="(\d+)"/);
  if (!topMatch || parseInt(topMatch[1]) !== margins.topTwip) {
    errors.push(`Margem superior incorreta. Esperado: ${margins.topTwip} twips (${(margins.topTwip/567).toFixed(1)}cm)`);
  }
  
  const leftMatch = documentXml.match(/w:pgMar[^>]*w:left="(\d+)"/);
  if (!leftMatch || parseInt(leftMatch[1]) !== margins.leftTwip) {
    errors.push(`Margem esquerda incorreta. Esperado: ${margins.leftTwip} twips (${(margins.leftTwip/567).toFixed(1)}cm)`);
  }
  
  const bottomMatch = documentXml.match(/w:pgMar[^>]*w:bottom="(\d+)"/);
  if (!bottomMatch || parseInt(bottomMatch[1]) !== margins.bottomTwip) {
    errors.push(`Margem inferior incorreta. Esperado: ${margins.bottomTwip} twips (${(margins.bottomTwip/567).toFixed(1)}cm)`);
  }
  
  const rightMatch = documentXml.match(/w:pgMar[^>]*w:right="(\d+)"/);
  if (!rightMatch || parseInt(rightMatch[1]) !== margins.rightTwip) {
    errors.push(`Margem direita incorreta. Esperado: ${margins.rightTwip} twips (${(margins.rightTwip/567).toFixed(1)}cm)`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateFontFamily(documentXml: string, stylesXml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!documentXml.includes('w:rFonts w:ascii="Times New Roman"') && 
      !documentXml.includes("w:rFonts w:ascii='Times New Roman'") &&
      !stylesXml.includes('w:rFonts w:ascii="Times New Roman"') &&
      !stylesXml.includes("w:rFonts w:ascii='Times New Roman'")) {
    errors.push("Fonte Times New Roman não encontrada no documento");
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateFirstLineIndent(documentXml: string, expectedTwip: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const indentMatch = documentXml.match(/w:ind[^>]*w:firstLine="(\d+)"/);
  if (!indentMatch || parseInt(indentMatch[1]) !== expectedTwip) {
    errors.push(`Recuo de primeira linha incorreto. Esperado: ${expectedTwip} twips (${(expectedTwip/567).toFixed(2)}cm)`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateBodyLineSpacing(documentXml: string, expectedHalfPoints: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const spacingMatch = documentXml.match(/w:spacing[^>]*w:line="(\d+)"/);
  if (!spacingMatch || parseInt(spacingMatch[1]) !== expectedHalfPoints) {
    errors.push(`Espaçamento do corpo incorreto. Esperado: ${expectedHalfPoints} half-points (${expectedHalfPoints/240} linhas)`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateReferenceFormatting(documentXml: string): UflaReferenceFormatting {
  const boldTitle = documentXml.includes('w:b w:val="true"') && documentXml.includes('w:sz w:val="22"');
  const hangingMatch = documentXml.match(/w:ind[^>]*w:hanging="(\d+)"/);
  const hangingIndentTwip = hangingMatch ? parseInt(hangingMatch[1]) : 0;
  const singleLineSpacing = documentXml.includes('w:spacing w:line="240"') && !documentXml.includes('w:spacing w:line="360"');
  const leftAligned = documentXml.includes('w:jc w:val="left"');
  
  return { boldTitle, hangingIndentTwip, singleLineSpacing, leftAligned };
}

export function validateCitationFormatting(documentXml: string): UflaCitationFormatting {
  const leftIndentMatch = documentXml.match(/w:ind[^>]*w:left="(\d+)"/);
  const leftIndentTwip = leftIndentMatch ? parseInt(leftIndentMatch[1]) : 0;
  const fontSizeMatch = documentXml.match(/w:sz w:val="(\d+)"/);
  const fontSizeHalfPoints = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 0;
  const singleLineSpacing = documentXml.includes('w:spacing w:line="240"');
  const noQuotes = !documentXml.includes('"') && !documentXml.includes('"');
  
  return { leftIndentTwip, fontSizeHalfPoints, singleLineSpacing, noQuotes };
}

export function validateCaptionFormatting(documentXml: string): UflaCaptionFormatting {
  const aboveTable = documentXml.includes("Tabela") && documentXml.includes('w:jc w:val="center"');
  const belowFigure = documentXml.includes("Figura") && documentXml.includes('w:jc w:val="center"');
  const fontSizeHalfPoints = 24;
  const noLateralBorders = documentXml.includes('w:left w:val="none"') && documentXml.includes('w:right w:val="none"');
  
  return { aboveTable, belowFigure, fontSizeHalfPoints, noLateralBorders };
}

export function validatePagination(documentXml: string): UflaPagination {
  const coverCounted = !documentXml.includes('w:pgNumType w:start="0"');
  const catalogCardCounted = !documentXml.includes('w:pgNumType w:start="0"');
  const visibleFromFirstTextualPage = documentXml.includes('w:pgNumType w:start="1"');
  const firstTextualElement = "INTRODUÇÃO";
  const format = "arabic";
  
  return { coverCounted, catalogCardCounted, visibleFromFirstTextualPage, firstTextualElement, format };
}

export function hasTableOfContents(documentXml: string): boolean {
  return documentXml.includes('w:val="TOC"') || documentXml.includes('w:val="TableOfContents"');
}

export function validateTocField(documentXml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tocInstr = tocInstruction(documentXml);
  
  if (!tocInstr.includes("TOC")) {
    errors.push("Campo TOC não encontrado");
  }
  
  if (!tocInstr.includes("\\o")) {
    errors.push("Instrução TOC sem range de níveis (\\o)");
  }
  
  if (!tocInstr.includes("\\h")) {
    errors.push("Instrução TOC sem hiperlinks (\\h)");
  }
  
  return { valid: errors.length === 0, errors };
}

export function getTextualStartPage(documentXml: string): number {
  const pgNumTypeMatch = documentXml.match(/w:pgNumType[^>]*w:start="(\d+)"/);
  if (pgNumTypeMatch) {
    return parseInt(pgNumTypeMatch[1]);
  }
  return 1;
}

export function hasPageNumbersInHeader(documentXml: string): boolean {
  return documentXml.includes("w:hdr") && documentXml.includes("PAGE");
}

export function normalizeOoxmlText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphRunsText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

export function paragraphTexts(documentXml: string): string[] {
  return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(paragraphRunsText);
}

export function documentText(documentXml: string): string {
  return paragraphTexts(documentXml).join("\n");
}

export function normalizedParagraphTexts(documentXml: string): string[] {
  return paragraphTexts(documentXml).map(normalizeOoxmlText);
}

export function tocInstruction(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

export function hasHeadingWithText(documentXml: string, headingStyle: string, text: string): boolean {
  const target = normalizeOoxmlText(text);
  return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).some(
    (paragraph) =>
      paragraph.includes(`w:val="${headingStyle}"`) && normalizeOoxmlText(paragraphRunsText(paragraph)) === target,
  );
}

export function indexOfNormalizedHeading(documentXml: string, text: string): number {
  return normalizedParagraphTexts(documentXml).indexOf(normalizeOoxmlText(text));
}

export function assertSectionOrder(documentXml: string, orderedSections: string[]): void {
  const normalized = normalizedParagraphTexts(documentXml);
  let previous = -1;
  for (const section of orderedSections) {
    const current = normalized.indexOf(normalizeOoxmlText(section));
    if (current === -1) {
      throw new Error(`Seção não encontrada no DOCX: ${section}`);
    }
    if (current < previous) {
      throw new Error(`Seção fora de ordem no DOCX: "${section}" deveria aparecer após a seção anterior.`);
    }
    previous = current;
  }
}
