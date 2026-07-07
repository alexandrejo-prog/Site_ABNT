import * as mammoth from "mammoth/mammoth.browser";
import { detectAcademicFieldsFromStructure } from "./field-detector";
import {
  AcademicFieldKey,
  AcademicFields,
  Confidence,
  WorkTypeValue,
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
import { repairHeadingFragments, repairRecordHeadingFragments } from "./heading-fragment-repair";
import { sanitizeImportedTitle } from "./title-sanitizer";

export interface WorkTypeSuggestion {
  workType: WorkTypeValue;
  confidence: Confidence;
  message: string;
}

export interface ImportResult {
  text: string;
  editorText: string;
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  messages: string[];
  blocks: ImportedBlock[];
  workTypeSuggestion?: WorkTypeSuggestion;
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

// Não reclassifica o workType automaticamente. Apenas sugere quando o texto
// parece projeto de pesquisa e o trabalho ainda não é desse tipo.
function detectWorkTypeSuggestion(text: string, fields: AcademicFields): WorkTypeSuggestion | undefined {
  if (fields.workType === "projeto_pesquisa") return undefined;
  if (!looksLikeResearchProject(text, fields)) return undefined;
  return {
    workType: "projeto_pesquisa",
    confidence: "media",
    message: "O sistema detectou possível Projeto de pesquisa. Aplicar este tipo?",
  };
}

function sanitizeFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    title: sanitizeImportedTitle(fields.title),
  };
}

function sanitizeConfidence(
  confidence: Record<AcademicFieldKey, Confidence>,
  fields: AcademicFields,
): Record<AcademicFieldKey, Confidence> {
  return {
    ...confidence,
    title: fields.title ? confidence.title : "nao-identificado",
  };
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
): ImportResult {
  const text = repairHeadingFragments(normalized.text);
  const editorText = repairHeadingFragments(detected.editorText || text);
  const fields = sanitizeFields(repairRecordHeadingFragments(detected.fields));
  const confidence = sanitizeConfidence(detected.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(text, fields);

  return {
    text,
    editorText,
    fields,
    confidence,
    messages,
    blocks: normalized.structure.blocks,
    workTypeSuggestion,
  };
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks"> {
  const normalized = normalizePlainAcademicText(text);
  const identified = detectAcademicFieldsFromStructure(normalized.structure);
  const repairedText = repairHeadingFragments(normalized.text);
  const fields = sanitizeFields(repairRecordHeadingFragments(identified.fields));
  const confidence = sanitizeConfidence(identified.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(repairedText, fields);
  return {
    fields,
    confidence,
    workTypeSuggestion,
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
