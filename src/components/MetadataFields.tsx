import type { AcademicFields, AcademicFieldKey, Confidence } from "../ufla-rules";
import { ACADEMIC_FIELD_KEYS, CONFIDENCE_LABELS, isCpgWork, isResearchProject, isUflaCollectionWork } from "../ufla-rules";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "../academic-production-types";
import { UFLA_PPG_PROGRAMS } from "../ufla-ppg-programs";
import { draftWorkTypeSupportsIndicators } from "../draft-builder";
import { FileCheck2 } from "lucide-react";
import { FIELD_LABELS, ASSISTED_FIELD_KEYS, LONG_FIELDS, IMPACT_KEYS, rowsForField, visibleField, courseFieldLabel } from "../app-constants";

interface Props {
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  updateField: (key: AcademicFieldKey, value: string) => void;
  assistedMode: boolean;
  setAssistedMode: (v: boolean) => void;
  handleBuildDraft: () => void;
  confirmReplaceDraft: boolean;
  setConfirmReplaceDraft: (v: boolean) => void;
}

export default function MetadataFields({ fields, confidence, updateField, assistedMode, setAssistedMode, handleBuildDraft, confirmReplaceDraft, setConfirmReplaceDraft }: Props) {
  return (
    <div className="metadata-pane">
      <div className="assisted-panel">
        <div className="assisted-header-row"><h2>Preencher campos</h2><label className="assisted-toggle"><input type="checkbox" checked={assistedMode} onChange={(e) => setAssistedMode(e.target.checked)} /><span>Mostrar campos guiados</span></label></div>
        <p className="assisted-note">Preencha os campos abaixo e use <strong>Montar rascunho</strong> para gerar a estrutura no editor. Campos vazios viram marcadores [PREENCHER: ...]; o sistema não inventa conteúdo.</p>
        <div><button className="primary-action" type="button" onClick={handleBuildDraft}><FileCheck2 size={18} aria-hidden="true" />{confirmReplaceDraft ? "Confirmar substituição" : "Montar rascunho a partir dos campos"}</button>{confirmReplaceDraft && <button className="secondary-action" type="button" onClick={() => setConfirmReplaceDraft(false)}>Cancelar</button>}</div>
      </div>
      {fields.workType === "artigo" && <div className="mode-panel"><h2>Artigo acadêmico simples</h2><p>Modelo sem capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto e sumário.</p></div>}
      {isCpgWork(fields.workType) && <div className="mode-panel"><h2>Modo CPG/UFLA selecionado</h2><p>Este modelo segue template CPG/UFLA. Seções incompatíveis importadas serão removidas automaticamente do DOCX e da validação do rascunho.</p><p><strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.</p></div>}
      {(fields.workType === "dissertacao" || fields.workType === "tese") && <div className="mode-panel"><h2>Dissertação/Tese</h2><p>O sumário do DOCX é um campo atualizável. Após abrir no Word ou LibreOffice, atualize os campos para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
      {isResearchProject(fields.workType) && <div className="mode-panel"><h2>Estrutura do Projeto de Pesquisa</h2><p>Campos específicos para estrutura de projeto de pesquisa conforme ABNT NBR 15287:2025.</p><p className="toc-update-note">Após abrir o DOCX no Word ou LibreOffice, atualize os campos do documento para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
      {isUflaCollectionWork(fields.workType) && academicProductionTypeById(fields.workType) && <div className="mode-panel"><h2>{academicProductionTypeById(fields.workType)!.label}</h2><p>{ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE}</p><p><strong>Saída do sistema:</strong> DOCX editável; o PDF final deve ser exportado no Word ou LibreOffice.</p></div>}
      {ACADEMIC_FIELD_KEYS.map((key) => (visibleField(key, fields.workType) || (assistedMode && ASSISTED_FIELD_KEYS.includes(key))) ? (
        <div className="field-group" key={key}>
          <div className="label-row"><label htmlFor={key}>{key === "course" ? courseFieldLabel(fields.workType) : FIELD_LABELS[key]}</label><span className={`confidence confidence-${(confidence as any)[key]}`}>{(CONFIDENCE_LABELS as any)[(confidence as any)[key]]}</span></div>
          {LONG_FIELDS.has(key) ? (
            <textarea id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} rows={rowsForField(key)} />
          ) : key === "program" && ["dissertacao", "tese", "projeto_pesquisa"].includes(fields.workType) ? (
            <input id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} list="ufla-ppg-programs" />
          ) : (
            <input id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} />
          )}
          {key === "referencias" && <div className="field-note" id="referencias-note"><p>Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.</p><p>Use uma referência por linha.</p></div>}
        </div>
      ) : null)}
      {["dissertacao", "tese", "projeto_pesquisa"].includes(fields.workType) && (
        <datalist id="ufla-ppg-programs">{UFLA_PPG_PROGRAMS.map((p) => (<option key={`${p.type}-${p.name}`} value={p.name} />))}</datalist>
      )}
      {draftWorkTypeSupportsIndicators(fields.workType) && (
        <div className="field-group impact-indicators-group"><h3>Indicadores de impacto (dissertação/tese)</h3>{IMPACT_KEYS.map((key) => (
          <div className="field-group" key={key}><label htmlFor={key}>{FIELD_LABELS[key]}</label><textarea id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} rows={2} /></div>
        ))}</div>
      )}
    </div>
  );
}
