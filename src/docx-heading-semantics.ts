/**
 * Classificação semântica de títulos DOCX (Estratégia B).
 *
 * Desde a Estratégia B os títulos do corpo usam estilos próprios `ufla_titulo_*`
 * definidos em word/styles.xml com `w:outlineLvl` (0/1/2). O campo TOC do Word
 * (`\o "1-3"`) captura os títulos pelos outline levels, não pelo nome do estilo.
 * Testes e analisadores devem classificar títulos pela semântica
 * (estilo aplicado + outlineLvl resolvido em styles.xml), mantendo compatibilidade
 * com os estilos legados Heading1/2/3 (ex.: exportador CPG ainda os usa).
 */

export type HeadingLevel = 1 | 2 | 3;

/** Estilos nativos do Word herdados (documentos legados e exportador CPG). */
export const LEGACY_HEADING_LEVELS: Readonly<Record<string, HeadingLevel>> = {
  Heading1: 1,
  Heading2: 2,
  Heading3: 3,
  // styleId numérico usado por alguns produtores Word para títulos nativos.
  "1": 1,
  "2": 2,
  "3": 3,
};

/**
 * Mapa canônico dos estilos próprios da Estratégia B para o nível semântico.
 * `ufla_titulo_sem_indicativo`, `ufla_anexo_titulo` e `ufla_apendice_titulo`
 * são títulos de nível 1 sem indicativo numérico (RESUMO, SUMÁRIO, REFERÊNCIAS,
 * ANEXOS, APÊNDICES).
 */
export const UFLA_STYLE_HEADING_LEVELS: Readonly<Record<string, HeadingLevel>> = {
  ufla_titulo_primario: 1,
  ufla_titulo_secundario: 2,
  ufla_titulo_terciario: 3,
  ufla_titulo_sem_indicativo: 1,
  ufla_anexo_titulo: 1,
  ufla_apendice_titulo: 1,
};

/** Outline level (0-based) esperado para cada estilo próprio. */
export const UFLA_STYLE_EXPECTED_OUTLINE_LEVEL: Readonly<Record<string, number>> = {
  ufla_titulo_primario: 0,
  ufla_titulo_secundario: 1,
  ufla_titulo_terciario: 2,
  ufla_titulo_sem_indicativo: 0,
  ufla_anexo_titulo: 0,
  ufla_apendice_titulo: 0,
};

export interface HeadingStyleResolution {
  /** w:pStyle w:val do parágrafo (null quando ausente). */
  styleId: string | null;
  /** Outline level resolvido (styles.xml ou direto no parágrafo). */
  outlineLevel: number | null;
  /** Nível semântico 1..3, ou null quando o parágrafo não é título válido. */
  level: HeadingLevel | null;
  /** true quando veio de estilo legado Heading1/2/3 (aceito pelo nome). */
  legacy: boolean;
  /**
   * Problemas de hierarquia: estilo inexistente em styles.xml, outlineLvl
   * ausente em estilo próprio ou outlineLvl divergente do esperado.
   * Estilo arbitrário (não-título) não gera erro: apenas level null.
   */
  errors: string[];
}

export function paragraphStyleId(paragraphXml: string): string | null {
  return paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? null;
}

/** Outline level declarado diretamente no pPr do parágrafo (sem estilos). */
export function paragraphOutlineLevel(paragraphXml: string): number | null {
  const match = paragraphXml.match(/<w:outlineLvl\b[^>]*w:val="(\d+)"/);
  return match ? Number(match[1]) : null;
}

export interface StyleOutlineResolution {
  /** false quando o estilo não existe em word/styles.xml. */
  defined: boolean;
  /** Outline level declarado na definição do estilo (null quando ausente). */
  level: number | null;
}

function styleDefinitionXml(stylesXml: string, styleId: string): string | null {
  const marker = `w:styleId="${styleId}"`;
  let idx = stylesXml.indexOf(marker);
  while (idx !== -1) {
    const open = stylesXml.lastIndexOf("<w:style", idx);
    const close = stylesXml.indexOf("</w:style>", idx);
    if (open !== -1 && close !== -1) {
      return stylesXml.slice(open, close + "</w:style>".length);
    }
    idx = stylesXml.indexOf(marker, idx + 1);
  }
  return null;
}

