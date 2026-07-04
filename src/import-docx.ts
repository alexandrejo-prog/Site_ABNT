import * as mammoth from "mammoth/mammoth.browser";
import { detectAcademicFieldsFromStructure } from "./field-detector";
import {
  AcademicFieldKey,
  AcademicFields,
  Confidence,
} from "./ufla-rules";
import {
  ImportedBlock,
  extractDocxStructure,
  normalizeForDetection,
} from "./word-structure-extractor";
import {
  normalizeImportedStructure,
  normalizePlainAcademicText,
} from "./import-normalizer";

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

function looksLikeResearchProject(text: string, fields: AcademicFields): boolean {
  const normalized = normalizeForDetection(
    [text, fields.title, fields.subtitle, fields.workNature, fields.resumo, fields.introducao].join("\n"),
  );

  return (
    /\bPROJETO DE PESQUISA\b/.test(normalized) ||
    /\bPROJETO DE PESQUISA APRESENTADO\b/.test(normalized) ||
    /\bRESEARCH PROJECT\b/.test(normalized)
  );
}

function withInferredWorkType(fields: AcademicFields, text: string): AcademicFields {
  if (!looksLikeResearchProject(text, fields)) return fields;
  return { ...fields, workType: "projeto_pesquisa" };
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
): ImportResult {
  return {
    text: normalized.text,
    editorText: detected.editorText || normalized.text,
    fields: withInferredWorkType(detected.fields, normalized.text),
    confidence: detected.confidence,
    messages,
    blocks: normalized.structure.blocks,
  };
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks"> {
  const normalized = normalizePlainAcademicText(text);
  const identified = detectAcademicFieldsFromStructure(normalized.structure);
  return {
    fields: withInferredWorkType(identified.fields, normalized.text),
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
      const normalized = normalizeImportedStructure({
        ...structure,
        text: structure.text || mammothText,
      });
      const detected = detectAcademicFieldsFromStructure(normalized.structure);

      return buildImportResult(normalized, detected, [
        ...messages,
        ...normalized.messages,
        ...detected.messages,
      ]);
    } catch {
      if (mammothText.trim()) {
        const normalized = normalizePlainAcademicText(mammothText);
        const detected = detectAcademicFieldsFromStructure(normalized.structure);
        return buildImportResult(normalized, detected, [
          ...messages,
          "Não foi possível ler a estrutura OOXML; o arquivo foi importado apenas como texto bruto.",
          ...normalized.messages,
          ...detected.messages,
        ]);
      }

      throw docxOpenError(file.name);
    }
  }

  if (extension === "txt" || extension === "md") {
    const text = await file.text();
    const normalized = normalizePlainAcademicText(text);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);
    return buildImportResult(normalized, detected, [
      ...normalized.messages,
      ...detected.messages,
    ]);
  }

  throw new Error("Formato não suportado. Use .docx, .txt ou .md.");
}
