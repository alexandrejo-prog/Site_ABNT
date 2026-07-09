import { WORK_TYPE_LABELS, type WorkType, type WorkTypeValue } from "../ufla-rules";

interface WorkTypeSelectorProps {
  value: WorkTypeValue;
  onChange: (workType: WorkTypeValue) => void;
}

const LONG_FORM_TYPES: WorkType[] = ["monografia", "dissertacao", "tese"];
const PROJECT_TYPES: WorkType[] = ["projeto_pesquisa"];
const ARTICLE_AND_CPG_TYPES: WorkType[] = ["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"];
const UFLA_PRODUCTION_TYPES: WorkType[] = [
  "artigo_cientifico_ufla",
  "patente_ufla",
  "revisao_sistematica_ufla",
  "estudo_caso_ufla",
  "cultivar_ufla",
  "relatorio_estagio_ufla",
  "proposta_intervencao_ufla",
];
const OTHER_TYPES: WorkType[] = ["software_aplicativo_ufla", "outro"];

function renderOptions(types: WorkType[]) {
  return types.map((type) => (
    <option key={type} value={type}>
      {WORK_TYPE_LABELS[type]}
    </option>
  ));
}

export function WorkTypeSelector({ value, onChange }: WorkTypeSelectorProps) {
  return (
    <section className="work-type-card" aria-label="Escolha do tipo de trabalho">
      <p className="section-kicker">Etapa 2</p>
      <label htmlFor="work-type">Tipo de trabalho</label>
      <select id="work-type" value={value} onChange={(event) => onChange(event.target.value as WorkTypeValue)}>
        <option value="">Selecione</option>
        <optgroup label="Trabalhos acadêmicos longos">
          {renderOptions(LONG_FORM_TYPES)}
        </optgroup>
        <optgroup label="Projeto">
          {renderOptions(PROJECT_TYPES)}
        </optgroup>
        <optgroup label="Artigos e CPG">
          {renderOptions(ARTICLE_AND_CPG_TYPES)}
        </optgroup>
        <optgroup label="Coleção Produção Acadêmica UFLA">
          {renderOptions(UFLA_PRODUCTION_TYPES)}
        </optgroup>
        <optgroup label="Outros">
          {renderOptions(OTHER_TYPES)}
        </optgroup>
      </select>
    </section>
  );
}
