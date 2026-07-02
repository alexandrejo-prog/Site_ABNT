import { Packer } from "docx";
import { createDocxDocument, type DocxGenerationInput } from "./export-docx";

export async function generateArticleDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return Packer.toBlob(createDocxDocument(input));
}
