import JSZip from "jszip";
import { Packer } from "docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TOC_FIELD_PATTERN = /<w:instrText[^>]*>\s*TOC\b/i;
const SUMMARY_TITLE_PATTERN = /<w:t[^>]*>\s*SUM[ÁA]RIO\s*<\/w:t>/i;
const STATIC_TOC_PARAGRAPH_PATTERN = /<w:p\b(?:(?!<\/w:p>)[\s\S])*?<w:pStyle\s+w:val="TOC[123]"(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;

function dynamicTocFieldXml(): string {
  return [
    "<w:p>",
    "<w:pPr><w:pStyle w:val=\"TOC1\"/></w:pPr>",
    "<w:r><w:fldChar w:fldCharType=\"begin\" w:dirty=\"true\"/></w:r>",
    "<w:r><w:instrText xml:space=\"preserve\"> TOC \\o \"1-3\" \\h \\z \\u </w:instrText></w:r>",
    "<w:r><w:fldChar w:fldCharType=\"separate\"/></w:r>",
    "<w:r><w:t>Clique com o botão direito e atualize o campo para gerar o sumário.</w:t></w:r>",
    "<w:r><w:fldChar w:fldCharType=\"end\"/></w:r>",
    "</w:p>",
  ].join("");
}

export async function ensureDynamicTocField(blob: Blob): Promise<Blob> {
  if (!blob.type.includes("wordprocessingml") && !blob.type.includes("officedocument")) {
    return blob;
  }

  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return blob;

  const xml = await documentFile.async("string");
  if (TOC_FIELD_PATTERN.test(xml)) return blob;
  if (!SUMMARY_TITLE_PATTERN.test(xml)) return blob;
  if (!STATIC_TOC_PARAGRAPH_PATTERN.test(xml)) return blob;

  let inserted = false;
  const patchedXml = xml.replace(STATIC_TOC_PARAGRAPH_PATTERN, () => {
    if (inserted) return "";
    inserted = true;
    return dynamicTocFieldXml();
  });

  if (!inserted || patchedXml === xml) return blob;

  zip.file("word/document.xml", patchedXml);
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

type PatchablePacker = {
  toBlob: (file: unknown, prettify?: boolean | "" | " " | "  " | "\t") => Promise<Blob>;
  __uflaDynamicTocPatch?: boolean;
};

const patchablePacker = Packer as unknown as PatchablePacker;

if (!patchablePacker.__uflaDynamicTocPatch) {
  const originalToBlob = patchablePacker.toBlob.bind(Packer);
  patchablePacker.toBlob = async (file, prettify) => {
    const blob = await originalToBlob(file, prettify);
    return ensureDynamicTocField(blob);
  };
  patchablePacker.__uflaDynamicTocPatch = true;
}
