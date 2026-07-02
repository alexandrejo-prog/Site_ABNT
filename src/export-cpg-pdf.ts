import { parseEditorContent, type DocxGenerationInput } from "./export-docx";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CM_TO_PT = 28.3464567;
const MARGIN_LEFT = 3 * CM_TO_PT;
const MARGIN_RIGHT = 3 * CM_TO_PT;
const MARGIN_TOP = 3.5 * CM_TO_PT;
const MARGIN_BOTTOM = 2.5 * CM_TO_PT;

function escapePdfText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = escapePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function collectCpgLines(input: DocxGenerationInput): string[] {
  const blocks = parseEditorContent(input.editorText);
  const editorReferences = blocks
    .filter((block) => block.type === "reference")
    .map((block) => block.text);
  const body = blocks
    .filter((block) => block.type !== "reference")
    .map((block) => block.text);

  if (input.fields.workType === "resumo_cpg") {
    return [
      input.fields.title,
      input.fields.author,
      input.fields.program,
      input.fields.course,
      input.fields.palavrasChave ? `Palavras-chave: ${input.fields.palavrasChave}` : "",
      input.fields.resumo || input.editorText,
      input.fields.agradecimentos ? `Agradecimentos: ${input.fields.agradecimentos}` : "",
    ].filter(Boolean);
  }

  return [
    input.fields.title,
    input.fields.author,
    input.fields.program,
    input.fields.course,
    input.fields.abstractText ? `Abstract. ${input.fields.abstractText}` : "",
    input.fields.keywords ? `Keywords: ${input.fields.keywords}` : "",
    input.fields.resumo ? `Resumo. ${input.fields.resumo}` : "",
    input.fields.palavrasChave ? `Palavras-chave: ${input.fields.palavrasChave}` : "",
    ...body,
    ...(input.fields.referencias || editorReferences.length ? ["Referencias"] : []),
    ...splitParagraphs(input.fields.referencias),
    ...editorReferences,
  ].filter(Boolean);
}

function buildContentStream(input: DocxGenerationInput): string {
  const maxChars = 78;
  const lineHeight = 15;
  const bottomLimit = MARGIN_BOTTOM;
  let y = PAGE_HEIGHT - MARGIN_TOP;
  const commands = ["BT", "/F1 12 Tf", `${MARGIN_LEFT.toFixed(2)} ${y.toFixed(2)} Td`];

  for (const paragraph of collectCpgLines(input)) {
    const lines = wrapText(paragraph, maxChars);
    for (const line of lines) {
      if (y < bottomLimit) {
        commands.push("ET");
        commands.push("BT");
        y = PAGE_HEIGHT - MARGIN_TOP;
        commands.push(`${MARGIN_LEFT.toFixed(2)} ${y.toFixed(2)} Td`);
        commands.push("/F1 12 Tf");
      }
      commands.push(`(${line}) Tj`);
      commands.push(`0 -${lineHeight} Td`);
      y -= lineHeight;
    }
    commands.push("0 -6 Td");
    y -= 6;
  }

  commands.push("ET");
  return commands.join("\n");
}

function makePdf(content: string): Uint8Array {
  const encoder = new TextEncoder();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

export async function generateCpgPdfBlob(input: DocxGenerationInput): Promise<Blob> {
  const bytes = makePdf(buildContentStream(input));
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  return new Blob([data], { type: "application/pdf" });
}
