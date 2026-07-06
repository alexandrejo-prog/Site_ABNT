function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownHeading(value: string): string {
  return value.replace(/^#{1,6}\s*/, "").trim();
}

interface HeadingFragmentPair {
  currentHeadings: string[];
  nextFragment: string;
}

const HEADING_FRAGMENT_PAIRS: HeadingFragmentPair[] = [
  { currentHeadings: ["OBJETIVOS"], nextFragment: "ESPECIFICOS" },
  { currentHeadings: ["CRONOGRAMA"], nextFragment: "DE EXECUCAO" },
  { currentHeadings: ["CONSIDERACOES"], nextFragment: "FINAIS" },
  { currentHeadings: ["REFERENCIAS"], nextFragment: "BIBLIOGRAFICAS" },
  { currentHeadings: ["FUNDAMENTACAO"], nextFragment: "TEORICA" },
  { currentHeadings: ["REVISAO"], nextFragment: "BIBLIOGRAFICA" },
  { currentHeadings: ["RESULTADOS"], nextFragment: "ESPERADOS" },
  { currentHeadings: ["MATERIAL E"], nextFragment: "METODOS" },
  { currentHeadings: ["RECURSOS"], nextFragment: "E ORCAMENTO" },
];

function isKnownHeadingFragment(currentLine: string, nextLine: string): boolean {
  const current = normalize(stripMarkdownHeading(currentLine)).replace(/^\d+(?:\.\d+)*\s+/, "");
  const next = normalize(nextLine);

  for (const pair of HEADING_FRAGMENT_PAIRS) {
    const normalizedHeadings = pair.currentHeadings.map((h) => normalize(h));
    const headingPattern = new RegExp(`^(${normalizedHeadings.join("|")})$`);

    if (headingPattern.test(current) && next === normalize(pair.nextFragment)) {
      return true;
    }
  }

  return false;
}

function nextNonEmptyLineIndex(lines: string[], startIndex: number): number | undefined {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim()) return index;
  }

  return undefined;
}

export function repairHeadingFragments(text: string): string {
  const lines = text.split(/\r?\n/);
  const repaired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const nextIndex = nextNonEmptyLineIndex(lines, index + 1);

    if (current.trim() && nextIndex !== undefined) {
      const next = lines[nextIndex];

      if (isKnownHeadingFragment(current.trim(), next.trim())) {
        repaired.push(`${current.trim()} ${next.trim()}`);
        index = nextIndex;
        continue;
      }
    }

    repaired.push(current);
  }

  return repaired.join("\n");
}

export function repairRecordHeadingFragments<T extends object>(record: T): T {
  const repairedEntries = Object.entries(record as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === "string" ? repairHeadingFragments(value) : value,
  ]);

  return Object.fromEntries(repairedEntries) as T;
}
