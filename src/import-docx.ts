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

function isLikelyZipFile(arrayBuffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function docxOpenError(fileName: string): Error {
  return new Error(
    `Não foi possível abrir "${fileName}" como DOCX válido. O arquivo pode estar corrompido, incompleto ou em formato .doc antigo renomeado para .docx. Abra o arquivo no Word ou LibreOffice, use "Salvar como" > "Documento do Word (.docx)" e tente importar novamente.`,
  );
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

    if (!arrayBuffer.byteLength || !isLikelyZipFile(arrayBuffer)) {
      throw docxOpenError(file.name);
    }

    try {
      const mammothResult = await mammoth.extractRawText({ arrayBuffer });
      mammothText = mammothResult.value;
      messages.push(
        ...mammothResult.messages.map(
          (message) => message.message ?? "Aviso do importador DOCX.",
        ),
      );
    } catch {
      messages.push("Mammoth não conseguiu extrair texto bruto; tentando estrutura OOXML.");
    }

    try {
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
    } catch {
      if (mammothText.trim()) {
        const detected = detectAcademicFieldsFromText(mammothText);
        return {
          text: mammothText,
          editorText: detected.editorText || mammothText,
          fields: detected.fields,
          confidence: detected.confidence,
          messages: [
            ...messages,
            "Não foi possível ler a estrutura OOXML; o arquivo foi importado apenas como texto bruto.",
            ...detected.messages,
          ],
          blocks: [],
        };
      }

      throw docxOpenError(file.name);
    }
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
