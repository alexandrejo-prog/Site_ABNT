/**
 * Fixtures por formato da Coleção Produção Acadêmica UFLA.
 *
 * Cada formato (patente, revisão sistemática, estudo de caso, software,
 * cultivar, relatório de estágio, proposta de intervenção, artigo científico)
 * é estruturado como artigo (sem capa/folha de rosto/ficha/aprovação) e tem
 * requiredFields próprios definidos em src/academic-production-types.ts.
 *
 * O exportador de artigo renderiza diretamente: título, autor, resumo,
 * palavras-chave, abstract, keywords e referências. Os demais requiredFields
 * (curso, justificativa, cronograma, objetivos, resultados, referencial
 * teórico) são expressos como seções/linhas no editorText — garantindo que
 * todo requiredField tenha conteúdo verificável no DOCX gerado.
 */
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import {
  ACADEMIC_PRODUCTION_TYPES,
  type AcademicProductionTypeDefinition,
} from "../../src/academic-production-types";

/** Campos cujo conteúdo é uma SEÇÃO (heading no editorText), não um campo renderizado. */
export const PRODUCTION_SECTION_FIELDS = new Set(["introducao", "metodologia", "conclusao", "referencialTeorico"]);

/** Rótulo em pt-BR para campos de conteúdo expressos como linha no corpo. */
const FIELD_LABELS: Record<string, string> = {
  course: "Curso",
  justificativa: "Justificativa",
  cronograma: "Cronograma",
  objetivoGeral: "Objetivo geral",
  objetivosEspecificos: "Objetivos especificos",
  resultadosEsperados: "Resultados esperados",
};

const BASE: AcademicFields = {
  ...emptyAcademicFields(),
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

const INTRO_BODY = "Texto da introducao do trabalho.";
const DEV_BODY = "Texto do desenvolvimento do trabalho.";
const METHOD_BODY = "Texto da metodologia adotada no trabalho.";
const THEORETICAL_BODY = "Texto do referencial teorico adotado.";
const CONCL_BODY = "Texto das consideracoes finais do trabalho.";

/** Monta o editorText com as seções e linhas exigidas por cada formato. */
function buildEditorText(def: AcademicProductionTypeDefinition, fields: AcademicFields): string {
  const lines: string[] = ["# 1 Introducao", INTRO_BODY, "# 2 Desenvolvimento", DEV_BODY];
  if (def.requiredFields.includes("referencialTeorico")) {
    lines.push("# 3 Referencial Teorico", THEORETICAL_BODY);
  }
  if (def.requiredFields.includes("metodologia")) {
    lines.push("# 4 Metodologia", METHOD_BODY);
  }
  if (def.requiredFields.includes("conclusao")) {
    lines.push("# 5 Conclusao", CONCL_BODY);
  }
  // Seções recomendadas do guia da coleção (2 primeiras) para estrutura realista.
  const extra = def.recommendedSections
    .filter((s) => !/introdu/i.test(s) && !/metodolog/i.test(s) && !/conclu/i.test(s) && !/referenci/i.test(s))
    .slice(0, 2);
  for (const section of extra) {
    lines.push(`# ${lines.filter((l) => l.startsWith("# ")).length + 1} ${section}`, `Texto da secao ${section}.`);
  }
  // Campos de conteúdo que o exportador de artigo NÃO renderiza viram linha no corpo.
  for (const field of def.requiredFields) {
    if (PRODUCTION_SECTION_FIELDS.has(field)) continue;
    if (["author", "title", "resumo", "palavrasChave", "abstractText", "keywords", "referencias"].includes(field)) continue;
    const value = (fields as unknown as Record<string, string>)[field];
    if (value && value.trim()) lines.push(`${FIELD_LABELS[field] ?? field}: ${value}`);
  }
  return lines.join("\n");
}

/** Valores de campos de conteúdo por formato (além do BASE). */
const FIELD_OVERRIDES: Record<string, Partial<AcademicFields>> = {
  patente_ufla: { referencialTeorico: THEORETICAL_BODY },
  revisao_sistematica_ufla: { objetivoGeral: "Sintetizar a literatura sobre acesso aberto." },
  estudo_caso_ufla: {},
  software_aplicativo_ufla: { objetivoGeral: "Desenvolver um aplicativo de apoio." },
  cultivar_ufla: {},
  relatorio_estagio_ufla: { course: "Bacharelado em Biologia" },
  proposta_intervencao_ufla: {
    justificativa: "Justificativa da proposta de intervencao.",
    objetivoGeral: "Planejar uma intervencao no servico.",
    cronograma: "Quadro 1 - Cronograma de execucao da pesquisa\n1o semestre: revisao bibliografica\nFonte: elaborado pelo autor (2026).",
  },
};

export interface ProductionFixture {
  def: AcademicProductionTypeDefinition;
  fields: AcademicFields;
  editorText: string;
}

export const PER_PRODUCTION_FIXTURES: ProductionFixture[] = ACADEMIC_PRODUCTION_TYPES.map((def) => {
  const fields: AcademicFields = {
    ...BASE,
    ...(FIELD_OVERRIDES[def.id] ?? {}),
    workType: def.id,
  };
  return { def, fields, editorText: buildEditorText(def, fields) };
});

export function productionFixtureFor(formatId: string): ProductionFixture | undefined {
  return PER_PRODUCTION_FIXTURES.find((f) => f.def.id === formatId);
}
