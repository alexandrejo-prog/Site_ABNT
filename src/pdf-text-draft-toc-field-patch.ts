import JSZip from "jszip";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

function patchDocumentXml(xml: string): string {
  let patched = xml;
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
  const patched = patchDocumentXml(xml);
  await ensureUpdateFieldsSetting(zip);
  if (patched !== xml) zip.file("word/document.xml", patched);
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}
