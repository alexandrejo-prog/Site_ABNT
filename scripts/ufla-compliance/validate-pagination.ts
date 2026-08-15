/**
 * Validação de paginação (UFLA-AMBIGUOUS-1) — DECISION-010.
 *
 * Regra: contagem contínua a partir da folha de rosto (folha de rosto = 1);
 * pré-textuais contadas, porém sem número visível; a numeração visível
 * (algarismos arábicos, canto superior direito) começa na Introdução com o
 * valor CONTADO (nº de pré-textuais + 1) — NUNCA reinicia em 1 em trabalhos
 * com parte pré-textual. Trabalhos sem pré-textuais (projeto/artigo/CPG)
 * iniciam em 1 na primeira folha textual.
 *
 * Dois níveis de evidência:
 *  1. OOXML — seção textual (única com w:headerReference + campo PAGE) deve
 *     declarar w:pgNumType w:start="N" (N ≥ 2 quando há pré-textuais).
 *  2. PDF físico (renderizado pelo Word) — nenhuma pré-textual exibe dígito no
 *     canto superior direito; a primeira folha com número é a Introdução, com
 *     valor N; a sequência é contínua até o fim (referências/apêndices/anexos).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import AdmZip from "adm-zip";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PaginationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /** Folha física (1-based) onde aparece o primeiro número visível. */
  firstVisiblePage?: number;
  /** Valor declarado no OOXML (w:pgNumType w:start da seção textual). */
  declaredStart?: number;
  /** Valor visível na primeira folha textual, conforme o PDF renderizado. */
  firstVisibleValue?: number;
  totalPages: number;
  preTextualPages: number;
}

const PAGE_W = 595.32;
const PAGE_H = 841.92;

function sectionInfos(documentXml: string): Array<{ header: boolean; start?: number }> {
  const sects = documentXml.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g) ?? [];
  return sects.map((s) => {
    const header = s.includes("w:headerReference");
    const m = s.match(/w:pgNumType[^>]*w:start="(\d+)"/);
    return { header, start: m ? parseInt(m[1], 10) : undefined };
  });
}

function siblingPdfPath(docxPath: string): string {
  return join(dirname(docxPath), basename(docxPath, extname(docxPath)) + ".pdf");
}

/** Detecta número de página no canto superior direito (zona do cabeçalho, < 70 pt do topo). */
async function collectPdfPageNumbers(pdfPath: string): Promise<{ pages: Array<{ page: number; value: number }>; numPages: number }> {
  const buffer = readFileSync(pdfPath);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: Array<{ page: number; value: number }> = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items as Array<{ str: string; transform: number[] }>).map((it) => ({
      t: it.str.trim(),
      x: it.transform[4],
      yTop: PAGE_H - it.transform[5],
    }));
    const nums = items
      .filter((it) => /^\d{1,3}$/.test(it.t))
      .filter((it) => it.yTop < 70 && it.x > PAGE_W * 0.7)
      .map((it) => parseInt(it.t, 10));
    if (nums.length > 0) pages.push({ page: p, value: nums[0] });
  }
  return { pages, numPages: doc.numPages };
}

/** Tipos com parte pré-textual contada a partir da folha de rosto (DECISION-010). */
const PRETEXTUAL_COUNTED_TYPES = new Set(["dissertacao", "tese", "tcc", "monografia"]);

