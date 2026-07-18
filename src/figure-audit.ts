import type { ImportedDocumentImage, FigureAuditClass } from "./imported-images";
import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";

const TYPE_PREFIX_RE = /^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b/i;

function inferFigureType(caption?: string): string {
  const m = caption?.trim().match(TYPE_PREFIX_RE);
  if (!m) return "Outro";
  const word = m[1].toUpperCase();
  if (word === "GRAFICO" || word === "GRÁFICO") return "Gráfico";
  if (word === "ESQUEMA") return "Esquema";
  if (word === "FLUXOGRAMA") return "Fluxograma";
  if (word === "IMAGEM") return "Imagem";
  return "Figura";
}

// Heurística de classificação de auditoria para uma região candidata.
// Sinais disponíveis sem OCR: tipo de legenda, presença de FONTE, densidade
// de texto dentro da região (itens de texto vs área), e resultado da
// rasterização. É uma aproximação documentada, não uma verdade absoluta.
export function classifyFigureRegion(
  region: { pageNumber: number; caption?: string; source?: string; top: number; bottom: number },
  diagnostic: ImportedPdfDiagnostic,
  rasterSucceeded: boolean,
): { auditClass: FigureAuditClass; isFigure: boolean; confidence: number; reason?: string } {
  const type = inferFigureType(region.caption);
  const captionText = (region.caption || "").trim();
  const hasNumberedCaption = /^(FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GRAFICO|GR[AÁ]FICO)\b[\s.:]*[0-9IVXLC]+/i.test(captionText);
  const hasSource = Boolean(region.source);

  const page = diagnostic.pages.find((p) => p.pageNumber === region.pageNumber);
  let textItemCount = 0;
  let regionArea = 1;
  if (page) {
    const height = region.bottom - region.top;
    const area = Math.max(1, height) * (page.width || 595);
    regionArea = area;
    for (const it of page.items) {
      if (it.y >= region.top - 2 && it.y < region.bottom) textItemCount += 1;
    }
  }
  const textDensity = textItemCount / Math.max(1, regionArea / 5000);

  let confidence = 0.4;
  if (hasNumberedCaption) confidence += 0.3;
  if (hasSource) confidence += 0.2;
  if (type !== "Outro") confidence += 0.1;
  confidence = Math.min(1, confidence);

  if (rasterSucceeded) {
    let auditClass: FigureAuditClass = "figura-real";
    if (type === "Gráfico") auditClass = "grafico-vetorial";
    else if (type === "Esquema") auditClass = "outro";
    else if (type === "Fluxograma") auditClass = "outro";
    else if (type === "Imagem") auditClass = "imagem-raster";
    return { auditClass, isFigure: true, confidence, reason: undefined };
  }

  if (!hasNumberedCaption) {
    return {
      auditClass: "falso-positivo",
      isFigure: false,
      confidence: 0.2,
      reason: "Legenda sem numeração válida de figura; provável falso positivo do detector.",
    };
  }
  if (textDensity > 6) {
    return {
      auditClass: "falso-positivo",
      isFigure: false,
      confidence: 0.3,
      reason: "Região com alta densidade de texto; provável bloco de texto confundido com figura.",
    };
  }

  let auditClass: FigureAuditClass = "figura-real";
  let reason = "Rasterização não retornou imagem (timeout, sem dados ou região sem conteúdo gráfico capturável).";
  if (type === "Gráfico") {
    auditClass = "grafico-vetorial";
    reason = "Gráfico vetorial não rasterizado (backend não retornou imagem).";
  } else if (type === "Esquema") {
    auditClass = "outro";
  } else if (type === "Fluxograma") {
    auditClass = "outro";
  } else if (type === "Imagem") {
    auditClass = "imagem-raster";
  }
  return { auditClass, isFigure: true, confidence, reason };
}

export interface FigureAuditRecord {
  id: string;
  page: number;
  caption?: string;
  type: string;
  confidence: number;
  isFigure: boolean;
  rasterized: boolean;
  inserted: boolean;
  auditClass: FigureAuditClass;
  reason?: string;
  ocrText?: string;
  ocrBackend?: string;
  ocrConfidence?: number;
}

export interface FigureAuditSummary {
  candidateRegions: number;
  confirmedFigures: number;
  rasterized: number;
  inserted: number;
  lost: number;
  falsePositives: number;
  confirmationRate: number;
  rasterizationRate: number;
  insertionRate: number;
  classBreakdown: Record<FigureAuditClass, number>;
  records: FigureAuditRecord[];
}

