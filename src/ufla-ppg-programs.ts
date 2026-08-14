export interface UflaPpgProgram {
  name: string;
  type: "academico" | "profissional";
  masters: boolean;
  doctorate: boolean;
}

export const UFLA_PPG_PROGRAMS_SOURCE = "https://prpg.ufla.br/mestrado-e-doutorado";

// Snapshot local conferido com a página oficial da PRPG/UFLA (acesso em 2026-08-12).
// 43 programas: 35 acadêmicos + 8 profissionais. Atualizar manualmente se a PRPG
// alterar a lista de programas.

export const UFLA_PPG_PROGRAMS: UflaPpgProgram[] = [
  { name: "Administração", type: "academico", masters: true, doctorate: true },
  { name: "Agroquímica", type: "academico", masters: true, doctorate: true },
  { name: "Biotecnologia Vegetal", type: "academico", masters: true, doctorate: true },
  { name: "Botânica Aplicada", type: "academico", masters: true, doctorate: true },
  { name: "Ciência da Computação", type: "academico", masters: true, doctorate: true },
  { name: "Ciência do Solo", type: "academico", masters: true, doctorate: true },
  { name: "Ciência dos Alimentos", type: "academico", masters: true, doctorate: true },
  { name: "Ciência e Tecnologia da Madeira", type: "academico", masters: true, doctorate: true },
  { name: "Ciências da Saúde", type: "academico", masters: true, doctorate: false },
  { name: "Ciências Veterinárias", type: "academico", masters: true, doctorate: true },
  { name: "Ecologia Aplicada", type: "academico", masters: true, doctorate: true },
  { name: "Educação Científica e Ambiental", type: "academico", masters: true, doctorate: false },
  { name: "Educação Física", type: "academico", masters: true, doctorate: false },
  { name: "Engenharia Agrícola", type: "academico", masters: true, doctorate: true },
  { name: "Engenharia Ambiental", type: "academico", masters: true, doctorate: false },
  { name: "Engenharia de Alimentos", type: "academico", masters: true, doctorate: false },
  { name: "Engenharia de Sistemas e Automação", type: "academico", masters: true, doctorate: false },
  { name: "Engenharia de Biomateriais", type: "academico", masters: true, doctorate: true },
  { name: "Engenharia Florestal", type: "academico", masters: true, doctorate: true },
  { name: "Engenharia Química e de Materiais", type: "academico", masters: true, doctorate: false },
  { name: "Entomologia", type: "academico", masters: true, doctorate: true },
  { name: "Estatística e Experimentação Agropecuária", type: "academico", masters: true, doctorate: true },
  { name: "Filosofia", type: "academico", masters: true, doctorate: false },
  { name: "Física", type: "academico", masters: true, doctorate: false },
  { name: "Fisiologia Vegetal", type: "academico", masters: true, doctorate: true },
  { name: "Fitopatologia", type: "academico", masters: true, doctorate: true },
  { name: "Fitotecnia", type: "academico", masters: true, doctorate: true },
  { name: "Genética e Melhoramento de Plantas", type: "academico", masters: true, doctorate: true },
  { name: "Letras", type: "academico", masters: true, doctorate: false },
  { name: "Microbiologia Agrícola", type: "academico", masters: true, doctorate: true },
  { name: "Multicêntrico em Química de Minas Gerais", type: "academico", masters: true, doctorate: true },
  { name: "Nutrição e Saúde", type: "academico", masters: true, doctorate: false },
  { name: "Plantas Medicinais, Aromáticas e Condimentares", type: "academico", masters: true, doctorate: true },
  { name: "Recursos Hídricos", type: "academico", masters: true, doctorate: true },
  { name: "Zootecnia", type: "academico", masters: true, doctorate: true },
  { name: "Administração Pública", type: "profissional", masters: true, doctorate: false },
  { name: "Ciência e Tecnologia da Produção Animal", type: "profissional", masters: true, doctorate: false },
  { name: "Desenvolvimento Sustentável e Extensão", type: "profissional", masters: true, doctorate: false },
  { name: "Educação", type: "profissional", masters: true, doctorate: true },
  { name: "Ensino de Ciências e Educação Matemática", type: "profissional", masters: true, doctorate: false },
  { name: "Genética e Melhoramento de Plantas", type: "profissional", masters: true, doctorate: false },
  { name: "Matemática em Rede Nacional – PROFMAT", type: "profissional", masters: true, doctorate: false },
  { name: "Tecnologias e Inovações Ambientais", type: "profissional", masters: true, doctorate: false },
];

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function findUflaPpgProgram(value: string): UflaPpgProgram | undefined {
  const query = fold(value).replace(/^programa de pos-graduacao em\s+/, "").replace(/^programa de pos-graduacao\s+/, "");
  if (!query) return undefined;
  return UFLA_PPG_PROGRAMS.find((program) => fold(program.name) === query || fold(program.name).includes(query) || query.includes(fold(program.name)));
}

