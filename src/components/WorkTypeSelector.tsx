import { useState } from "react";
import type { WorkTypeValue, WorkType } from "../ufla-rules";
import { WORK_TYPE_LABELS } from "../ufla-rules";
import { isResearchProject } from "../ufla-rules";

interface WorkTypeGroup {
  label: string;
  values: WorkTypeValue[];
}

const ACADEMIC_GROUPS: WorkTypeGroup[] = [
  {
    label: "Trabalhos acadêmicos longos",
    values: ["monografia", "dissertacao", "tese"],
  },
  { label: "Projeto", values: ["projeto_pesquisa"] },
  { label: "Artigos e CPG", values: ["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"] },
  {
    label: "Coleção Produção Acadêmica UFLA",
    values: [
      "artigo_cientifico_ufla",
      "patente_ufla",
      "revisao_sistematica_ufla",
      "estudo_caso_ufla",
      "software_aplicativo_ufla",
      "cultivar_ufla",
      "relatorio_estagio_ufla",
      "proposta_intervencao_ufla",
    ],
  },
  { label: "Outros", values: ["outro"] },
];

interface WorkTypeSelectorProps {
  value: WorkTypeValue;
  onChange: (value: WorkTypeValue) => void;
}

export function WorkTypeSelector({ value, onChange }: WorkTypeSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="work-type-selector">
      <label className="work-type-label" htmlFor="work-type">Tipo de trabalho</label>
      <div className="work-type-select">
        <select
          id="work-type"
          value={value}
          onChange={(event) => {
            onChange(event.target.value as WorkTypeValue);
            setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <option value="">Selecione</option>
          {ACADEMIC_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.values.map((type) => (
                <option key={type} value={type}>
                  {WORK_TYPE_LABELS[type as WorkType]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {open && value === "" && (
        <p className="work-type-hint">
          Escolha o modelo que melhor descreve o trabalho. Cada tipo define os elementos pré-textuais, campos obrigatórios e regras de exportação.
        </p>
      )}
      {value === "monografia" ? (
        <p className="work-type-warning">
          Use este modelo para rascunho editável. Confira orientador, folha de aprovação, ficha catalográfica e sumário antes da versão final.
        </p>
      ) : null}
      {value === "dissertacao" || value === "tese" ? (
        <p className="work-type-warning">
          Use este modelo para rascunho editável. A versão final exige revisão de orientador, banca, ficha catalográfica e sumário.
        </p>
      ) : null}
      {isResearchProject(value) ? (
        <p className="work-type-info">
          Projeto de pesquisa não recebe ficha catalográfica nem folha de aprovação. O sumário deve ser atualizado no Word/LibreOffice.
        </p>
      ) : null}
    </div>
  );
}
