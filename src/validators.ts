import {
  AcademicFields,
  WorkTypeValue,
  isAdvisorRequired,
  isCpgWork,
  isResearchProject,
} from "./ufla-rules";
import { validateReferencesText } from "./references-validator";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  what?: string;
  why?: string;
  action?: string;
}

export interface AdherenceCategory {
  key: string;
  label: string;
  status: "implemented" | "partial" | "pending" | "manual";
  statusLabel: string;
  note?: string;
}

export const ADHERENCE_CATEGORIES: AdherenceCategory[] = [
  {
    key: "metadata",
    label: "Metadados",
    status: "implemented",
    statusLabel: "Implementado",
    note: "Tipo de trabalho, autor, título, orientador e campos básicos são editáveis.",
  },
  {
    key: "pretextual",
    label: "Elementos pré-textuais",
    status: "partial",
    statusLabel: "Parcial",
    note: "Capa, folha de rosto, resumo e abstract são gerados. Ficha catalográfica e folha de aprovação dependem de preenchimento manual.",
  },
  {
    key: "resumo",
    label: "Resumo",
    status: "partial",
    statusLabel: "Parcial",
    note: "Estrutura e campo são gerados. Validação de extensão (150-500 palavras) não é automática.",
  },
  {
    key: "abstract",
    label: "Abstract",
    status: "partial",
    statusLabel: "Parcial",
    note: "Estrutura e campo são gerados. Validação de extensão não é automática.",
  },
  {
    key: "keywords",
    label: "Palavras-chave",
    status: "implemented",
    statusLabel: "Implementado",
    note: "Campo editável com formatação ponto e vírgula.",
  },
  {
    key: "body",
    label: "Corpo do texto",
    status: "implemented",
    statusLabel: "Implementado",
    note: "Editor com títulos, citações longas, negrito e itálico. Espaçamento 1,5 aplicado no DOCX.",
  },
  {
    key: "illustrations",
    label: "Ilustrações e tabelas",
    status: "partial",
    statusLabel: "Parcial",
    note: "Imagens importadas são preservadas como marcadores. Legendas e fontes devem ser conferidas manualmente.",
  },
  {
    key: "references",
    label: "Referências",
    status: "partial",
    statusLabel: "Parcial",
    note: "Normalização de destaque (negrito) implementada com detecção de tipo. Itens ambíguos exigem revisão manual.",
  },
  {
    key: "posttextual",
    label: "Elementos pós-textuais",
    status: "partial",
    statusLabel: "Parcial",
    note: "Referências, apêndices e anexos são suportados. Glossário e índice não foram implementados.",
  },
  {
    key: "export",
    label: "Exportação DOCX",
    status: "implemented",
    statusLabel: "Implementado",
    note: "Gera DOCX editável com margens, fonte, espaçamento e sumário atualizável. PDF deve ser gerado externamente.",
  },
  {
    key: "research-project",
    label: "Projeto de pesquisa / NBR 15287",
    status: "partial",
    statusLabel: "Parcial",
    note: "Suporte inicial para projeto de pesquisa com estrutura básica e validações parciais. A revisão final pelo usuário é obrigatória.",
  },
];

function hasValue(value: string | WorkTypeValue): boolean {
  return value.trim().length > 0;
}

