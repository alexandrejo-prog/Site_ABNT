/**
 * Executa o gate expandido UFLA para cada tipo de trabalho suportado.
 *
 * Uso: npx tsx scripts/ufla-compliance/run-gate-per-type.ts
 *
 * Gera um DOCX de exemplo por tipo (artigo, monografia/TCC, resumo expandido CPG,
 * projeto de pesquisa) com o exportador correspondente e roda o gate com o tipo
 * explicito. Escreve artifacts/ufla-compliance/gates-per-type.json.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import type { DocxLogoAsset } from "../../src/export-docx";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateArticleDocxBlob } from "../../src/export-article-docx";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx";
import { generateDocxBlob } from "../../src/export-docx";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";
import { generateGraduateEditableDraftDocxBlob } from "../../src/export-graduate-editable-draft-docx";
import { runFullComplianceGate } from "./gate";
import { countMojibakeLines } from "./mojibake-check";
import { checkLongQuoteFormatting, countLongQuoteLines } from "./long-quote-check";
import type { DocumentType } from "./document-type-matrix";
import { PER_TYPE_EDITOR_TEXT, PER_TYPE_FIELDS } from "./per-type-fixtures";
import { PER_PRODUCTION_FIXTURES, type ProductionFixture } from "./per-production-fixtures";
import { verifyProductionFormatContent } from "./verify-production-format";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUT_DIR = join(ROOT, "artifacts", "ufla-compliance", "per-type");
mkdirSync(OUT_DIR, { recursive: true });

interface TypeSpec {
  /** Chave no resultado (gates-per-type.json). */
  formatId: string;
  /** Tipo usado no gate expandido (matriz de requisitos). */
  type: DocumentType;
  label: string;
  filename: string;
  generate: () => Promise<Blob>;
  /** Formato da Coleção Produção Acadêmica: verifica requiredFields próprios no DOCX. */
  productionFixture?: ProductionFixture;
}

// Logo padrão da UFLA (mesmo asset do app) para os DOCX de exemplo por tipo —
// a capa real embute a marca (A2: logo presente na página 1 do PDF).
const DEFAULT_LOGO: DocxLogoAsset = {
  data: readFileSync(join(ROOT, "public", "assets", "ufla-logo.jpeg")),
  width: 265,
  height: 108,
};

