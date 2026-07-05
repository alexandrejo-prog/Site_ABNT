function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceMarks(value: string): number {
  return (value.match(/[.!?]/g) ?? []).length;
}

function wordCount(value: string): number {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function endsAsNarrativeSentence(value: string): boolean {
  return /[.!?]$/.test(value.trim());
}

export function isLikelyImportedTitle(value: string): boolean {
  const title = clean(value);
  const words = wordCount(title);
  if (!title) return false;

  // Titulos academicos podem ser longos, mas nao devem ser um paragrafo narrativo inteiro.
  if (title.length > 260) return false;
  if (words > 34) return false;
  if (sentenceMarks(title) >= 2) return false;

  // Titulo importado de capa normalmente nao termina como frase narrativa.
  if (endsAsNarrativeSentence(title) && words > 7) return false;

  // Evita promover trecho de corpo, citação ou nota bibliografica para titulo.
  if (/\b(segundo|conforme|sobre|aparece|dizem|começa|contem|contém|constelação|referências?)\b/i.test(title) && words > 7) {
    return false;
  }

  return true;
}

export function sanitizeImportedTitle(value: string): string {
  const title = clean(value);
  return isLikelyImportedTitle(title) ? title : "";
}
