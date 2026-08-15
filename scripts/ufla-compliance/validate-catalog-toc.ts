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

export async function validateCatalogCard(docxPath: string): Promise<Array<{
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

  const hasCatalogCard = /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i.test(xml);
  if (!hasCatalogCard) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Ficha catalográfica não detectada.",
      suggestion: "Inserir ficha catalográfica com campos obrigatórios.",
    });
    return results;
  }

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => extractText(m[0]));
  const catalogParagraph = paragraphs.find((p) => /FICHA CATALOGRÁFICA|FICHA CATALOGRAFICA/i.test(p));

  if (!catalogParagraph) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Ficha catalográfica detectada, mas conteúdo vazio.",
      suggestion: "Preencher campos da ficha catalográfica.",
    });
    return results;
  }

  const hasAuthor = /[A-ZÀ-Ÿ]{2,}/.test(catalogParagraph);
  const hasYear = /\b(19|20)\d{2}\b/.test(catalogParagraph);
  const hasTitle = /[A-Za-zÀ-ÿ]{3,}/.test(catalogParagraph);

  if (!hasAuthor) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Ficha catalográfica sem autor detectado.",
      suggestion: "Incluir autor na ficha catalográfica.",
    });
  }

  if (!hasYear) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Ficha catalográfica sem ano detectado.",
      suggestion: "Incluir ano na ficha catalográfica.",
    });
  }

  if (!hasTitle) {
    results.push({
      status: "failed",
      severity: "major",
      message: "Ficha catalográfica sem título detectado.",
      suggestion: "Incluir título na ficha catalográfica.",
    });
  }

  if (hasAuthor && hasYear && hasTitle) {
    results.push({
      status: "passed",
      severity: "major",
      message: "Ficha catalográfica com campos obrigatórios detectada.",
    });
  }

  return results;
}

export async function validateToc(docxPath: string): Promise<Array<{
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

  const hasTocField = /TOC\\o|w:fldChar|w:instrText/i.test(xml);
  if (!hasTocField) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "TOC real não detectado.",
      suggestion: "Inserir campo TOC atualizável no Word (TOC \\o \"1-3\" \\h).",
    });
    return results;
  }

  const tocMatches = [...xml.matchAll(/w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)];
  const hasValidInstr = tocMatches.some((m) => /TOC/i.test(m[1]));

  if (!hasValidInstr) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "Campo TOC encontrado, mas instrução inválida.",
      suggestion: "Verificar instrução TOC no documento.",
    });
    return results;
  }

  results.push({
    status: "passed",
    severity: "critical",
    message: "TOC real detectado com instrução válida.",
  });

  return results;
}
