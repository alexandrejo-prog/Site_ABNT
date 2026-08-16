import {
  AcademicFields,
  WorkTypeValue,
  isAdvisorRequired,
  isCpgWork,
  isResearchProject,
  isUflaCollectionWork,
} from "./ufla-rules";
import { validateReferencesText } from "./references-validator";
import { hasCatalogCardContent, hasCutterNumber } from "./catalog-card";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "./academic-production-types";
import {
  detectAbstractTopicConflict,
  detectCpgForbiddenStructures,
  detectControlledPlaceholder,
  detectGenericAiLikeText,
  detectNaturalPlaceholder,
  detectPlaceholderText,
  detectProgramConflict,
} from "./academic-guardrails";
import { assessAbstractHeuristics, assessResumoHeuristics } from "./text-diagnostics";
import { hasSufficientImpactIndicators } from "./impact-indicators";
import { findUflaPpgProgram, findUflaPpgPrograms, resolveUflaPpgProgram, type UflaPpgProgram } from "./ufla-ppg-programs";
import { getWorkTypeRequirements } from "./work-type-requirements";

export type ValidationSeverity = "error" | "warning" | "info";

export const FIELD_TARGET_WORK_TYPE = "__work_type__";
export const FIELD_TARGET_EDITOR = "__editor__";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  what?: string;
  why?: string;
  action?: string;
  /**
   * Alvo de navegação ("Corrigir campo"). Correspondem a chaves de campo,
   * FIELD_TARGET_EDITOR ("__editor__") ou FIELD_TARGET_WORK_TYPE ("__work_type__").
   */
  fieldKey?: string;
}

export interface AdherenceCategory {
  key: string;
  label: string;
  status: "implemented" | "partial" | "pending" | "manual";
  statusLabel: string;
  note?: string;
}

export const ADHERENCE_CATEGORIES: AdherenceCategory[] = [
  { key: "metadata", label: "Metadados", status: "implemented", statusLabel: "Implementado", note: "Tipo de trabalho, autor, título, orientador e campos básicos são editáveis." },
  { key: "pretextual", label: "Elementos pré-textuais", status: "partial", statusLabel: "Parcial", note: "Capa, folha de rosto, resumo e abstract são gerados quando o tipo de trabalho exige esses elementos." },
  { key: "resumo", label: "Resumo", status: "partial", statusLabel: "Parcial", note: "Estrutura e campo são gerados. Validação de extensão, parágrafo único e palavras-chave está implementada como alerta." },
  { key: "abstract", label: "Abstract", status: "partial", statusLabel: "Parcial", note: "Estrutura e campo são gerados. Validação de extensão, parágrafo único e keywords está implementada como alerta." },
  { key: "keywords", label: "Palavras-chave", status: "implemented", statusLabel: "Implementado", note: "Campo editável com validação de quantidade e separação por ponto e vírgula." },
  { key: "body", label: "Corpo do texto", status: "implemented", statusLabel: "Implementado", note: "Editor com títulos, citações longas, negrito e itálico. Espaçamento 1,5 aplicado no DOCX." },
  { key: "illustrations", label: "Ilustrações e tabelas", status: "partial", statusLabel: "Parcial", note: "Imagens importadas são preservadas como marcadores. Legendas e fontes devem ser conferidas manualmente." },
  { key: "references", label: "Referências", status: "partial", statusLabel: "Parcial", note: "Normalização de destaque (negrito) implementada com detecção de tipo. Itens ambíguos exigem revisão manual." },
  { key: "posttextual", label: "Elementos pós-textuais", status: "partial", statusLabel: "Parcial", note: "Referências, apêndices, anexos, glossário e índice (remissivo, NBR 6034) são suportados." },
  { key: "export", label: "Exportação DOCX", status: "implemented", statusLabel: "Implementado", note: "Gera DOCX editável com margens, fonte, espaçamento e sumário atualizável. PDF deve ser gerado externamente." },
  { key: "research-project", label: "Projeto de pesquisa / NBR 15287", status: "partial", statusLabel: "Parcial", note: "Suporte inicial para projeto de pesquisa com estrutura básica e validações parciais. A revisão final pelo usuário é obrigatória." },
];

function hasValue(value: string | WorkTypeValue): boolean {
  return value.trim().length > 0;
}


function normalizeForValidation(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function stripHeadingSyntax(value: string): string {
  return normalizeForValidation(value).replace(/^#+\s*/, "").replace(/^\d+(?:\.\d+)*\s+/, "").replace(/[:.\-–—]+$/, "").trim();
}

function hasSectionHeading(editorText: string, labels: string[]): boolean {
  const normalizedLabels = labels.map(normalizeForValidation);
  return editorText.split(/\n+/).map(stripHeadingSyntax).some((line) => normalizedLabels.includes(line));
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function paragraphCount(value: string): number {
  return value.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).length;
}

function keywordItems(value: string): string[] {
  return value.split(/[;.]/).map((item) => item.trim()).filter(Boolean);
}

function addPlaceholderIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  const courseLabel = isCpgWork(fields.workType) ? "E-mail" : "Curso";
  const criticalTargets: [string, string, string][] = [
    ["title", fields.title, "Título"],
    ["author", fields.author, "Autor"],
    ["program", fields.program, "Programa"],
    ["course", fields.course, courseLabel],
    ["workNature", fields.workNature, "Natureza do trabalho"],
    ["resumo", fields.resumo, "Resumo"],
    ["abstractText", fields.abstractText, "Abstract"],
    ["indicadoresImpacto", fields.indicadoresImpacto, "Indicadores de impacto"],
    ["impactIndicators", fields.impactIndicators, "Impact indicators"],
  ];
  if (isAdvisorRequired(fields.workType)) criticalTargets.push(["advisor", fields.advisor, "Orientador"]);

  const auxiliaryTargets: [string, string, string][] = [
    ["subtitle", fields.subtitle, "Subtítulo"],
    ["introducao", fields.introducao, "Introdução"],
    ["conclusao", fields.conclusao, "Conclusão"],
    ["palavrasChave", fields.palavrasChave, "Palavras-chave"],
    ["keywords", fields.keywords, "Keywords"],
    ["agradecimentos", fields.agradecimentos, "Agradecimentos"],
    ["dedicatoria", fields.dedicatoria, "Dedicatória"],
  ];

  for (const [_key, value, label] of criticalTargets) {
    if (hasValue(value) && detectPlaceholderText(value)) {
      issues.push({ severity: "error", code: "placeholder-detected", message: "Há marcador de preenchimento no documento.", what: `O campo ${label} contém placeholder ou instrução não substituída.`, why: "O DOCX final não pode conter campos genéricos ou instruções de preenchimento.", action: "Substitua o trecho por informação real antes da versão final." });
      break;
    }
  }
  for (const [_key, value, label] of auxiliaryTargets) {
    if (hasValue(value) && detectPlaceholderText(value)) {
      issues.push({ severity: "warning", code: "placeholder-detected", message: "Há marcador de preenchimento no documento.", what: `O campo ${label} contém placeholder ou instrução não substituída.`, why: "O DOCX final não pode conter campos genéricos ou instruções de preenchimento.", action: "Substitua o trecho por informação real antes da versão final." });
      break;
    }
  }
  if (hasValue(editorText)) {
    if (detectControlledPlaceholder(editorText)) {
      issues.push({ severity: "error", code: "draft-placeholder-detected", fieldKey: FIELD_TARGET_EDITOR, message: "O rascunho ainda contém campos a preencher.", what: "O texto principal contém marcadores controlados de rascunho como [PREENCHER: ...].", why: "O DOCX final não pode conter marcadores de preenchimento; eles indicam seções não redigidas.", action: "Substitua os marcadores por conteúdo real antes de gerar a versão final." });
    } else if (detectPlaceholderText(editorText)) {
      issues.push({ severity: "warning", code: "placeholder-detected", fieldKey: FIELD_TARGET_EDITOR, message: "Há marcador de preenchimento no documento.", what: "O texto principal contém placeholder ou instrução não substituída.", why: "O DOCX final não pode conter campos genéricos ou instruções de preenchimento.", action: "Substitua o trecho por informação real antes da versão final." });
    }
  }
}

function addRequiredFieldIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  if (fields.workType === "monografia" && !hasValue(fields.course)) {
    issues.push({
      severity: "error",
      code: "course-required",
      fieldKey: "course",
      message: "Informe o curso da monografia antes de gerar o DOCX.",
      what: "A monografia não tem o curso informado.",
      why: "A natureza do trabalho (folha de rosto) exige o curso para a gradação correspondente.",
      action: "Preencha o campo Curso com o nome oficial (ex.: Licenciatura em Física, Bacharelado em Biologia).",
    });
  }

  if ((fields.workType === "dissertacao" || fields.workType === "tese") && !hasValue(fields.program)) {
    issues.push({
      severity: "error",
      code: "program-required",
      fieldKey: "program",
      message: "Informe o programa de pós-graduação antes de gerar o DOCX.",
      what: "A dissertação/tese não tem o programa de pós-graduação informado.",
      why: "A natureza do trabalho (folha de rosto) exige o programa para o título solicitado.",
      action: "Preencha o campo Programa com o nome oficial do PPG (ex.: Educação Científica e Ambiental).",
    });
  }
}

function addNaturalPlaceholderIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  const targets: [string, string][] = [
    ["Título", fields.title],
    ["Natureza do trabalho", fields.workNature],
    ["Resumo", fields.resumo],
    ["Abstract", fields.abstractText],
    ["Introdução", fields.introducao],
    ["Conclusão", fields.conclusao],
    ["Texto principal", editorText],
  ];
  for (const [_label, value] of targets) {
    if (hasValue(value) && detectNaturalPlaceholder(value)) {
      issues.push({
severity: "error",
      code: "natural-placeholder-detected",
      fieldKey: FIELD_TARGET_EDITOR,
      message: "Há texto provisório de preenchimento no documento.",
        what: "O sistema detectou uma frase genérica como 'informado pelo usuário' ou 'grau acadêmico correspondente'.",
        why: "Esse tipo de texto não pode aparecer em versão acadêmica final.",
        action: "Preencha os campos obrigatórios reais antes de gerar o DOCX.",
      });
      break;
    }
  }
}

function addProgramConflictIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!getWorkTypeRequirements(fields.workType).requiresInstitutionalMetadata) return;

  if (detectProgramConflict(fields, editorText)) {
    issues.push({
      severity: "error",
      code: "program-conflict",
      message: "Há conflito entre programa/área informado e texto do documento.",
      what: "O documento menciona programas ou áreas diferentes em campos centrais.",
      why: "A folha de rosto, resumo e corpo do texto precisam ter metadados institucionais consistentes.",
      action: "Revise Programa, Curso, Natureza do trabalho, Resumo, Abstract e texto principal.",
    });
  }
}

function addAbstractTopicIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  const result = detectAbstractTopicConflict(fields);
  if (result.conflict) {
    issues.push({
      severity: result.severity,
      code: "abstract-topic-conflict",
      fieldKey: "abstractText",
      message: "O Abstract parece não corresponder ao título/resumo.",
      what: "O texto em inglês possui termos centrais incompatíveis com o tema em português.",
      why: "Abstract incoerente passa impressão de texto alucinado ou reaproveitado.",
      action: "Revise o Abstract e confirme se ele traduz fielmente o resumo.",
    });
  }
}

function addGenericAiLikeIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  const sources: [string, string][] = [
    ["Resumo", fields.resumo],
    ["Abstract", fields.abstractText],
    ["Introdução", fields.introducao],
    ["Conclusão", fields.conclusao],
    ["Texto principal", editorText],
  ];
  for (const [label, value] of sources) {
    if (hasValue(value) && detectGenericAiLikeText(value)) {
      issues.push({
        severity: "warning",
        code: "generic-ai-like-text",
        message: "Possível texto genérico ou com padrão de texto automático detectado.",
        what: `O trecho em ${label} contém expressões genéricas ou de 'cara de IA'.`,
        why: "Expressões genéricas podem enfraquecer a argumentação acadêmica e a originalidade do texto.",
        action: "Reescreva com termos específicos do seu trabalho, evitando clichês de redação automática.",
      });
      break;
    }
  }
}

function addCpgForbiddenIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isCpgWork(fields.workType)) return;
  const found = detectCpgForbiddenStructures(editorText);
  if (found.length > 0) {
    issues.push({
      severity: "error",
      code: "cpg-forbidden-structure",
      message: "O texto contém elementos estruturais incompatíveis com o modelo CPG/UFLA.",
      what: `Foram detectados: ${found.join(", ")}.`,
      why: "Os modelos CPG/UFLA não devem conter capa, folha de rosto, ficha catalográfica, folha de aprovação, sumário ou indicadores de impacto no corpo do texto.",
      action: "Remova esses elementos do editor; o CPG exige apenas Resumo, Palavras-chave, Abstract, Keywords e seções textuais.",
    });
  }
}

function addTextDiagnosticIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  if (isCpgWork(fields.workType)) return;
  if (!hasValue(fields.resumo)) return;

  const heuristics = assessResumoHeuristics(fields.resumo);
  if (!heuristics.hasMethod) issues.push({ severity: "warning", code: "resumo-missing-method", message: "O resumo não parece descrever a metodologia utilizada.", what: "Não foram detectados termos de método no resumo (ex.: metodologia, análise, observação).", why: "O resumo deve sintetizar objetivo, método, resultados e conclusão quando aplicável.", action: "Adicione uma frase sobre a metodologia no campo Resumo." });
  if (!heuristics.hasObjective) issues.push({ severity: "warning", code: "resumo-missing-objective", message: "O resumo não parece explicitar o objetivo.", what: "Não foram detectados termos de objetivo no resumo (ex.: objetivo, analisa, investiga).", why: "O objetivo orienta a leitura e a avaliação do trabalho.", action: "Adicione o objetivo no campo Resumo." });
  if (!heuristics.hasResult && !heuristics.hasConclusion) issues.push({ severity: "warning", code: "resumo-missing-result-conclusion", message: "O resumo não parece apresentar resultado ou conclusão.", what: "Não foram detectados termos de resultado/conclusão no resumo.", why: "Resumos costumam encerrar com resultados ou conclusão.", action: "Adicione resultado ou conclusão no campo Resumo." });

  const abstract = assessAbstractHeuristics(fields);
  if (!abstract.isEmpty && abstract.tooMuchPortuguese) issues.push({ severity: "warning", code: "abstract-looks-portuguese", message: "O abstract parece conter português demais para um texto em inglês.", what: "Há mais termos em português do que em inglês no campo Abstract.", why: "O abstract deve estar em inglês ou idioma estrangeiro, traduzindo fielmente o resumo.", action: "Revise o Abstract e reescreva em inglês, se aplicável." });
  if (!abstract.isEmpty && !abstract.looksEnglish && !abstract.tooMuchPortuguese) issues.push({ severity: "info", code: "abstract-language-review", message: "Confira se o abstract está em inglês ou idioma estrangeiro.", what: "O abstract não apresentou marcadores claros de inglês.", why: "A língua estrangeira deve espelhar o resumo.", action: "Confira a língua do Abstract antes da versão final." });
}

function addResumoAbstractIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  if (isCpgWork(fields.workType)) return;

  if (hasValue(fields.resumo)) {
    const count = wordCount(fields.resumo);
    if (count < 150 || count > 500) issues.push({ severity: "warning", code: "resumo-word-count", message: `Resumo com ${count} palavra(s). Confira se está entre 150 e 500 palavras antes da versão final.`, what: "O resumo parece estar fora da faixa usual de extensão.", why: "Resumos acadêmicos normalmente exigem controle de extensão e síntese adequada.", action: "Revise o campo Resumo e ajuste a extensão, mantendo objetivo, método, resultados e conclusão quando aplicável." });
    if (paragraphCount(fields.resumo) > 1) issues.push({ severity: "warning", code: "resumo-single-paragraph", message: "Resumo parece ter mais de um parágrafo. Revise antes da versão final.", what: "O campo Resumo contém quebras de parágrafo internas.", why: "O resumo costuma ser apresentado em parágrafo único nos modelos acadêmicos.", action: "Una o texto do resumo em um único parágrafo, se o manual/template aplicável exigir." });
  }

  if (hasValue(fields.palavrasChave)) {
    const items = keywordItems(fields.palavrasChave);
    if (items.length < 3 || items.length > 5) issues.push({ severity: "warning", code: "palavras-chave-count", message: `Palavras-chave com ${items.length} item(ns). Confira se há de 3 a 5 termos.`, what: "A quantidade de palavras-chave parece fora da faixa usual.", why: "Palavras-chave orientam indexação e recuperação do trabalho.", action: "Informe de 3 a 5 palavras-chave, preferencialmente separadas por ponto e vírgula." });
    if (items.length > 1 && !fields.palavrasChave.includes(";")) issues.push({ severity: "warning", code: "palavras-chave-separator", message: "Palavras-chave parecem não estar separadas por ponto e vírgula.", what: "O separador entre os termos pode estar inconsistente.", why: "A separação padronizada facilita a normalização e a leitura do DOCX.", action: "Use ponto e vírgula entre as palavras-chave." });
  }

  if (hasValue(fields.abstractText)) {
    const count = wordCount(fields.abstractText);
    if (count < 150 || count > 500) issues.push({ severity: "warning", code: "abstract-word-count", message: `Abstract com ${count} palavra(s). Confira se está entre 150 e 500 palavras antes da versão final.`, what: "O abstract parece estar fora da faixa usual de extensão.", why: "O abstract deve corresponder ao resumo e manter extensão controlada.", action: "Revise o campo Abstract e ajuste a extensão conforme o template aplicável." });
    if (paragraphCount(fields.abstractText) > 1) issues.push({ severity: "warning", code: "abstract-single-paragraph", message: "Abstract parece ter mais de um parágrafo. Revise antes da versão final.", what: "O campo Abstract contém quebras de parágrafo internas.", why: "O abstract costuma acompanhar o formato sintético do resumo.", action: "Una o abstract em um único parágrafo, se o manual/template aplicável exigir." });
  }

  if (hasValue(fields.keywords)) {
    const items = keywordItems(fields.keywords);
    if (items.length < 3 || items.length > 5) issues.push({ severity: "warning", code: "keywords-count", message: `Keywords com ${items.length} item(ns). Confira se há de 3 a 5 termos.`, what: "A quantidade de keywords parece fora da faixa usual.", why: "Keywords orientam indexação e recuperação internacional do trabalho.", action: "Informe de 3 a 5 keywords, preferencialmente separadas por ponto e vírgula." });
    if (items.length > 1 && !fields.keywords.includes(";")) issues.push({ severity: "warning", code: "keywords-separator", message: "Keywords parecem não estar separadas por ponto e vírgula.", what: "O separador entre os termos pode estar inconsistente.", why: "A separação padronizada facilita a normalização e a leitura do DOCX.", action: "Use ponto e vírgula entre as keywords." });
  }
}

function addImpactIndicatorIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  if (!getWorkTypeRequirements(fields.workType).requiresImpactIndicators) return;
  const isInstructional = hasValue(fields.indicadoresImpacto) && detectPlaceholderText(fields.indicadoresImpacto);
  const sufficient = hasSufficientImpactIndicators(fields);
  if (!sufficient && !isInstructional) issues.push({ severity: "error", code: "impact-indicators-missing", fieldKey: "indicadoresImpacto", message: "Preencha os Indicadores de Impacto antes da versão final.", what: "Os indicadores de impacto estão vazios ou insuficientes.", why: "A UFLA pode exigir indicadores de impacto em dissertações e teses; texto genérico não é aceitável.", action: "Preencha ao menos dois dos campos de impacto (social, científico, educacional, ambiental, tecnológico/econômico) e o público beneficiado com informações reais do trabalho." });
  if (isInstructional) issues.push({ severity: "error", code: "impact-indicators-missing", fieldKey: "indicadoresImpacto", message: "Preencha os Indicadores de Impacto com informações reais antes da versão final.", what: "Os indicadores de impacto contêm apenas texto instrucional.", why: "A UFLA pode exigir indicadores de impacto em dissertações e teses; texto genérico não é aceitável.", action: "Substitua o texto instrucional por informações reais do trabalho." });
  if (hasValue(fields.indicadoresImpacto) && !isInstructional && !hasValue(fields.impactIndicators)) issues.push({ severity: "warning", code: "impact-indicators-english-recommended", message: "Inclua a versão em inglês dos indicadores de impacto quando exigida.", what: "Há indicadores de impacto em português, mas o campo Impact indicators está vazio.", why: "Alguns fluxos de pós-graduação exigem versão em português e inglês.", action: "Preencha o campo Impact indicators ou confirme se o template aplicado não exige versão em inglês." });
}

