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

function numberedPrefixPattern(): string {
  return "(?:\\d+(?:\\.\\d+)*\\s+)?";
}

function isKnownHeadingFragment(currentLine: string, nextLine: string): boolean {
  const current = normalize(stripMarkdownHeading(currentLine));
  const next = normalize(nextLine);
  const prefix = numberedPrefixPattern();

  return (
    (next === "ESPECIFICOS" && new RegExp(`^${prefix}OBJETIVOS$`).test(current)) ||
    (next === "DE EXECUCAO" && new RegExp(`^${prefix}CRONOGRAMA$`).test(current))
  );
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
    const next = nextIndex === undefined ? undefined : lines[nextIndex];

    if (current.trim() && next !== undefined && isKnownHeadingFragment(current.trim(), next.trim())) {
      repaired.push(`${current.trim()} ${next.trim()}`);
      index = nextIndex;
      continue;
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