export const PER_TYPE_SPECS: TypeSpec[] = [
  {
    formatId: "artigo",
    type: "artigo",
    label: "Artigo academico",
    filename: "artigo.docx",
    generate: () => generateArticleDocxBlob({ fields: PER_TYPE_FIELDS.artigo, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  {
    formatId: "tcc",
    type: "tcc",
    label: "Monografia/TCC",
    filename: "tcc.docx",
    generate: () => generateDocxBlob({ fields: PER_TYPE_FIELDS.tcc, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  {
    formatId: "resumo_expandido_cpg",
    type: "resumo_expandido_cpg",
    label: "Resumo expandido CPG",
    filename: "resumo-expandido-cpg.docx",
    generate: () => generateCpgDocxBlob({ fields: PER_TYPE_FIELDS.resumo_expandido_cpg, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  {
    formatId: "projeto_pesquisa",
    type: "projeto_pesquisa",
    label: "Projeto de pesquisa",
    filename: "projeto-pesquisa.docx",
    generate: () => generateResearchProjectDocxBlob({ fields: PER_TYPE_FIELDS.projeto_pesquisa, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  // Rascunho editável de trabalhos longos (monografia/dissertação/tese): mesmo
  // conteúdo do template padrão com patches de natureza/recuo/Curso.
  {
    formatId: "monografia_draft",
    type: "monografia",
    label: "Monografia (rascunho editavel)",
    filename: "monografia-draft.docx",
    generate: () => generateGraduateEditableDraftDocxBlob({ fields: PER_TYPE_FIELDS.monografia_draft, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  {
    formatId: "dissertacao_draft",
    type: "dissertacao",
    label: "Dissertacao (rascunho editavel)",
    filename: "dissertacao-draft.docx",
    generate: () => generateGraduateEditableDraftDocxBlob({ fields: PER_TYPE_FIELDS.dissertacao_draft, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  {
    formatId: "tese_draft",
    type: "tese",
    label: "Tese (rascunho editavel)",
    filename: "tese-draft.docx",
    generate: () => generateGraduateEditableDraftDocxBlob({ fields: PER_TYPE_FIELDS.tese_draft, editorText: PER_TYPE_EDITOR_TEXT, logo: DEFAULT_LOGO }),
  },
  // Coleção Produção Acadêmica UFLA: 8 formatos estruturados como artigo
  // (sem capa/folha de rosto/ficha/aprovação), cada um com requiredFields
  // próprios verificados no DOCX gerado (UFLA-formatos-20).
  ...PER_PRODUCTION_FIXTURES.map<TypeSpec>((fixture) => ({
    formatId: fixture.def.id,
    type: "artigo",
    label: fixture.def.label,
    filename: `${fixture.def.id}.docx`,
    generate: () => generateDocxBlob({ fields: fixture.fields, editorText: fixture.editorText, logo: DEFAULT_LOGO }),
    productionFixture: fixture,
  })),
];

export async function runPerTypeGates(options?: { only?: string[] }): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const { importDocumentFile } = await import(pathToFileURL(join(ROOT, "src", "import-docx.ts")).href);
  const specs = options?.only ? PER_TYPE_SPECS.filter((s) => options.only!.includes(s.formatId)) : PER_TYPE_SPECS;
  for (const spec of specs) {
    const path = join(OUT_DIR, spec.filename);
    const blob = await spec.generate();
    writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
    console.log(`Gerado: ${path}`);
  }

  for (const spec of specs) {
    const path = join(OUT_DIR, spec.filename);
    console.log(`\n=== Gate ${spec.label} (${spec.formatId}) ===`);
    const gate = await runFullComplianceGate(path, undefined, spec.type);

    // A7: mojibake zero por tipo — reimporta o DOCX gerado e conta linhas
    // corrompidas (mesma definição do DOCX de referência: Ã+alto ou U+FFFD).
    const generated = await importDocumentFile(
      new File([readFileSync(path)], spec.filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    );
    const mojibakeLines = countMojibakeLines(generated.editorText || "");
    if (mojibakeLines > 0) {
      gate.gaps.push(`mojibake: ${mojibakeLines} linhas corrompidas no DOCX gerado (encoding inválido)`);
      gate.passed = false;
    }

    // A4: citação longa por tipo — formatação verificada ocorrência a
    // ocorrência no DOCX gerado (recuo 4 cm / 11 pt / espaço simples),
    // sem falso-positivo quando o conteúdo não tem citação direta.
    const contentQuotes = countLongQuoteLines(generated.editorText || "");
    const longQuote = await checkLongQuoteFormatting(path, contentQuotes);
    if (!longQuote.passed) {
      gate.gaps.push(longQuote.gap!);
      gate.passed = false;
    }

    let contentCheck: { passed: boolean; missing: string[]; checked: number } | undefined;
    if (spec.productionFixture) {
      const check = verifyProductionFormatContent(path, spec.productionFixture);
      contentCheck = { passed: check.passed, missing: check.missing.map(String), checked: check.checked };
      if (!check.passed) {
        gate.gaps.push(`requiredFields próprios ausentes no DOCX: ${check.missing.join(", ")}`);
        gate.passed = false;
      }
    }

    results[spec.formatId] = {
      label: spec.label,
      docx: `per-type/${spec.filename}`,
      documentType: spec.type,
      requiredFieldsCheck: contentCheck ?? null,
      mojibake: { checked: true, mojibakeLines },
      longQuote: { checked: true, contentQuotes, formattedParas: longQuote.formattedParas, malformed: longQuote.malformed },
      passed: gate.passed,
      gaps: gate.gaps,
      categories: gate.results.map((r) => ({ name: r.name, passed: r.passed, errors: r.errors })),
    };
    console.log(gate.passed ? "PASSED" : `FAILED (${gate.gaps.length} gaps)`);
    for (const g of gate.gaps) console.log(`  - ${g}`);
  }
  return results;
}

async function main(): Promise<void> {
  const results = await runPerTypeGates();
  const payload = {
    schema: "ufla-audit/gates-per-type/v1",
    generatedAt: new Date().toISOString(),
    types: results,
  };
  const target = join(ROOT, "artifacts", "ufla-compliance", "gates-per-type.json");
  writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`\nOK: ${target}`);
}

// Executa standalone apenas quando chamado diretamente (não importado).
const isDirectRun = typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("run-gate-per-type.ts");
if (isDirectRun) {
  void main();
}
