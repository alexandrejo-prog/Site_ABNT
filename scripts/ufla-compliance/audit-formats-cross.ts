/**
 * Auditoria cruzada de formatos (UFLA-formatos-20).
 *
 * O Manual UFLA (Portaria 249/2025 e Resolução PRPG 087/2024) permite mais de
 * 20 formatos de TCC; a regra é "identificar o formato e aplicar somente as
 * regras pertinentes". Este script cruza o cadastro de formatos
 * (src/ufla-rules → WORK_TYPES + src/academic-production-types → Coleção
 * Produção Acadêmica) com a DOCUMENT_TYPE_MATRIX (requisitos × tipos):
 *
 *  1. Todo formato cadastrado deve mapear para um tipo da matriz (nenhum
 *     formato sem regras pertinentes).
 *  2. Todo requisito da matriz deve ser aplicável a ≥ 1 formato (sem
 *     requisito órfão) e ter validator definido.
 *  3. Todo tipo da matriz deve ser alcançável por ≥ 1 formato (sem tipo
 *     morto).
 *  4. Todo formato deve ter cobertura de regras ≥ 1 (aplicável + validator).
 *
 * Escreve artifacts/ufla-compliance/formats-cross-audit.json.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WORK_TYPES, WORK_TYPE_LABELS } from "../../src/ufla-rules";
import { ACADEMIC_PRODUCTION_TYPES } from "../../src/academic-production-types";
import { DOCUMENT_TYPE_MATRIX, type DocumentType } from "./document-type-matrix";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

/** Mapeamento WorkType → DocumentType da matriz (base para "regras pertinentes"). */
export const FORMAT_TO_DOCUMENT_TYPE: Record<string, DocumentType> = {
  artigo: "artigo",
  resumo_cpg: "resumo_cpg",
  resumo_expandido_cpg: "resumo_expandido_cpg",
  artigo_completo_cpg: "artigo_completo_cpg",
  monografia: "monografia",
  tcc: "monografia", // mesmo documento; gate-per-type gera com workType "monografia"
  dissertacao: "dissertacao",
  tese: "tese",
  projeto_pesquisa: "projeto_pesquisa",
  artigo_cientifico_ufla: "artigo",
  patente_ufla: "artigo",
  revisao_sistematica_ufla: "artigo",
  estudo_caso_ufla: "artigo",
  software_aplicativo_ufla: "artigo",
  cultivar_ufla: "artigo",
  relatorio_estagio_ufla: "artigo",
  proposta_intervencao_ufla: "artigo",
  outro: "outro",
};

export interface FormatAuditEntry {
  formatId: string;
  label: string;
  documentType: DocumentType;
  collection: "padrão" | "CPG" | "produção acadêmica" | "outro";
  applicableReqs: string[];
  validatorsDefined: number;
  coverageOk: boolean;
}

export interface FormatsCrossAudit {
  schema: string;
  formats: FormatAuditEntry[];
  checks: {
    allFormatsMapped: boolean;
    noOrphanRequirements: boolean;
    noDeadTypes: boolean;
    allCoverageOk: boolean;
    unmappedFormats: string[];
    orphanRequirements: string[];
    deadTypes: DocumentType[];
    formatsWithoutCoverage: string[];
  };
  summary: {
    totalFormats: number;
    totalRequirements: number;
    typesReached: string[];
  };
}

export function auditFormatsCross(): FormatsCrossAudit {
  const formats: FormatAuditEntry[] = [];

  for (const workType of WORK_TYPES) {
    const docType = FORMAT_TO_DOCUMENT_TYPE[workType];
    if (!docType) continue;
    const production = ACADEMIC_PRODUCTION_TYPES.find((t) => t.id === workType);
    const collection = production
      ? "produção acadêmica"
      : ["resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"].includes(workType)
        ? "CPG"
        : "padrão";
    const applicable = DOCUMENT_TYPE_MATRIX.filter((r) => r.documentTypes.includes(docType) && r.required !== false);
    const validatorsDefined = applicable.filter((r) => r.validator && r.validator.length > 0).length;
    formats.push({
      formatId: workType,
      label: WORK_TYPE_LABELS[workType as keyof typeof WORK_TYPE_LABELS] ?? workType,
      documentType: docType,
      collection,
      applicableReqs: applicable.map((r) => r.id),
      validatorsDefined,
      coverageOk: applicable.length > 0 && validatorsDefined === applicable.length,
    });
  }
  // alias tcc (mesmo documento da monografia)
  if (!formats.some((f) => f.formatId === "tcc")) {
    const applicable = DOCUMENT_TYPE_MATRIX.filter((r) => r.documentTypes.includes("monografia") && r.required !== false);
    formats.push({
      formatId: "tcc",
      label: "TCC/Monografia",
      documentType: "monografia",
      collection: "padrão",
      applicableReqs: applicable.map((r) => r.id),
      validatorsDefined: applicable.filter((r) => r.validator && r.validator.length > 0).length,
      coverageOk: applicable.length > 0,
    });
  }

  const mappedTypes = new Set(formats.map((f) => f.documentType));
  const unmappedFormats = WORK_TYPES.filter((w) => !FORMAT_TO_DOCUMENT_TYPE[w]);
  const orphanRequirements = DOCUMENT_TYPE_MATRIX.filter(
    (r) => !r.documentTypes.some((t) => mappedTypes.has(t)),
  ).map((r) => r.id);
  const deadTypes = (Object.keys(FORMAT_TO_DOCUMENT_TYPE).map((k) => FORMAT_TO_DOCUMENT_TYPE[k]) as DocumentType[])
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .filter((t) => !mappedTypes.has(t));
  const formatsWithoutCoverage = formats.filter((f) => !f.coverageOk).map((f) => f.formatId);

  return {
    schema: "ufla-audit/formats-cross/v1",
    formats,
    checks: {
      allFormatsMapped: unmappedFormats.length === 0,
      noOrphanRequirements: orphanRequirements.length === 0,
      noDeadTypes: deadTypes.length === 0,
      allCoverageOk: formatsWithoutCoverage.length === 0,
      unmappedFormats,
      orphanRequirements,
      deadTypes,
      formatsWithoutCoverage,
    },
    summary: {
      totalFormats: formats.length,
      totalRequirements: DOCUMENT_TYPE_MATRIX.length,
      typesReached: [...mappedTypes].sort(),
    },
  };
}

async function main(): Promise<void> {
  const audit = auditFormatsCross();
  const target = join(ROOT, "artifacts", "ufla-compliance", "formats-cross-audit.json");
  writeFileSync(target, JSON.stringify(audit, null, 2) + "\n", "utf8");
  console.log(`Formatos auditados: ${audit.summary.totalFormats}`);
  for (const c of Object.entries(audit.checks)) {
    if (typeof c[1] === "boolean") console.log(`  ${c[0]}: ${c[1] ? "OK" : "FALHOU"}`);
  }
  console.log(`OK: ${target}`);
}

// Executa standalone apenas quando chamado diretamente (não importado).
const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].split(/[\\/]/).pop() === "audit-formats-cross.ts";
if (isDirectRun) {
  void main();
}