function looksInstitutionalAuthor(value: string): boolean {
  const normalized = normalizeForValidation(value);
  return /\b(UNIVERSIDADE|UFLA|INSTITUTO|PROGRAMA|POS-GRADUACAO|CURSO|DEPARTAMENTO|FACULDADE|ESCOLA|LAVRAS|MINAS GERAIS|MG)\b/.test(normalized);
}

function hasLikelyImageWithoutCaption(text: string): boolean {
  const hasImageMarker = /!\[[^\]]*\]\(|<img\b|\bimagem\b|\[Imagem detectada:/i.test(text);
  const hasCaption = /\b(figura|imagem)\s+\d+|\blegenda\b/i.test(text);
  return hasImageMarker && !hasCaption;
}

function hasLikelyUnmarkedLongQuote(text: string): boolean {
  return text.split(/\n{2,}/).map((part) => part.trim()).some((paragraph) => {
    const looksLong = paragraph.length > 450;
    const alreadyMarked = paragraph.startsWith(">");
    const hasCitationClue = /\([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^)]*,\s*(19|20)\d{2}/.test(paragraph);
    return looksLong && hasCitationClue && !alreadyMarked;
  });
}

function hasQuotationMarks(text: string): boolean {
  return /["''""«"]/.test(text);
}

function validateShortCitation(editorText: string): ValidationIssue[] {
  const found: ValidationIssue[] = [];
  const paragraphs = editorText.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  for (const paragraph of paragraphs) {
    // (AUTOR), (AUTOR, 2024), (AUTOR, 2024, p. 15), (AUTOR, 2024, 15)
    const citeRe = /\(([^()]*?(?:\b(?:19|20)\d{2}\b)?[^()]*?)\)/g;
    let match: RegExpExecArray | null;
    while ((match = citeRe.exec(paragraph)) !== null) {
      const inner = match[1].trim();
      // ignora parênteses que não parecem citação (ex.: dados (IBGE), fórmulas)
      if (inner.length > 60) continue;
      const yearMatch = inner.match(/\b(19|20)\d{2}\b/);
      const authorPart = yearMatch ? inner.slice(0, inner.indexOf(yearMatch[0])).trim() : "";
      const hasAuthorInside = /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(authorPart.replace(/[,;]\s*$/, ""));
      // C11 — autor fora do parêntese na forma correta: SILVA (2024)
      const hasAuthorOutside = !hasAuthorInside
        ? /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç.'-]{1,50})\s+\(\s*$/u.test(paragraph.slice(0, match.index))
        : false;
      const bareYear = !!yearMatch && /^\s*(?:19|20)\d{2}\s*$/.test(inner);
      const hasPageIndicator =
        /,\s*(p\.?|pag\.?|f\.?|página[s]?)\b/i.test(inner) ||
        /\b(p\.?|pag\.?|f\.?|página[s]?)\s*:?\s*\d/i.test(inner);

      // C11 — só trata como citação parêntese com padrão autor-ano plausível
      // (ano presente ou indicador de página); (IBGE), (Tabela 2) e (2020)
      // sozinhos não são citações e não podem gerar warning.
      if (!yearMatch && !hasPageIndicator) continue;
      // Ano puro sem autor dentro nem fora (ex.: "(2020)" isolado) → não é citação.
      if (bareYear && !hasAuthorInside && !hasAuthorOutside) continue;

      // página indicada de forma vazia: (SILVA, 2024, p.) ou (SILVA, 2024, p. )
      if (/,\s*p\.?\s*\)?$/i.test(inner.trim()) || /p\.\s*$/.test(inner.trim())) {
        found.push({
          severity: "warning",
          code: "citation-page-missing",
          message: "Citação com indicação de página vazia.",
          what: `Citação "(${inner})" indica página, mas não informa o número.`,
        });
        continue;
      }

      if (!yearMatch) {
        // tem autor (ou indicador de página) mas não tem ano → toda citação deve indicar o ano
        found.push({
          severity: "warning",
          code: "citation-year-missing",
          message: "Citação sem ano. Toda citação deve indicar o ano da fonte.",
          what: `Citação "(${inner})" não traz o ano da publicação.`,
        });
        continue;
      }

      if (!hasAuthorInside && !hasAuthorOutside) {
        found.push({
          severity: "warning",
          code: "citation-author-missing",
          message: "Citação sem autor identificável antes do ano.",
          what: `Citação "(${inner})" não tem autor antes do ano.`,
        });
        continue;
      }

      // Citação direta (com aspas) deve indicar a página (NBR 10520:2023)
      if (hasQuotationMarks(paragraph) && !/\b(p\.?|pag\.?|f\.?|página[s]?)\s*[.:]?\s*\d+/i.test(inner)) {
        found.push({
          severity: "info",
          code: "citation-direct-locator",
          message: "Citação direta (com aspas) sem indicação de página. Se for transcrição literal, informe a página (NBR 10520).",
          what: `Citação "(${inner})" em parágrafo com aspas não indica a página da fonte.`,
        });
      }
    }
  }
  return found;
}

function referenceIssueMessage(code: string, message: string): string {
  if (code === "reference-normative-preserved") return `${message} Isso pode estar correto para leis, portarias e resoluções, mas confira no Word antes da entrega.`;
  if (code === "reference-doi-url-normalized" || code === "reference-url-markup-normalized") return `${message} Confira o DOCX gerado e mantenha apenas a forma normalizada.`;
  if (code === "reference-author-spelling-review") return `${message} O sistema não altera nomes próprios automaticamente; confira na ficha catalográfica ou na fonte original.`;
  if (code === "reference-academic-pages-missing") return `${message} Informe o total de páginas se a fonte bibliográfica trouxer essa informação.`;
  if (code === "reference-legal-publisher-missing" || code === "reference-institutional-publisher-missing") return `${message} Confira órgão/editor responsável, publicação oficial e local.`;
  if (code === "reference-access-missing") return `${message} Referência online sem data de acesso bloqueia a versão final — informe 'Acesso em: <data>' (NBR 6023).`;
  if (code === "reference-highlight-missing") return `${message} Revise antes da versão final.`;
  if (code === "reference-order") return `${message} O DOCX reordena as referências alfabeticamente ao gerar, mas confira a sequência final no arquivo.`;
  return message;
}

function estimatePages(fields: AcademicFields, editorText: string): number {
  const text = [fields.title, fields.author, fields.abstractText, fields.keywords, fields.resumo, fields.palavrasChave, editorText, fields.referencias].join("\n");
  return Math.max(1, Math.ceil(text.length / 3200));
}

function estimateLineCount(value: string): number {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 95)), 0);
}

