import type { AcademicFields, AcademicFieldKey, Confidence } from "../ufla-rules";
import { CONFIDENCE_LABELS, isCpgWork, isResearchProject, isUflaCollectionWork } from "../ufla-rules";
import { ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE, academicProductionTypeById } from "../academic-production-types";
import { UFLA_PPG_PROGRAMS } from "../ufla-ppg-programs";
import { draftWorkTypeSupportsIndicators } from "../draft-builder";
import { FileCheck2, FilePlus2, ImagePlus, Trash2, Upload } from "lucide-react";
import { generateCatalogCard } from "../catalog-card";
import { FIELD_LABELS, ASSISTED_FIELD_KEYS, LONG_FIELDS, IMPACT_KEYS, rowsForField, visibleField, courseFieldLabel } from "../app-constants";
import { isValidImageBytes, readImageDimensions, MAX_FICHA_IMAGE_BYTES } from "../image-asset-utils";
import { useState } from "react";

export interface FichaCatalograficaImageAsset {
  data: ArrayBuffer | Uint8Array;
  fileName?: string;
  width?: number;
  height?: number;
}

interface Props {
  fields: AcademicFields;
  confidence: Record<AcademicFieldKey, Confidence>;
  updateField: (key: AcademicFieldKey, value: string) => void;
  assistedMode: boolean;
  setAssistedMode: (v: boolean) => void;
  handleBuildDraft: () => void;
  confirmReplaceDraft: boolean;
  setConfirmReplaceDraft: (v: boolean) => void;
  fichaCatalograficaImage?: FichaCatalograficaImageAsset | null;
  onFichaCatalograficaImageChange?: (asset: FichaCatalograficaImageAsset) => void;
  onFichaCatalograficaImageRemove?: () => void;
}

interface FieldSection {
  id: string;
  title: string;
  keys: AcademicFieldKey[];
  defaultOpen: boolean;
}

const FIELD_SECTIONS: FieldSection[] = [
  {
    id: "sec-identificacao",
    title: "Identificação do trabalho",
    keys: [
      "author", "title", "subtitle", "englishTitle", "workNature", "course", "program",
      "advisor", "coadvisor", "areaConcentracao", "location", "year",
    ],
    defaultOpen: true,
  },
  {
    id: "sec-resumo",
    title: "Resumo e palavras-chave",
    keys: ["resumo", "palavrasChave", "abstractText", "keywords"],
    defaultOpen: true,
  },
  {
    id: "sec-conteudo",
    title: "Conteúdo principal",
    keys: ["introducao", "conclusao"],
    defaultOpen: true,
  },
  {
    id: "sec-referencias",
    title: "Referências e pós-textuais",
    keys: ["referencias", "anexos", "apendices"],
    defaultOpen: true,
  },
  {
    id: "sec-pretextuais",
    title: "Elementos pré-textuais (opcionais)",
    keys: ["dedicatoria", "agradecimentos", "epigrafe", "errata", "fichaCatalografica"],
    defaultOpen: false,
  },
  {
    id: "sec-impacto",
    title: "Indicadores de impacto (dissertação/tese)",
    keys: ["indicadoresImpacto", "impactIndicators", "imageWarnings"],
    defaultOpen: false,
  },
  {
    id: "sec-banca",
    title: "Banca e aprovação",
    keys: ["aprovalDate", "approvalMembers"],
    defaultOpen: false,
  },
  {
    id: "sec-projeto",
    title: "Estrutura do projeto de pesquisa",
    keys: [
      "tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral",
      "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia",
      "cronograma", "recursosOrcamento", "resultadosEsperados",
    ],
    defaultOpen: true,
  },
  {
    id: "sec-complementares",
    title: "Campos complementares",
    keys: ["corpusDados", "contextoInstitucional", "conclusaoProvisoria", "contribuicoesImpactos"],
    defaultOpen: false,
  },
];

