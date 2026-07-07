import { UFLA_PPG_PROGRAMS } from "./ufla-ppg-programs";
import { AcademicFields } from "./ufla-rules";

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[nome do orientador\]/i,
  /\[preencher\]/i,
  /\[preencher:.*?\]/i,
  /\[preencha aqui\]/i,
  /\[insira aqui\]/i,
  /\[insira o texto\]/i,
  /\[insira:.*?\]/i,
  /\[inserir:.*?\]/i,
  /\[digite aqui\]/i,
  /\[digite:.*?\]/i,
  /\{\{titulo\}\}/i,
  /\{\{.*?\}\}/i,
  /<preencher>/i,
  /lorem ipsum/i,
  /o relato dos impactos deve ser inserido/i,
  /texto a ser preenchido/i,
  /insira o texto/i,
  /digite aqui/i,
  /\(preencher\)/i,
  /xxx+/i,
  /\[*\s*insira\s*\]/i,
];

const CONTROLLED_PLACEHOLDER = /\[(?:\s*)(?:preencha|preenche|preencher|insira|inserir|digite|coloque|adicione|complete|substitua)[\s:.-]*/i;

export function detectControlledPlaceholder(value: string): boolean {
  if (!value) return false;
  return CONTROLLED_PLACEHOLDER.test(value);
}

// Frases genéricas em linguagem natural que o sistema usava como fallback quando
// cursos/programas estavam vazios. Elas não podem aparecer em versão acadêmica
// final. A detecção é feita sobre o texto normalizado (sem acento / minúsculo).
const NATURAL_PLACEHOLDER_SUBSTRINGS = [
  "informado pelo usuario",
  "grau academico correspondente",
  "programa de pos-graduacao informado pelo usuario",
];

export function detectNaturalPlaceholder(value: string): boolean {
  if (!value) return false;
  const normalized = normalizeTextForMatch(value);
  return NATURAL_PLACEHOLDER_SUBSTRINGS.some((token) => normalized.includes(token));
}

export function detectPlaceholderText(value: string): boolean {
  if (!value) return false;
  const normalized = normalizeTextForMatch(value);
  if (detectControlledPlaceholder(value)) return true;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value) || pattern.test(normalized))) return true;
  const bracketMatches = value.match(/\[[^\]]+\]/g) || [];
  return bracketMatches.some((token) => {
    const inner = token.slice(1, -1).toLowerCase().trim();
    if (inner.length < 3) return false;
    return /(preenche|preencha|preencher|insira|coloque|adicione|inserir|digite|complete|substitua|exemplo|placeholder|nome do|nome da)/.test(inner);
  });
}

interface ProgramTermEntry {
  value: string;
  contextualOnly: boolean;
}

interface ProgramTermGroup {
  label: string;
  terms: ProgramTermEntry[];
}

const PROGRAM_TERM_ALIASES: Record<string, Array<string | { value: string; contextualOnly?: boolean }>> = {
  "educacao cientifica e ambiental": [
    { value: "educacao cientifica e ambiental", contextualOnly: false },
    { value: "ppgeca", contextualOnly: false },
    { value: "ppg-eca", contextualOnly: false },
  ],
};

const PROGRAM_TERM_SUPPLEMENTS: ProgramTermGroup[] = [
  {
    label: "Engenharia de Controle e Automação",
    terms: [
      { value: "engenharia de controle e automacao", contextualOnly: false },
      { value: "controle e automacao", contextualOnly: false },
      { value: "engenharia de automacao", contextualOnly: false },
    ],
  },
];

function normalizedProgramName(value: string): string {
  return normalizeTextForMatch(value).replace(/\s+[\u2013-]\s+profmat$/i, "");
}

function addProgramTerm(groups: Map<string, ProgramTermGroup>, label: string, value: string, contextualOnly: boolean): void {
  const normalized = normalizeTextForMatch(value);
  if (!normalized) return;
  const key = normalizeTextForMatch(label);
  const group = groups.get(key) ?? { label, terms: [] };
  const existing = group.terms.find((term) => term.value === normalized);
  if (existing) {
    existing.contextualOnly = existing.contextualOnly && contextualOnly;
  } else {
    group.terms.push({ value: normalized, contextualOnly });
  }
  groups.set(key, group);
}

function buildProgramTerms(): ProgramTermGroup[] {
  const groups = new Map<string, ProgramTermGroup>();

  for (const program of UFLA_PPG_PROGRAMS) {
    const baseName = normalizedProgramName(program.name);
    addProgramTerm(groups, program.name, baseName, true);

    for (const alias of PROGRAM_TERM_ALIASES[baseName] ?? []) {
      if (typeof alias === "string") addProgramTerm(groups, program.name, alias, true);
      else addProgramTerm(groups, program.name, alias.value, alias.contextualOnly ?? true);
    }
  }

  for (const supplement of PROGRAM_TERM_SUPPLEMENTS) {
    for (const term of supplement.terms) {
      addProgramTerm(groups, supplement.label, term.value, term.contextualOnly);
    }
  }

  return [...groups.values()];
}

