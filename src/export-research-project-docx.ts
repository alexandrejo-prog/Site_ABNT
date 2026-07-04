import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return generateDocxBlob(input);
}
