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
  DocxStructure,
  extractDocxStructure,
  normalizeForDetection,
} from "./word-structure-extractor";
import {
  normalizeImportedStructure,
  normalizePlainAcademicText,
} from "./import-normalizer";
import { repairHeadingFragments, repairRecordHeadingFragments } from "./heading-fragment-repair";
import { sanitizeImportedTitle } from "./title-sanitizer";
import { ImportedDocumentImage, importedImageMarker } from "./imported-images";

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
  importedImages: ImportedDocumentImage[];
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

function blockText(block: ImportedBlock): string {
  if (block.type === "pageBreak" || block.type === "image") return "";
  if (block.type === "table") return block.rows.map((row) => row.join("\t")).join("\n");
  return block.text.trim();
}

function looksLikeImageCaption(text: string): boolean {
  return /^(Figura|Imagem|Gr[aá]fico|Grafico|Quadro|Tabela)\s+\d+\s*[-–—]/i.test(text.trim());
}

function looksLikeImageSource(text: string): boolean {
  return /^Fonte\s*:/i.test(text.trim());
}

function nearestText(
  blocks: ImportedBlock[],
  startIndex: number,
  direction: -1 | 1,
  predicate: (text: string) => boolean,
): string {
  for (let offset = 1; offset <= 3; offset += 1) {
    const block = blocks[startIndex + offset * direction];
    if (!block || block.type === "pageBreak") break;
    const text = blockText(block);
    if (text && predicate(text)) return text;
  }
  return "";
}

function importedImagesFromStructure(structure: DocxStructure): ImportedDocumentImage[] {
  const assetsByRelationship = new Map(
    structure.images
      .filter((image) => image.relationshipId)
      .map((image) => [image.relationshipId as string, image]),
  );
  const assetsByTarget = new Map(structure.images.map((image) => [image.target, image]));
  const seen = new Set<string>();
  const imported: ImportedDocumentImage[] = [];

  structure.blocks.forEach((block, index) => {
    if (block.type !== "image") return;

    const asset =
      (block.relationshipId ? assetsByRelationship.get(block.relationshipId) : undefined) ||
      (block.target ? assetsByTarget.get(block.target) : undefined);
    const dedupeKey = asset?.target ?? block.target ?? block.relationshipId ?? `image-${index}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const id = `img-${imported.length + 1}`;
    const data = asset?.data;
    imported.push({
      id,
      relationshipId: block.relationshipId,
      target: asset?.target ?? block.target,
      fileName: asset?.fileName,
      mimeType: asset?.mimeType,
      data,
      caption: nearestText(structure.blocks, index, -1, looksLikeImageCaption),
      source: nearestText(structure.blocks, index, 1, looksLikeImageSource),
      position: index,
      status: data?.byteLength ? "preserved" : "detected-but-not-preserved",
    });
  });

  return imported;
}

function isEditorHeading(block: ImportedBlock): boolean {
  if (block.type !== "heading") return false;
  const normalized = normalizeForDetection(block.text);
  return (
    /^(\d+(?:\.\d+)*)\s+\S+/.test(normalized) ||
    normalized === "INTRODUCAO" ||
    normalized === "INTRODUÇÃO"
  );
}

function isReferenceOrPostTextual(block: ImportedBlock): boolean {
  const normalized = normalizeForDetection(blockText(block));
  return /^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized);
}

function editorTextWithImageMarkers(
  blocks: ImportedBlock[],
  fallbackEditorText: string,
  importedImages: ImportedDocumentImage[],
): string {
  if (!importedImages.length) return fallbackEditorText;
  const appendMissingImages = (output: string, emittedImageIds: Set<string>): string => {
    const missingPreservedImages = importedImages.filter(
      (image) => image.status === "preserved" && !emittedImageIds.has(image.id),
    );
    if (!missingPreservedImages.length) return repairHeadingFragments(output);

    const appendedImages = missingPreservedImages.flatMap((image) => [
      image.caption ?? "",
      importedImageMarker(image.id),
      image.source ?? "",
    ]).filter(Boolean);

    return repairHeadingFragments([output, ...appendedImages].filter(Boolean).join("\n\n"));
  };

  const imagesByPosition = new Map(importedImages.map((image) => [image.position, image]));
  const start = blocks.findIndex((block) => {
    const normalized = normalizeForDetection(blockText(block));
    return normalized === "1 INTRODUCAO" || normalized === "INTRODUCAO";
  });
  if (start < 0) return appendMissingImages(fallbackEditorText, new Set());

  const lines: string[] = [];
  const emittedImageIds = new Set<string>();
  for (let index = start; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (isReferenceOrPostTextual(block)) break;
    if (block.type === "pageBreak") continue;

    if (block.type === "image") {
      const image = imagesByPosition.get(index);
      if (image?.status === "preserved") {
        lines.push(importedImageMarker(image.id));
        emittedImageIds.add(image.id);
      }
      continue;
    }

    if (block.type === "heading") {
      lines.push(`${block.level <= 1 || isEditorHeading(block) ? "#" : "##"} ${block.text}`);
      continue;
    }

    if (block.type === "longQuote") {
      lines.push(`> ${block.text}`);
      continue;
    }

    const text = blockText(block);
    if (text) lines.push(text);
  }

  const output = lines.join("\n\n").trim() || fallbackEditorText;
  return appendMissingImages(output, emittedImageIds);
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
): ImportResult {
  const text = repairHeadingFragments(normalized.text);
  const importedImages = importedImagesFromStructure(normalized.structure);
  const editorText = editorTextWithImageMarkers(
    normalized.structure.blocks,
    repairHeadingFragments(detected.editorText || text),
    importedImages,
  );
  const fields = sanitizeFields(repairRecordHeadingFragments(detected.fields));
  const confidence = sanitizeConfidence(detected.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(text, fields);
  const preservedCount = importedImages.filter((image) => image.status === "preserved").length;
  const missingCount = importedImages.filter((image) => image.status === "detected-but-not-preserved").length;
  const imageMessages = [
    preservedCount
      ? `${preservedCount} imagem(ns) importada(s) e preservada(s) no rascunho. Revise posição, legenda e fonte antes da versão final.`
      : "",
    missingCount
      ? `${missingCount} imagem(ns) detectada(s), mas nem todas puderam ser preservadas automaticamente. Reinsira manualmente as imagens ausentes e confira legendas e fontes.`
      : "",
  ].filter(Boolean);
  if (preservedCount || missingCount) {
    fields.imageWarnings = imageMessages.join(" ");
  }
  const nonImageMessages = messages.filter(
    (message) => !/imagem\(ns\) detectada\(s\)|imagem\(ns\) importada\(s\)/i.test(message),
  );

  return {
    text,
    editorText,
    fields,
    confidence,
    messages: [...nonImageMessages, ...imageMessages],
    blocks: normalized.structure.blocks,
    importedImages,
    workTypeSuggestion,
  };
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks" | "importedImages"> {
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
      const structure = await extractDocxStructure(arrayBuffer, { includeMediaData: true });
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