// Retorna TODAS as correspondências oficiais. Alguns programas aparecem tanto na
// modalidade acadêmica quanto na profissional (ex.: "Genética e Melhoramento de
// Plantas"), por isso .find() silencioso pode escolher a entrada errada.
// Correspondências exatas têm prioridade: um nome completo (ex.: "Educação
// Científica e Ambiental") não deve casar como duplicata de "Educação".
export function findUflaPpgPrograms(value: string): UflaPpgProgram[] {
  const query = fold(value).replace(/^programa de pos-graduacao em\s+/, "").replace(/^programa de pos-graduacao\s+/, "");
  if (!query) return [];
  const exact = UFLA_PPG_PROGRAMS.filter((program) => fold(program.name) === query);
  if (exact.length > 0) return exact;
  return UFLA_PPG_PROGRAMS.filter((program) => fold(program.name).includes(query) || query.includes(fold(program.name)));
}

export interface UflaPpgProgramResolution {
  program: UflaPpgProgram | undefined;
  ambiguous: boolean;
}

// Resolve a entrada correta considerando o contexto do trabalho.
// - tese: exige doctorate === true; se nenhuma entrada tem doutorado, a
//   duplicidade é mantida como ambígua (não mascara).
// - dissertacao: restringe a masters === true; em duplicidade, prefere a
//   modalidade academica, mas sem mascarar ambiguidade relevante.
// - preferredType: força modalidade quando informado.
// Retorna program === undefined e ambiguous === true quando não há como decidir.
export function resolveUflaPpgProgram(
  value: string,
  options?: { preferredType?: "academico" | "profissional"; workType?: string },
): UflaPpgProgramResolution {
  const matches = findUflaPpgPrograms(value);
  if (matches.length <= 1) {
    return { program: matches[0], ambiguous: false };
  }

  let candidates = matches;
  const workType = options?.workType;

  if (workType === "tese") {
    const doctorates = candidates.filter((program) => program.doctorate);
    if (doctorates.length === 0) return { program: undefined, ambiguous: true };
    candidates = doctorates;
  } else if (workType === "dissertacao") {
    const masters = candidates.filter((program) => program.masters);
    if (masters.length >= 1) candidates = masters;
    const academic = candidates.filter((program) => program.type === "academico");
    if (academic.length === 1) candidates = academic;
  }

  if (options?.preferredType) {
    const filtered = candidates.filter((program) => program.type === options.preferredType);
    if (filtered.length === 1) candidates = filtered;
  }

  if (candidates.length === 1) {
    return { program: candidates[0], ambiguous: false };
  }

  return { program: undefined, ambiguous: true };
}

export function normalizeUflaPpgProgramName(value: string): string {
  return findUflaPpgProgram(value)?.name ?? value.trim();
}

export function formatUflaPpgProgram(value: string): string {
  const name = normalizeUflaPpgProgramName(value);
  if (!name) return "";
  if (fold(name).includes("programa de pos-graduacao")) return name;
  return `Programa de Pós-Graduação em ${name}`;
}
