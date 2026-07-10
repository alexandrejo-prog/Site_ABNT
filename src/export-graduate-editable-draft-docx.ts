import JSZip from "jszip";
import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";
import { isLongFormAcademicWork } from "./graduate-draft-guidance";

const CATALOG_PLACEHOLDER_BEFORE =
  "Inserir aqui a ficha catalográfica oficial gerada pela Biblioteca Universitária da UFLA. Não substitua por texto manual na versão final.";
const CATALOG_PLACEHOLDER_AFTER =
  "Ficha catalográfica provisória. Substitua esta página pela ficha oficial gerada pela Biblioteca Universitária da UFLA antes da versão final.";

const APPROVAL_PLACEHOLDER_BEFORE = "Banca examinadora a ser preenchida na versão final.";
const APPROVAL_PLACEHOLDER_AFTER =
  "Banca examinadora provisória. Folha de aprovação provisória. Substitua os dados da banca após a aprovação ou conforme orientação do programa.";

const GENERIC_WORK_NATURE =
  "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
const MONOGRAPH_WORK_NATURE =
  "Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";

function replaceEvery(value: string, search: string | RegExp, replacement: string): string {
  if (search instanceof RegExp) {
    return value.replace(search, replacement);
  }
  return value.split(search).join(replacement);
}

function patchMonographDocumentXml(xml: string): string {
  return xml
    .split(GENERIC_WORK_NATURE)
    .join(MONOGRAPH_WORK_NATURE)
    .replace(/(<w:t[^>]*>)Programa:/g, "$1Curso:");
}

function patchGraduateDocumentXml(xml: string, workType: string): string {
  const patches: [string | RegExp, string][] = [
    [CATALOG_PLACEHOLDER_BEFORE, CATALOG_PLACEHOLDER_AFTER],
    [APPROVAL_PLACEHOLDER_BEFORE, APPROVAL_PLACEHOLDER_AFTER],
    [/<w:ind\s+w:left="0"\s+w:firstLine="0"\s*\/>/g, '<w:ind w:left="0" w:hanging="720"/>'],
    [/<w:ind\s+w:firstLine="0"\s+w:left="0"\s*\/>/g, '<w:ind w:left="0" w:hanging="720"/>'],
  ];
  const patchedXml = patches.reduce((current, [search, replacement]) => replaceEvery(current, search, replacement), xml);
  return workType === "monografia" ? patchMonographDocumentXml(patchedXml) : patchedXml;
}

export async function generateGraduateEditableDraftDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const blob = await generateDocxBlob(input);
  if (!isLongFormAcademicWork(input.fields.workType)) return blob;

  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXmlPart = zip.file("word/document.xml");
  if (!documentXmlPart) return blob;

  const documentXml = await documentXmlPart.async("string");
  zip.file("word/document.xml", patchGraduateDocumentXml(documentXml, input.fields.workType));

  return zip.generateAsync({
    type: "blob",
    mimeType: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
