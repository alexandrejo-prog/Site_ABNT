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

const CITATION_PATTERN = /\(([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\.-]+?)(?:;\s*[A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\.-]+?)*,\s*(?:[12]\d{3})/g;

export async function validateCitations(docxPath: string): Promise<Array<{
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
  let citationCount = 0;
  let invalidCount = 0;

  for (const text of paragraphs) {
    const matches = [...text.matchAll(CITATION_PATTERN)];
    for (const m of matches) {
      citationCount++;
      const authorsText = m[1];
      const authors = authorsText.split(/;/).map((a) => a.trim()).filter(Boolean);
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch?.[0] ?? "";

      if (!authors.length || !year) {
        invalidCount++;
      }
    }
  }

  if (citationCount === 0) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Nenhuma citação detectada.",
      location: "word/document.xml",
      suggestion: "Incluir citações no texto conforme ABNT NBR 10520.",
    });
  } else if (invalidCount > 0) {
    results.push({
      status: "failed",
      severity: "major",
      message: `${invalidCount} citação(ões) inválida(s) de ${citationCount} detectada(s).`,
      location: "word/document.xml",
      suggestion: "Corrigir formato das citações para (AUTOR, ano, p. X) conforme NBR 10520.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "major",
      message: `${citationCount} citação(ões) válida(s) detectada(s).`,
    });
  }

  return results;
}

export async function validateReferences(docxPath: string): Promise<Array<{
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

  const hasReferences = /referências|referencias bibliográficas|referencias bibliograficas|bibliográficas|bibliograficas/i.test(xml);
  if (!hasReferences) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "Seção de referências não detectada.",
      location: "word/document.xml",
      suggestion: "Inserir seção de referências bibliográficas.",
    });
    return results;
  }

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => extractText(m[0]));
  const referenceParagraphs = paragraphs.filter((p) => /\b(19|20)\d{2}\b/.test(p) && /[A-ZÀ-Ÿ]{2,}/.test(p));

  if (referenceParagraphs.length === 0) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "Nenhuma entrada de referência válida detectada.",
      location: "word/document.xml",
      suggestion: "Verificar formato das referências.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "critical",
      message: `${referenceParagraphs.length} entrada(s) de referência detectada(s).`,
    });
  }

  return results;
}