/** Resolve o outlineLvl do estilo em word/styles.xml. */
export function resolveStyleOutlineLevel(stylesXml: string, styleId: string): StyleOutlineResolution {
  const definition = styleDefinitionXml(stylesXml, styleId);
  if (!definition) return { defined: false, level: null };
  const match = definition.match(/<w:outlineLvl\b[^>]*w:val="(\d+)"/);
  return { defined: true, level: match ? Number(match[1]) : null };
}

/**
 * Classifica um parágrafo como título (1..3), legado (Heading1/2/3) ou não-título.
 * A fonte de verdade é o outlineLvl resolvido: direto no pPr, nome legado ou
 * definição do estilo em styles.xml. Estilos próprios com definição ausente,
 * outlineLvl ausente ou divergente são rejeitados com erro.
 */
export function resolveHeadingStyleLevel(paragraphXml: string, stylesXml: string): HeadingStyleResolution {
  const styleId = paragraphStyleId(paragraphXml);

  const directOutline = paragraphOutlineLevel(paragraphXml);
  if (directOutline !== null) {
    if (directOutline >= 0 && directOutline <= 2) {
      return {
        styleId,
        outlineLevel: directOutline,
        level: (directOutline + 1) as HeadingLevel,
        legacy: false,
        errors: [],
      };
    }
    return {
      styleId,
      outlineLevel: directOutline,
      level: null,
      legacy: false,
      errors: [`outlineLvl ${directOutline} fora da faixa de títulos (0-2)`],
    };
  }

  if (!styleId) {
    return { styleId: null, outlineLevel: null, level: null, legacy: false, errors: [] };
  }

  const legacyLevel = LEGACY_HEADING_LEVELS[styleId];
  if (legacyLevel) {
    return {
      styleId,
      outlineLevel: legacyLevel - 1,
      level: legacyLevel,
      legacy: true,
      errors: [],
    };
  }

  const expectedLevel = UFLA_STYLE_HEADING_LEVELS[styleId];
  if (expectedLevel === undefined) {
    // Estilo arbitrário: não é um título reconhecido (sem erro de hierarquia).
    return { styleId, outlineLevel: null, level: null, legacy: false, errors: [] };
  }

  const resolved = resolveStyleOutlineLevel(stylesXml, styleId);
  if (!resolved.defined) {
    return {
      styleId,
      outlineLevel: null,
      level: null,
      legacy: false,
      errors: [`estilo ${styleId} referenciado mas inexistente em word/styles.xml`],
    };
  }
  if (resolved.level === null) {
    return {
      styleId,
      outlineLevel: null,
      level: null,
      legacy: false,
      errors: [`estilo ${styleId} sem w:outlineLvl em word/styles.xml (obrigatório para título)`],
    };
  }
  const expectedOutline = UFLA_STYLE_EXPECTED_OUTLINE_LEVEL[styleId];
  if (resolved.level !== expectedOutline) {
    return {
      styleId,
      outlineLevel: resolved.level,
      level: null,
      legacy: false,
      errors: [`estilo ${styleId} com outlineLvl ${resolved.level}; esperado ${expectedOutline}`],
    };
  }
  return { styleId, outlineLevel: resolved.level, level: expectedLevel, legacy: false, errors: [] };
}

export interface ClassifiedHeading {
  paragraphXml: string;
  text: string;
  styleId: string | null;
  outlineLevel: number | null;
  level: HeadingLevel | null;
  legacy: boolean;
  errors: string[];
}

function paragraphRunsText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

/** Classifica todos os parágrafos de um document.xml (com styles.xml para resolução). */
export function classifyHeadingParagraphs(documentXml: string, stylesXml: string): ClassifiedHeading[] {
  return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map((paragraphXml) => {
    const resolution = resolveHeadingStyleLevel(paragraphXml, stylesXml);
    return {
      paragraphXml,
      text: paragraphRunsText(paragraphXml),
      styleId: resolution.styleId,
      outlineLevel: resolution.outlineLevel,
      level: resolution.level,
      legacy: resolution.legacy,
      errors: resolution.errors,
    };
  });
}

/** Parágrafos classificados como título válido no nível informado (1..3). */
export function headingParagraphsAtLevel(
  documentXml: string,
  stylesXml: string,
  level: HeadingLevel,
): string[] {
  return classifyHeadingParagraphs(documentXml, stylesXml)
    .filter((heading) => heading.level === level && heading.errors.length === 0)
    .map((heading) => heading.paragraphXml);
}
