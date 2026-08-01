import type { AcademicFieldKey, Confidence } from "../ufla-rules";
import { emptyAcademicFields } from "../ufla-rules";
import type { ImportedDocumentImage } from "../imported-images";
import type { ImportedTable } from "../imported-tables";

export interface ImportResult {
  fields: ReturnType<typeof emptyAcademicFields>;
  confidence: Record<AcademicFieldKey, Confidence>;
  editorText: string;
  messages: string[];
  fileName: string;
  importedImages?: ImportedDocumentImage[];
  importedTables?: ImportedTable[];
}

export function importedFileNameSuggestsOtherType(fileName: string, currentWorkType: string): boolean {
  if (currentWorkType !== "projeto_pesquisa") return false;
  const lower = fileName.toLowerCase();
  return ["desenvolvimento-de-software", "artigo", "monografia", "tese", "dissertacao"].some((kw) => lower.includes(kw));
}