export function buildFigureAudit(
  images: ImportedDocumentImage[],
  diagnostic: ImportedPdfDiagnostic,
  regionsByImageId?: Map<string, { pageNumber: number; caption?: string; source?: string; top: number; bottom: number }>,
): FigureAuditSummary {
  const records: FigureAuditRecord[] = images.map((img) => {
    const region = regionsByImageId?.get(img.id);
    const rasterSucceeded = img.status === "preserved";
    const classified = region
      ? classifyFigureRegion(region, diagnostic, rasterSucceeded)
      : { auditClass: "outro" as FigureAuditClass, isFigure: rasterSucceeded, confidence: img.confidence ?? 0.5, reason: img.reason };
    const auditClass = img.auditClass ?? classified.auditClass;
    const isFigure = img.isFigure ?? classified.isFigure;
    const confidence = img.confidence ?? classified.confidence;
    const reason = img.reason ?? classified.reason;
    const rasterized = img.rasterized ?? rasterSucceeded;
    const inserted = img.inserted ?? rasterSucceeded;
    return {
      id: img.id,
      page: img.page ?? region?.pageNumber ?? 0,
      caption: img.caption,
      type: img.figureType ?? inferFigureType(img.caption),
      confidence,
      isFigure,
      rasterized,
      inserted,
      auditClass,
      reason,
      ocrText: img.ocrText,
      ocrBackend: img.ocrBackend,
      ocrConfidence: img.ocrConfidence,
    };
  });

  const candidateRegions = records.length;
  const confirmedFigures = records.filter((r) => r.isFigure).length;
  const rasterized = records.filter((r) => r.rasterized).length;
  const inserted = records.filter((r) => r.inserted).length;
  const lost = records.filter((r) => r.isFigure && !r.inserted).length;
  const falsePositives = candidateRegions - confirmedFigures;

  const classBreakdown = {
    "figura-real": 0,
    "falso-positivo": 0,
    "grafico-vetorial": 0,
    "imagem-raster": 0,
    "decoracao": 0,
    "assinatura": 0,
    "logotipo": 0,
    "formula": 0,
    "outro": 0,
  } as Record<FigureAuditClass, number>;
  for (const r of records) classBreakdown[r.auditClass] += 1;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  return {
    candidateRegions,
    confirmedFigures,
    rasterized,
    inserted,
    lost,
    falsePositives,
    confirmationRate: pct(confirmedFigures, candidateRegions),
    rasterizationRate: pct(rasterized, confirmedFigures),
    insertionRate: pct(inserted, confirmedFigures),
    classBreakdown,
    records,
  };
}

function escapeMd(value?: string): string {
  return (value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function generateFigureReportMarkdown(
  summary: FigureAuditSummary,
  meta: { fileName: string; source: string; generatedAt: string },
): string {
  const lines: string[] = [];
  lines.push(`# Relatório de Figuras — ${meta.fileName}`);
  lines.push("");
  lines.push(`- Fonte: ${meta.source}`);
  lines.push(`- Gerado em: ${meta.generatedAt}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push("| Métrica | Valor |");
  lines.push("| --- | --- |");
  lines.push(`| Regiões candidatas (detectadas) | ${summary.candidateRegions} |`);
  lines.push(`| Figuras confirmadas | ${summary.confirmedFigures} |`);
  lines.push(`| Figuras rasterizadas | ${summary.rasterized} |`);
  lines.push(`| Figuras inseridas no DOCX | ${summary.inserted} |`);
  lines.push(`| Figuras perdidas (reais) | ${summary.lost} |`);
  lines.push(`| Falsos positivos | ${summary.falsePositives} |`);
  lines.push(`| Taxa de confirmação | ${summary.confirmationRate}% |`);
  lines.push(`| Taxa de rasterização | ${summary.rasterizationRate}% |`);
  lines.push(`| Taxa de inserção | ${summary.insertionRate}% |`);
  lines.push("");
  lines.push("## Classificação das regiões não inseridas");
  lines.push("");
  const cb = summary.classBreakdown;
  lines.push(`- figura-real: ${cb["figura-real"]}`);
  lines.push(`- falso-positivo: ${cb["falso-positivo"]}`);
  lines.push(`- grafico-vetorial: ${cb["grafico-vetorial"]}`);
  lines.push(`- imagem-raster: ${cb["imagem-raster"]}`);
  lines.push(`- decoracao: ${cb["decoracao"]}`);
  lines.push(`- assinatura: ${cb["assinatura"]}`);
  lines.push(`- logotipo: ${cb["logotipo"]}`);
  lines.push(`- formula: ${cb["formula"]}`);
  lines.push(`- outro: ${cb["outro"]}`);
  lines.push("");
  lines.push("## Tabela por figura");
  lines.push("");
  lines.push("| Página | Legenda | Tipo | Confiança | Rasterizada | Inserida | OCR | Motivo |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of summary.records) {
    const ocr = r.ocrText && r.ocrText.trim()
      ? `sim (${r.ocrBackend}, ${r.ocrConfidence ?? 0}%)`
      : "não";
    lines.push(
      `| ${r.page} | ${escapeMd(r.caption) || "—"} | ${escapeMd(r.type)} | ${Math.round(r.confidence * 100)}% | ${r.rasterized ? "sim" : "não"} | ${r.inserted ? "sim" : "não"} | ${ocr} | ${escapeMd(r.reason) || "—"} |`,
    );
  }
  lines.push("");
  lines.push("## Notas metodológicas");
  lines.push("");
  lines.push("- **Região candidata** = trecho com legenda do tipo FIGURA/IMAGEM/ESQUEMA/FLUXOGRAMA/GRÁFICO detectada no PDF. Não é, por si só, uma figura confirmada.");
  lines.push("- **Figura confirmada** = região com legenda numerada válida e baixa densidade de texto (heurística).");
  lines.push("- **Figura perdida** = figura confirmada que NÃO foi rasterizada nem inserida. Falsos positivos NÃO contam como perda.");
  lines.push("- A classificação das regiões restantes é heurística (sem OCR): baseia-se em tipo de legenda, presença de FONTE e densidade de texto na região.");
  lines.push("");
  return lines.join("\n");
}