function normalizeForValidation(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function looksInstitutionalAuthor(value: string): boolean {
  const normalized = normalizeForValidation(value);
  return /\b(UNIVERSIDADE|UFLA|INSTITUTO|PROGRAMA|POS-GRADUACAO|CURSO|DEPARTAMENTO|FACULDADE|ESCOLA|LAVRAS|MINAS GERAIS|MG)\b/.test(
    normalized,
  );
}

function hasLikelyImageWithoutCaption(text: string): boolean {
  const hasImageMarker = /!\[[^\]]*\]\(|<img\b|\bimagem\b|\[Imagem detectada:/i.test(text);
  const hasCaption = /\b(figura|imagem)\s+\d+|\blegenda\b/i.test(text);
  return hasImageMarker && !hasCaption;
}

function hasLikelyUnmarkedLongQuote(text: string): boolean {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .some((paragraph) => {
      const looksLong = paragraph.length > 450;
      const alreadyMarked = paragraph.startsWith(">");
      const hasCitationClue = /\([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^)]*,\s*(19|20)\d{2}/.test(
        paragraph,
      );
      return looksLong && hasCitationClue && !alreadyMarked;
    });
}

function referenceIssueMessage(code: string, message: string): string {
  if (code === "reference-normative-preserved") {
    return `${message} Isso pode estar correto para leis, portarias e resoluções, mas confira no Word antes da entrega.`;
  }

  if (code === "reference-access-missing" || code === "reference-highlight-missing") {
    return `${message} Revise antes da versão final.`;
  }

  return message;
}

function estimatePages(fields: AcademicFields, editorText: string): number {
  const text = [
    fields.title,
    fields.author,
    fields.abstractText,
    fields.keywords,
    fields.resumo,
    fields.palavrasChave,
    editorText,
    fields.referencias,
  ].join("\n");
  return Math.max(1, Math.ceil(text.length / 3200));
}

function estimateLineCount(value: string): number {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 95)), 0);
}

function addCpgWarnings(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isCpgWork(fields.workType)) return;

  issues.push({
    severity: "warning",
    code: "cpg-mode-selected",
    message:
      "Modo CPG/UFLA selecionado: não use capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto, sumário, cabeçalho, rodapé ou número de página. A submissão final deve ser em PDF.",
  });

  if (fields.workType === "resumo_cpg") {
    issues.push({
      severity: "warning",
      code: "cpg-resumo-one-page",
      message:
        "Resumo CPG/UFLA deve ter apenas 1 página, em português, A4, coluna simples, margens 3,5 cm superior, 2,5 cm inferior e 3 cm laterais.",
    });
  }

  if (fields.workType === "resumo_expandido_cpg") {
    issues.push({
      severity: "warning",
      code: "cpg-expanded-pages",
      message: "Resumo expandido CPG/UFLA deve ter de 4 a 6 páginas e conter abstract e resumo na primeira página.",
    });
  }

  if (fields.workType === "artigo_completo_cpg") {
    issues.push({
      severity: "warning",
      code: "cpg-full-pages",
      message: "Artigo completo CPG/UFLA deve ter de 8 a 14 páginas e conter abstract e resumo na primeira página.",
    });
  }

  const pages = estimatePages(fields, editorText);
  if (fields.workType === "resumo_cpg" && pages > 1) {
    issues.push({
      severity: "warning",
      code: "cpg-resumo-estimated-pages",
      message: `Estimativa atual: ${pages} pagina(s). Para resumo CPG, ajuste o conteudo para 1 pagina.`,
    });
  }
  if (fields.workType === "resumo_expandido_cpg" && (pages < 4 || pages > 6)) {
    issues.push({
      severity: "warning",
      code: "cpg-expanded-estimated-pages",
      message: `Estimativa atual: ${pages} página(s). Para resumo expandido CPG, ajuste para 4 a 6 páginas.`,
    });
  }

  if (fields.workType === "artigo_completo_cpg" && (pages < 8 || pages > 14)) {
    issues.push({
      severity: "warning",
      code: "cpg-full-estimated-pages",
      message: `Estimativa atual: ${pages} página(s). Para artigo completo CPG, ajuste para 8 a 14 páginas.`,
    });
  }
  if (fields.workType !== "resumo_cpg" && estimateLineCount(fields.abstractText) > 10) {
    issues.push({
      severity: "warning",
      code: "cpg-abstract-too-long",
      message: "Abstract CPG parece ultrapassar 10 linhas. Encurte ou revise a primeira pagina antes da submissao.",
    });
  }

  if (fields.workType !== "resumo_cpg" && estimateLineCount(fields.resumo) > 10) {
    issues.push({
      severity: "warning",
      code: "cpg-resumo-too-long",
      message: "Resumo CPG parece ultrapassar 10 linhas. Encurte ou revise a primeira pagina antes da submissao.",
    });
  }

  if (/<table\b|<\/table>|!\[[^\]]*\]\(|<img\b|\[Imagem detectada:/i.test(editorText)) {
    issues.push({
      severity: "warning",
      code: "cpg-complex-media-warning",
      message:
        "Modelos CPG com imagens ou tabelas complexas precisam de conferencia visual: legendas, qualidade e espacamento podem exigir ajuste manual.",
    });
  }
}

