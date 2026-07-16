const TERMINAL_ACADEMIC_HEADING = /^(?:REFER[├èE]NCIAS|CONCLUS[├âA]O|CONSIDERA[├çC][├òO]ES FINAIS|AP[├èE]NDICES?|ANEXOS?)(?:\s+[A-Z0-9├ü├Ç├é├â├ë├è├ì├ô├ö├ò├Ü├£├ç][^.!?;:]*)?$/iu;
const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/u;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function isPdfTocEligibleHeadingText(text: string): boolean {
  const value = clean(text);
  if (!value || value.length > 180) return false;
  if (TERMINAL_ACADEMIC_HEADING.test(value)) return true;

  const match = value.match(NUMBERED_HEADING);
  if (!match) return false;
  const title = match[2].trim();
  if (!title || title.length > 160) return false;
  if (/^[a-z├í├á├ó├ú├®├¬├¡├│├┤├Á├║├╝├º]/u.test(title)) return false;
  if (!/^[A-Z├ü├Ç├é├â├ë├è├ì├ô├ö├ò├Ü├£├ç]/u.test(title)) return false;
  if (/[.!?;:]\s*$/u.test(title)) return false;
  if (/\d+(?:[.,]\d+)?\s*%/u.test(title)) return false;
  if (/^(?:funciona|funcionou|tem|t├¬m|teve|foram|foi|descreve|apresenta|indica|mostra)\b/iu.test(title)) return false;
  return true;
}

export function pdfTocHeadingLevel(text: string): number {
  const value = clean(text);
  const match = value.match(NUMBERED_HEADING);
  if (!match) return 1;
  return Math.min(4, match[1].split(".").length);
}
