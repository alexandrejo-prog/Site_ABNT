const FORBIDDEN_CPG_HEADINGS = new Map<string, string>([
  ["SUMARIO", "SUMÁRIO"],
  ["FICHA CATALOGRAFICA", "FICHA CATALOGRÁFICA"],
  ["FOLHA DE APROVACAO", "FOLHA DE APROVAÇÃO"],
  ["INDICADORES DE IMPACTO", "INDICADORES DE IMPACTO"],
  ["IMPACT INDICATORS", "IMPACT INDICATORS"],
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

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
