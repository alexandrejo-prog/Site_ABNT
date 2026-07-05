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

function isObjectivesFragment(currentLine: string, nextLine: string): boolean {
  const current = normalize(stripMarkdownHeading(currentLine));
  const next = normalize(nextLine);

  return next === "ESPECIFICOS" && /^(?:\d+(?:\.\d+)*\s+)?OBJETIVOS$/.test(current);
}

export function repairHeadingFragments(text: string): string {
  const lines = text.split(/\r?\n/);
  const repaired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (next !== undefined && isObjectivesFragment(current.trim(), next.trim())) {
      repaired.push(`${current.trim()} ${next.trim()}`);
      index += 1;
      continue;
    }

    repaired.push(current);
  }

  return repaired.join("\n");
}

export function repairRecordHeadingFragments<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" ? repairHeadingFragments(value) : value,
    ]),
  ) as T;
}
