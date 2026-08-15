/**
 * Verifica que o DOCX gerado de um formato da Coleção Produção Acadêmica UFLA
 * contém conteúdo para TODOS os requiredFields da sua definição própria
 * (src/academic-production-types.ts) — "aplicar somente as regras pertinentes".
 *
 * - Campos-seção (introdução, metodologia, conclusão, referencial teórico):
 *   o heading da seção deve existir no documento.
 * - Campos de conteúdo (autor, título, resumo, referências, palavras-chave,
 *   curso, justificativa, cronograma, objetivos, resultados): o valor (ou um
 *   fragmento significativo) deve aparecer no texto do documento.
 */
import { existsSync } from "node:fs";
import AdmZip from "adm-zip";
import type { AcademicFieldKey } from "../../src/ufla-rules";
import type { ProductionFixture } from "./per-production-fixtures";

const SECTION_HEADING: Record<string, string> = {
  introducao: "INTRODUCAO",
  metodologia: "METODOLOGIA",
  conclusao: "CONCLUSAO",
  referencialTeorico: "REFERENCIAL TEORICO",
};

export interface ProductionContentCheck {
  passed: boolean;
  missing: AcademicFieldKey[];
  checked: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza para comparação tolerando a reformatação ABNT (espaços antes de pontuação). */
function normalizeForMatch(value: string): string {
  return normalize(value).replace(/\s+([.,;:])\)?/g, "$1");
}

/** Fragmento significativo do valor de um campo de conteúdo (primeira linha). */
function contentFragment(field: AcademicFieldKey, fixture: ProductionFixture): string {
  const value = (fixture.fields as unknown as Record<string, string>)[field] ?? "";
  const firstLine = value.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return normalizeForMatch(firstLine);
}

export function expectedContentFor(field: AcademicFieldKey, fixture: ProductionFixture): string | undefined {
  if (SECTION_HEADING[field]) return SECTION_HEADING[field];
  const fragment = contentFragment(field, fixture);
  return fragment.length >= 3 ? fragment : undefined;
}

export function verifyProductionFormatContent(docxPath: string, fixture: ProductionFixture): ProductionContentCheck {
  const missing: AcademicFieldKey[] = [];
  if (!existsSync(docxPath)) {
    return { passed: false, missing: [...fixture.def.requiredFields], checked: fixture.def.requiredFields.length };
  }

  const zip = new AdmZip(docxPath);
  const xml = zip.readAsText("word/document.xml");
  const texts = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
  const docText = normalizeForMatch(texts.join(" "));

  for (const field of fixture.def.requiredFields) {
    const expected = expectedContentFor(field, fixture);
    if (expected && !docText.includes(expected)) missing.push(field);
  }

  return { passed: missing.length === 0, missing, checked: fixture.def.requiredFields.length };
}
