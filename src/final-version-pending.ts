import type { AcademicFields } from "./ufla-rules";
import { detectNaturalPlaceholder, detectPlaceholderText } from "./academic-guardrails";

export const FIELD_TARGET_EDITOR = "__editor__";

export interface FinalVersionPendingItem {
  label: string;
  description: string;
  fieldKey?: string;
}

export interface FinalVersionPendingReport {
  hasPendingItems: boolean;
  items: FinalVersionPendingItem[];
  blocksFinalVersion: boolean;
  allowsDraftGeneration: boolean;
}

export function finalVersionPendingReport(fields: AcademicFields, editorText: string): FinalVersionPendingReport {
  const requiresAdvisor = fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
  const requiresCatalogCard = fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
  const hasApprovalPage = fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
  const hasSummary = fields.workType === "dissertacao" || fields.workType === "tese" || fields.workType === "projeto_pesquisa" || fields.workType === "monografia";

  const items: FinalVersionPendingItem[] = [];

  if (requiresAdvisor && fields.advisor) {
    if (detectPlaceholderText(fields.advisor) || detectNaturalPlaceholder(fields.advisor)) {
      items.push({
        label: "Orientador(a) provisorio",
        description: "Substitua o nome do orientador pelo nome real antes da versao final.",
        fieldKey: "advisor",
      });
    }
  }

  if (requiresCatalogCard) {
    items.push({
      label: "Ficha catalografica provisoria",
      description: "Substitua esta pagina pela ficha oficial gerada pela Biblioteca Universitaria da UFLA antes da versao final.",
    });
  }

  if (hasApprovalPage) {
    items.push({
      label: "Folha de aprovacao provisoria",
      description: "Substitua os dados da banca e a data de aprovacao apos a defesa ou conforme orientacao do programa.",
    });
  }

  if (hasSummary) {
    items.push({
      label: "Sumario a atualizar",
      description: "Apos abrir no Word/LibreOffice, pressione Ctrl+A e F9 no Word, ou Ferramentas > Atualizar > Atualizar tudo no LibreOffice.",
    });
  }

  if (editorText) {
    if (detectPlaceholderText(editorText) || detectControlledPlaceholder(editorText)) {
      items.push({
        label: "Marcadores de rascunho no texto",
        description: "Substitua os marcadores [PREENCHER: ...] pelo conteúdo real antes da versão final.",
        fieldKey: FIELD_TARGET_EDITOR,
      });
    }
  }

  const blocksFinalVersion = items.length > 0;
  const allowsDraftGeneration = true;

  return {
    hasPendingItems: items.length > 0,
    items,
    blocksFinalVersion,
    allowsDraftGeneration,
  };
}

function detectControlledPlaceholder(value: string): boolean {
  if (!value) return false;
  return /\[(?:\s*)(?:preencha|preenche|preencher|insira|inserir|digite|coloque|adicione|complete|substitua)[\s:.-]/i.test(value);
}
