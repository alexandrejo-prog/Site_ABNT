import JSZip from "jszip";
import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";
import { isLongFormAcademicWork } from "./graduate-draft-guidance";

const CATALOG_PLACEHOLDER_BEFORE =
  "Inserir aqui a ficha catalográfica oficial gerada pela Biblioteca Universitária da UFLA. Não substitua por texto manual na versão final.";
const CATALOG_PLACEHOLDER_AFTER =
  "Ficha catalográfica provisória. Substitua esta página pela ficha oficial gerada pela Biblioteca Universitária da UFLA antes da versão final.";

const APPROVAL_PLACEHOLDER_BEFORE = "Banca examinadora a ser preenchida na versão final.";
const APPROVAL_PLACEHOLDER_AFTER =
  "Folha de aprovação provisória. Substitua os dados da banca após a aprovação ou conforme orientação do programa.";

function replaceEvery(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

function patchGraduateDocumentXml(xml: string): string {
  return [
    [CATALOG_PLACEHOLDER_BEFORE, CATALOG_PLACEHOLDER_AFTER],
    [APPROVAL_PLACEHOLDER_BEFORE, APPROVAL_PLACEHOLDER_AFTER],
    ['<w:ind w:firstLine="0" w:left="0"/>', '<w:ind w:left="0" w:hanging="720"/>'],
  ].reduce((current, [search, replacement]) => replaceEvery(current, search, replacement), xml);
}

export async function generateGraduateEditableDraftDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const blob = await generateDocxBlob(input);
  if (!isLongFormAcademicWork(input.fields.workType)) return blob;

  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXmlPart = zip.file("word/document.xml");
  if (!documentXmlPart) return blob;

  const documentXml = await documentXmlPart.async("string");
  zip.file("word/document.xml", patchGraduateDocumentXml(documentXml));

  return zip.generateAsync({
    type: "blob",
    mimeType: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
