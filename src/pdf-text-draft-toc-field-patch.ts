import JSZip from "jszip";
import { isPdfTocEligibleHeadingText, pdfTocHeadingLevel } from "./pdf-toc-eligibility";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const RIGHT_TAB_POSITION = 8500;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldXml(instruction: string, visibleText: string): string {
  return [
    "<w:r><w:fldChar w:fldCharType=\"begin\" w:dirty=\"true\"/></w:r>",
    `<w:r><w:instrText xml:space=\"preserve\"> ${instruction} </w:instrText></w:r>`,
    "<w:r><w:fldChar w:fldCharType=\"separate\"/></w:r>",
    `<w:r><w:t>${visibleText}</w:t></w:r>`,
    "<w:r><w:fldChar w:fldCharType=\"end\"/></w:r>",
  ].join("");
}

function patchTokenTextRun(xml: string, token: string, replacement: string): string {
  const pattern = new RegExp(`<w:r\\b(?:(?!</w:r>)[\\s\\S])*?<w:t[^>]*>${escapeRegExp(token)}</w:t>(?:(?!</w:r>)[\\s\\S])*?</w:r>`, "g");
  return xml.replace(pattern, replacement);
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function visibleTextFromXml(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .filter((text) => !/^__PDF_(?:PAGEREF|BM_)/.test(text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function tocTitleFromParagraph(paragraphXml: string): string {
  const tokenIndex = paragraphXml.indexOf("__PDF_PAGEREF_");
  const titleScope = tokenIndex >= 0 ? paragraphXml.slice(0, tokenIndex) : paragraphXml;
  return visibleTextFromXml(titleScope);
}

function bookmarkHeadingTitles(xml: string): Map<string, string> {
  const titles = new Map<string, string>();
  const pattern = /__PDF_BM_START_(PDFBM\d{3})__([\s\S]*?)__PDF_BM_END_\1__/g;
  for (const match of xml.matchAll(pattern)) {
    const title = visibleTextFromXml(match[2]);
    if (title) titles.set(match[1], title);
  }
  return titles;
}

function ensureTabRunBeforePageRef(paragraphXml: string): string {
  const tokenIndex = paragraphXml.indexOf("__PDF_PAGEREF_");
  if (tokenIndex < 0) return paragraphXml;
  const beforeToken = paragraphXml.slice(0, tokenIndex);
  if (/<w:tab\s*\/>/.test(beforeToken.slice(Math.max(0, beforeToken.length - 500)))) return paragraphXml;
  const tokenRunPattern = /(<w:r\b(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>__PDF_PAGEREF_PDFBM\d{3}__<\/w:t>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>)/;
  return paragraphXml.replace(tokenRunPattern, "<w:r><w:tab/></w:r>$1");
}

function replaceOrInsertParagraphProperty(paragraphXml: string, pattern: RegExp, replacement: string): string {
  const paragraphProperties = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0];
  if (paragraphProperties) {
    const updated = pattern.test(paragraphProperties)
      ? paragraphProperties.replace(pattern, replacement)
      : paragraphProperties.replace(/<\/w:pPr>$/, `${replacement}</w:pPr>`);
    return paragraphXml.replace(paragraphProperties, updated);
  }
  return paragraphXml.replace(/^(<w:p\b[^>]*>)/, `$1<w:pPr>${replacement}</w:pPr>`);
}

function formatTocParagraph(paragraphXml: string, title: string): string {
  const level = pdfTocHeadingLevel(title);
  const leftIndent = Math.min(850, Math.max(0, level - 1) * 283);
  const tabs = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${RIGHT_TAB_POSITION}"/></w:tabs>`;
  const indent = `<w:ind w:left="${leftIndent}" w:firstLine="0"/>`;
  let formatted = replaceOrInsertParagraphProperty(paragraphXml, /<w:tabs\b[\s\S]*?<\/w:tabs>/, tabs);
  formatted = replaceOrInsertParagraphProperty(formatted, /<w:ind\b[^>]*\/>/, indent);
  return ensureTabRunBeforePageRef(formatted);
}

function filterAndFormatTocParagraphs(xml: string, headingTitles: Map<string, string>): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const bookmark = paragraphXml.match(/__PDF_PAGEREF_(PDFBM\d{3})__/)?.[1];
    if (!bookmark) return paragraphXml;
    const title = headingTitles.get(bookmark) ?? tocTitleFromParagraph(paragraphXml);
    if (!title || !isPdfTocEligibleHeadingText(title)) return "";
    return formatTocParagraph(paragraphXml, title);
  });
}

export function patchPdfTextDraftDocumentXml(xml: string): string {
  const headingTitles = bookmarkHeadingTitles(xml);
  let patched = filterAndFormatTocParagraphs(xml, headingTitles);
  const bookmarkStarts = [...patched.matchAll(/__PDF_BM_START_(PDFBM\d{3})__/g)].map((match, index) => ({
    token: match[0],
    name: match[1],
    id: String(index + 1),
  }));

  for (const bookmark of bookmarkStarts) {
    patched = patchTokenTextRun(patched, bookmark.token, `<w:bookmarkStart w:id="${bookmark.id}" w:name="${bookmark.name}"/>`);
    patched = patchTokenTextRun(patched, `__PDF_BM_END_${bookmark.name}__`, `<w:bookmarkEnd w:id="${bookmark.id}"/>`);
  }

  for (const bookmark of bookmarkStarts) {
    patched = patchTokenTextRun(patched, `__PDF_PAGEREF_${bookmark.name}__`, fieldXml(`PAGEREF ${bookmark.name} \\h`, "1"));
  }

  return patched;
}

async function ensureUpdateFieldsSetting(zip: JSZip): Promise<void> {
  const settingsFile = zip.file("word/settings.xml");
  if (!settingsFile) return;
  const settingsXml = await settingsFile.async("string");
  if (/<w:updateFields\b/i.test(settingsXml)) return;
  zip.file("word/settings.xml", settingsXml.replace(/<\/w:settings>\s*$/, "<w:updateFields w:val=\"true\"/></w:settings>"));
}

export async function ensurePdfTextDraftTocFields(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return blob;
  const xml = await documentFile.async("string");
  const patched = patchPdfTextDraftDocumentXml(xml);
  await ensureUpdateFieldsSetting(zip);
  if (patched !== xml) zip.file("word/document.xml", patched);
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}
