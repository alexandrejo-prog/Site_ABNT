/**
 * A4 (checklist-15): citação longa (recuo 4 cm / 11 pt / espaço simples)
 * verificada POR TIPO no DOCX real.
 *
 * A regra do Manual UFLA (§20 / NBR 10520) exige que citação direta com 3+
 * linhas tenha recuo de 4 cm (w:left=2268 twips), fonte 11 pt (sz=22) e
 * espaçamento simples (w:line=240). O checker OOXML (ooxml-checks) valida o
 * DOCX de referência; este módulo é o check por tipo usado no gate
 * gates-per-type: cada DOCX gerado é reimportado, as citações longas do
 * conteúdo são contadas (linhas iniciadas com "> ") e o OOXML do DOCX gerado
 * é inspecionado ocorrência a ocorrência — sem falso-positivo quando o
 * conteúdo não tem citação direta.
 */
import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

export interface LongQuoteCheckResult {
  /** Número de citações longas identificadas no conteúdo (linhas "> "). */
  contentQuotes: number;
  /** Parágrafos no OOXML com o estilo ufla_citacao_longa. */
  formattedParas: number;
  /** Descrição dos parágrafos de citação longa fora do padrão (trio). */
  malformed: string[];
  passed: boolean;
  gap?: string;
}

/** Conta linhas de citação longa no texto do editor (prefixo "> "). */
export function countLongQuoteLines(editorText: string): number {
  return editorText
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("> "))
    .length;
}

const LEFT_INDENT = 'w:left="2268"';
const FONT_SIZE = 'w:sz w:val="22"';
const SINGLE_LINE = 'w:line="240"';

function hasTrio(paraXml: string): boolean {
  return paraXml.includes(LEFT_INDENT) && paraXml.includes(FONT_SIZE) && paraXml.includes(SINGLE_LINE);
}

const hasStyle = (p: string) => p.includes("ufla_citacao_longa");

function extractText(xml: string): string {
  return xml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Verifica a formatação das citações longas no DOCX gerado.
 * - Sem citação longa no conteúdo → passa (sem falso-positivo).
 * - Com citação longa no conteúdo → exige pelo menos tantos parágrafos
 *   formatados (trio 2268/22/240) quanto linhas "> " no conteúdo, e nenhum
 *   parágrafo de citação longa fora do padrão.
 */
export async function checkLongQuoteFormatting(
  docxPath: string,
  expectedQuotes: number,
): Promise<LongQuoteCheckResult> {
  const result: LongQuoteCheckResult = { contentQuotes: expectedQuotes, formattedParas: 0, malformed: [], passed: true };

  if (!existsSync(docxPath)) {
    result.passed = false;
    result.gap = `long-quote: DOCX não encontrado (${docxPath})`;
    return result;
  }

  const zip = await JSZip.loadAsync(readFileSync(docxPath));
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const paragraphs = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  // Citação longa = parágrafo com o estilo ufla_citacao_longa OU com o trio
  // completo (4 cm + 11 pt + simples) — os 4 exportadores emitem o estilo,
  // exceto o CPG que usa parágrafo inline com as mesmas propriedades.
  const longQuoteParas = paragraphs.filter((p) => hasStyle(p) || hasTrio(p));
  result.formattedParas = longQuoteParas.length;

  // Malformado = parágrafo com o ESTILO de citação longa mas sem o trio
  // completo (o trio parcial fora do estilo é capturado pela contagem).
  const malformed = paragraphs.filter((p) => hasStyle(p) && !hasTrio(p));
  result.malformed = malformed.slice(0, 5).map((p) => {
    const text = extractText(p).slice(0, 80);
    const indent = /w:left="(\d+)"/.exec(p)?.[1];
    const sz = /w:sz w:val="(\d+)"/.exec(p)?.[1];
    const line = /w:line="(\d+)"/.exec(p)?.[1];
    return `"${text}" (indent=${indent}, sz=${sz}, line=${line})`;
  });

  if (expectedQuotes === 0) {
    // Sem citação direta no conteúdo → sem exigência (evita falso-positivo
    // para tipos/artigos sem citação longa). Se houver parágrafo de citação
    // longa, ainda assim deve estar formatado corretamente.
    if (malformed.length > 0) {
      result.passed = false;
      result.gap = `long-quote: ${malformed.length} parágrafo(s) de citação longa fora do padrão (recuo 4 cm / 11 pt / espaço simples): ${result.malformed.join("; ")}`;
    }
    return result;
  }

  if (longQuoteParas.length === 0) {
    result.passed = false;
    result.gap = `long-quote: conteúdo com ${expectedQuotes} citação(ões) longa(s) ("> ") mas DOCX sem parágrafo ufla_citacao_longa (recuo 4 cm / 11 pt / espaço simples ausentes).`;
    return result;
  }

  if (longQuoteParas.length < expectedQuotes) {
    result.passed = false;
    result.gap = `long-quote: ${expectedQuotes} citação(ões) longa(s) no conteúdo, apenas ${longQuoteParas.length} parágrafo(s) formatado(s) no DOCX.`;
    return result;
  }

  if (malformed.length > 0) {
    result.passed = false;
    result.gap = `long-quote: ${malformed.length} parágrafo(s) de citação longa fora do padrão (recuo 4 cm / 11 pt / espaço simples): ${result.malformed.join("; ")}`;
  }

  return result;
}