function addCpgWarnings(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isCpgWork(fields.workType)) return;
  issues.push({ severity: "warning", code: "cpg-mode-selected", message: "Modo CPG/UFLA selecionado: não use capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto, sumário, cabeçalho, rodapé ou número de página. A submissão final deve ser em PDF." });
  if (fields.workType === "resumo_cpg") issues.push({ severity: "warning", code: "cpg-resumo-one-page", message: "Resumo CPG/UFLA deve ter apenas 1 página, em português, A4, coluna simples, margens 3,5 cm superior, 2,5 cm inferior e 3 cm laterais." });
  if (fields.workType === "resumo_expandido_cpg") issues.push({ severity: "warning", code: "cpg-expanded-pages", message: "Resumo expandido CPG/UFLA deve ter de 4 a 6 páginas e conter abstract e resumo na primeira página." });
  if (fields.workType === "artigo_completo_cpg") issues.push({ severity: "warning", code: "cpg-full-pages", message: "Artigo completo CPG/UFLA deve ter de 8 a 14 páginas e conter abstract e resumo na primeira página." });
  const pages = estimatePages(fields, editorText);
  if (fields.workType === "resumo_cpg" && pages > 1) issues.push({ severity: "warning", code: "cpg-resumo-estimated-pages",     message: `Estimativa atual: ${pages} página(s). Para resumo CPG, ajuste o conteúdo para 1 página.` });
  if (fields.workType === "resumo_expandido_cpg" && (pages < 4 || pages > 6)) issues.push({ severity: "warning", code: "cpg-expanded-estimated-pages", message: `Estimativa atual: ${pages} página(s). Para resumo expandido CPG, ajuste para 4 a 6 páginas.` });
  if (fields.workType === "artigo_completo_cpg" && (pages < 8 || pages > 14)) issues.push({ severity: "warning", code: "cpg-full-estimated-pages", message: `Estimativa atual: ${pages} página(s). Para artigo completo CPG, ajuste para 8 a 14 páginas.` });
  if (fields.workType !== "resumo_cpg" && estimateLineCount(fields.abstractText) > 10) issues.push({ severity: "warning", code: "cpg-abstract-too-long",     message: "Abstract CPG parece ultrapassar 10 linhas. Encurte ou revise a primeira página antes da submissão." });
  if (fields.workType !== "resumo_cpg" && estimateLineCount(fields.resumo) > 10) issues.push({ severity: "warning", code: "cpg-resumo-too-long",     message: "Resumo CPG parece ultrapassar 10 linhas. Encurte ou revise a primeira página antes da submissão." });
  if (/<table\b|<\/table>|!\[[^\]]*\]\(|<img\b|\[Imagem detectada:/i.test(editorText)) issues.push({ severity: "warning", code: "cpg-complex-media-warning", message: "Modelos CPG com imagens ou tabelas complexas precisam de conferencia visual: legendas, qualidade e espacamento podem exigir ajuste manual." });
}

function addResearchProjectIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isResearchProject(fields.workType)) return;
  issues.push({ severity: "warning", code: "research-project-partial", message: "Suporte inicial para Projeto de pesquisa (NBR 15287:2025). A revisão final pelo usuário é obrigatória.", what: "O sistema possui suporte inicial para projeto de pesquisa.", why: "A validação NBR 15287 é parcial e o sistema não substitui a norma oficial.", action: "Revise todos os campos e o DOCX gerado antes da versão final." });
  const hasProblemStatement = hasValue(fields.problemaPesquisa) || hasSectionHeading(editorText, ["PROBLEMA DE PESQUISA", "PROBLEMA"]);
  const hasObjective = hasValue(fields.objetivoGeral) || hasSectionHeading(editorText, ["OBJETIVO GERAL"]);
  const hasJustification = hasValue(fields.justificativa) || hasSectionHeading(editorText, ["JUSTIFICATIVA"]);
  const hasMethodology = hasValue(fields.metodologia) || hasSectionHeading(editorText, ["METODOLOGIA", "PROCEDIMENTOS METODOLÓGICOS", "PROCEDIMENTOS METODOLOGICOS"]);
  const hasSchedule = hasValue(fields.cronograma) || hasSectionHeading(editorText, ["CRONOGRAMA"]);
  const hasReferences = hasValue(fields.referencias) || hasSectionHeading(editorText, ["REFERÊNCIAS", "REFERENCIAS", "BIBLIOGRÁFICAS", "BIBLIOGRAFICAS"]);
  if (!hasProblemStatement) issues.push({ severity: "error", code: "research-problem-required", fieldKey: "problemaPesquisa", message: "Informe o problema de pesquisa.", what: "O projeto de pesquisa não apresenta o problema a ser investigado.", why: "O problema delimita a investigação e orienta objetivos, metodologia e justificativa.", action: "Adicione conteúdo no campo 'Problema de pesquisa' ou uma seção chamada 'Problema de pesquisa' no editor." });
  if (!hasObjective) issues.push({ severity: "error", code: "research-goal-required", fieldKey: "objetivoGeral", message: "Informe o objetivo geral.", what: "O projeto de pesquisa não apresenta o objetivo geral.", why: "O objetivo geral direciona a pesquisa e fundamenta a metodologia.", action: "Adicione conteúdo no campo 'Objetivo geral' ou uma seção chamada 'Objetivo geral' no editor." });
  if (!hasJustification) issues.push({ severity: "error", code: "research-justification-required", fieldKey: "justificativa", message: "Informe a justificativa.", what: "O projeto de pesquisa não apresenta a justificativa.", why: "A justificativa fundamenta a relevância e pertinência da pesquisa.", action: "Adicione conteúdo no campo 'Justificativa' ou uma seção chamada 'Justificativa' no editor." });
  if (!hasMethodology) issues.push({ severity: "error", code: "research-methodology-required", fieldKey: "metodologia", message: "Informe a metodologia.", what: "O projeto de pesquisa não apresenta a metodologia.", why: "A metodologia descreve como a pesquisa será conduzida.", action: "Adicione conteúdo no campo 'Metodologia' ou uma seção chamada 'Metodologia' no editor." });
  if (!hasSchedule) issues.push({ severity: "error", code: "research-schedule-required", fieldKey: "cronograma", message: "Informe o cronograma.", what: "O projeto de pesquisa não apresenta o cronograma.", why: "O cronograma orienta a execução e marcos do projeto.", action: "Adicione conteúdo no campo 'Cronograma' ou uma seção chamada 'Cronograma' no editor." });
  if (!hasReferences) issues.push({ severity: "error", code: "research-references-required", fieldKey: "referencias", message: "Informe as referências.", what: "O projeto de pesquisa não apresenta referências.", why: "Referências são necessárias para base teórica e aportes bibliográficos.", action: "Adicione referências no editor ou no campo Referências." });
  if (hasValue(fields.objetivosEspecificos) && !hasValue(fields.objetivoGeral) && !hasObjective) issues.push({ severity: "error", code: "research-objective-mandatory", message: "Objetivo geral é obrigatório quando há objetivos específicos.", what: "Objetivos específicos foram informados, mas o objetivo geral está ausente.", why: "O objetivo geral é o alvo principal da pesquisa e deve estar presente antes dos objetivos específicos.", action: "Preencha o campo 'Objetivo Geral' antes da geração." });
  issues.push({ severity: "info", code: "research-toc-update", message: "Após gerar o DOCX, abra no Word ou LibreOffice e atualize o sumário para preencher a paginação real.", what: "O sumário do Projeto de pesquisa é atualizável.", why: "O campo TOC precisa ser atualizado no editor de texto para refletir a paginação final.", action: "No Word: Ctrl+A e F9, depois 'Atualizar o índice inteiro'. No LibreOffice: Ferramentas > Atualizar > Atualizar tudo." });
}

