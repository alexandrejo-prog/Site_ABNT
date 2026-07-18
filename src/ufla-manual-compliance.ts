// Registro de conformidade por regra do Manual de Normalização UFLA (6ª ed.),
// conforme UFLA_MANUAL_INSTRUCOES_CONSOLIDADAS.md.
//
// Cada regra é avaliada com base em EVidêcia de código (arquivo:linha) ou,
// quando dependente de atualização no Word/LibreOffice, marcada como "manual".
// Nenhuma porcentagem aqui é presumida: é derivada do somatório de pesos.

export type RuleStatus = "implemented" | "partial" | "pending" | "manual";

export interface UflaRule {
  id: string;
  section: string;
  description: string;
  status: RuleStatus;
  evidence?: string;
  note?: string;
}

const R: UflaRule[] = [
  // ---- §27: Regras de validação normativa do site (1-50) ----
  { id: "V01", section: "27.1", description: "Autor ausente", status: "implemented", evidence: "src/validators.ts:649", note: "validateWork emite 'author-required' (error)." },
  { id: "V02", section: "27.2", description: "Título ausente", status: "implemented", evidence: "src/validators.ts:647", note: "validateWork emite 'title-required'." },
  { id: "V03", section: "27.3", description: "Tipo de trabalho ausente", status: "implemented", evidence: "src/validators.ts:645", note: "validateWork emite 'work-type-required'." },
  { id: "V04", section: "27.4", description: "Orientador ausente quando obrigatório", status: "implemented", evidence: "src/validators.ts:652", note: "advisor-required (error p/ dissertação/tese)." },
  { id: "V05", section: "27.5", description: "Capa incompleta", status: "partial", evidence: "src/export-docx.ts:1004", note: "Capa gerada com UFLA_RULES; validação de logo/fields por alerta, não bloqueio rígido." },
  { id: "V06", section: "27.6", description: "Folha de rosto incompleta", status: "partial", evidence: "src/validators.ts:154", note: "Curso/programa exigidos; natureza validada por alerta." },
  { id: "V07", section: "27.7", description: "Ficha catalográfica ausente/não informada", status: "manual", evidence: "src/document-template.ts", note: "Manual §6 proibe inventar ficha; reserva espaço e alerta. Dependente de intervenção humana." },
  { id: "V08", section: "27.8", description: "Folha de aprovação ausente quando exigida", status: "partial", evidence: "src/document-template.ts", note: "Gerada quando há dados de banca; campo editável. Sem banca => pendente." },
  { id: "V09", section: "27.9", description: "Resumo ausente", status: "implemented", evidence: "src/validators.ts:656", note: "resumo-required (warning/error)." },
  { id: "V10", section: "27.10", description: "Resumo com tópicos/listas", status: "implemented", evidence: "src/validators.ts:290", note: "resumo-single-paragraph." },
  { id: "V11", section: "27.11", description: "Resumo fora da extensão recomendada", status: "implemented", evidence: "src/validators.ts:289", note: "resumo-word-count (150-500)." },
  { id: "V12", section: "27.12", description: "Palavras-chave ausentes", status: "implemented", evidence: "src/validators.ts:293", note: "palavras-chave-count/separator." },
  { id: "V13", section: "27.13", description: "Abstract ausente", status: "implemented", evidence: "src/validators.ts:663", note: "abstract-recommended." },
  { id: "V14", section: "27.14", description: "Keywords ausentes", status: "implemented", evidence: "src/validators.ts:305", note: "keywords-count/separator." },
  { id: "V15", section: "27.15", description: "Indicadores ausentes em dissertação/tese", status: "implemented", evidence: "src/validators.ts:312", note: "impact-indicators-missing (error)." },
  { id: "V16", section: "27.16", description: "Sumário ausente", status: "implemented", evidence: "src/export-docx.ts:99", note: "Campo TOC gerado (TOC1..TOC5)." },
  { id: "V17", section: "27.17", description: "Sumário contendo elemento pré-textual indevido", status: "partial", evidence: "src/validators.ts:678", note: "summary-empty-headings alerta; exclusão de pré-textuais depende do template." },
  { id: "V18", section: "27.18", description: "Sumário sem referências", status: "partial", evidence: "src/document-template.ts", note: "TOC inclui seções textuais; referências dependem de headings no editor." },
  { id: "V19", section: "27.19", description: "Introdução ausente", status: "implemented", evidence: "src/validators.ts:662", note: "intro-required." },
  { id: "V20", section: "27.20", description: "Conclusão/considerações finais ausente", status: "implemented", evidence: "src/validators.ts:537", note: "required-section-missing (introducao/conclusao)." },
  { id: "V21", section: "27.21", description: "Referências ausentes", status: "implemented", evidence: "src/validators.ts:660", note: "references-required." },
  { id: "V22", section: "27.22", description: "Referência sem autor provável", status: "partial", evidence: "src/references-validator.ts", note: "Validação de autor implementada parcialmente; itens ambíguos exigem revisão." },
  { id: "V23", section: "27.23", description: "Referência sem ano provável", status: "implemented", evidence: "src/references-validator.ts", note: "year-missing detectado." },
  { id: "V24", section: "27.24", description: "Referência online sem acesso", status: "implemented", evidence: "src/references-validator.ts", note: "access-missing detectado." },
  { id: "V25", section: "27.25", description: "Referência sem destaque em negrito quando detectável", status: "partial", evidence: "src/references-validator.ts", note: "highlight-missing quando detectável; nem sempre detectável." },
  { id: "V26", section: "27.26", description: "`et al.` sem itálico", status: "partial", evidence: "src/references-validator.ts", note: "Normalização de et al. parcial." },
  { id: "V27", section: "27.27", description: "Citação curta sem aspas", status: "pending", evidence: "src/academic-guardrails.ts", note: "Não há validação automática de aspas em citação curta." },
  { id: "V28", section: "27.28", description: "Citação longa com aspas", status: "partial", evidence: "src/validators.ts:332", note: "hasLikelyUnmarkedLongQuote detecta longa sem marcador; não valida aspas." },
  { id: "V29", section: "27.29", description: "Citação longa sem recuo de 4 cm", status: "partial", evidence: "src/export-docx.ts", note: "Estilo ufla_citacao_longa aplica recuo; validação de 4cm não automática." },
  { id: "V30", section: "27.30", description: "Citação longa sem fonte 11", status: "partial", evidence: "src/export-docx.ts", note: "Estilo aplica tamanho 11; validação não automática." },
  { id: "V31", section: "27.31", description: "Citação longa sem espaço simples", status: "partial", evidence: "src/export-docx.ts", note: "Estilo aplica espaço simples." },
  { id: "V32", section: "27.32", description: "Corpo textual sem espaçamento 1,5", status: "implemented", evidence: "src/export-docx.ts", note: "ufla_corpo_texto com spacing 1.5." },
  { id: "V33", section: "27.33", description: "Resumo/abstract/referências sem espaço simples", status: "implemented", evidence: "src/export-docx.ts", note: "Estilos aplicam espaço simples." },
  { id: "V34", section: "27.34", description: "Texto comum exportado como título/outline indevido", status: "implemented", evidence: "src/validators.ts:556", note: "invalid-hierarchy + outline control." },
  { id: "V35", section: "27.35", description: "Títulos sem negrito", status: "implemented", evidence: "src/export-docx.ts", note: "Estilos ufla_titulo_* com bold." },
  { id: "V36", section: "27.36", description: "Título primário sem nova página", status: "partial", evidence: "src/document-template.ts", note: "pageBreak antes de seção primária no template; nem sempre aplicado a headings livres." },
  { id: "V37", section: "27.37", description: "Paginação ausente", status: "partial", evidence: "src/export-docx.ts:2197", note: "pageNumbers gerado via campo; depende de atualização no Word." },
  { id: "V38", section: "27.38", description: "Paginação visível antes da introdução", status: "partial", evidence: "src/document-template.ts", note: "Pré-textuais sem número visível; depende do template do tipo." },
  { id: "V39", section: "27.39", description: "Número de página fora do canto superior direito", status: "implemented", evidence: "src/export-docx.ts:2148", note: "pageNumberHeader no canto superior direito." },
  { id: "V40", section: "27.40", description: "Imagem sem legenda", status: "partial", evidence: "src/validators.ts:326", note: "hasLikelyImageWithoutCaption alerta; depende de caption detectada." },
  { id: "V41", section: "27.41", description: "Imagem sem fonte", status: "partial", evidence: "src/export-docx.ts:1058", note: "Fonte preservada quando detectada; alerta quando ausente." },
  { id: "V42", section: "27.42", description: "Tabela sem título", status: "partial", evidence: "src/export-docx.ts", note: "Título de tabela gerado quando detectado." },
  { id: "V43", section: "27.43", description: "Tabela sem fonte", status: "partial", evidence: "src/export-docx.ts", note: "Fonte de tabela preservada quando detectada." },
  { id: "V44", section: "27.44", description: "Lista de ilustrações ausente quando houver muitas ilustrações", status: "partial", evidence: "src/document-template.ts", note: "Lista gerada quando há figuras detectadas; limiar 'muitas' não parametrizada." },
  { id: "V45", section: "27.45", description: "Lista de tabelas ausente quando houver tabelas", status: "partial", evidence: "src/document-template.ts", note: "Lista gerada quando há tabelas detectadas." },
  { id: "V46", section: "27.46", description: "Cor azul indevida no texto acadêmico", status: "implemented", evidence: "src/export-docx.ts:201", note: "BLACK forçado em estilos de corpo/referência." },
  { id: "V47", section: "27.47", description: "Margens incorretas", status: "partial", evidence: "src/export-docx.ts:2183", note: "pageMargins() aplica UFLA_RULES; valor exato depende da constante." },
  { id: "V48", section: "27.48", description: "Fonte diferente de Times ou similar", status: "implemented", evidence: "src/export-docx.ts:81", note: "REFERENCE_FONT = Times New Roman em todos os estilos." },
  { id: "V49", section: "27.49", description: "Tamanho de fonte incorreto", status: "partial", evidence: "src/export-docx.ts", note: "BODY_SIZE 12 / 11 para especiais; validação de valor não automática." },
  { id: "V50", section: "27.50", description: "Apêndices/anexos detectados mas não exportados", status: "partial", evidence: "src/document-template.ts", note: "Suporte a apêndices/anexos; detecção→export nem sempre automática." },

  // ---- Estruturais adicionais (§17, §19, §28) ----
  { id: "S01", section: "17.1", description: "Papel A4 (21x29,7cm)", status: "implemented", evidence: "src/export-docx.ts", note: "page.size A4." },
  { id: "S02", section: "17.2", description: "Margens 3/3/2/2 cm", status: "partial", evidence: "src/export-docx.ts:2183", note: "pageMargins() do UFLA_RULES; confirmar constante = 1701/1701/1134/1134 twips." },
  { id: "S03", section: "28.1", description: "Estilos internos obrigatórios UFLA", status: "partial", evidence: "src/export-docx.ts:99", note: "Parte dos estilos ufla_* definidos; nem todos os 28 listados." },
  { id: "S04", section: "28.2", description: "Campos automáticos (pág., sumário, listas)", status: "partial", evidence: "src/docx-toc-field-patch.ts", note: "TOC como campo; atualização exige F9 no Word/LibreOffice." },
  { id: "S05", section: "19", description: "Numeração progressiva em algarismos arábicos", status: "partial", evidence: "src/section-aliases.ts", note: "Seções numeradas suportadas; validação de formato não rígida." },
  { id: "S06", section: "22", description: "Equações/fórmulas editáveis", status: "manual", evidence: "src/pdf-figure-extractor.ts", note: "Equações não recriadas como objeto OOXML; rasterizadas quando possível. Dependente de intervenção." },
  { id: "S07", section: "24.4", description: "Tabelas nativas do Word preservadas", status: "partial", evidence: "src/export-docx.ts:1058", note: "Tabelas reconstruídas de coordenadas; podem perder células complexas." },
  { id: "S08", section: "23.4", description: "Ilustrações posicionadas/preservadas no DOCX", status: "partial", evidence: "src/pdf-figure-extractor.ts", note: "Imagens embarcadas como marcadores; posição aproximada." },
  { id: "S09", section: "28.4", description: "Preservação de negrito/itálico importados", status: "partial", evidence: "src/import-docx.ts", note: "Runs preservados quando importados via DOCX; PDF depende de extração." },
];

