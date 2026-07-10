import JSZip from "jszip";
import { Packer } from "docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TOC_FIELD_PATTERN = /<w:instrText[^>]*>\s*TOC\b|<w:fldSimple[^>]*w:instr="\s*TOC\b/i;
const TOC_FIELD_PARAGRAPH_PATTERN = /<w:p\b(?:(?!<\/w:p>)[\s\S])*?(?:<w:instrText[^>]*>\s*TOC\b|<w:fldSimple[^>]*w:instr="\s*TOC\b)(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;
const SUMMARY_TITLE_PATTERN = /<w:t[^>]*>\s*SUM[ÁA]RIO\s*<\/w:t>/i;
const STATIC_TOC_PARAGRAPH_PATTERN = /<w:p\b(?:(?!<\/w:p>)[\s\S])*?<w:pStyle\s+w:val="TOC[123]"(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;
const GENERIC_MONOGRAPH_NATURE = "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
const MONOGRAPH_NATURE = "Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";

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

function patchDynamicTocField(xml: string): { xml: string; changed: boolean } {
  if (!SUMMARY_TITLE_PATTERN.test(xml)) return { xml, changed: false };

  let inserted = false;
  if (TOC_FIELD_PATTERN.test(xml)) {
    const patchedXml = xml.replace(TOC_FIELD_PARAGRAPH_PATTERN, () => {
      if (inserted) return "";
      inserted = true;
      return dynamicTocFieldXml();
    });
    return { xml: patchedXml, changed: inserted && patchedXml !== xml };
  }

  if (!STATIC_TOC_PARAGRAPH_PATTERN.test(xml)) return { xml, changed: false };

  const patchedXml = xml.replace(STATIC_TOC_PARAGRAPH_PATTERN, () => {
    if (inserted) return "";
    inserted = true;
    return dynamicTocFieldXml();
  });

  return { xml: patchedXml, changed: inserted && patchedXml !== xml };
}

function patchMonographDraftLabels(xml: string): { xml: string; changed: boolean } {
  const isLikelyMonograph =
    xml.includes(GENERIC_MONOGRAPH_NATURE) &&
    /Banca examinadora/i.test(xml) &&
    !/Dissertação apresentada|Tese apresentada/i.test(xml);

  if (!isLikelyMonograph) return { xml, changed: false };

  const patchedXml = xml
    .replaceAll(GENERIC_MONOGRAPH_NATURE, MONOGRAPH_NATURE)
    .replace(/(<w:t[^>]*>)Programa:/g, "$1Curso:");

  return { xml: patchedXml, changed: patchedXml !== xml };
}

async function ensureUpdateFieldsSetting(zip: JSZip): Promise<boolean> {
  const settingsFile = zip.file("word/settings.xml");
  if (!settingsFile) return false;

  const settingsXml = await settingsFile.async("string");
  if (/<w:updateFields\b/i.test(settingsXml)) return false;

  const patchedSettingsXml = settingsXml.replace(
    /<\/w:settings>\s*$/,
    "<w:updateFields w:val=\"true\"/></w:settings>",
  );

  if (patchedSettingsXml === settingsXml) return false;
  zip.file("word/settings.xml", patchedSettingsXml);
  return true;
}

export async function ensureDynamicTocField(blob: Blob): Promise<Blob> {
  if (!blob.type.includes("wordprocessingml") && !blob.type.includes("officedocument")) {
    return blob;
  }

  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return blob;

  const xml = await documentFile.async("string");
  const tocPatch = patchDynamicTocField(xml);
  const monographPatch = patchMonographDraftLabels(tocPatch.xml);
  const updateFieldsChanged = await ensureUpdateFieldsSetting(zip);

  if (tocPatch.changed || monographPatch.changed) {
    zip.file("word/document.xml", monographPatch.xml);
  }

  if (!tocPatch.changed && !monographPatch.changed && !updateFieldsChanged) return blob;
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