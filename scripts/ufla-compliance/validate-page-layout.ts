import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type { RequirementStatus, Severity } from "./document-type-matrix.js";
import { UFLA_RULES } from "../../src/ufla-rules.js";

function extractXml(docxPath: string): Promise<string> {
  if (!existsSync(docxPath)) return Promise.resolve("");
  const buffer = readFileSync(docxPath);
  return JSZip.loadAsync(buffer).then((zip) =>
    zip.file("word/document.xml")?.async("string") ?? "",
  );
}

function measureMargin(xml: string, selector: RegExp): number | null {
  const match = selector.exec(xml);
  if (!match) return null;
  const raw = match[1];
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) return null;
  return Math.round((value / 567) * 100) / 100;
}

export async function validatePageLayout(docxPath: string): Promise<Array<{
  status: RequirementStatus;
  severity: Severity;
  message: string;
  location?: string;
  suggestion?: string;
}>> {
  const xml = await extractXml(docxPath);
  const results: Array<{
    status: RequirementStatus;
    severity: Severity;
    message: string;
    location?: string;
    suggestion?: string;
  }> = [];

  if (!xml) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "DOCX não encontrado ou inválido.",
      suggestion: "Verifique o caminho do arquivo.",
    });
    return results;
  }

  const pageMatch = xml.match(/<w:pgSz\b[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/);
  if (!pageMatch) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "Tamanho de página não detectado.",
      suggestion: "Verificar seção em word/section*.xml.",
    });
  } else {
    const widthTwip = parseInt(pageMatch[1], 10);
    const heightTwip = parseInt(pageMatch[2], 10);
    const widthCm = Math.round((widthTwip / 567) * 100) / 100;
    const heightCm = Math.round((heightTwip / 567) * 100) / 100;
    const isA4 = widthTwip === UFLA_RULES.page.formatWidthTwip && heightTwip === UFLA_RULES.page.formatHeightTwip;

    results.push({
      status: isA4 ? "passed" : "failed",
      severity: "critical",
      message: isA4 ? "Papel A4 confirmado." : `Papel fora do padrão A4: ${widthCm} cm × ${heightCm} cm.`,
      location: "word/section*.xml",
      suggestion: isA4 ? "" : "Ajustar página para A4 (21 cm × 29,7 cm).",
    });
  }

  const marginTop = measureMargin(xml, /<w:pgMar\b[^>]*w:top="(\d+)"/);
  const marginLeft = measureMargin(xml, /<w:pgMar\b[^>]*w:left="(\d+)"/);
  const marginBottom = measureMargin(xml, /<w:pgMar\b[^>]*w:bottom="(\d+)"/);
  const marginRight = measureMargin(xml, /<w:pgMar\b[^>]*w:right="(\d+)"/);

  const expectedTop = UFLA_RULES.margins.topCm;
  const expectedLeft = UFLA_RULES.margins.leftCm;
  const expectedBottom = UFLA_RULES.margins.bottomCm;
  const expectedRight = UFLA_RULES.margins.rightCm;

  results.push({
    status: marginTop === expectedTop ? "passed" : "failed",
    severity: "critical",
    message: marginTop === expectedTop ? "Margem superior 3 cm confirmada." : `Margem superior divergente: ${marginTop ?? "não detectada"} cm.`,
    location: "word/section*.xml",
    suggestion: marginTop === expectedTop ? "" : "Ajustar margem superior para 3 cm.",
  });

  results.push({
    status: marginLeft === expectedLeft ? "passed" : "failed",
    severity: "critical",
    message: marginLeft === expectedLeft ? "Margem esquerda 3 cm confirmada." : `Margem esquerda divergente: ${marginLeft ?? "não detectada"} cm.`,
    location: "word/section*.xml",
    suggestion: marginLeft === expectedLeft ? "" : "Ajustar margem esquerda para 3 cm.",
  });

  results.push({
    status: marginBottom === expectedBottom ? "passed" : "failed",
    severity: "critical",
    message: marginBottom === expectedBottom ? "Margem inferior 2 cm confirmada." : `Margem inferior divergente: ${marginBottom ?? "não detectada"} cm.`,
    location: "word/section*.xml",
    suggestion: marginBottom === expectedBottom ? "" : "Ajustar margem inferior para 2 cm.",
  });

  results.push({
    status: marginRight === expectedRight ? "passed" : "failed",
    severity: "critical",
    message: marginRight === expectedRight ? "Margem direita 2 cm confirmada." : `Margem direita divergente: ${marginRight ?? "não detectada"} cm.`,
    location: "word/section*.xml",
    suggestion: marginRight === expectedRight ? "" : "Ajustar margem direita para 2 cm.",
  });

  return results;
}

export async function validateTypography(docxPath: string): Promise<Array<{
  status: RequirementStatus;
  severity: Severity;
  message: string;
  location?: string;
  suggestion?: string;
}>> {
  const xml = await extractXml(docxPath);
  const results: Array<{
    status: RequirementStatus;
    severity: Severity;
    message: string;
    location?: string;
    suggestion?: string;
  }> = [];

  if (!xml) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "DOCX não encontrado ou inválido.",
      suggestion: "Verifique o caminho do arquivo.",
    });
    return results;
  }

  const hasTimesNewRoman = /w:ascii="Times New Roman"|w:hAnsi="Times New Roman"/i.test(xml);
  results.push({
    status: hasTimesNewRoman ? "passed" : "failed",
    severity: "critical",
    message: hasTimesNewRoman ? "Fonte Times New Roman confirmada." : "Fonte Times New Roman não detectada.",
    location: "word/styles.xml",
    suggestion: hasTimesNewRoman ? "" : "Usar fonte Times New Roman em todo o documento.",
  });

  const bodySizeHalfPoints = UFLA_RULES.typography.bodyFontSizePt * 2;
  const hasBodySize = new RegExp(`w:sz="\\s*${bodySizeHalfPoints}\\s*"|w:szCs="\\s*${bodySizeHalfPoints}\\s*"`).test(xml);
  results.push({
    status: hasBodySize ? "passed" : "failed",
    severity: "critical",
    message: hasBodySize ? "Tamanho de corpo 12 pt confirmado." : "Tamanho de corpo 12 pt não detectado.",
    location: "word/styles.xml",
    suggestion: hasBodySize ? "" : "Aplicar tamanho 12 pt no corpo de texto.",
  });

  const firstLineTwip = UFLA_RULES.typography.paragraphFirstLineTwip;
  const hasFirstLine = /<w:firstLine\s+w:val="\s*567\s*"\/>/i.test(xml) || /<w:firstLine\s+w:val="\s*1417\s*"\/>/i.test(xml);
  results.push({
    status: hasFirstLine ? "passed" : "failed",
    severity: "major",
    message: hasFirstLine ? "Recuo de primeira linha confirmado." : "Recuo de primeira linha não detectado.",
    location: "word/styles.xml",
    suggestion: hasFirstLine ? "" : "Aplicar recuo de 1,25 cm na primeira linha do parágrafo.",
  });

  return results;
}
