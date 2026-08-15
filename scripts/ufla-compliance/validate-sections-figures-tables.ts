import { readFileSync, existsSync } from "node:fs";
import JSZip from "jszip";

import type { RequirementStatus, Severity } from "./document-type-matrix.js";

function extractXml(docxPath: string): Promise<string> {
  if (!existsSync(docxPath)) return Promise.resolve("");
  const buffer = readFileSync(docxPath);
  return JSZip.loadAsync(buffer).then((zip) =>
    zip.file("word/document.xml")?.async("string") ?? "",
  );
}

function extractText(paragraphXml: string): string {
  return paragraphXml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function validateSections(docxPath: string): Promise<Array<{
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

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => extractText(m[0]));
  const headings = paragraphs.filter((text) => /^(\d+(\.\d+)*)\s+/.test(text.trim()));
  const numberingRegex = /^(\d+(\.\d+)*)\s+/;

  if (headings.length === 0) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Nenhuma numeração progressiva detectada nos títulos.",
      location: "word/document.xml",
      suggestion: "Aplicar numeração 1, 1.1, 1.1.1 conforme ABNT NBR 6024.",
    });
    return results;
  }

  const withoutNumbering = headings.filter((h) => !numberingRegex.test(h.trim()));
  if (withoutNumbering.length > 0) {
    results.push({
      status: "failed",
      severity: "minor",
      message: `${withoutNumbering.length} título(s) sem numeração progressiva.`,
      location: "word/document.xml",
      suggestion: "Adicionar numeração progressiva aos títulos.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "major",
      message: "Todos os títulos têm numeração progressiva.",
    });
  }

  return results;
}

export async function validateFigures(docxPath: string): Promise<Array<{
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

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => extractText(m[0]));
  const figurePattern = /(Figura|Quadro|Gráfico|Mapa|Imagem|Ilustração)\s*\d+\s*[:\-–]/i;
  const figureParagraphs = paragraphs.filter((p) => figurePattern.test(p));

  if (figureParagraphs.length === 0) {
    results.push({
      status: "failed",
      severity: "minor",
      message: "Nenhuma figura/ilustração detectada.",
      location: "word/document.xml",
      suggestion: "Inserir legendas no formato 'Figura X - Descrição' quando houver ilustrações.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "minor",
      message: `${figureParagraphs.length} figura(s)/ilustração(ões) detectada(s).`,
    });
  }

  return results;
}

export async function validateTables(docxPath: string): Promise<Array<{
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

  const tableRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  const tables = Array.from(xml.matchAll(tableRegex), (m) => m[0]);
  const totalTables = tables.length;

  if (totalTables === 0) {
    results.push({
      status: "failed",
      severity: "minor",
      message: "Nenhuma tabela detectada.",
      location: "word/document.xml",
      suggestion: "Inserir tabelas quando necessário.",
    });
    return results;
  }

  const withHeader = tables.filter((t) => /<w:tblHeader\b/i.test(t)).length;
  const missingHeaders = totalTables - withHeader;

  if (missingHeaders > 0) {
    results.push({
      status: "failed",
      severity: "major",
      message: `${missingHeaders}/${totalTables} tabelas sem w:tblHeader.`,
      location: "word/document.xml",
      suggestion: "Adicionar w:tblHeader nas tabelas com cabeçalho semântico.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "major",
      message: `${withHeader}/${totalTables} tabelas com w:tblHeader.`,
    });
  }

  return results;
}
