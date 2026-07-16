import { AcademicFieldKey } from "./ufla-rules";

interface SectionAlias {
  headings: string[];
  fieldKey: AcademicFieldKey;
}

const SECTION_ALIASES: SectionAlias[] = [
  { headings: ["CONCLUSAO", "CONSIDERACOES FINAIS"], fieldKey: "conclusao" },
  { headings: ["REFERENCIAS", "REFERÊNCIAS", "REFERENCIAS BIBLIOGRAFICAS", "REFERÊNCIAS BIBLIOGRÁFICAS"], fieldKey: "referencias" },
  { headings: ["REFERENCIAL TEORICO", "FUNDAMENTACAO TEORICA", "REVISAO BIBLIOGRAFICA"], fieldKey: "referencialTeorico" },
  { headings: ["METODOLOGIA", "PROCEDIMENTOS METODOLICOS", "PROCEDIMENTOS METODOLÓGICOS", "MATERIAL E METODOS", "MATERIAIS E METODOS", "METODOLOGIA E TECNICAS"], fieldKey: "metodologia" },
  { headings: ["OBJETIVO GERAL"], fieldKey: "objetivoGeral" },
  { headings: ["OBJETIVOS ESPECIFICOS", "OBJETIVOS ESPECÍFICOS"], fieldKey: "objetivosEspecificos" },
  { headings: ["RESULTADOS ESPERADOS"], fieldKey: "resultadosEsperados" },
  { headings: ["CRONOGRAMA", "CRONOGRAMA DE EXECUCAO"], fieldKey: "cronograma" },
  { headings: ["REVISAO DA LITERATURA", "ESTADO DA TECNICA"], fieldKey: "referencialTeorico" },
  { headings: ["REIVINDICACOES", "REQUISITOS", "DESENVOLVIMENTO", "ATIVIDADES DESENVOLVIDAS", "PLANO DE EXECUCAO"], fieldKey: "metodologia" },
  { headings: ["JUSTIFICATIVA", "DIAGNOSTICO SITUACIONAL"], fieldKey: "justificativa" },
  { headings: ["RESULTADOS", "RESULTADOS E DISCUSSAO", "DESEMPENHO AGRONOMICO"], fieldKey: "resultadosEsperados" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSectionTitle(value: string): string {
  const normalized = normalize(value);
  return normalized.replace(/^\d+(?:\.\d+)*\.?\s*/, "").trim();
}

export function getSectionKeyFromTitle(title: string): AcademicFieldKey | undefined {
  const normalized = normalizeSectionTitle(title);
  for (const alias of SECTION_ALIASES) {
    if (alias.headings.some((h) => normalize(h) === normalized)) {
      return alias.fieldKey;
    }
  }
  return undefined;
}

export function isEquivalentSectionTitle(title: string, expectedKey: AcademicFieldKey): boolean {
  const alias = SECTION_ALIASES.find((a) => a.fieldKey === expectedKey);
  if (!alias) return false;
  const normalized = normalizeSectionTitle(title);
  return alias.headings.some((h) => normalize(h) === normalized);
}

export function getKnownSectionHeadings(): string[] {
  return SECTION_ALIASES.flatMap((alias) => alias.headings);
}

// Nivel de secao (1..5) derivado de uma linha de titulo do editor,
// espelhando o criterio do exportador DOCX. Aceita tanto numeracao
// explicita (1, 1.1, 1.1.1, ...) quanto prefixos markdown (#, ##, ###),
// para que validacao e exportacao compartilhem a mesma hierarquia.
export function sectionLevelFromHeadingLine(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Numeracao explicita tem precedencia sobre o prefixo markdown.
  if (/^\d+(?:\.\d+){4}(?:\s|$)/.test(trimmed)) return 5;
  if (/^\d+(?:\.\d+){3}(?:\s|$)/.test(trimmed)) return 4;
  if (/^\d+(?:\.\d+){2}(?:\s|$)/.test(trimmed)) return 3;
  if (/^\d+\.\d+(?:\s|$)/.test(trimmed)) return 2;
  if (/^\d+(?:\s|$)/.test(trimmed)) return 1;

  // Prefixos markdown (sem numero): mapeiam para o nivel correspondente.
  const markdown = /^(#{1,5})\s+/.exec(trimmed);
  if (markdown) return markdown[1].length;

  return null;
}

// Lista de niveis de secao presentes no texto do editor, na ordem de leitura.
// Usada por validacao (hierarquia continua) e pelo exportador (se desejado).
export function sectionLevelsFromEditorText(editorText: string): number[] {
  return editorText
    .split(/\r?\n/)
    .map(sectionLevelFromHeadingLine)
    .filter((level): level is number => level !== null);
}

// --- Criterio semantico compartilhado para o XML do DOCX (OOXML) ---

// Extrai o nivel (1..5) de um paragrafo OOXML se ele for um titulo de secao
// (Heading1..Heading5). O criterio espelha sectionLevelFromHeadingLine:
// ambos validacao e exportacao consideram "heading" da mesma forma, evitando
// drift. Retorna null se o paragrafo nao for titulo de secao.
export function headingLevelFromParagraphXml(paragraphXml: string): number | null {
  const styleMatch = /<w:pStyle\b[^>]*\bw:val="(Heading[1-5])"/i.exec(paragraphXml);
  if (!styleMatch) return null;
  return Number(styleMatch[1].replace(/\D/g, ""));
}

export function isHeadingParagraphXml(paragraphXml: string): boolean {
  return headingLevelFromParagraphXml(paragraphXml) !== null;
}

// Divide o document.xml em paragrafos <w:p>...</w:p> completos, de forma
// robusta a atributos fora de ordem. Evita regex guloso que poderia fundir
// paragrafos adjacentes.
export function splitParagraphs(documentXml: string): string[] {
  const paragraphs: string[] = [];
  const regex = /<w:p\b[\s\S]*?<\/w:p>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(documentXml)) !== null) {
    paragraphs.push(match[0]);
  }
  return paragraphs;
}