const STATUS_WEIGHT: Record<RuleStatus, number> = {
  implemented: 1,
  partial: 0.5,
  pending: 0,
  manual: 0,
};

export interface ComplianceSummary {
  total: number;
  byStatus: Record<RuleStatus, number>;
  implementedPct: number;
  weightedPct: number;
  rules: UflaRule[];
}

export function evaluateUflaCompliance(): ComplianceSummary {
  const byStatus: Record<RuleStatus, number> = { implemented: 0, partial: 0, pending: 0, manual: 0 };
  let weightSum = 0;
  for (const rule of R) {
    byStatus[rule.status] += 1;
    weightSum += STATUS_WEIGHT[rule.status];
  }
  const total = R.length;
  const implementedCount = byStatus.implemented + byStatus.partial;
  return {
    total,
    byStatus,
    implementedPct: Math.round((implementedCount / total) * 1000) / 10,
    weightedPct: Math.round((weightSum / total) * 1000) / 10,
    rules: R,
  };
}

export function formatCompliance(summary: ComplianceSummary): string {
  const lines: string[] = [];
  lines.push(`Total de regras avaliadas: ${summary.total}`);
  lines.push(`Implementado: ${summary.byStatus.implemented}`);
  lines.push(`Parcial: ${summary.byStatus.partial}`);
  lines.push(`Pendente: ${summary.byStatus.pending}`);
  lines.push(`Dependente de humano: ${summary.byStatus.manual}`);
  lines.push(`% coberta (implementado+parcial): ${summary.implementedPct}%`);
  lines.push(`% ponderada (parcial=0,5): ${summary.weightedPct}%`);
  lines.push("");
  lines.push("| ID | Seção | Regra | Status | Evidência |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of summary.rules) {
    lines.push(`| ${r.id} | ${r.section} | ${r.description} | ${r.status} | ${r.evidence ?? "—"} |`);
  }
  return lines.join("\n");
}