// Termos de programas institucionais reais derivados do snapshot da PRPG/UFLA.
// Nomes oficiais exigem contexto institucional no corpo do texto; aliases muito
// especificos cobrem siglas e nomes historicos sem reabrir falso positivo para
// expressoes academicas comuns como "ciencia do solo".
const PROGRAM_TERMS = buildProgramTerms();

// Termos de area/tema do CONTEUDO. Usados apenas para diagnostico; NAO geram
// conflito bloqueante contra programas institucionais.
const TOPIC_TERMS: { terms: string[]; label: string }[] = [
  { label: "Biologia", terms: ["biologia", "ciencias e biologia", "ciências e biologia"] },
  { label: "Ciências", terms: ["ciencias", "ciências"] },
  { label: "Pedagogia", terms: ["pedagogia", "pedagogico", "pedagógica", "pedagógico", "docencia", "docência", "ensino", "formação de professores", "formacao de professores"] },
];

function repairMojibakeForMatch(value: string): string {
  if (!/[ÃÂâ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

export function normalizeTextForMatch(value: string): string {
  return repairMojibakeForMatch(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Detecta um marcador de programa institucional como termo contextual, ou seja,
// quando o texto aponta para um programa de outra área (ex.: "curso de Engenharia
// de Controle e Automação", "programa de Pós-Graduação em X"). Evita falso positivo
// com uso genérico como "engenharia didática", "engenharia pedagógica", "engenharia social".
const INSTITUTIONAL_CONTEXT = [
  "programa de pos-graduacao em",
  "programa de pós-graduação em",
  "programa de pos graduacao em",
  "pos-graduacao em",
  "pós-graduação em",
  "pos graduacao em",
  "curso de",
  "curso de graduacao em",
  "graduacao em",
  "graduação em",
  "departamento de",
  "instituto de",
  "faculdade de",
  "ppg em",
  "ppgeca",
  "ppg-eca",
];

function isInstitutionalProgramMention(normalized: string, term: ProgramTermEntry, allowPlain = false): boolean {
  if (term.value === "engenharia") {
    // Só conta como programa institucional "Engenharia" quando acompanhado de
    // curso/programa/departamento ou de um complemento institucional específico.
    if (INSTITUTIONAL_CONTEXT.some((ctx) => normalized.includes(`${ctx} engenharia`))) return true;
    if (/\bengenharia (de|em|elétrica|eletrica|mecanica|mecânica|civil|de producao|de produção|quimica|química|de controle e automacao|de automacao|de materiais|aeroespacial|aeroespacial)\b/.test(normalized)) return true;
    return false;
  }
  if (INSTITUTIONAL_CONTEXT.some((ctx) => normalized.includes(`${ctx} ${term.value}`))) return true;
  // Programas curtos também casam direto (ppgeca, eca, controle e automacao...).
  return allowPlain || !term.contextualOnly ? normalized.includes(term.value) : false;
}

function detectProgramLabel(value: string, allowPlain = true): string | null {
  const normalized = normalizeTextForMatch(value);
  for (const group of PROGRAM_TERMS) {
    if (group.terms.some((term) => isInstitutionalProgramMention(normalized, term, allowPlain))) return group.label;
  }
  return null;
}

export function detectProgramConflict(fields: AcademicFields, editorText = ""): boolean {
  const declaredProgram = detectProgramLabel(fields.program, true) || detectProgramLabel(fields.course, true);
  if (!declaredProgram) return false;

  const bodySources = [
    fields.workNature,
    fields.resumo,
    fields.abstractText,
    fields.title,
    fields.introducao,
    fields.conclusao,
    editorText,
  ].join(" ");
  const normalizedBody = normalizeTextForMatch(bodySources);
  const mentionedLabels = new Set<string>();
  for (const group of PROGRAM_TERMS) {
    if (group.terms.some((term) => isInstitutionalProgramMention(normalizedBody, term, false))) {
      mentionedLabels.add(group.label);
    }
  }
  mentionedLabels.delete(declaredProgram);
  return mentionedLabels.size > 0;
}

const PT_STOPWORDS = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "para", "por", "com", "sem", "que", "um", "uma", "uns", "umas", "se", "ao", "aos",
  "as", "os", "como", "seu", "sua", "seus", "suas", "este", "esta", "esse", "essa",
  "foi", "sao", "ser", "foi", "tem", "sobre", "entre", "mais", "menos", "pela", "pelo",
  "ou", "já", "ja", "não", "nao", "dos", "das", "num", "numa", "do", "da",
]);

const EN_STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "with", "without",
  "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "this", "that",
  "these", "those", "it", "its", "their", "his", "her", "our", "your", "we", "they", "he",
  "she", "but", "not", "no", "yes", "can", "could", "should", "would", "may", "might",
  "study", "paper", "research", "work", "article", "analysis", "results", "conclusion",
  "objective", "aim", "aims", "goal", "goals", "method", "methods", "approach",
]);

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function relevantTerms(value: string, stopwords: Set<string>): Set<string> {
  return new Set(tokenize(value).filter((term) => term.length > 2 && !stopwords.has(term)));
}

const DOMAIN_INCOMPATIBLE: { domain: string[]; opposite: string[] }[] = [
  {
    domain: ["agriculture", "agricultural", "crop", "crops", "farming", "soil", "plant", "plants", "harvest", "yield", "agronomy"],
    opposite: ["docencia", "docência", "estagio", "estágio", "pedagogia", "pedagogical", "ensino", "teaching", "pgd", "gerencialismo", "gestao", "gestão", "school", "classroom", "aluno", "alunos", "professor", "professores", "biologia", "biológica", "biológico", "biological", "biologic", "ciencias", "ciências", "discente", "formacao", "formação"],
  },
  {
    domain: ["docencia", "docência", "estagio", "estágio", "pedagogia", "pedagogical", "ensino", "teaching", "pgd", "gerencialismo", "gestao", "gestão", "school", "classroom", "aluno", "alunos", "professor", "professores", "biologia", "biológica", "biológico", "biological", "biologic", "ciencias", "ciências", "discente", "formacao", "formação"],
    opposite: ["agriculture", "agricultural", "crop", "crops", "farming", "soil", "plant", "plants", "harvest", "yield", "agronomy"],
  },
];

export interface AbstractTopicConflict {
  conflict: boolean;
  severity: "error" | "warning";
  sharedTerms: number;
  incompatibleTerms: string[];
}

export function detectAbstractTopicConflict(fields: AcademicFields): AbstractTopicConflict {
  const ptText = `${fields.title} ${fields.resumo} ${fields.workNature}`;
  const enText = fields.abstractText;
  if (!enText.trim() || !ptText.trim()) return { conflict: false, severity: "warning", sharedTerms: 0, incompatibleTerms: [] };

  const ptTerms = relevantTerms(ptText, PT_STOPWORDS);
  const enTerms = relevantTerms(enText, EN_STOPWORDS);

  let shared = 0;
  const sharedSet = new Set<string>();
  for (const term of enTerms) {
    if (ptTerms.has(term)) {
      shared += 1;
      sharedSet.add(term);
    }
  }

  const ptJoined = normalizeTextForMatch(ptText);
  const enJoined = normalizeTextForMatch(enText);
  const incompatible: string[] = [];
  for (const pair of DOMAIN_INCOMPATIBLE) {
    const ptHasDomain = pair.domain.some((term) => ptJoined.includes(term));
    const enHasOpposite = pair.opposite.some((term) => enJoined.includes(term));
    if (ptHasDomain && enHasOpposite) {
      incompatible.push(...pair.opposite.filter((term) => enJoined.includes(term)));
    }
  }

  if (incompatible.length > 0 && shared <= 1) {
    return { conflict: true, severity: "error", sharedTerms: shared, incompatibleTerms: [...new Set(incompatible)] };
  }
  if (incompatible.length > 0 && shared <= 3) {
    return { conflict: true, severity: "warning", sharedTerms: shared, incompatibleTerms: [...new Set(incompatible)] };
  }
  return { conflict: false, severity: "warning", sharedTerms: shared, incompatibleTerms: [] };
}

const GENERIC_AI_LIKE_PATTERNS: RegExp[] = [
  /this study analyzes the transformative role of artificial intelligence in modern agriculture/i,
  /in today's world/i,
  /this paper aims to explore various aspects/i,
  /it is important to highlight/i,
  /este trabalho aborda diversos aspectos/i,
  /a presente pesquisa busca contribuir de forma significativa/i,
  /este artigo aborda diversos aspectos/i,
  /este estudo aborda diversos aspectos/i,
  /este artigo aborda diversos aspectos/i,
  /este estudo aborda diversos aspectos/i,
  /busca contribuir significativamente/i,
  /no mundo atual/i,
  /neste contexto, faz-se necessário/i,
  /faz-se necessario/i,
];

export function detectGenericAiLikeText(value: string): boolean {
  if (!value) return false;
  return GENERIC_AI_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

const CPG_FORBIDDEN_TERMS = [
  "CAPA",
  "CAPA DO TRABALHO",
  "FOLHA DE ROSTO",
  "FICHA CATALOGRAFICA",
  "FICHA CATALOGRÁFICA",
  "FOLHA DE APROVACAO",
  "FOLHA DE APROVAÇÃO",
  "SUMARIO",
  "SUMÁRIO",
  "INDICADORES DE IMPACTO",
];

function normalizeHeadingLine(line: string): string {
  return normalizeTextForMatch(line)
    .replace(/^#+\s*/, "")
    .replace(/^\d+(?:\.\d+)*\s*/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/[:\-–—]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectCpgForbiddenStructures(editorText: string): string[] {
  const normalizedLines = editorText
    .split(/\n+/)
    .map(normalizeHeadingLine)
    .filter(Boolean);
  const found: string[] = [];
  for (const forbidden of CPG_FORBIDDEN_TERMS) {
    const term = normalizeTextForMatch(forbidden).trim();
    if (normalizedLines.includes(term)) found.push(forbidden);
  }
  return found;
}
