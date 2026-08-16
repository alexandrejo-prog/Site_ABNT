export type CatalogCardRequirement = "required" | "recommended" | "not_applicable";

export interface CatalogCardStatus {
  requirement: CatalogCardRequirement;
  hasContent: boolean;
  cutterDetected: boolean;
  blocking: boolean;
  message: string;
}

/**
 * Número de Cutter-Sanborn: letra inicial do sobrenome + 1 a 4 dígitos da
 * tabela Cutter + (opcional) letra minúscula do início do título. Toda ficha
 * catalográfica oficial da Biblioteca Universitária da UFLA traz esse código
 * (ex.: "S586f"). A validação aceita também o prefixo "CDU" (Classificação
 * Decimal Universal) com número de classificação.
 */
const CUTTER_NUMBER_RE = /\b[A-Z]\d{1,4}[a-z]?\b/i;
const CDU_NUMBER_RE = /\b(?:CDU\s*)?\d{2,3}(?:\.\d+){1,3}\b/i;

export function hasCutterNumber(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return CUTTER_NUMBER_RE.test(normalized) || CDU_NUMBER_RE.test(normalized);
}

export function catalogCardRequirement(workType: string): CatalogCardRequirement {
  if (workType === "monografia" || workType === "dissertacao" || workType === "tese") return "required";
  return "not_applicable";
}

/**
 * Tabela Cutter-Sanborn (duas figuras) para os sobrenomes brasileiros mais
 * comuns, com os valores usados nas fichas da Biblioteca Universitária da UFLA.
 * Para sobrenomes fora da tabela, gera-se um valor determinístico aproximado
 * (primeira letra + 2 dígitos de hash) que mantém o formato oficial
 * `[A-Z]\d{1,4}[a-z]?` — o usuário deve confirmar o número com a Biblioteca.
 */
const CUTTER_TABLE: Record<string, string> = {
  ABREU: "A16",
  ALMEIDA: "A447",
  ARAUJO: "A663",
  BARBOSA: "B238",
  CARDOSO: "C268",
  CARVALHO: "C331",
  COSTA: "C837",
  FERREIRA: "F383",
  FREITAS: "F866",
  GOMES: "G633",
  LIMA: "L732",
  NASCIMENTO: "N244",
  OLIVEIRA: "O48",
  PEREIRA: "P436",
  RIBEIRO: "R484",
  ROCHA: "R672",
  RODRIGUES: "R696",
  SANTOS: "S237",
  SILVA: "S586",
  SOUSA: "S729",
  SOUZA: "S729",
};

/** Normaliza nome/sobrenome: maiúsculas, sem acentos, sem pontuação. */
function normalizeNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .trim();
}

/** Último sobrenome do autor (despreza "da/de/dos/das" e conectivos). */
export function authorSurname(author: string): string {
  const parts = normalizeNamePart(author).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1];
  const ARTICLES = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
  if (ARTICLES.has(last) && parts.length > 1) return parts[parts.length - 2];
  return last;
}

/**
 * Número de Cutter-Sanborn calculado do sobrenome (tabela) com fallback
 * determinístico. `title` entra como letra minúscula inicial do primeiro
 * termo significativo do título (padrão da ficha: S586f).
 */
export function cutterNumberFromSurname(surname: string, title = ""): string {
  const clean = normalizeNamePart(surname);
  if (!clean) return "";
  const first = clean[0];
  const table = CUTTER_TABLE[clean];
  const digits = table ?? `${first}${String((hashCode(clean) % 98) + 1).padStart(2, "0")}`;
  let suffix = "";
  const titleWord = normalizeNamePart(title).split(/\s+/).find((w) => !["O", "A", "OS", "AS", "UM", "UMA", "DE", "DA", "DO", "EM", "PARA"].includes(w));
  if (titleWord) suffix = titleWord[0].toLowerCase();
  return `${digits}${suffix}`;
}

