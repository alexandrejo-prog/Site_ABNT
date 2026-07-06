export interface UflaPpgProgram {
  name: string;
  type: "academico" | "profissional";
  masters: boolean;
  doctorate: boolean;
}

export const UFLA_PPG_PROGRAMS_SOURCE = "https://prpg.ufla.br/servicos-em-destaque/mestrado-e-doutorado";

export const UFLA_PPG_PROGRAMS: UflaPpgProgram[] = [
  { name: "Administração", type: "academico", masters: true, doctorate: true },
  { name: "Agroquímica", type: "academico", masters: true, doctorate: true },
  { name: "Biotecnologia Vegetal", type: "academico", masters: true, doctorate: true },
  { name: "Botânica Aplicada", type: "academico", masters: true, doctorate: true },
  { name: "Ciência da Computação", type: "academico", masters: true, doctorate: false },
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

export function normalizeUflaPpgProgramName(value: string): string {
  return findUflaPpgProgram(value)?.name ?? value.trim();
}

export function formatUflaPpgProgram(value: string): string {
  const name = normalizeUflaPpgProgramName(value);
  if (!name) return "Programa de Pós-Graduação informado pelo usuário";
  if (fold(name).includes("programa de pos-graduacao")) return name;
  return `Programa de Pós-Graduação em ${name}`;
}
