/**
 * Gera o DOCX equivalente a dissertacao de referencia (dissertacao-geometria-sistema.docx)
 * a partir do conteudo real extraido da referencia. Baseline-driven: nenhum valor hardcoded
 * de estilo e inventado aqui — apenas o conteudo real + os campos AcademicFields.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import type { AcademicFields } from "../../src/ufla-rules";

const TEMP = process.env.TEMP ?? ".";
const OUT = process.env.UFLA_COMPLIANCE_OUT ?? `${TEMP}\\opencode`;

const content = JSON.parse(readFileSync(`${OUT}\\ref-content.json`, "utf-8"));
const body = JSON.parse(readFileSync(`${OUT}\\ref-body.json`, "utf-8"));

function buildEditorText(paragraphs: string[]): string {
  const lines: string[] = [];
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    const m = p.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (m && m[1].split(".").length === 1) {
      lines.push(`# ${p}`);
    } else if (m) {
      const depth = m[1].split(".").length - 1;
      lines.push(`${depth === 1 ? "##" : depth >= 2 ? "###" : "#"} ${p}`);
    } else {
      lines.push(p);
    }
  }
  return lines.join("\n");
}

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "dissertacao",
  author: content.author,
  title: content.title,
  location: content.location,
  year: content.year,
  resumo: content.resumo,
  palavrasChave: content.palavras_chave.replace(/^Palavras-chave:\s*/i, ""),
  abstractText: content.abstract || "",
  keywords: content.keywords || "",
  referencias: (content.referencias as string[]).join("\n"),
  indicadoresImpacto: content.indicadores_nota ?? "",
};

async function main() {
  const blob = await generateDocxBlob({ fields, editorText: buildEditorText(body.body_paragraphs) });
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync(`${OUT}\\generated.docx`, buf);
  console.log(`OK generated.docx ${buf.length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});