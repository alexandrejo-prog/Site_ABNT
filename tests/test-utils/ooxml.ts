import JSZip from "jszip";

export interface DocxParts {
  documentXml: string;
  stylesXml: string;
  settingsXml: string;
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