function hashCode(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Descrição da natureza do trabalho para a ficha (ex.: TCC, dissertação, tese). */
function workNatureLabel(workType: string, courseOrProgram: string): string {
  const base =
    workType === "monografia" ? "Trabalho de Conclusão de Curso" :
    workType === "dissertacao" ? "Dissertação" :
    workType === "tese" ? "Tese" : "Trabalho acadêmico";
  return courseOrProgram ? `${base} (${courseOrProgram})` : base;
}

/**
 * Gera uma ficha catalográfica provisória no formato da Biblioteca Universitária
 * da UFLA (cabeçalho, Cutter-Sanborn calculado, dados do trabalho e descritores).
 * O usuário deve confirmar o Cutter e a classificação CDU com a Biblioteca antes
 * da versão final — o texto gerado já satisfaz a validação `hasCutterNumber`.
 */
export function generateCatalogCard(fields: {
  workType: string;
  author: string;
  title: string;
  subtitle?: string;
  course?: string;
  program?: string;
  advisor?: string;
  coadvisor?: string;
  areaConcentracao?: string;
  location?: string;
  year?: string;
  palavrasChave?: string;
}): string {
  const author = fields.author.trim();
  const title = fields.title.trim();
  if (!author || !title) return "";

  const surname = authorSurname(author);
  const cutter = cutterNumberFromSurname(surname, title);
  const fullTitle = fields.subtitle?.trim() ? `${title}: ${fields.subtitle.trim()}` : title;
  const location = fields.location?.trim() || "Lavras";
  const year = fields.year?.trim() || "";
  const nature = workNatureLabel(fields.workType, fields.course?.trim() || fields.program?.trim() || fields.areaConcentracao?.trim() || "");

  const lines: string[] = [];
  lines.push("Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA");
  lines.push("");
  const heading = `${cutter} ${surname.toUpperCase()}, ${author.split(/\s+/).slice(0, -1).join(" ").trim()}`;
  lines.push(heading);
  lines.push(`    ${fullTitle} / ${author}. - ${location}: UFLA, ${year}.`);
  if (fields.advisor?.trim()) lines.push("");
  if (fields.advisor?.trim()) lines.push(`    Orientador: ${fields.advisor.trim()}`);
  if (fields.coadvisor?.trim()) lines.push(`    Coorientador: ${fields.coadvisor.trim()}`);
  lines.push("");
  lines.push(`    ${nature} - Universidade Federal de Lavras, ${year}.`);
  if (fields.palavrasChave?.trim()) {
    lines.push("");
    const descriptors = fields.palavrasChave.split(/[;,]\s*/).map((k) => k.trim()).filter(Boolean);
    lines.push(`    ${descriptors.map((d, i) => `${i + 1}. ${d}`).join(". ")}.`);
  }
  lines.push("");
  lines.push("    I. Título.");
  return lines.join("\n");
}

export function hasCatalogCardContent(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (normalized.includes("INSERIR AQUI A FICHA CATALOGRAFICA")) return false;
  if (normalized.includes("NAO SUBSTITUA POR TEXTO MANUAL")) return false;
  return normalized.length >= 40;
}

export function catalogCardStatus(workType: string, content: string): CatalogCardStatus {
  const requirement = catalogCardRequirement(workType);
  const hasContent = hasCatalogCardContent(content);
  const cutterDetected = hasContent && hasCutterNumber(content);
  const blocking = requirement === "required" && !hasContent;

  if (blocking) {
    return {
      requirement,
      hasContent,
      cutterDetected,
      blocking,
      message: "Ficha catalografica obrigatoria ausente. Insira a ficha oficial da Biblioteca antes da versao final.",
    };
  }

  if (hasContent && !cutterDetected) {
    return {
      requirement,
      hasContent,
      cutterDetected,
      blocking: false,
      message: "Conteudo presente, mas sem numero de Cutter (ex.: S586f) ou classificacao CDU detectavel. Confira se a ficha oficial da Biblioteca foi colada integralmente.",
    };
  }

  return {
    requirement,
    hasContent,
    cutterDetected,
    blocking: false,
    message: hasContent ? "Ficha catalografica informada com numero de Cutter detectado." : "Ficha catalografica nao aplicavel.",
  };
}
