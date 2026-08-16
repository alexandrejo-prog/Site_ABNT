/**
 * Gera a fixture de equações para a análise física do PDF:
 *   artifacts/ufla-compliance/rendered/fixtures/eq-fixture.docx
 *   artifacts/ufla-compliance/rendered/fixtures/eq-fixture.pdf
 *
 * O DOCX é gerado pelo próprio exportador (editor com [EQ] + LaTeX → OMML
 * estrutural m:f/m:rad via parseLatexMath). O PDF é renderizado pelo Word COM
 * (esta máquina tem Word) — é o que permite validar fisicamente que a equação
 * declarada no OOXML foi renderizada (glifos matemáticos Unicode no PDF,
 * detectados por MATH_GLYPH_RE no analyze-pdf-physical.ts).
 *
 * Uso:
 *   npx tsx scripts/ufla-compliance/generate-equation-fixture.ts
 *
 * Sem Word o script gera apenas o DOCX e avisa que o PDF depende do Word.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
const fixturesDir = join(root, "artifacts", "ufla-compliance", "rendered", "fixtures");
const docxPath = join(fixturesDir, "eq-fixture.docx");
const pdfPath = join(fixturesDir, "eq-fixture.pdf");

const { emptyAcademicFields } = await import(pathToFileURL(join(root, "src", "ufla-rules.ts")).href);
const { generateDocxBlob } = await import(pathToFileURL(join(root, "src", "export-docx.ts")).href);

const fields = {
  ...emptyAcademicFields(),
  workType: "artigo" as const,
  author: "Maria Silva",
  title: "Equacoes e formulas",
  resumo: "Resumo do artigo com equacoes e formulas.",
  palavrasChave: "equacao; formula; OMML",
  referencias: "SILVA, M. Equacoes. Lavras: UFLA, 2024.",
};

const editorText = [
  "# 1 Introducao",
  "",
  "A equacao a seguir usa fracao e raiz (OMML estrutural):",
  "",
  "[EQ] \\frac{a}{b} + \\sqrt[3]{x} = x^2 (1.1)",
  "",
  "# 2 Desenvolvimento",
  "",
  "Texto com formula F = ma (1.2) no corpo.",
  "",
].join("\n");

mkdirSync(fixturesDir, { recursive: true });
const blob = await generateDocxBlob({ fields, editorText });
writeFileSync(docxPath, Buffer.from(await blob.arrayBuffer()));
console.log("DOCX:", docxPath);

// Renderiza com Word (caminho absoluto — o COM não resolve relativo).
const absDocx = resolve(docxPath);
const absPdf = resolve(pdfPath);
if (process.platform === "win32") {
  const psRender = join(__dirname, "render-docx-to-pdf.ps1");
  if (!existsSync(psRender)) {
    console.log("AVISO: render-docx-to-pdf.ps1 ausente — PDF não gerado.");
    process.exit(0);
  }
  try {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psRender, "-DocxPath", absDocx, "-PdfPath", absPdf],
      { stdio: "pipe", timeout: 180000 },
    );
    console.log("PDF:", pdfPath, existsSync(pdfPath) ? "OK" : "FALHOU");
  } catch (err) {
    console.log("AVISO: Word indisponível ou falhou ao renderizar — PDF não gerado (o DOCX serve ao nível OOXML).");
  }
} else {
  console.log("AVISO: plataforma sem Word COM — PDF não gerado. Rode em máquina com Word para validar a física.");
}
