import JSZip from "jszip";
import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";
import { isLongFormAcademicWork } from "./graduate-draft-guidance";

function patchMonographDocumentXml(xml: string): string {
  return xml
    .split(
      "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.",
    )
    .join(
      "Monografia apresentada à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.",
    )
    .replace(/(<w:t[^>]*>)Programa:/g, "$1Curso:");
}

function patchGraduateDocumentXml(xml: string, workType: string): string {
  const patchedXml = xml
    .replace(/<w:ind\s+w:left="0"\s+w:firstLine="0"\s*\/>/g, '<w:ind w:left="0" w:hanging="720"/>')
    .replace(/<w:ind\s+w:firstLine="0"\s+w:left="0"\s*\/>/g, '<w:ind w:left="0" w:hanging="720"/>');

  return workType === "monografia" ? patchMonographDocumentXml(patchedXml) : patchedXml;
}

export async function generateGraduateEditableDraftDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const blob = await generateDocxBlob(input);
  if (!isLongFormAcademicWork(input.fields.workType)) return blob;

  const arrayBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentXmlPart = zip.file("word/document.xml");
  if (!documentXmlPart) return blob;

  const documentXml = await documentXmlPart.async("string");
  zip.file("word/document.xml", patchGraduateDocumentXml(documentXml, input.fields.workType));

  return zip.generateAsync({
    type: "blob",
    mimeType: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
