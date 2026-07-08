export function normalizeUflaManualInTextCitations(value: string): string {
  return value.replace(
    /\(UNIVERSIDADE FEDERAL DE LAVRAS,\s*2024,\s*p\.\s*([^)]+)\)/giu,
    (_match: string, pages: string) => `(UNIVERSIDADE FEDERAL DE LAVRAS, 2025, p. ${pages.trim()})`,
  );
}