export async function validatePagination(docxPath: string, pdfPath?: string, documentType?: string): Promise<PaginationValidation> {
  const result: PaginationValidation = { isValid: true, errors: [], warnings: [], totalPages: 0, preTextualPages: 0 };
  const type = documentType ?? "dissertacao";
  const countedFromTitlePage = PRETEXTUAL_COUNTED_TYPES.has(type);

  if (!existsSync(docxPath)) {
    result.isValid = false;
    result.errors.push(`Arquivo não encontrado: ${docxPath}`);
    return result;
  }

  try {
    const zip = new AdmZip(docxPath);
    const documentXml = zip.readAsText("word/document.xml");
    const sections = sectionInfos(documentXml);
    const textual = sections.filter((s) => s.header);
    const preTextual = sections.filter((s) => !s.header);

    if (sections.length === 0) {
      result.isValid = false;
      result.errors.push("Sem w:sectPr no documento.");
      return result;
    }

    if (textual.length === 0) {
      result.isValid = false;
      result.errors.push("Nenhuma seção referencia cabeçalho com número de página (w:headerReference ausente).");
      return result;
    }

    result.declaredStart = textual[0].start;

    // DECISION-010: com parte pré-textual contada (dissertação/tese/TCC/monografia),
    // a seção textual NÃO reinicia em 1. Tipos sem pré-textuais (artigo/CPG/projeto)
    // iniciam a numeração em 1 na primeira folha textual.
    if (countedFromTitlePage && preTextual.length >= 1 && textual[0].start !== undefined && textual[0].start === 1) {
      result.isValid = false;
      result.errors.push(
        `Seção textual reinicia a numeração em 1 (w:pgNumType w:start="1") com parte pré-textual presente; ` +
          `a contagem deve continuar a partir da folha de rosto (DECISION-010): a Introdução deve exibir o valor contado (pré-textuais + 1).`,
      );
    } else if (preTextual.length >= 1 && textual[0].start === undefined) {
      result.warnings.push(
        "Seção textual sem w:pgNumType w:start explícito — o Word pode reiniciar a numeração por conta própria (DECISION-010).",
      );
    }

    // Nível físico: PDF renderizado pelo Word (mesmo diretório, extensão .pdf).
    const effectivePdf = pdfPath ?? siblingPdfPath(docxPath);
    if (existsSync(effectivePdf)) {
      const { pages, numPages } = await collectPdfPageNumbers(effectivePdf);
      result.totalPages = numPages;
      if (pages.length === 0) {
        result.isValid = false;
        result.errors.push("Nenhum número de página visível no canto superior direito do PDF renderizado.");
        return result;
      }

      const first = pages[0];
      result.firstVisiblePage = first.page;
      result.firstVisibleValue = first.value;
      result.preTextualPages = first.page - 1;

      // Pré-textuais não podem exibir número.
      const hiddenViolations = pages.filter((p) => p.page < first.page);
      if (hiddenViolations.length > 0) {
        result.isValid = false;
        result.errors.push(
          `Pré-textuais exibem número visível antes da Introdução: ${hiddenViolations.map((p) => `folha ${p.page}=${p.value}`).join(", ")}.`,
        );
      }

      // Primeiro valor visível deve coincidir com o declarado no OOXML (alinhamento com o Word).
      if (result.declaredStart !== undefined && first.value !== result.declaredStart) {
        result.isValid = false;
        result.errors.push(
          `Valor visível na Introdução (${first.value}, folha física ${first.page}) difere do declarado no OOXML ` +
            `(w:pgNumType w:start="${result.declaredStart}") — o Word renderizou diferente do que o documento declara.`,
        );
      }

      // Continuidade a partir da Introdução.
      let expected = first.value;
      for (const p of pages.slice(1)) {
        if (p.value !== expected + 1) {
          result.isValid = false;
          result.errors.push(`Quebra na sequência: esperado ${expected + 1} na folha ${p.page}, encontrado ${p.value}.`);
        }
        expected = p.value;
      }

      result.warnings.push(
        `PDF físico: numeração visível da Introdução (folha ${first.page}, valor ${first.value}) até o fim, contínua em ${pages.length} folhas.`,
      );
    } else {
      result.totalPages = 0;
      result.warnings.push(
        "PDF renderizado não encontrado ao lado do DOCX — validação apenas no nível OOXML (seções/pgNumType/PAGE).",
      );
    }
  } catch (err) {
    result.isValid = false;
    result.errors.push(`Falha ao validar paginação: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}
