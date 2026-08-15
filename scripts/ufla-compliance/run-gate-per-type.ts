/**
 * Executa o gate expandido UFLA para cada tipo de trabalho suportado.
 *
 * Uso: npx tsx scripts/ufla-compliance/run-gate-per-type.ts
 *
 * Gera um DOCX de exemplo por tipo (artigo, monografia/TCC, resumo expandido CPG,
 * projeto de pesquisa) com o exportador correspondente e roda o gate com o tipo
 * explicito. Escreve artifacts/ufla-compliance/gates-per-type.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateArticleDocxBlob } from "../../src/export-article-docx";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx";
import { generateDocxBlob } from "../../src/export-docx";
import { generateResearchProjectDocxBlob } from "../../src/export-research-project-docx";
import { runFullComplianceGate } from "./gate";
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

export const PER_TYPE_SPECS: TypeSpec[] = [
  {
    formatId: "artigo",
    type: "artigo",
    label: "Artigo academico",
    filename: "artigo.docx",
    generate: () => generateArticleDocxBlob({ fields: PER_TYPE_FIELDS.artigo, editorText: PER_TYPE_EDITOR_TEXT }),
  },
  {
    formatId: "tcc",
    type: "tcc",
    label: "Monografia/TCC",
    filename: "tcc.docx",
    generate: () => generateDocxBlob({ fields: PER_TYPE_FIELDS.tcc, editorText: PER_TYPE_EDITOR_TEXT }),
  },
  {
    formatId: "resumo_expandido_cpg",
    type: "resumo_expandido_cpg",
    label: "Resumo expandido CPG",
    filename: "resumo-expandido-cpg.docx",
    generate: () => generateCpgDocxBlob({ fields: PER_TYPE_FIELDS.resumo_expandido_cpg, editorText: PER_TYPE_EDITOR_TEXT }),
  },
  {
    formatId: "projeto_pesquisa",
    type: "projeto_pesquisa",
    label: "Projeto de pesquisa",
    filename: "projeto-pesquisa.docx",
    generate: () => generateResearchProjectDocxBlob({ fields: PER_TYPE_FIELDS.projeto_pesquisa, editorText: PER_TYPE_EDITOR_TEXT }),
  },
  // Coleção Produção Acadêmica UFLA: 8 formatos estruturados como artigo
  // (sem capa/folha de rosto/ficha/aprovação), cada um com requiredFields
  // próprios verificados no DOCX gerado (UFLA-formatos-20).
  ...PER_PRODUCTION_FIXTURES.map<TypeSpec>((fixture) => ({
    formatId: fixture.def.id,
    type: "artigo",
    label: fixture.def.label,
    filename: `${fixture.def.id}.docx`,
    generate: () => generateDocxBlob({ fields: fixture.fields, editorText: fixture.editorText }),
    productionFixture: fixture,
  })),
];

export async function runPerTypeGates(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  for (const spec of PER_TYPE_SPECS) {
    const path = join(OUT_DIR, spec.filename);
    const blob = await spec.generate();
    writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
    console.log(`Gerado: ${path}`);
  }

  for (const spec of PER_TYPE_SPECS) {
    const path = join(OUT_DIR, spec.filename);
    console.log(`\n=== Gate ${spec.label} (${spec.formatId}) ===`);
    const gate = await runFullComplianceGate(path, undefined, spec.type);

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