function addResearchProjectIssues(fields: AcademicFields, editorText: string, issues: ValidationIssue[]): void {
  if (!isResearchProject(fields.workType)) return;

  issues.push({
    severity: "warning",
    code: "research-project-partial",
    message: "Suporte inicial para Projeto de pesquisa (NBR 15287:2025). A revisão final pelo usuário é obrigatória.",
    what: "O sistema possui suporte inicial para projeto de pesquisa.",
    why: "A validação NBR 15287 é parcial e o sistema não substitui a norma oficial.",
    action: "Revise todos os campos e o DOCX gerado antes da versão final.",
  });

  const hasProblemStatement = /#+\s*PROBLEMA\s+DE\s+PESQUISA/i.test(editorText) || /#+\s*PROBLEMA/i.test(editorText);
  const hasObjective = /#+\s*OBJETIVO\s+GERAL/i.test(editorText);
  const hasJustification = /#+\s*JUSTIFICATIVA/i.test(editorText);
  const hasMethodology = /#+\s*METODOLOGIA/i.test(editorText) || /#+\s*PROCEDIMENTOS/i.test(editorText);
  const hasSchedule = /#+\s*CRONOGRAMA/i.test(editorText);
  const hasReferences = /#+\s*(REFERÊNCIAS|REFERENCIAS|REFERÊNCIAS)/i.test(editorText) || /#+\s*BIBLIOGRÁFICAS/i.test(editorText);

  if (!hasProblemStatement) {
    issues.push({
      severity: "error",
      code: "research-problem-required",
      message: "Informe o problema de pesquisa.",
      what: "O projeto de pesquisa não apresenta o problema a ser investigado.",
      why: "O problema delimita a investigação e orienta objetivos, metodologia e justificativa.",
      action: "Adicione uma seção chamada 'Problema de pesquisa' no editor.",
    });
  }

  if (!hasObjective) {
    issues.push({
      severity: "error",
      code: "research-goal-required",
      message: "Informe o objetivo geral.",
      what: "O projeto de pesquisa não apresenta o objetivo geral.",
      why: "O objetivo geral direciona a pesquisa e fundamenta a metodologia.",
      action: "Adicione uma seção chamada 'Objetivo geral' no editor.",
    });
  }

  if (!hasJustification) {
    issues.push({
      severity: "error",
      code: "research-justification-required",
      message: "Informe a justificativa.",
      what: "O projeto de pesquisa não apresenta a justificativa.",
      why: "A justificativa fundamenta a relevância e pertinência da pesquisa.",
      action: "Adicione uma seção chamada 'Justificativa' no editor.",
    });
  }

  if (!hasMethodology) {
    issues.push({
      severity: "error",
      code: "research-methodology-required",
      message: "Informe a metodologia.",
      what: "O projeto de pesquisa não apresenta a metodologia.",
      why: "A metodologia descreve como a pesquisa será conduzida.",
      action: "Adicione uma seção chamada 'Metodologia' no editor.",
    });
  }

  if (!hasSchedule) {
    issues.push({
      severity: "error",
      code: "research-schedule-required",
      message: "Informe o cronograma.",
      what: "O projeto de pesquisa não apresenta o cronograma.",
      why: "O cronograma orienta a execução e marcos do projeto.",
      action: "Adicione uma seção chamada 'Cronograma' no editor.",
    });
  }

  if (!hasReferences) {
    issues.push({
      severity: "error",
      code: "research-references-required",
      message: "Informe as referências.",
      what: "O projeto de pesquisa não apresenta referências.",
      why: "Referências são necessárias para base teórica e aportes bibliográficos.",
      action: "Adicione referências no editor ou no campo Referências.",
    });
  }
}