export default function MetadataFields({ fields, confidence, updateField, assistedMode, setAssistedMode, handleBuildDraft, confirmReplaceDraft, setConfirmReplaceDraft, fichaCatalograficaImage, onFichaCatalograficaImageChange, onFichaCatalograficaImageRemove }: Props) {
  const renderField = (key: AcademicFieldKey) => {
    const conf = (confidence as any)[key] as Confidence | undefined;
    const showConfidence = conf === "alta" || conf === "media" || conf === "baixa";
    return (
      <div className="field-group" key={key}>
        <div className="label-row">
          <label htmlFor={key}>{key === "course" ? courseFieldLabel(fields.workType) : FIELD_LABELS[key]}</label>
          {showConfidence && (
            <span className={`confidence confidence-${conf}`} title={`Detecção automática com confiança ${CONFIDENCE_LABELS[conf]}`}>
              {CONFIDENCE_LABELS[conf]}
            </span>
          )}
        </div>
        {LONG_FIELDS.has(key) ? (
          <textarea id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} rows={rowsForField(key)} />
        ) : key === "program" ? (
          <input id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} list="ufla-ppg-programs" />
        ) : (
          <input id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} />
        )}
        {key === "fichaCatalografica" && (
          <div className="ficha-generate-row">
            <button
              className="secondary-action"
              type="button"
              disabled={!fields.author.trim() || !fields.title.trim()}
              title={!fields.author.trim() || !fields.title.trim() ? "Preencha autor e título para gerar a ficha" : "Gera ficha provisória com Cutter-Sanborn calculado (confirme com a Biblioteca)"}
              onClick={() => {
                const card = generateCatalogCard(fields);
                if (card) updateField("fichaCatalografica", card);
              }}
            >
              <FilePlus2 size={14} aria-hidden="true" /> Gerar ficha provisória
            </button>
            <span className="field-note ficha-generate-note">Calcula o Cutter do sobrenome (ex.: S586f) e monta o texto no formato da Biblioteca Universitária. Confirme Cutter/CDU com a Biblioteca antes da versão final.</span>
          </div>
        )}
        {key === "referencias" && <div className="field-note" id="referencias-note"><p>Para editar com mais espaço, use o botão <strong>Referências</strong> no painel central.</p><p>Use uma referência por linha.</p></div>}
      </div>
    );
  };

  const [fichaUploadError, setFichaUploadError] = useState<string | null>(null);

  const handleFichaImageUpload = async (file: File) => {
    if (!onFichaCatalograficaImageChange) return;
    setFichaUploadError(null);
    // C10 — validação real: tipo (magic bytes) e tamanho, antes de aceitar.
    if (file.size > MAX_FICHA_IMAGE_BYTES) {
      setFichaUploadError("Imagem muito grande (máx. 10 MB). Escaneie a ficha com menos resolução.");
      return;
    }
    const data = await file.arrayBuffer();
    if (!isValidImageBytes(new Uint8Array(data))) {
      setFichaUploadError("Arquivo não é uma imagem PNG/JPEG/WebP válida — envie a ficha em imagem ou cole o texto acima.");
      return;
    }
    let width: number | undefined;
    let height: number | undefined;
    try {
      const bitmap = await createImageBitmap(new Blob([data], { type: file.type }));
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } catch {
      // C10 — fallback de dimensões sem distorção: lê os cabeçalhos PNG/JPEG.
      const dims = readImageDimensions(new Uint8Array(data));
      width = dims.width;
      height = dims.height;
    }
    onFichaCatalograficaImageChange({ data, fileName: file.name, width, height });
  };

  const renderFichaCatalograficaUpload = () => (
    <div className="field-group" key="fichaCatalograficaImage">
      <div className="label-row"><label htmlFor="fichaCatalograficaImage">Ficha catalográfica (imagem)</label></div>
      <div className="ficha-upload-row">
        {fichaCatalograficaImage ? (
          <>
            <span className="ficha-upload-name"><ImagePlus size={14} aria-hidden="true" /> {fichaCatalograficaImage.fileName || "Imagem anexada"}</span>
            <button className="secondary-action" type="button" onClick={() => onFichaCatalograficaImageRemove?.()} title="Remover imagem da ficha"><Trash2 size={14} aria-hidden="true" /> Remover</button>
          </>
        ) : (
          <label className="ficha-upload-label">
            <Upload size={14} aria-hidden="true" /> Escolher imagem (foto/scan da ficha oficial)
            <input id="fichaCatalograficaImage" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFichaImageUpload(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <div className="field-note"><p>O Manual UFLA (§6.1) aceita texto <em>ou</em> imagem da ficha oficial da Biblioteca Universitária. O texto colado acima prevalece sobre a imagem na exportação.</p></div>
      {fichaUploadError && <p className="field-note ficha-upload-error" role="alert">{fichaUploadError}</p>}
    </div>
  );

  const renderImpactKeys = () => (
    <>
      {IMPACT_KEYS.map((key) => (
        <div className="field-group" key={key}>
          <label htmlFor={key}>{FIELD_LABELS[key]}</label>
          <textarea id={key} value={(fields as any)[key]} onChange={(e) => updateField(key as any, e.target.value)} rows={2} />
        </div>
      ))}
    </>
  );

  const complementaresOpen = isCpgWork(fields.workType);

  return (
    <div className="metadata-fields-inner">
      <div className="assisted-panel">
        <div className="assisted-header-row"><h2>Preencher campos</h2><label className="assisted-toggle"><input type="checkbox" checked={assistedMode} onChange={(e) => setAssistedMode(e.target.checked)} /><span>Mostrar campos guiados</span></label></div>
        <div className="assisted-actions"><button className="primary-action" type="button" onClick={handleBuildDraft}><FileCheck2 size={16} aria-hidden="true" />{confirmReplaceDraft ? "Confirmar substituição" : "Montar rascunho a partir dos campos"}</button>{confirmReplaceDraft && <button className="secondary-action" type="button" onClick={() => setConfirmReplaceDraft(false)}>Cancelar</button>}</div>
      </div>
      {(
        fields.workType === "artigo" ||
        isCpgWork(fields.workType) ||
        fields.workType === "dissertacao" ||
        fields.workType === "tese" ||
        isResearchProject(fields.workType) ||
        isUflaCollectionWork(fields.workType)
      ) && (
        <details className="mode-panels-details">
          <summary>Sobre o modelo selecionado</summary>
          {fields.workType === "artigo" && <div className="mode-panel"><h2>Artigo acadêmico simples</h2><p>Modelo sem capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto e sumário.</p></div>}
          {isCpgWork(fields.workType) && <div className="mode-panel"><h2>Modo CPG/UFLA selecionado</h2><p>Este modelo segue template CPG/UFLA. Seções incompatíveis importadas serão removidas automaticamente do DOCX e da validação do rascunho.</p><p><strong>Saída do sistema:</strong> gere o DOCX e, se precisar de PDF, exporte por um editor de texto externo.</p></div>}
          {(fields.workType === "dissertacao" || fields.workType === "tese") && <div className="mode-panel"><h2>Dissertação/Tese</h2><p>O sumário do DOCX é um campo atualizável. Após abrir no Word ou LibreOffice, atualize os campos para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
          {isResearchProject(fields.workType) && <div className="mode-panel"><h2>Estrutura do Projeto de Pesquisa</h2><p>Campos específicos para estrutura de projeto de pesquisa conforme ABNT NBR 15287:2025.</p><p className="toc-update-note">Após abrir o DOCX no Word ou LibreOffice, atualize os campos do documento para preencher o sumário com a paginação real. No Word: Ctrl+A e F9, depois escolha &ldquo;Atualizar o índice inteiro&rdquo;. No LibreOffice: Ferramentas &gt; Atualizar &gt; Atualizar tudo.</p></div>}
          {isUflaCollectionWork(fields.workType) && academicProductionTypeById(fields.workType) && <div className="mode-panel"><h2>{academicProductionTypeById(fields.workType)!.label}</h2><p>{ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE}</p><p><strong>Saída do sistema:</strong> DOCX editável; o PDF final deve ser exportado no Word ou LibreOffice.</p></div>}
        </details>
      )}
      {FIELD_SECTIONS.map((section) => {
        const keys = section.keys.filter((key) => visibleField(key, fields.workType) || (assistedMode && ASSISTED_FIELD_KEYS.includes(key)));
        if (keys.length === 0) return null;
        const isOpen = section.id === "sec-complementares" ? complementaresOpen : section.defaultOpen;
        return (
          <details className="field-section" id={section.id} key={section.id} open={isOpen}>
            <summary>
              <span className="field-section-title">{section.id === "sec-complementares" && isCpgWork(fields.workType) ? "Campos CPG/UFLA" : section.title}</span>
              <span className="field-section-meta" aria-hidden="true">
                <span className="field-section-count">{keys.length}</span>
                <span className="field-section-chevron" />
              </span>
            </summary>
            <div className="field-section-body">
              {keys.map((key) => renderField(key))}
              {section.id === "sec-pretextuais" && (fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese") && renderFichaCatalograficaUpload()}
              {section.id === "sec-impacto" && draftWorkTypeSupportsIndicators(fields.workType) && renderImpactKeys()}
            </div>
          </details>
        );
      })}
      <datalist id="ufla-ppg-programs">{UFLA_PPG_PROGRAMS.map((p) => (<option key={`${p.type}-${p.name}`} value={p.name} />))}</datalist>
    </div>
  );
}
