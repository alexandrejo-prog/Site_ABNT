import AdmZip from "adm-zip";

const zip = new AdmZip("tmp/checklist-validation.docx");
const doc = zip.readAsText("word/document.xml");
// Verify we can extract text from DOCX
const textLength = doc.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, "$1").replace(/\s+/g, " ").trim().length;
if (textLength === 0) {
  throw new Error("Failed to extract text from DOCX");
}