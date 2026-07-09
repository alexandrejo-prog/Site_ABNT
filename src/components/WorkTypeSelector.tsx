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

function selectionHint(value: WorkTypeValue): { title: string; text: string; tone: "neutral" | "warning" | "success" } {
  if (value === "dissertacao" || value === "tese") {
    return {
      title: "Rascunho editável",
      text: "Antes da versão final, revise orientador, banca, ficha catalográfica e atualize o sumário no Word ou LibreOffice.",
      tone: "warning",
    };
  }
  if (value === "monografia") {
    return {
      title: "Trabalho longo",
      text: "Confira orientador, folha de aprovação, ficha catalográfica e sumário antes da entrega final.",
      tone: "warning",
    };
  }
  if (value === "projeto_pesquisa") {
    return {
      title: "Projeto de pesquisa",
      text: "Este modelo não usa ficha catalográfica nem folha de aprovação. O sumário deve ser atualizado no Word ou LibreOffice.",
      tone: "success",
    };
  }
  if (value) {
    return {
      title: "Modelo selecionado",
      text: "Confira se o modelo combina com o arquivo importado. O tipo escolhido define a estrutura do DOCX.",
      tone: "neutral",
    };
  }
  return {
    title: "Selecione o modelo",
    text: "Escolha o tipo antes de gerar. Essa decisão define capa, sumário, ficha e seções permitidas.",
    tone: "neutral",
  };
}

export function WorkTypeSelector({ value, onChange }: WorkTypeSelectorProps) {
  const hint = selectionHint(value);

  return (
    <section className="work-type-card" aria-label="Escolha do tipo de trabalho">
      <p className="section-kicker">Etapa 2</p>
      <label htmlFor="work-type">Tipo de trabalho</label>
      <select id="work-type" value={value} aria-describedby="work-type-help" onChange={(event) => onChange(event.target.value as WorkTypeValue)}>
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
      <div id="work-type-help" className={`work-type-hint ${hint.tone}`} role="note">
        <strong>{hint.title}:</strong> {hint.text}
      </div>
    </section>
  );
}
