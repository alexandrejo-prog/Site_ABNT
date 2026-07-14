import { importDocumentFile } from "./import-docx";
import { importPdfDocument } from "./import-pdf";
import type { ImportResult } from "./import-docx";
import type { ImportedPdfDocument } from "./imported-pdf";

export type ImportableFileKind = "docx" | "pdf" | "unknown";

export function detectImportableFileKind(input: { fileName: string; mimeType?: string }): ImportableFileKind {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return "docx";
  }
  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return "pdf";
  }
  return "unknown";
}

export type ImportAcademicFileResult =
  | { kind: "docx"; result: ImportResult }
  | { kind: "pdf"; document: ImportedPdfDocument }
  | { kind: "unknown"; error: string };

export async function importAcademicFile(file: File): Promise<ImportAcademicFileResult> {
  const kind = detectImportableFileKind({ fileName: file.name, mimeType: file.type });

  if (kind === "docx") {
    const result = await importDocumentFile(file);
    return { kind: "docx", result };
  }
  if (kind === "pdf") {
    const document = await importPdfDocument(file, file.name);
    return { kind: "pdf", document };
  }
  return { kind: "unknown", error: "Tipo de arquivo não suportado para importação assistida." };
}
