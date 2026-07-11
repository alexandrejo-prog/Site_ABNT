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
import { ImportedTable, importedTableMarker } from "./imported-tables";

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
  importedTables: ImportedTable[];
  workTypeSuggestion?: WorkTypeSuggestion;
}

const DECORATIVE_SECTION_NAMES = new Set([
  "CAPA",
  "FOLHA DE ROSTO",
  "FICHA CATALOGRAFICA",
  "FOLHA DE APROVACAO",
]);

function isLikelyZipFile(arrayBuffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function docxOpenError(fileName: string): Error {
  return new Error(
    `Nao foi possivel abrir "${fileName}" como DOCX valido. O arquivo pode estar corrompido, incompleto ou em formato .doc antigo renomeado para .docx. Abra o arquivo no Word ou LibreOffice, use "Salvar como" > "Documento do Word (.docx)" e tente importar novamente.`,
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

function detectWorkTypeSuggestion(text: string, fields: AcademicFields): WorkTypeSuggestion | undefined {
  if (fields.workType === "projeto_pesquisa") return undefined;
  if (!looksLikeResearchProject(text, fields)) return undefined;
  return {
    workType: "projeto_pesquisa",
    confidence: "media",
    message: "O sistema detectou possivel Projeto de pesquisa. Aplicar este tipo?",
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
  return /^(Figura|Imagem|Graf|Grafico|Quadro|Tabela)\s+\d+\s*[-–—]/i.test(text.trim());
}

function looksLikeImageSource(text: string): boolean {
  return /^Fonte\s*:/i.test(text.trim());
}

function looksLikeTableCaption(text: string): boolean {
  return /^(Quadro|Tabela|Graf|Grafico)\s+\d+\s*[-–—]/i.test(text.trim());
}

function looksLikeTableSource(text: string): boolean {
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

function isDecorativeImageBlock(block: ImportedBlock): boolean {
  if (block.type !== "image") return false;
  const target = normalizeForDetection(block.target || block.fileName || "");
  return DECORATIVE_SECTION_NAMES.has(normalizeForDetection(block.section || "")) || target.includes("logo");
}

function classifyAcademicImage(block: ImportedBlock, index: number, blocks: ImportedBlock[]): boolean {
  if (block.type !== "image") return false;
  if (isDecorativeImageBlock(block)) return false;

  const caption = nearestText(blocks, index, -1, looksLikeImageCaption);
  const source = nearestText(blocks, index, 1, looksLikeImageSource);
  if (!caption && !source) return false;

  const bodyIndex = blocks.findIndex((b) => /1\s+INTRODUCAO/i.test(blockText(b)));
  if (bodyIndex < 0) return false;
  if (index < bodyIndex) return false;

  return true;
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
    if (!classifyAcademicImage(block, index, structure.blocks)) return;

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

function importedTablesFromStructure(structure: DocxStructure): ImportedTable[] {
  const imported: ImportedTable[] = [];

  structure.blocks.forEach((block, index) => {
    if (block.type !== "table") return;

    const rows = block.rows.filter((row) => row.some((cell) => cell.trim()));
    if (!rows.length) {
      imported.push({
        id: `tbl-${imported.length + 1}`,
        rows: [],
        rowCount: 0,
        columnCount: 0,
        position: index,
        origin: "docx-table",
        status: "ignored-empty-table",
      });
      return;
    }

    const columnCount = Math.max(...rows.map((row) => row.length), 1);
    const caption = nearestText(structure.blocks, index, -1, looksLikeTableCaption);
    const source = nearestText(structure.blocks, index, 1, looksLikeTableSource);

    imported.push({
      id: `tbl-${imported.length + 1}`,
      rows,
      rowCount: rows.length,
      columnCount,
      caption: caption || undefined,
      source: source || undefined,
      position: index,
      origin: "docx-table",
      status: "preserved",
    });
  });

  return imported;
}

function isEditorHeading(block: ImportedBlock): boolean {
  if (block.type !== "heading") return false;
  const normalized = normalizeForDetection(block.text);
  return /^(\d+(?:\.\d+)*)\s+\S+/.test(normalized) || normalized === "INTRODUCAO";
}

function isReferenceOrPostTextual(block: ImportedBlock): boolean {
  const normalized = normalizeForDetection(blockText(block));
  return /^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized);
}

function editorTextWithImageMarkers(
  blocks: ImportedBlock[],
  fallbackEditorText: string,
  importedImages: ImportedDocumentImage[],
  importedTables: ImportedTable[],
): string {
  if (!importedImages.length && !importedTables.length) return fallbackEditorText;
  const appendMissingPreserved = (
    output: string,
    emittedImageIds: Set<string>,
    emittedTableIds: Set<string>,
  ): string => {
    const missingPreservedImages = importedImages.filter(
      (image) => image.status === "preserved" && !emittedImageIds.has(image.id),
    );
    const missingPreservedTables = importedTables.filter(
      (table) => table.status === "preserved" && !emittedTableIds.has(table.id),
    );

    const appended: string[] = [];
    for (const image of missingPreservedImages) {
      appended.push(
        "Imagem detectada, mas nao inserida automaticamente por baixa confianca de posicionamento. Revise e reinsira manualmente se necessario.",
      );
      if (image.caption) appended.push(image.caption);
      appended.push(importedImageMarker(image.id));
      if (image.source) appended.push(image.source);
    }
    for (const table of missingPreservedTables) {
      if (table.caption) appended.push(table.caption);
      appended.push(importedTableMarker(table.id));
      if (table.source) appended.push(table.source);
    }

    if (!appended.length) return repairHeadingFragments(output);

    return repairHeadingFragments([output, ...appended].filter(Boolean).join("\n\n"));
  };

  const imagesByPosition = new Map(importedImages.map((image) => [image.position, image]));
  const tablesByPosition = new Map(importedTables.map((table) => [table.position, table]));
  const start = blocks.findIndex((block) => {
    const normalized = normalizeForDetection(blockText(block));
    return normalized === "1 INTRODUCAO" || normalized === "INTRODUCAO";
  });
  if (start < 0) return appendMissingPreserved(fallbackEditorText, new Set(), new Set());

  const lines: string[] = [];
  const emittedImageIds = new Set<string>();
  const emittedTableIds = new Set<string>();
  let sawConclusion = false;
  let tocArtifactMode = false;
  for (let index = start; index < blocks.length; index += 1) {
    const block = blocks[index];
    const normalized = normalizeForDetection(blockText(block));
    if (/^(CONCLUSAO|CONCLUSÃO|CONSIDERACOES FINAIS|CONSIDERAÇÕES FINAIS)\b/.test(normalized)) {
      sawConclusion = true;
    }
    if (/^(REFERENCIAS|ANEXOS|ANEXO|APENDICES|APENDICE)\b/.test(normalized)) {
      if (sawConclusion) break;
      if (!tocArtifactMode) {
        const nextBlocks = blocks.slice(index + 1, index + 6);
        const looksLikeTocArtifact = nextBlocks.some(
          (next) => /^(Na Introdução|Na seção|Nos Resultados|Já na Conclusão|Na Introducao|Na secao|REFERENCIAL TEORICO|REFERENCIAL TEÓRICO)\b/i.test(blockText(next)),
        );
        if (looksLikeTocArtifact) {
          tocArtifactMode = true;
          continue;
        }
      }
    }
    if (tocArtifactMode) {
      if (block.type === "heading") {
        tocArtifactMode = false;
        if (isReferenceOrPostTextual(block)) continue;
      } else {
        continue;
      }
    }
    if (isReferenceOrPostTextual(block) && sawConclusion) break;
    if (block.type === "pageBreak") continue;

    if (block.type === "image") {
      const image = imagesByPosition.get(index);
      if (image?.status === "preserved") {
        lines.push(importedImageMarker(image.id));
        emittedImageIds.add(image.id);
      }
      continue;
    }

    if (block.type === "table") {
      const table = tablesByPosition.get(index);
      if (table?.status === "preserved") {
        lines.push(importedTableMarker(table.id));
        emittedTableIds.add(table.id);
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
  return appendMissingPreserved(output, emittedImageIds, emittedTableIds);
}

function buildImportResult(
  normalized: ReturnType<typeof normalizePlainAcademicText>,
  detected: ReturnType<typeof detectAcademicFieldsFromStructure>,
  messages: string[],
): ImportResult {
  const text = repairHeadingFragments(normalized.text);
  const importedImages = importedImagesFromStructure(normalized.structure);
  const importedTables = importedTablesFromStructure(normalized.structure);
  const editorText = editorTextWithImageMarkers(
    normalized.structure.blocks,
    repairHeadingFragments(detected.editorText || text),
    importedImages,
    importedTables,
  );
  const fields = sanitizeFields(repairRecordHeadingFragments(detected.fields));
  const confidence = sanitizeConfidence(detected.confidence, fields);
  const workTypeSuggestion = detectWorkTypeSuggestion(text, fields);
  const preservedImages = importedImages.filter((image) => image.status === "preserved").length;
  const missingImages = importedImages.filter((image) => image.status === "detected-but-not-preserved").length;
  const preservedTables = importedTables.filter((table) => table.status === "preserved").length;
  const missingTables = importedTables.filter((table) => table.status === "detected-but-not-preserved").length;
  const imageMessages = [
    preservedImages
      ? `${preservedImages} imagem(ns) importada(s) e preservada(s) no rascunho. Revise posicao, legenda e fonte antes da versao final.`
      : "",
    missingImages
      ? `${missingImages} imagem(ns) detectada(s), mas nem todas puderam ser preservadas automaticamente. Reinsira manualmente as imagens ausentes e confira legendas e fontes.`
      : "",
  ].filter(Boolean);
  const tableMessages = [
    preservedTables
      ? `${preservedTables} tabela(s)/quadro(s) importada(s) e preservada(s) no rascunho. Revise estrutura, legenda e fonte antes da versao final.`
      : "",
    missingTables
      ? `${missingTables} tabela(s)/quadro(s) detectada(s), mas nao preservada(s) automaticamente. Reinsira manualmente as tabelas ausentes se necessario.`
      : "",
  ].filter(Boolean);
  if (preservedImages || missingImages) {
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
    messages: [...nonImageMessages, ...imageMessages, ...tableMessages],
    blocks: normalized.structure.blocks,
    importedImages,
    importedTables,
    workTypeSuggestion,
  };
}

export function identifyAcademicFields(
  text: string,
): Omit<ImportResult, "text" | "editorText" | "messages" | "blocks" | "importedImages" | "importedTables"> {
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
      messages.push("Mammoth nao conseguiu extrair texto bruto; tentando estrutura OOXML.");
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
          "Nao foi possivel ler a estrutura OOXML; o arquivo foi importado apenas como texto bruto.",
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

  throw new Error("Formato nao suportado. Use .docx, .txt ou .md.");
}