/** Rótulos de seção que satisfazem um requiredField da Coleção (mesmo critério do gate por tipo). */
const PRODUCTION_SECTION_LABELS: Record<string, string[]> = {
  introducao: ["INTRODUCAO"],
  metodologia: ["METODOLOGIA", "MATERIAL E METODOS", "MATERIAIS E METODOS"],
  conclusao: ["CONCLUSAO", "CONSIDERACOES FINAIS"],
  referencialTeorico: ["REFERENCIAL TEORICO", "REVISAO DE LITERATURA", "REVISAO BIBLIOGRAFICA"],
};

function addUflaCollectionIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isUflaCollectionWork(fields.workType)) return;
  const productionType = academicProductionTypeById(fields.workType);
  if (!productionType) return;

  issues.push({
    severity: "warning",
    code: "ufla-collection-initial-support",
    message: ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE,
    what: "O formato foi cadastrado no sistema com suporte inicial.",
    why: "Os exportadores especificos da Colecao Producao Academica UFLA ainda serao evoluidos incrementalmente.",
    action: "Confira estrutura, campos, sumário e paginação no DOCX final antes de exportar o PDF pelo Word ou LibreOffice.",
  });

  const headingLines = editorText
    .split(/\n+/)
    .map(stripHeadingSyntax)
    .map(normalizeForValidation);

  for (const fieldKey of productionType.requiredFields) {
    const fieldValue = fields[fieldKey];
    const valueString = Array.isArray(fieldValue) ? fieldValue.join(" ") : fieldValue;
    const sectionLabels = PRODUCTION_SECTION_LABELS[fieldKey];
    const satisfiedByHeading = sectionLabels?.some((label) =>
      headingLines.some((line) => line.includes(label)),
    );
    if (!hasValue(valueString) && !satisfiedByHeading) {
      const viaSection = sectionLabels ? " ou insira a secao correspondente no editor" : "";
      issues.push({
        severity: "error",
        code: `ufla-collection-${fieldKey}-required`,
        fieldKey,
        message: `Preencha o campo obrigatorio para ${productionType.label}: ${fieldKey}${viaSection}.`,
        what: "Um campo minimo do formato selecionado esta vazio (sem secao correspondente no editor).",
        why: "A Colecao Producao Academica UFLA exige revisao da estrutura e dos metadados antes da submissao.",
        action: "Preencha o campo indicado, insira a secao no editor ou confirme manualmente se o guia especifico dispensa esse item.",
      });
    }
  }
}

function addDocumentStructureIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  const requirements = getWorkTypeRequirements(fields.workType);
  const hasHeadings = /^\s*#{1,3}\s+/m.test(editorText);
  const headingLabels = editorText.split(/\n+/).map((line) => line.trim()).filter((line) => /^#{1,3}\s+/.test(line));

  if (requirements.requiresTableOfContents && !hasHeadings) {
    issues.push({
      severity: "warning",
      code: "document-structure-missing-headings",
      fieldKey: FIELD_TARGET_EDITOR,
      message: "O sumário será gerado, mas não há títulos de seção no texto principal.",
      what: "O documento não contém cabeçalhos de nível 1-3 no editor.",
      why: "O sumário automático do Word depende de estilos de título no corpo do texto para listar as seções.",
      action: "Insira títulos de seção no editor (ex.: '# 1 Introdução', '## 1.1 Objetivos').",
    });
  }

  if (fields.workType === "projeto_pesquisa") {
    const missingSections: string[] = [];
    if (!hasSectionHeading(editorText, ["PROBLEMA DE PESQUISA", "PROBLEMA"])) missingSections.push("Problema de pesquisa");
    if (!hasSectionHeading(editorText, ["OBJETIVO GERAL"])) missingSections.push("Objetivo geral");
    if (!hasSectionHeading(editorText, ["JUSTIFICATIVA"])) missingSections.push("Justificativa");
    if (!hasSectionHeading(editorText, ["METODOLOGIA", "PROCEDIMENTOS METODOLÓGICOS", "PROCEDIMENTOS METODOLOGICOS"])) missingSections.push("Metodologia");
    if (!hasSectionHeading(editorText, ["CRONOGRAMA"])) missingSections.push("Cronograma");
    if (missingSections.length > 0) {
      issues.push({
        severity: "warning",
        code: "document-structure-research-project-sections",
        fieldKey: FIELD_TARGET_EDITOR,
        message: `Seções obrigatórias do projeto de pesquisa não detectadas: ${missingSections.join(", ")}.`,
        what: "O projeto de pesquisa não apresenta todas as seções estruturais esperadas.",
        why: "A NBR 15287:2025 exige problema, objetivo, justificativa, metodologia e cronograma.",
        action: `Adicione as seções ausentes no editor: ${missingSections.join(", ")}.`,
      });
    }
  }

  const normalizedHeadings = headingLabels.map((line) => stripHeadingSyntax(line));
  const refHeadingIndex = normalizedHeadings.findIndex((line) => /^REFERENCIAS|BIBLIOGRAFICAS/.test(line));
  if (refHeadingIndex >= 0 && refHeadingIndex < normalizedHeadings.length - 1) {
    const afterRefs = normalizedHeadings.slice(refHeadingIndex + 1);
    if (afterRefs.some((line) => line.length > 0 && !/^APENDICE|ANEXO|GLOSSARIO|INDICE/.test(line))) {
      issues.push({
        severity: "warning",
        code: "document-structure-content-after-references",
        fieldKey: FIELD_TARGET_EDITOR,
        message: "Há conteúdo textual após a seção de referências.",
        what: "O editor contém seções depois de REFERÊNCIAS.",
        why: "As referências devem ser a última seção pós-textual antes de apêndices/anexos.",
        action: "Mova conteúdo eventual para apêndices/anexos ou remova seções após REFERÊNCIAS.",
      });
    }
  }

  if (requirements.requiresCoverAndFrontMatter && !hasValue(fields.title)) {
    issues.push({
      severity: "error",
      code: "document-structure-title-missing",
      fieldKey: "title",
      message: "Título obrigatório ausente para a estrutura pré-textual.",
      what: "O trabalho não possui título informado.",
      why: "Capa e folha de rosto dependem do título para compor a estrutura pré-textual.",
      action: "Preencha o campo Título antes de gerar o DOCX.",
    });
  }
}

function addProgramCompatibilityIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  if (!getWorkTypeRequirements(fields.workType).requiresProgramMetadata) return;

  const programValue = fields.program.trim();
  if (!programValue) return;

  const matches = findUflaPpgPrograms(programValue);
  if (matches.length > 1) {
    const resolved = resolveUflaPpgProgram(programValue, { workType: fields.workType });
    if (resolved.ambiguous || !resolved.program) {
      issues.push({
        severity: "warning",
        code: "program-ambiguous",
        fieldKey: "program",
        message: "O programa informado corresponde a mais de um programa da UFLA (acadêmico e profissional).",
        what: "Há mais de um programa com esse nome na lista oficial da PRPG/UFLA.",
        why: "Dissertação/tese exigem a definição exata da modalidade (acadêmica ou profissional) e do nível.",
        action: "Confirme se o programa é acadêmico ou profissional antes da versão final.",
      });
      return;
    }
    applyProgramDegreeChecks(resolved.program, fields, issues);
    return;
  }

  const program = findUflaPpgProgram(programValue);
  if (!program) {
    issues.push({
      severity: "warning",
      code: "program-not-recognized",
      fieldKey: "program",
      message: "O programa informado não foi reconhecido na lista local da PRPG/UFLA.",
      what: "O campo Programa não corresponde exatamente a um programa cadastrado no snapshot local.",
      why: "Usar o nome oficial reduz erro na folha de rosto e na natureza do trabalho.",
      action: "Revise o nome do programa conforme a lista oficial da PRPG/UFLA.",
    });
    return;
  }

  applyProgramDegreeChecks(program, fields, issues);
}

function applyProgramDegreeChecks(program: UflaPpgProgram, fields: AcademicFields, issues: ValidationIssue[]): void {
  if (fields.workType === "dissertacao" && !program.masters) {
    issues.push({
      severity: "error",
      code: "program-degree-incompatible",
      fieldKey: "program",
      message: "O programa informado não é compatível com o tipo de trabalho selecionado.",
      what: "A lista oficial da PRPG/UFLA indica que o programa não oferece o nível exigido pelo tipo selecionado.",
      why: "Dissertação exige programa com mestrado; tese exige programa com doutorado.",
      action: "Selecione um programa compatível ou revise o tipo de trabalho.",
    });
  }

  if (fields.workType === "tese" && !program.doctorate) {
    issues.push({
      severity: "error",
      code: "program-degree-incompatible",
      fieldKey: "program",
      message: "O programa informado não é compatível com o tipo de trabalho selecionado.",
      what: "A lista oficial da PRPG/UFLA indica que o programa não oferece o nível exigido pelo tipo selecionado.",
      why: "Dissertação exige programa com mestrado; tese exige programa com doutorado.",
      action: "Selecione um programa compatível ou revise o tipo de trabalho.",
    });
  }
}

export function validateWork(fields: AcademicFields, editorText = ""): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  addDocumentStructureIssues(fields, editorText, issues);
  const requirements = getWorkTypeRequirements(fields.workType);
  const simpleArticle = fields.workType === "artigo";

  if (!hasValue(fields.workType)) issues.push({ severity: "error", code: "work-type-required", fieldKey: FIELD_TARGET_WORK_TYPE, message: "Selecione o tipo de trabalho.", what: "O tipo de trabalho não foi informado.", why: "O tipo define quais elementos pré-textuais e regras de formatação serão aplicados no DOCX.", action: "Escolha artigo, monografia, dissertação, tese ou outro na lista suspensa." });

  if (!hasValue(fields.title)) issues.push({ severity: simpleArticle ? "warning" : "error", code: "title-required", fieldKey: "title", message: simpleArticle ? "Título não detectado automaticamente; será usado título provisório no artigo simples." : "Informe o título do trabalho.", what: "O título do trabalho está vazio.", why: simpleArticle ? "Artigo simples pode ser gerado como rascunho com título provisório." : "O título é obrigatório na capa, folha de rosto e cabeçalhos do documento.", action: "Preencha o campo Título com a designação oficial do trabalho antes da versão final." });

  if (!hasValue(fields.author)) issues.push({ severity: "error", code: "author-required", fieldKey: "author", message: "Informe o autor do trabalho.", what: "O autor do trabalho não foi informado.", why: "O nome do autor aparece na capa, folha de rosto e elementos pré-textuais.", action: "Preencha o campo Autor com o nome completo do autor ou autores separados por vírgula." });
  else if (looksInstitutionalAuthor(fields.author)) issues.push({ severity: "error", code: "author-institutional", fieldKey: "author", message: "O campo autor parece conter uma instituição, programa, unidade ou localidade, não um nome de pessoa. Revise a identificação automática.", what: "O campo Autor contém texto que parece institucional.", why: "A capa e a folha de rosto esperam o nome de pessoa física, não o nome da instituição.", action: "Substitua por nome(s) de pessoa(s). Se houver múltiplos autores, separe por vírgula." });

  if (requirements.requiresCoverAndFrontMatter && isAdvisorRequired(fields.workType) && !hasValue(fields.advisor)) {
    const severity = fields.workType === "monografia" ? "warning" : "error";
    issues.push({ severity, code: "advisor-required", fieldKey: "advisor", message: "Informe o orientador para dissertação ou tese.", what: "O orientador não foi informado.", why: "Dissertações e teses exigem identificação do orientador na folha de rosto.", action: "Preencha o campo Orientador com o nome completo antes da versão final." });
  }
  if (!hasValue(fields.resumo)) {
    const severity = fields.workType === "projeto_pesquisa" ? "error" : "warning";
    issues.push({ severity, code: "resumo-required", fieldKey: "resumo", message: severity === "error" ? "Informe o resumo antes de gerar o DOCX." : "Inclua o resumo antes da versão final.", what: "O resumo está vazio.", why: "O resumo é elemento pré-textual obrigatório na maioria dos tipos de trabalho.", action: "Escreva o resumo no campo correspondente. Verifique extensão e palavras-chave." });
  }
  if (!hasValue(fields.referencias) && !isCpgWork(fields.workType)) issues.push({ severity: "warning", code: "references-required", fieldKey: "referencias", message: "Inclua as referências do trabalho.", what: "O bloco de referências está vazio.", why: "Referências são obrigatórias para a seção pós-textual.", action: "Adicione as referências no campo Referências, uma por linha." });
  else if (hasValue(fields.referencias)) for (const referenceIssue of validateReferencesText(fields.referencias)) issues.push({ severity: referenceIssue.code === "reference-access-missing" ? "error" : "warning", code: referenceIssue.code, message: referenceIssueMessage(referenceIssue.code, referenceIssue.message), what: referenceIssue.code.includes("year-missing") ? "Há referência sem ano detectável." : referenceIssue.code.includes("access-missing") ? "Há referência online sem informação de acesso." : referenceIssue.code.includes("highlight-missing") ? "Há referência sem destaque de título detectado." : referenceIssue.code.includes("too-short") ? "Há referência muito curta para validação segura." : referenceIssue.code.includes("normative-preserved") ? "Há referência normativa preservada sem destaque automático." : referenceIssue.code.includes("academic-pages-missing") ? "Há trabalho acadêmico sem paginação detectável." : referenceIssue.code.includes("publisher-missing") ? "Há referência sem órgão/editor responsável detectável." : referenceIssue.code.includes("doi-url-normalized") ? "Há DOI informado como URL." : referenceIssue.code.includes("url-markup-normalized") ? "Há URL em markdown ou entre sinais." : referenceIssue.code.includes("author-spelling-review") ? "Há grafia de autor que exige conferência." : "Referência precisa de revisão.", why: "A conformidade ABNT/UFLA depende de autor, ano, acesso, editora/órgão, paginação e destaque corretos.", action: "Revise o item no campo Referências e confira a fonte bibliográfica original antes da versão final." });
