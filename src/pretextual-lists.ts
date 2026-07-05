export interface PretextualEntry {
  type: "figure" | "table" | "abbreviation";
  label: string;
  title: string;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractFiguresAndTables(text: string): PretextualEntry[] {
  return text
    .split(/\n+/)
    .map(clean)
    .filter(Boolean)
    .flatMap((line) => {
      const figure = line.match(/^(Figura|Imagem|Quadro|Grafico|Gráfico|Mapa)\s+(\d+)\s*[-–—:]\s*(.+)$/i);
      if (figure) {
        return [{ type: "figure" as const, label: `${figure[1]} ${figure[2]}`, title: figure[3] }];
      }

      const table = line.match(/^(Tabela)\s+(\d+)\s*[-–—:]\s*(.+)$/i);
      if (table) {
        return [{ type: "table" as const, label: `${table[1]} ${table[2]}`, title: table[3] }];
      }

      return [];
    });
}

export function extractAbbreviations(text: string): PretextualEntry[] {
  const candidates = new Set<string>();
  const pattern = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:-[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,})?\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[0];
    if (!/^\d+$/.test(value) && value.length <= 12) candidates.add(value);
  }

  return Array.from(candidates)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => ({ type: "abbreviation" as const, label: value, title: "Definir significado" }));
}

export function extractPretextualEntries(text: string): PretextualEntry[] {
  return [...extractFiguresAndTables(text), ...extractAbbreviations(text)];
}

export function hasConditionalPretextualList(text: string, type: PretextualEntry["type"]): boolean {
  return extractPretextualEntries(text).some((entry) => entry.type === type);
}
