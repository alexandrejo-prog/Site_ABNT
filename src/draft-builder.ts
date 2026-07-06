import { AcademicFields, WorkTypeValue, isCpgWork } from "./ufla-rules";

const PLACEHOLDER_PREFIX = "[PREENCHER:";

export function isDraftPlaceholder(value: string): boolean {
  return value.includes(`${PLACEHOLDER_PREFIX}`);
}

function line(value: string): string {
  return value.trim();
}

function heading(level: 1 | 2 | 3, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function optionalBlock(label: string, value: string, placeholderLabel: string, level: 1 | 2 | 3 = 2): string[] {
  const content = line(value);
  if (content) return [heading(level, label), content];
  return [heading(level, label), `${PLACEHOLDER_PREFIX} ${placeholderLabel}]`];
}

export function buildDraftFromFields(fields: AcademicFields): string {
  if (isCpgWork(fields.workType)) return buildCpgDraft(fields);

  const blocks: string[] = [];

  const tema = line(fields.tema);
  blocks.push(...optionalBlock("TEMA", tema, "tema"));

  const problema = line(fields.problemaPesquisa);
  blocks.push(...optionalBlock("PROBLEMA DE PESQUISA", problema, "problema de pesquisa"));

  const objetivoGeral = line(fields.objetivoGeral);
  blocks.push(...optionalBlock("OBJETIVO GERAL", objetivoGeral, "objetivo geral"));

  const objetivosEspecificos = line(fields.objetivosEspecificos);
  blocks.push(...optionalBlock("OBJETIVOS ESPECÍFICOS", objetivosEspecificos, "objetivos específicos"));

  const justificativa = line(fields.justificativa);
  blocks.push(...optionalBlock("JUSTIFICATIVA", justificativa, "justificativa"));

  const referencial = line(fields.referencialTeorico);
  blocks.push(...optionalBlock("REFERENCIAL TEÓRICO", referencial, "referencial teórico"));

  const corpus = line(fields.corpusDados);
  blocks.push(...optionalBlock("CORPUS/DADOS", corpus, "corpus ou dados"));

  const contexto = line(fields.contextoInstitucional);
  blocks.push(...optionalBlock("CONTEXTO INSTITUCIONAL", contexto, "contexto institucional"));

  const metodologia = line(fields.metodologia);
  blocks.push(...optionalBlock("METODOLOGIA", metodologia, "metodologia"));

  const resultados = line(fields.resultadosEsperados);
  blocks.push(...optionalBlock("RESULTADOS OU RESULTADOS ESPERADOS", resultados, "resultados ou resultados esperados"));

  const conclusao = line(fields.conclusaoProvisoria) || line(fields.conclusao);
  blocks.push(...optionalBlock("CONCLUSÃO PROVISÓRIA", conclusao, "conclusão provisória"));

  const contribuicoes = line(fields.contribuicoesImpactos);
  blocks.push(...optionalBlock("CONTRIBUIÇÕES/IMPACTOS", contribuicoes, "contribuições ou impactos"));

  const introducao = line(fields.introducao);
  if (introducao) blocks.push(heading(2, "INTRODUÇÃO"), introducao);

  return blocks.join("\n\n");
}

export function buildCpgDraft(fields: AcademicFields): string {
  const sections: string[] = [];
  sections.push(heading(1, "1 INTRODUÇÃO"));
  sections.push(line(fields.introducao) || `${PLACEHOLDER_PREFIX} introdução]`);
  sections.push("");
  sections.push(heading(1, "2 MATERIAIS E MÉTODOS"));
  sections.push(line(fields.metodologia) || `${PLACEHOLDER_PREFIX} materiais e métodos]`);
  sections.push("");
  sections.push(heading(1, "3 RESULTADOS E DISCUSSÃO"));
  sections.push(line(fields.resultadosEsperados) || `${PLACEHOLDER_PREFIX} resultados e discussão]`);
  sections.push("");
  sections.push(heading(1, "4 CONCLUSÃO"));
  sections.push(line(fields.conclusaoProvisoria) || line(fields.conclusao) || `${PLACEHOLDER_PREFIX} conclusão]`);
  sections.push("");
  sections.push(heading(1, "AGRADECIMENTOS"));
  sections.push(line(fields.agradecimentos) || `${PLACEHOLDER_PREFIX} agradecimentos]`);
  sections.push("");
  sections.push(heading(1, "REFERÊNCIAS"));
  sections.push(line(fields.referencias) || `${PLACEHOLDER_PREFIX} referências]`);
  return sections.join("\n");
}

export function buildImpactIndicatorsText(fields: AcademicFields): string {
  if (fields.workType !== "dissertacao" && fields.workType !== "tese") return "";
  const map: [string, string, string][] = [
    ["impactoSocial", fields.impactoSocial, "impacto social"],
    ["impactoCientifico", fields.impactoCientifico, "impacto científico"],
    ["impactoEducacional", fields.impactoEducacional, "impacto educacional"],
    ["impactoAmbiental", fields.impactoAmbiental, "impacto ambiental"],
    ["impactoTecnologico", fields.impactoTecnologico, "impacto tecnológico/econômico"],
    ["publicoBeneficiado", fields.publicoBeneficiado, "público beneficiado"],
    ["aderenciaOds", fields.aderenciaOds, "aderência a ODS ou política institucional"],
  ];
  const filled = map.filter(([, value]) => line(value).length > 0);
  if (filled.length === 0) return "";
  const lines: string[] = [];
  for (const [, value] of filled) {
    lines.push(`- ${line(value)}`);
  }
  return lines.join("\n");
}

export function hasUnfilledPlaceholders(draft: string): boolean {
  return isDraftPlaceholder(draft);
}

export function draftWorkTypeSupportsIndicators(workType: WorkTypeValue): boolean {
  return workType === "dissertacao" || workType === "tese";
}
