import { FileCheck2, FileDown } from "lucide-react";
import { DraftStatus } from "./DraftStatus";
import type { DraftStatusValue } from "../hooks/useDraft";

interface Props {
  draftStatus: DraftStatusValue;
  hasStoredDraft: boolean;
  handleClearDraft: () => void;
  resetFields: () => void;
  resetEditor: () => void;
  setImportedFileName: (v: null) => void;
  setImportedImages: (v: []) => void;
  setImportedTables: (v: []) => void;
  setStatus: (s: string) => void;
  triggerValidation: () => void;
  handleGenerateDocx: () => void;
  isGenerating: boolean;
}

export default function AppHeader({ draftStatus, hasStoredDraft, handleClearDraft, resetFields, resetEditor, setImportedFileName, setImportedImages, setImportedTables, setStatus, triggerValidation, handleGenerateDocx, isGenerating }: Props) {
  return (
    <header className="app-header">
      <img src="/assets/ufla-logo.jpeg" alt="Marca UFLA" className="ufla-logo" />
      <div><p className="eyebrow">Ferramenta de apoio UFLA/ABNT</p><h1>Assistente de estruturação e normalização acadêmica</h1></div>
      <div className="header-actions">
        <DraftStatus draftStatus={draftStatus} hasDraft={hasStoredDraft} onClearDraft={() => { handleClearDraft(); resetFields(); resetEditor(); setImportedFileName(null); setImportedImages([]); setImportedTables([]); setStatus("Rascunho local removido e formulário limpo."); }} />
        <button className="primary-action" type="button" onClick={triggerValidation}><FileCheck2 size={18} aria-hidden="true" />Validar trabalho</button>
        <button className="primary-action strong" type="button" onClick={handleGenerateDocx} disabled={isGenerating}><FileDown size={18} aria-hidden="true" />{isGenerating ? "Gerando..." : "Gerar DOCX editável"}</button>
      </div>
    </header>
  );
}
