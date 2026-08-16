import { readFileSync } from "node:fs";
import { join } from "node:path";

const data = JSON.parse(readFileSync(join(process.cwd(), "artifacts/ufla-compliance/baseline-extraction.json"), "utf8"));
const paras = data.paragraphs || [];
const targets = ["INTRODUÇÃO", "REFERENCIAL TEÓRICO", "METODOLOGIA", "RESULTADOS", "CONSIDERAÇÕES FINAIS", "REFERÊNCIAS", "APÊNDICES", "ANEXOS"];
for (const t of targets) {
  const idx = paras.findIndex((p: any) => p.text && p.text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase() === t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
  console.log(idx >= 0 ? "FOUND" : "MISSING", t, idx >= 0 ? "index=" + idx : "");
}