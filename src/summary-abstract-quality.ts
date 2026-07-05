export interface TextualSummaryQuality {
  wordCount: number;
  paragraphCount: number;
  hasKeywords: boolean;
  keywordCount: number;
  singleParagraph: boolean;
  wordCountOk: boolean;
  keywordCountOk: boolean;
  readyForManualReview: boolean;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function paragraphCount(text: string): number {
  return text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).length;
}

function keywordCount(text: string): number {
  return text.split(/[;.]/).map((part) => part.trim()).filter(Boolean).length;
}

export function assessSummaryQuality(summary: string, keywords: string): TextualSummaryQuality {
  const words = wordCount(summary);
  const paragraphs = paragraphCount(summary);
  const terms = keywordCount(keywords);
  const hasKeywords = terms > 0;
  const wordCountOk = words >= 150 && words <= 500;
  const singleParagraph = paragraphs <= 1;
  const keywordCountOk = terms >= 3 && terms <= 5;

  return {
    wordCount: words,
    paragraphCount: paragraphs,
    hasKeywords,
    keywordCount: terms,
    singleParagraph,
    wordCountOk,
    keywordCountOk,
    readyForManualReview: wordCountOk && singleParagraph && keywordCountOk,
  };
}

export function summaryQualityMessage(label: string, quality: TextualSummaryQuality): string {
  const problems: string[] = [];
  if (!quality.wordCountOk) problems.push(`${quality.wordCount} palavra(s)`);
  if (!quality.singleParagraph) problems.push(`${quality.paragraphCount} parágrafo(s)`);
  if (!quality.keywordCountOk) problems.push(`${quality.keywordCount} termo(s)`);

  if (!problems.length) return `${label} pronto para revisão manual.`;
  return `${label} precisa de ajuste: ${problems.join(", ")}.`;
}