export function validateWork(
  fields: AcademicFields,
  editorText = "",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasValue(fields.workType)) {
    issues.push({
      severity: "error",
      code: "work-type-required",
      message: "Selecione o tipo de trabalho.",
      what: "O tipo de trabalho não foi informado.",
      why: "O tipo define quais elementos pré-textuais e regras de formatação serão aplicados no DOCX.",
      action: "Escolha artigo, monografia, dissertação, tese ou outro na lista suspensa.",
    });
  }

  if (!hasValue(fields.title)) {
    issues.push({
      severity: "error",
      code: "title-required",
      message: "Informe o título do trabalho.",
      what: "O título do trabalho está vazio.",
      why: "O título é obrigatório na capa, folha de rosto e cabeçalhos do documento.",
      action: "Preencha o campo Título com a designação oficial do trabalho.",
    });
  }

  if (!hasValue(fields.author)) {
    issues.push({
      severity: "error",
      code: "author-required",
      message: "Informe o autor do trabalho.",
      what: "O autor do trabalho não foi informado.",
      why: "O nome do autor aparece na capa, folha de rosto e elementos pré-textuais.",
      action: "Preencha o campo Autor com o nome completo do autor ou autores separados por vírgula.",
    });
  } else if (looksInstitutionalAuthor(fields.author)) {
    issues.push({
      severity: "error",
      code: "author-institutional",
      message:
        "O campo autor parece conter uma instituição, programa, unidade ou localidade, não um nome de pessoa. Revise a identificação automática.",
      what: "O campo Autor contém texto que parece institucional.",
      why: "A capa e a folha de rosto esperam o nome de pessoa física, não o nome da instituição.",
      action: "Substitua por nome(s) de pessoa(s). Se houver múltiplos autores, separe por vírgula.",
    });
  }

  if (isAdvisorRequired(fields.workType) && !hasValue(fields.advisor)) {
    issues.push({
      severity: "warning",
      code: "advisor-required",
      message: "Informe o orientador para monografia, dissertação ou tese.",
      what: "O orientador não foi informado.",
      why: "Monografias, dissertações e teses exigem nome do orientador na folha de rosto.",
      action: "Preencha o campo Orientador antes de gerar o DOCX.",
    });
  }

  if (!hasValue(fields.resumo)) {
    issues.push({
      severity: "warning",
      code: "resumo-required",
      message: "Inclua o resumo antes da versão final.",
      what: "O resumo está vazio.",
      why: "O resumo é elemento pré-textual obrigatório na maioria dos tipos de trabalho.",
      action: "Escreva o resumo no campo correspondente. Verifique extensão e palavras-chave.",
    });
  }

  if (!hasValue(fields.referencias) && !isCpgWork(fields.workType)) {
    issues.push({
      severity: "warning",
      code: "references-required",
      message: "Inclua as referências do trabalho.",
      what: "O bloco de referências está vazio.",
      why: "Referências são obrigatórias para a seção pós-textual.",
      action: "Adicione as referências no campo Referências, uma por linha.",
    });
  } else if (hasValue(fields.referencias)) {
    for (const referenceIssue of validateReferencesText(fields.referencias)) {
      issues.push({
        severity: "warning",
        code: referenceIssue.code,
        message: referenceIssueMessage(referenceIssue.code, referenceIssue.message),
        what: referenceIssue.code.includes("year-missing")
          ? "Há referência sem ano detectável."
          : referenceIssue.code.includes("access-missing")
            ? "Há referência online sem informação de acesso."
            : referenceIssue.code.includes("highlight-missing")
              ? "Há referência sem destaque de título detectado."
              : referenceIssue.code.includes("too-short")
                ? "Há referência muito curta para validação segura."
                : referenceIssue.code.includes("normative-preserved")
                  ? "Há referência normativa preservada sem destaque automático."
                  : "Referência precisa de revisão.",
        why: "A conformidade ABNT/UFLA depende de autor, ano, acesso e destaque corretos.",
        action: "Revise o item no campo Referências e use Negrito/Itálico para ajustar o destaque.",
      });
    }
  }

  if (!hasValue(fields.introducao) && !isCpgWork(fields.workType)) {
    issues.push({
      severity: "warning",
      code: "intro-required",
      message: "A introdução não foi detectada ou está vazia.",
      what: "A seção de introdução não foi identificada.",
      why: "A introdução é a primeira seção textual obrigatória na estrutura UFLA.",
      action: "Insira a introdução no editor ou no campo Introdução.",
    });
  }

  if (!hasValue(fields.abstractText) && fields.workType !== "resumo_cpg") {
    issues.push({
      severity: "warning",
      code: "abstract-recommended",
      message: "Inclua o abstract quando exigido pelo trabalho.",
      what: "O abstract está vazio.",
      why: "O abstract é obrigatório para a maioria dos trabalhos acadêmicos da UFLA.",
      action: "Preencha o campo Abstract com a versão do resumo em inglês ou idioma estrangeiro.",
    });
}

