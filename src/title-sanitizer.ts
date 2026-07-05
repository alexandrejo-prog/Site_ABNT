function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceMarks(value: string): number {
  return (value.match(/[.!?]/g) ?? []).length;
}

function wordCount(value: string): number {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

export function isLikelyImportedTitle(value: string): boolean {
  const title = clean(value);
  if (!title) return false;

  // Titulos academicos podem ser longos, mas nao devem ser um paragrafo narrativo inteiro.
  if (title.length > 260) return false;
  if (wordCount(title) > 34) return false;
  if (sentenceMarks(title) >= 2) return false;

  // Evita promover trecho de corpo, citação ou nota bibliografica para titulo.
  if (/\b(segundo|conforme|sobre|aparece|dizem|começa|constelação|referências?)\b/i.test(title) && wordCount(title) > 18) {
    return false;
  }

  return true;
}

export function sanitizeImportedTitle(value: string): string {
  const title = clean(value);
  return isLikelyImportedTitle(title) ? title : "";
}
