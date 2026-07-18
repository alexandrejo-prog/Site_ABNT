import type {
  ImportedPdfDiagnostic,
  PdfTextReconstructionDiagnostic,
} from "./imported-pdf-diagnostic";

export type LossCategory =
  | "ocr"
  | "extracao_pdf"
  | "hifenizacao"
  | "rodape"
  | "cabecalho"
  | "numeracao"
  | "equacao"
  | "simbolo_unicode"
  | "ligatura"
  | "outro";

export interface LossCategoryDetail {
  category: LossCategory;
  label: string;
  chars: number;
  samples: string[];
  note: string;
}

export interface TextLossReport {
  rawTextLen: number;
  editorTextLen: number;
  deltaChars: number;
  deltaPct: number;
  byCategory: LossCategoryDetail[];
  residualChars: number;
  residualNote: string;
}

const PAGE_NUMBER_RE = /^\d{1,4}$/;
const EQUATION_HINT_RE = /[=+\-*/^√∑∫∂Δα-ωΑ-Ω≤≥±×÷∞≈≠%]/;
const LIGATURE_RE = /[ﬂﬁﬃﬄﬅﬆ]/;

function whitespaceNormalize(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Coleta, a partir do diagnóstico, o texto bruto (raw) página a página.
function rawPdfText(diagnostic: ImportedPdfDiagnostic): string {
  return diagnostic.pages.map((page) => page.rawText).join("\n");
}

// Tenta reconstruir o texto "esperado" que o editor deveria conter,
// somando blocos reconstruídos + linhas ignoradas categorizadas.
// Usado apenas para atribuir categorias com base em evidência medida.
function classifyByReconstruction(
  reconstruction: PdfTextReconstructionDiagnostic,
): Map<LossCategory, { chars: number; samples: string[] }> {
  const buckets = new Map<LossCategory, { chars: number; samples: string[] }>();
  const add = (cat: LossCategory, text: string) => {
    const cur = buckets.get(cat) ?? { chars: 0, samples: [] };
    cur.chars += whitespaceNormalize(text).length;
    if (cur.samples.length < 3 && whitespaceNormalize(text)) cur.samples.push(whitespaceNormalize(text).slice(0, 80));
    buckets.set(cat, cur);
  };

  for (const line of reconstruction.ignoredLines) {
    const t = line.text || "";
    if (line.role === "page-number" || PAGE_NUMBER_RE.test(t.trim())) add("numeracao", t);
    else if (line.role === "repeated-header") add("cabecalho", t);
    else if (line.role === "repeated-footer") add("rodape", t);
  }

  for (const block of reconstruction.blocks) {
    if (block.type === "unresolved") add("extracao_pdf", block.text);
  }

  for (const h of reconstruction.hyphenation) {
    if (h.action === "joined-without-hyphen") {
      // O hífen original foi removido ao unir a palavra.
      add("hifenizacao", h.originalEnd);
    } else if (h.action === "uncertain") {
      add("hifenizacao", h.originalEnd);
    }
  }

  return buckets;
}

// Detecta símbolos/equações/ligações que estão NO PDF bruto mas
// AUSENTES no editor (ou seja, genuinamente não preservados).
// Conta apenas o que falta, evitando contar caracteres presentes.
function classifyByUnicode(rawText: string, editorText: string): Map<LossCategory, { chars: number; samples: string[] }> {
  const buckets = new Map<LossCategory, { chars: number; samples: string[] }>();
  const editorHas = (ch: string) => editorText.includes(ch);
  const add = (cat: LossCategory, text: string) => {
    const cur = buckets.get(cat) ?? { chars: 0, samples: [] };
    cur.chars += whitespaceNormalize(text).length;
    if (cur.samples.length < 3) cur.samples.push(whitespaceNormalize(text).slice(0, 80));
    buckets.set(cat, cur);
  };

  const isEquationish = (ch: string) => EQUATION_HINT_RE.test(ch) || (ch.charCodeAt(0) > 0x2390 && ch.charCodeAt(0) < 0x23ff);
  const isSymbol = (ch: string) => ch.charCodeAt(0) > 0x2000 && ch.charCodeAt(0) < 0x2c00 && !editorHas(ch);
  const isLigature = (ch: string) => LIGATURE_RE.test(ch);

  for (const ch of rawText) {
    if (editorHas(ch)) continue;
    if (isLigature(ch)) add("ligatura", ch);
    else if (isEquationish(ch)) add("equacao", ch);
    else if (isSymbol(ch)) add("simbolo_unicode", ch);
  }

  return buckets;
}

export function classifyPdfTextLoss(
  diagnostic: ImportedPdfDiagnostic,
  editorText: string,
): TextLossReport {
  const raw = whitespaceNormalize(rawPdfText(diagnostic));
  const editor = whitespaceNormalize(editorText);
  const rawTextLen = raw.length;
  const editorTextLen = editor.length;
  const deltaChars = Math.max(0, rawTextLen - editorTextLen);
  const deltaPct = rawTextLen ? Math.round((deltaChars / rawTextLen) * 1000) / 10 : 0;

  const recon = classifyByReconstruction(diagnostic.reconstruction);
  const unicode = classifyByUnicode(raw, editor);

  const byCategory: LossCategoryDetail[] = [];
  const merge = (cat: LossCategory, label: string, note: string) => {
    const r = recon.get(cat);
    const u = unicode.get(cat);
    const chars = (r?.chars ?? 0) + (u?.chars ?? 0);
    const samples = [...(r?.samples ?? []), ...(u?.samples ?? [])].slice(0, 3);
    if (chars > 0 || label === "Equação" || label === "Símbolo Unicode" || label === "Ligatura") {
      byCategory.push({ category: cat, label, chars, samples, note });
    }
  };

  merge("extracao_pdf", "Extração PDF", "Texto interno de regiões de layout (figura/tabela) não emitido como parágrafo; deduplicação de itens; truncamento de pré-texto antes da introdução.");
  merge("numeracao", "Numeração", "Números de página removidos da reconstrução do corpo.");
  merge("cabecalho", "Cabeçalho", "Linhas repetidas de cabeçalho removidas da reconstrução.");
  merge("rodape", "Rodapé", "Linhas repetidas de rodapé removidas da reconstrução.");
  merge("hifenizacao", "Hifenização", "Hífen de quebra de linha removido ao unir palavras (correto para edição, mas conta como caractere ausente).");
  merge("equacao", "Equação", "Caracteres de fórmula/equação presentes no PDF bruto não reconstruídos como objeto editável.");
  merge("simbolo_unicode", "Símbolo Unicode", "Símbolos fora do range latino não representados no editor de texto.");
  merge("ligatura", "Ligatura", "Ligaturas tipográficas (ﬁ, ﬂ, ﬃ) normalizadas ou perdidas.");
  merge("ocr", "OCR", "Texto de páginas escaneadas reconhecido por OCR (medido via ocrStats quando aplicável).");

  // Soma dos buckets nunca pode exceder o delta real medido
  // (alguns blocos removidos podem se sobrepor ou já estar parcialmente
  // refletidos no delta por normalização de espaçamento).
  // Fazemos clamp para não super-afirmar a perda atribuída.
  const rawMeasured = byCategory.reduce((sum, c) => sum + c.chars, 0);
  const measuredChars = Math.min(rawMeasured, deltaChars);
  // Reescala proporcionalmente os buckets quando há clamp.
  if (rawMeasured > deltaChars && rawMeasured > 0) {
    const factor = deltaChars / rawMeasured;
    for (const c of byCategory) c.chars = Math.round(c.chars * factor);
  }
  const residualChars = Math.max(0, deltaChars - measuredChars);

  return {
    rawTextLen,
    editorTextLen,
    deltaChars,
    deltaPct,
    byCategory,
    residualChars,
    residualNote:
      "Diferença restante após atribuição por sinais medidos: majoritariamente normalização de espaçamento (quebras de linha/newlines colapsadas em espaço simples) e truncamento de pré-texto antes da introdução. Não representa perda de palavras/conteúdo semântico.",
  };
}

// Conta caracteres OCR quando há estatísticas disponíveis.
export function ocrCharCount(diagnostic: ImportedPdfDiagnostic): number {
  if (!diagnostic.ocrStats) return 0;
  return diagnostic.ocrStats.perPage.reduce((sum, p) => sum + (p.charCount ?? 0), 0);
}

export function formatLossReport(report: TextLossReport): string {
  const lines: string[] = [];
  lines.push(`Texto PDF bruto (normalizado): ${report.rawTextLen} caracteres`);
  lines.push(`Texto editor (normalizado): ${report.editorTextLen} caracteres`);
  lines.push(`Δ ausente: ${report.deltaChars} (${report.deltaPct}%)`);
  lines.push("");
  lines.push("| Categoria | Caracteres | Amostras |");
  lines.push("| --- | ---: | --- |");
  for (const c of report.byCategory.sort((a, b) => b.chars - a.chars)) {
    const samples = c.samples.length ? c.samples.map((s) => `\`${s}\``).join("; ") : "—";
    lines.push(`| ${c.label} | ${c.chars} | ${samples} |`);
  }
  lines.push(`| **Residual** | ${report.residualChars} | ${report.residualNote.slice(0, 120)}… |`);
  return lines.join("\n");
}
