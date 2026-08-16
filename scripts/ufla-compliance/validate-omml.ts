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

export async function validateOMML(docxPath: string): Promise<Array<{
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

  const mathMatches = [...xml.matchAll(/<m:oMath(?:\s[^>]*)?>|<\/m:oMath>/g)];
  const mathCount = mathMatches.length;

  if (mathCount === 0) {
    results.push({
      status: "passed",
      severity: "info",
      message: "Nenhuma equação OMML detectada.",
    });
    return results;
  }

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  const centeredEquations = paragraphs.filter((p) => {
    const hasMath = /<m:oMath|<\/m:oMath>/.test(p);
    const isCentered = /w:val="center"/.test(p);
    const hasRightTab = /w:tab[^>]*w:val="right"/.test(p);
    return hasMath && isCentered && hasRightTab;
  });

  if (centeredEquations.length === 0) {
    results.push({
      status: "failed",
      severity: "major",
      message: `Equações/fórmulas presentes sem parágrafo centralizado com numeração à direita (tab stop direito).`,
      location: "word/document.xml",
      suggestion: "Centralizar equações e adicionar tab stop direito para numeração.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "major",
      message: `${centeredEquations.length} equação(ões) centralizada(s) com tab stop direito.`,
    });
  }

  const hasOMMLStructure = /<m:oMath(?:\s[^>]*)?>[\s\S]*?<\/m:oMath>/.test(xml);
  if (!hasOMMLStructure) {
    results.push({
      status: "failed",
      severity: "critical",
      message: "OMML bruto ou malformado detectado.",
      location: "word/document.xml",
      suggestion: "Verificar estrutura OMML das equações.",
    });
  } else {
    results.push({
      status: "passed",
      severity: "critical",
      message: "Estrutura OMML válida detectada.",
    });
  }

  return results;
}
