/**
 * Detecção de mojibake/encoding para DOCX gerados.
 *
 * Mesma definição usada pelo regenerate na evidência do DOCX de referência:
 * mojibake real é UTF-8 lido como latin1 — "Ã" seguido de acento alto
 * (C2–C3 codificados em CP1252) — ou U+FFFD (replacement char).
 * Extraído para o gate por tipo (A7) e o regenerate compartilharem a MESMA
 * definição (fonte única, sem divergência de regex).
 */

export const MOJIBAKE_RE = /Ã[¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿]/u;

/** Número de linhas não-vazias com mojibake real (Ã+alto ou U+FFFD). */
export function countMojibakeLines(text: string): number {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (MOJIBAKE_RE.test(line) || line.includes("\uFFFD")) count++;
  }
  return count;
}
