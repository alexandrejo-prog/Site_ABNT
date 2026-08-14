import type { ImportedTable, ImportedTableCell } from "./imported-tables";
import { normalizeForDetection } from "./word-structure-extractor";

export type AcademicTablePattern =
  | "grouped-with-authors"
  | "advantages-disadvantages"
  | "critical-points"
  | "chronological"
  | "indicators"
  | "profile"
  | "questionnaire-results"
  | "generic-academic"
  | "unreconstructable";

export interface ReconstructedAcademicTableRow {
  group?: string;
  cells: string[];
}

export interface ReconstructedAcademicTable {
  pattern: AcademicTablePattern;
  confidence: "high" | "medium" | "low";
  caption?: string;
  headers: string[];
  rows: ReconstructedAcademicTableRow[];
  source?: string;
  warnings: string[];
}

const GROUP_HINTS = [
  "categoria",
  "grupo",
  "organizacao",
  "organização",
  "trabalhador",
  "trabalhadores",
  "servidores",
  "gestores",
  "instituicao",
  "instituição",
  "dimensao",
  "dimensão",
  "aspecto",
  "perfil",
];

const CONTENT_HEADER_LABELS: Record<string, string[]> = {
  Vantagens: ["vantagem", "vantagens", "beneficio", "benefícios", "beneficios", "aspectos positivos"],
  Desvantagens: ["desvantagem", "desvantagens", "limitacao", "limitação", "limitações", "limitacoes", "aspectos negativos"],
  "Pontos críticos": ["pontos criticos", "pontos críticos", "desafios", "problemas", "barreiras"],
  Indicadores: ["indicador", "indicadores", "criterio", "critério", "resultado"],
  Descrição: ["descricao", "descrição", "norma", "legislacao", "legislação", "evento", "marco"],
  Resultado: ["resposta", "frequencia", "frequência", "percentual", "media", "média", "concordancia", "concordância"],
};

function cellText(cell: ImportedTableCell | undefined): string {
  return normalizeAcademicTableText(cell?.text ?? "");
}

function fold(value: string): string {
  return normalizeForDetection(value).toLowerCase();
}

function rowTexts(row: ImportedTableCell[]): string[] {
  return row.map(cellText);
}

function nonEmptyRows(table: ImportedTable): string[][] {
  return table.rows.map(rowTexts).filter((row) => row.some(Boolean));
}

export function normalizeAcademicTableText(value: string): string {
  const lines = value
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length <= 1) return lines[0] ?? value.replace(/\s+/g, " ").trim();

  const result: string[] = [];
  for (const line of lines) {
    const previous = result[result.length - 1];
    if (
      previous &&
      !/[.;:!?)]$/.test(previous) &&
      !/^(?:[-–—•]|\d+[.)])\s*/.test(line) &&
      /^[a-zà-ú]/.test(line)
    ) {
      result[result.length - 1] = `${previous}${line}`;
      continue;
    }
    result.push(line);
  }

  return result.join("; ").replace(/\s+/g, " ").trim();
}

const HEADER_VOCABULARY_RE =
  /(categoria|grupo|fase|fases|caracter[ií]sticas?|vantagens?|desvantagens?|pontos cr[ií]ticos|autores?|refer[eê]ncias?|fonte|ano|data|norma|indicador|perfil|quest[aã]o|resposta|frequ[eê]ncia|percentual)/i;

/**
 * Detecta a linha de cabeçalho APENAS por vocabulário de coluna acadêmica.
 *
 * Sem vocabulário (ex.: "Instituição | Tipo de Documento | De quando | De
 * quem | Endereço eletrônico"), a primeira linha NÃO é tratada como cabeçalho:
 * a tabela permanece editable-table e é preservada integralmente. Uma heurística
 * de "rótulos curtos em todas as colunas" reclassificava tabelas como o
 * Quadro 2 da dissertação como grouped-with-authors, descartando a linha de
 * cabeçalho e embaralhando colunas no round-trip vivo (regressão 2026-08-14).
 */
export function detectAcademicTableHeader(table: ImportedTable): { headers: string[]; rowIndex: number } {
  const rows = nonEmptyRows(table);
  if (!rows.length) return { headers: [], rowIndex: 0 };
  const first = rows[0].map((text) => text.trim());
  const meaningful = first.filter(Boolean);
  const hasHeaderVocabulary = meaningful.some((text) => HEADER_VOCABULARY_RE.test(text));
  return hasHeaderVocabulary ? { headers: first, rowIndex: 0 } : { headers: [], rowIndex: 0 };
}

export function detectAcademicTableHeaders(table: ImportedTable): string[] {
  return detectAcademicTableHeader(table).headers;
}