addCpgWarnings(fields, editorText, issues);
  addResearchProjectIssues(fields, editorText, issues);

  if (hasLikelyImageWithoutCaption(editorText)) {
    issues.push({
      severity: "warning",
      code: "image-caption-warning",
      message: "Imagem detectada sem legenda provável. Confira posição, qualidade e legenda antes da versão final.",
      what: "Há possível imagem sem legenda no texto.",
      why: "Ilustrações precisam de legenda e fonte conforme ABNT/UFLA.",
      action: "Adicione legenda no formato 'Figura X - Título' e verifique a fonte da imagem.",
    });
  }

  if (hasLikelyUnmarkedLongQuote(editorText)) {
    issues.push({
      severity: "warning",
      code: "long-quote-warning",
      message: "Há possível citação longa não marcada como citação longa. Revise antes da versão final.",
      what: "Há parágrafo longo com data que pode ser citação direta.",
      why: "Citações longas exigem recuo de 4 cm, fonte 11 e espaço simples.",
      action: "Selecione o trecho e clique em Citação longa na barra de ferramentas.",
    });
  }

  if (hasValue(fields.imageWarnings)) {
    issues.push({
      severity: "warning",
      code: "imported-image-warning",
      message: `${fields.imageWarnings} Confira posição, qualidade e legenda antes da versão final.`,
      what: "Imagens foram importadas do arquivo original.",
      why: "Imagens importadas podem perder qualidade ou legenda na conversão.",
      action: "Verifique cada imagem no DOCX gerado e ajuste legendas se necessário.",
    });
  }

  if (hasValue(fields.anexos) && /\[Imagem detectada:/i.test(fields.anexos)) {
    issues.push({
      severity: "warning",
      code: "annex-image-partial",
      message: "Há imagem detectada em anexos; confira posição, qualidade e legenda antes da versão final.",
      what: "Imagens foram detectadas na seção de anexos.",
      why: "Anexos com imagens exigem verificação de legenda, fonte e qualidade.",
      action: "Abra o DOCX e confira cada imagem nos anexos.",
    });
  }

  if (hasValue(fields.apendices) && /\[Imagem detectada:/i.test(fields.apendices)) {
    issues.push({
      severity: "warning",
      code: "appendix-image-partial",
      message: "Há imagem detectada em apêndices; confira posição, qualidade e legenda antes da versão final.",
      what: "Imagens foram detectadas na seção de apêndices.",
      why: "Apêndices com imagens exigem verificação de legenda, fonte e qualidade.",
      action: "Abra o DOCX e confira cada imagem nos apêndices.",
    });
  }

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