if (!hasValue(fields.introducao) && !isCpgWork(fields.workType) && !simpleArticle) issues.push({ severity: "warning", code: "intro-required", fieldKey: "introducao", message: "A introdução não foi detectada ou está vazia.", what: "A seção de introdução não foi identificada.", why: "A introdução é a primeira seção textual obrigatória na estrutura UFLA.", action: "Insira a introdução no editor ou no campo Introdução." });
  if (!hasValue(fields.abstractText) && fields.workType !== "resumo_cpg" && !simpleArticle) {
    const severity = fields.workType === "projeto_pesquisa" ? "error" : "warning";
    issues.push({ severity, code: "abstract-recommended", fieldKey: "abstractText", message: severity === "error" ? "Informe o abstract antes de gerar o DOCX." : "Inclua o abstract quando exigido pelo trabalho.", what: "O abstract está vazio.", why: "O abstract é obrigatório para a maioria dos trabalhos acadêmicos da UFLA.", action: "Preencha o campo Abstract com a versão do resumo em inglês ou idioma estrangeiro." });
  }

  addResumoAbstractIssues(fields, issues);
  addImpactIndicatorIssues(fields, issues);

  if (
    requirements.requiresTableOfContents &&
    !/^\s*#{1,3}\s+/m.test(editorText) &&
    !hasValue(fields.referencias) &&
    !hasValue(fields.anexos) &&
    !hasValue(fields.apendices)
  ) {
    issues.push({
      severity: "warning",
      code: "summary-empty-headings",
      fieldKey: FIELD_TARGET_EDITOR,
      message: "O sumário será gerado como campo a atualizar no Word/LibreOffice. Sem títulos de seção no texto, ele pode ficar vazio até a atualização.",
      what: "Não foram detectados títulos de seção (cabeçalhos) no texto.",
      why: "O sumário automático (TOC) do Word/LibreOffice depende de cabeçalhos numerados no corpo do texto.",
      action: "Use títulos de seção (ex.: '# 1 Introdução') no editor; depois, abra no Word/LibreOffice e atualize o campo do sumário (botão direito > Atualizar campo).",
    });
  }

  addCpgWarnings(fields, editorText, issues);
  addResearchProjectIssues(fields, editorText, issues);
  addUflaCollectionIssues(fields, editorText, issues);
  addRequiredFieldIssues(fields, issues);
  addPlaceholderIssues(fields, editorText, issues);
  addNaturalPlaceholderIssues(fields, editorText, issues);
  addProgramConflictIssues(fields, editorText, issues);
  addAbstractTopicIssues(fields, issues);
  addProgramCompatibilityIssues(fields, issues);
  addGenericAiLikeIssues(fields, editorText, issues);
  addTextDiagnosticIssues(fields, issues);
  addCpgForbiddenIssues(fields, editorText, issues);
  if (hasLikelyImageWithoutCaption(editorText)) issues.push({ severity: "warning", code: "image-caption-warning", fieldKey: FIELD_TARGET_EDITOR, message: "Imagem detectada sem legenda provável. Confira posição, qualidade e legenda antes da versão final.", what: "Há possível imagem sem legenda no texto.", why: "Ilustrações precisam de legenda e fonte conforme ABNT/UFLA.", action: "Adicione legenda no formato 'Figura X - Título' e verifique a fonte da imagem." });
  if (hasLikelyUnmarkedLongQuote(editorText)) issues.push({ severity: "warning", code: "long-quote-warning", fieldKey: FIELD_TARGET_EDITOR, message: "Há possível citação longa não marcada como citação longa. Revise antes da versão final.", what: "Há parágrafo longo com data que pode ser citação direta.", why: "Citações longas exigem recuo de 4 cm, fonte 11 e espaço simples.", action: "Selecione o trecho e clique em Citação longa na barra de ferramentas." });
  issues.push(...validateShortCitation(editorText));
  if (hasValue(fields.imageWarnings)) issues.push({ severity: "warning", code: "imported-image-warning", message: fields.imageWarnings, what: "Imagens foram detectadas no arquivo original.", why: "A importacao preserva imagens quando os bytes estao acessiveis; quando isso nao e possivel, a imagem vira alerta revisavel, nao texto do trabalho.", action: "Confira imagens importadas, reinsira manualmente as ausentes e revise legendas e fontes." });
  if (hasValue(fields.anexos) && /\[Imagem detectada:/i.test(fields.anexos)) issues.push({ severity: "warning", code: "annex-image-partial", message: "Há imagem detectada em anexos; confira posição, qualidade e legenda antes da versão final.", what: "Imagens foram detectadas na seção de anexos.", why: "Anexos com imagens exigem verificação de legenda, fonte e qualidade.", action: "Revise a seção de anexos no DOCX gerado." });
  addCatalogCardIssues(fields, issues);
  return issues;
}

function addCatalogCardIssues(fields: AcademicFields, issues: ValidationIssue[]): void {
  const needsCard = fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
  if (!needsCard) return;
  const content = fields.fichaCatalografica?.trim() ?? "";
  if (!content) return; // ausência já é coberta pelas pendências de versão final
  // Ficha em TEXTO com conteúdo real mas sem número de Cutter/CDU → bloqueia a
  // versão final: toda ficha oficial da Biblioteca Universitária da UFLA traz o
  // código de Cutter (ex.: S586f) — ausência indica cópia parcial ou texto não
  // oficial. Ficha em IMAGEM (upload) não é validável por texto e não dispara.
  if (hasCatalogCardContent(content) && !hasCutterNumber(content)) {
    issues.push({
      severity: "error",
      code: "ficha-cutter-missing",
      fieldKey: "fichaCatalografica",
      message: "A ficha catalográfica em texto não contém número de Cutter (ex.: S586f) nem classificação CDU — confira se a ficha oficial da Biblioteca foi colada integralmente.",
      what: "O conteúdo da ficha está presente, mas sem o código de classificação que toda ficha oficial traz.",
      why: "A ficha catalográfica oficial inclui o número de Cutter e a classificação; a ausência indica cópia parcial ou texto não oficial.",
      action: "Substitua o texto pela ficha oficial completa ou anexe a imagem da ficha oficial (upload na seção pré-textuais).",
    });
  }
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