function columnValues(table: ImportedTable, columnIndex: number, skipHeader = true): string[] {
  const start = skipHeader ? 1 : 0;
  return table.rows.slice(start).map((row) => cellText(row[columnIndex])).filter(Boolean);
}

export function detectAuthorsColumn(table: ImportedTable): number {
  const headers = detectAcademicTableHeaders(table);
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < table.columnCount; index += 1) {
    const header = fold(headers[index] ?? "");
    const values = columnValues(table, index);
    let score = 0;
    if (/(autor|autores|referencia|referencias|fonte|base teorica)/.test(header)) score += 3;
    for (const value of values) {
      if (/\b(?:19|20)\d{2}\b/.test(value)) score += 1;
      if (/\bet\s+al\./i.test(value)) score += 1;
      if (/[A-ZÁ-Ú][a-zá-ú]+(?:\s+e\s+[A-ZÁ-Ú][a-zá-ú]+)?\s*\((?:19|20)\d{2}\)/.test(value)) score += 2;
      if (/[A-ZÁ-Ú][A-Za-zÀ-ú]+;\s*[A-ZÁ-Ú]/.test(value)) score += 1;
      if (/^brasil\s*\((?:19|20)\d{2}\)/i.test(value)) score += 2;
      if (/^fonte\s*:/i.test(value)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 2 ? bestIndex : -1;
}

export function detectGroupColumn(table: ImportedTable): number {
  const headers = detectAcademicTableHeaders(table);
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < Math.min(table.columnCount, 3); index += 1) {
    const values = table.rows.slice(1).map((row) => cellText(row[index]));
    const nonEmpty = values.filter(Boolean);
    if (!nonEmpty.length) continue;
    const distinct = new Set(nonEmpty.map(fold));
    const shortRatio = nonEmpty.filter((value) => value.length <= 40).length / nonEmpty.length;
    const emptyRatio = values.filter((value) => !value).length / Math.max(values.length, 1);
    const header = fold(headers[index] ?? "");
    const hintScore = GROUP_HINTS.some((hint) => header.includes(fold(hint))) ? 2 : 0;
    const categoryScore = nonEmpty.filter((value) => GROUP_HINTS.some((hint) => fold(value).includes(fold(hint)))).length;
    const score = hintScore + categoryScore + (distinct.size <= Math.max(4, nonEmpty.length / 2) ? 1 : 0) + (shortRatio >= 0.7 ? 1 : 0) + (emptyRatio >= 0.2 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 2 ? bestIndex : -1;
}

export function detectContentColumn(table: ImportedTable): number {
  const authors = detectAuthorsColumn(table);
  const group = detectGroupColumn(table);
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < table.columnCount; index += 1) {
    if (index === authors || index === group) continue;
    const values = columnValues(table, index);
    const score = values.reduce((sum, value) => sum + Math.min(value.length, 120), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function detectSourceText(table: ImportedTable): string | undefined {
  return table.source || table.rows.flatMap(rowTexts).find((text) => /^fonte\s*:/i.test(text));
}

function headerIncludes(headers: string[], words: string[]): boolean {
  const text = fold(headers.join(" "));
  return words.some((word) => text.includes(fold(word)));
}

export function isGroupedAcademicTable(table: ImportedTable): boolean {
  const headers = detectAcademicTableHeaders(table);
  const firstHeader = fold(headers[0] ?? "");
  const explicitGroupHeader = /(categoria|grupo|dimensao|dimensão|aspecto|perfil)/.test(firstHeader);
  return (detectGroupColumn(table) >= 0 || explicitGroupHeader) && detectContentColumn(table) >= 0;
}

export function isAcademicTableWithAuthors(table: ImportedTable): boolean {
  return detectAuthorsColumn(table) >= 0;
}

export function isChronologicalAcademicTable(table: ImportedTable): boolean {
  return headerIncludes(detectAcademicTableHeaders(table), ["ano", "data", "norma", "legislação", "legislacao", "marco", "evento"]);
}

export function isIndicatorAcademicTable(table: ImportedTable): boolean {
  return headerIncludes(detectAcademicTableHeaders(table), ["indicador", "dimensão", "dimensao", "categoria", "critério", "criterio", "resultado", "frequência", "frequencia"]);
}

export function isProfileAcademicTable(table: ImportedTable): boolean {
  return headerIncludes(detectAcademicTableHeaders(table), ["perfil", "sexo", "faixa etária", "faixa etaria", "escolaridade", "cargo", "tempo", "lotação", "lotacao"]);
}

function contentHeader(headers: string[], fallback = "Conteúdo"): string {
  const joined = fold(headers.join(" "));
  for (const [label, needles] of Object.entries(CONTENT_HEADER_LABELS)) {
    if (needles.some((needle) => joined.includes(fold(needle)))) return label;
  }
  return fallback;
}

export function classifyAcademicTablePattern(table: ImportedTable): AcademicTablePattern {
  const headers = detectAcademicTableHeaders(table);
  if (!headers.length && table.rowCount < 3) return "unreconstructable";
  if (headerIncludes(headers, ["vantagem", "benefício", "beneficio", "desvantagem"])) return "advantages-disadvantages";
  if (headerIncludes(headers, ["pontos críticos", "pontos criticos", "desafios", "barreiras", "problemas"])) return "critical-points";
  if (isGroupedAcademicTable(table) && isAcademicTableWithAuthors(table)) return "grouped-with-authors";
  if (isChronologicalAcademicTable(table)) return "chronological";
  if (isProfileAcademicTable(table)) return "profile";
  if (headerIncludes(headers, ["questão", "questao", "resposta", "percentual", "média", "media", "concordância", "concordancia"])) return "questionnaire-results";
  if (isIndicatorAcademicTable(table)) return "indicators";
  if (isGroupedAcademicTable(table)) return "generic-academic";
  return "unreconstructable";
}

export function reconstructGroupedAcademicTable(table: ImportedTable): ReconstructedAcademicTable {
  const { headers, rowIndex: headerRowIndex } = detectAcademicTableHeader(table);
  const headerSourceRow = headers.length ? headerRowIndex : -1;
  const groupIndex = Math.max(0, detectGroupColumn(table));
  const authorsIndex = detectAuthorsColumn(table);
  const contentIndex = detectContentColumn(table);
  const contentLabel = contentHeader(headers);
  const rows: ReconstructedAcademicTableRow[] = [];
  let currentGroup = "";

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    if (rowIndex === headerSourceRow) continue;
    const row = table.rows[rowIndex];
    const group = cellText(row[groupIndex]);
    const content = cellText(row[contentIndex]);
    const authors = authorsIndex >= 0 ? cellText(row[authorsIndex]) : "";
    if (group) currentGroup = group;
    if (!content && !authors) continue;
    rows.push({
      group: currentGroup,
      cells: [currentGroup, content, authors],
    });
  }

  const hasAuthors = authorsIndex >= 0 && rows.some((row) => row.cells[2]);
  const confidence = rows.length >= 2 && contentIndex >= 0 && hasAuthors ? "high" : rows.length >= 2 ? "medium" : "low";
  return {
    pattern: classifyAcademicTablePattern(table),
    confidence,
    caption: table.caption,
    headers: ["Grupo", contentLabel, "Autores"],
    rows,
    source: detectSourceText(table),
    warnings: ["Quadro/tabela reconstruído semanticamente a partir de documento convertido. Revise o layout manualmente."],
  };
}

export function reconstructGenericAcademicTable(table: ImportedTable): ReconstructedAcademicTable {
  const { headers, rowIndex: headerRowIndex } = detectAcademicTableHeader(table);
  const headerSourceRow = headers.length ? headerRowIndex : -1;
  const source = detectSourceText(table);
  const columnCount = Math.max(1, table.columnCount);
  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => {
    const header = normalizeAcademicTableText(headers[index] ?? "");
    return header || "";
  });
  const rows: ReconstructedAcademicTableRow[] = [];

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    if (rowIndex === headerSourceRow) continue;
    const cells = Array.from({ length: columnCount }, (_, index) => cellText(table.rows[rowIndex]?.[index]));
    if (!cells.some(Boolean)) continue;
    rows.push({ cells });
  }

  return {
    pattern: "generic-academic",
    confidence: rows.length >= 2 ? "medium" : "low",
    caption: table.caption,
    headers: normalizedHeaders,
    rows,
    source,
    warnings: ["Quadro/tabela reconstruÃ­do semanticamente a partir de documento convertido. Revise o layout manualmente."],
  };
}

export function reconstructStructuredTextFallback(table: ImportedTable): ReconstructedAcademicTable {
  const rows = nonEmptyRows(table).map((row) => ({ cells: [row.filter(Boolean).join("; ")] }));
  return {
    pattern: "unreconstructable",
    confidence: rows.length ? "low" : "low",
    caption: table.caption,
    headers: ["Conteúdo"],
    rows,
    source: detectSourceText(table),
    warnings: ["Tabela importada com estrutura frágil. Revise manualmente."],
  };
}

export function reconstructAcademicTable(table: ImportedTable): ReconstructedAcademicTable {
  const pattern = classifyAcademicTablePattern(table);
  if (
    pattern === "grouped-with-authors" ||
    pattern === "advantages-disadvantages" ||
    pattern === "critical-points"
  ) {
    return reconstructGroupedAcademicTable(table);
  }
  if (pattern === "generic-academic") return reconstructGenericAcademicTable(table);

  return reconstructStructuredTextFallback(table);
}
