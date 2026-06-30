import * as mammoth from "mammoth/mammoth.browser";
import {
  detectAcademicFieldsFromStructure,
  detectAcademicFieldsFromText,
} from "./field-detector";
import {
  AcademicFieldKey,
  AcademicFields,
  Confidence,
} from "./ufla-rules";
import {
  ImportedBlock,
  extractDocxStructure,
} from "./word-structure-extractor";

export interface ImportResult {
  text: string;
  editorText: string;
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  messages: string[];
  blocks: ImportedBlock[];
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks"> {
  const identified = detectAcademicFieldsFromText(text);
  return {
    fields: identified.fields,
    confidence: identified.confidence,
  };
}

export async function importDocumentFile(file: File): Promise<ImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const messages: string[] = [];

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    let mammothText = "";

    try {
      const mammothResult = await mammoth.extractRawText({ arrayBuffer });
      mammothText = mammothResult.value;
      messages.push(
        ...mammothResult.messages.map(
          (message) => message.message ?? "Aviso do importador DOCX.",
        ),
      );
    } catch {
      messages.push("Mammoth não conseguiu extrair texto bruto; usando estrutura OOXML.");
    }

    const structure = await extractDocxStructure(arrayBuffer);
    const text = structure.text || mammothText;
    const detected = detectAcademicFieldsFromStructure({ ...structure, text });

    return {
      text,
      editorText: detected.editorText || text,
      fields: detected.fields,
      confidence: detected.confidence,
      messages: [...messages, ...detected.messages],
      blocks: structure.blocks,
    };
  }

  if (extension === "txt" || extension === "md") {
    const text = await file.text();
    const detected = detectAcademicFieldsFromText(text);
    return {
      text,
      editorText: detected.editorText || text,
      fields: detected.fields,
      confidence: detected.confidence,
      messages: detected.messages,
      blocks: [],
    };
  }

  throw new Error("Formato não suportado. Use .docx, .txt ou .md.");
}
