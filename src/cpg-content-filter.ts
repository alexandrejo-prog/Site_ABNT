const FORBIDDEN_CPG_HEADINGS = new Map<string, string>([
  ["CAPA", "CAPA"],
  ["FOLHA DE ROSTO", "FOLHA DE ROSTO"],
  ["SUMARIO", "SUMÁRIO"],
  ["FICHA CATALOGRAFICA", "FICHA CATALOGRÁFICA"],
  ["FOLHA DE APROVACAO", "FOLHA DE APROVAÇÃO"],
  ["DEDICATORIA", "DEDICATÓRIA"],
  ["AGRADECIMENTOS", "AGRADECIMENTOS"],
  ["EPIGRAFE", "EPÍGRAFE"],
  ["INDICADORES DE IMPACTO", "INDICADORES DE IMPACTO"],
  ["IMPACT INDICATORS", "IMPACT INDICATORS"],
  ["APENDICE", "APÊNDICE"],
  ["APENDICES", "APÊNDICES"],
  ["ANEXO", "ANEXO"],
  ["ANEXOS", "ANEXOS"],
]);

function normalizeHeading(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "")
    .replace(/^\d+(?:\.\d+)*\s+/, "")
    .replace(/[:.\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const withoutMarkdown = trimmed.replace(/^#{1,6}\s*/, "");
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^\d+(?:\.\d+)*\s+\S+/.test(withoutMarkdown)) return true;
  if (/^\[?[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s:.\-–—]+\]?$/.test(withoutMarkdown) && withoutMarkdown.length <= 90) return true;
  return false;
}

function isTopLevelNumberedHeading(line: string): boolean {
  return /^\s*(?:#{1,6}\s*)?\d+\s+\S+/.test(line) && !/^\s*(?:#{1,6}\s*)?\d+\.\d+/.test(line);
}

function renumberTopLevelHeadings(text: string): string {
  let nextNumber = 1;
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!isTopLevelNumberedHeading(line)) return line;
      return line.replace(/^(\s*(?:#{1,6}\s*)?)\d+(\s+\S.*)$/u, (_match, prefix: string, rest: string) => {
        const updated = `${prefix}${nextNumber}${rest}`;
        nextNumber += 1;
        return updated;
      });
    })
    .join("\n");
}

export function cpgForbiddenHeadingLabel(line: string): string | null {
  if (!isLikelyHeadingLine(line)) return null;
  return FORBIDDEN_CPG_HEADINGS.get(normalizeHeading(line)) ?? null;
}

export function stripCpgForbiddenSections(editorText: string): string {
  const lines = editorText.split(/\r?\n/);
  const kept: string[] = [];
  let skippingForbiddenSection = false;

  for (const line of lines) {
    const forbiddenLabel = cpgForbiddenHeadingLabel(line);
    if (forbiddenLabel) {
      skippingForbiddenSection = true;
      continue;
    }

    if (skippingForbiddenSection) {
      if (isLikelyHeadingLine(line)) {
        skippingForbiddenSection = false;
        kept.push(line);
      }
      continue;
    }

    kept.push(line);
  }

  return renumberTopLevelHeadings(kept.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

export function hasCpgForbiddenSections(editorText: string): boolean {
  return editorText.split(/\r?\n/).some((line) => cpgForbiddenHeadingLabel(line) !== null);
}
