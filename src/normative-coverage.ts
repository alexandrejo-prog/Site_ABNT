export type CoveragePriority = "alta" | "media" | "baixa";
export type CoverageStatus = "implemented" | "partial" | "pending" | "manual";

export interface NormativeCoverageItem {
  id: string;
  category: string;
  problem: string;
  currentStatus: CoverageStatus;
  priority: CoveragePriority;
  evidence: string[];
  nextStep: string;
  estimatedEffort: string;
}

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  implemented: "Implementado",
  partial: "Parcial",
  pending: "Pendente",
  manual: "Manual",
};

export const NORMATIVE_COVERAGE_MATRIX: NormativeCoverageItem[] = [
  {
    id: "positioning-no-ai",
    category: "Posicionamento",
    problem: "Evitar mensagem ambígua sobre IA, serviço externo ou conformidade automática.",
    currentStatus: "implemented",
    priority: "alta",
    evidence: ["README posiciona a ferramenta como apoio", "Teste de fluxo sem provedores externos no código principal"],
    nextStep: "Manter interface e documentação sem promessa de conformidade total.",
    estimatedEffort: "0,5 dia",
  },
  {
    id: "coverage-matrix",
    category: "Cobertura normativa",
    problem: "Checklist amplo precisa ficar rastreável por requisito, status e teste.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Matriz de cobertura versionada", "Painel de aderência existente"],
    nextStep: "Exibir a matriz no produto e vincular cada item a testes ou issues.",
    estimatedEffort: "2 a 3 dias",
  },
  {
    id: "catalog-card",
    category: "Ficha catalográfica",
    problem: "Reserva ou placeholder não atende ao fluxo real de submissão.",
    currentStatus: "pending",
    priority: "alta",
    evidence: ["Elemento informado como dependente de preenchimento manual"],
    nextStep: "Adicionar campo/upload para ficha catalográfica e validação condicional por tipo de trabalho.",
    estimatedEffort: "1 a 2 dias",
  },
  {
    id: "summary-abstract-validation",
    category: "Resumo/Abstract",
    problem: "Resumo, abstract, palavras-chave e keywords precisam de validação estrutural fina.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Validação de contagem de palavras", "Validação de parágrafo único", "Validação de quantidade de termos"],
    nextStep: "Ajustar mensagens por modelo UFLA/CPG e ampliar casos de teste com documentos reais.",
    estimatedEffort: "1 a 2 dias",
  },
  {
    id: "impact-indicators",
    category: "Indicadores de impacto",
    problem: "Dissertação e tese exigem tratamento específico e revisão sensível.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Campos editáveis de indicadores", "Alerta condicional para dissertação/tese"],
    nextStep: "Criar formulário orientado por dimensões de impacto e validações por tipo de trabalho.",
    estimatedEffort: "2 dias",
  },
  {
    id: "pretextual-lists",
    category: "Listas pré-textuais",
    problem: "Listas de ilustrações, tabelas e siglas dependem de extração estruturada.",
    currentStatus: "pending",
    priority: "media",
    evidence: ["Marcadores de imagem são preservados", "Legendas ainda exigem conferência manual"],
    nextStep: "Extrair figuras, tabelas e siglas com metadados e gerar listas condicionais.",
    estimatedEffort: "3 a 5 dias",
  },
  {
    id: "docx-import-regression",
    category: "Importação DOCX",
    problem: "Runs, tabelas, imagens e quebras podem perder fidelidade em documentos reais.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Mammoth + estrutura OOXML", "Teste de SUMÁRIO importado", "Correção do editor visual"],
    nextStep: "Adicionar snapshots de estrutura extraída com casos reais UFLA.",
    estimatedEffort: "3 a 4 dias",
  },
  {
    id: "docx-export-flow",
    category: "Exportação DOCX",
    problem: "Sumário, paginação e campos dependem de atualização em editor externo.",
    currentStatus: "partial",
    priority: "media",
    evidence: ["DOCX editável", "Sumário atualizável", "Instrução pós-geração para Word/LibreOffice"],
    nextStep: "Validar presença dos campos de sumário em mais tipos de trabalho e reforçar instruções no fluxo final.",
    estimatedEffort: "1 dia",
  },
  {
    id: "review-ux",
    category: "UX de revisão",
    problem: "Tela única pode ficar densa em trabalhos longos.",
    currentStatus: "pending",
    priority: "alta",
    evidence: ["Campos e editor estão em tela única"],
    nextStep: "Organizar metadados, pré-textuais, projeto, corpo, referências, anexos e validação em blocos dobráveis.",
    estimatedEffort: "2 dias",
  },
  {
    id: "transparency-score",
    category: "Transparência",
    problem: "Usuário pode interpretar alertas como conformidade total.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Erros bloqueantes", "Alertas não bloqueantes", "Cálculo técnico de score", "Painel de aderência"],
    nextStep: "Exibir o nível de aderência por documento na interface.",
    estimatedEffort: "1 a 2 dias",
  },
  {
    id: "continuous-quality",
    category: "Testes",
    problem: "Faltam e2e, Lighthouse e axe no pipeline contínuo.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Vitest unitário", "Build TypeScript", "Script npm run verify"],
    nextStep: "Adicionar workflow de CI, Playwright, Lighthouse CI e axe com orçamento de acessibilidade/performance.",
    estimatedEffort: "2 a 4 dias",
  },
  {
    id: "responsive-audit",
    category: "Responsividade",
    problem: "Ainda falta auditoria formal em larguras móveis e tablet.",
    currentStatus: "pending",
    priority: "media",
    evidence: ["Layout responsivo inicial"],
    nextStep: "Validar 375px, 768px e desktop com formulários extensos e anexos.",
    estimatedEffort: "1 a 2 dias",
  },
  {
    id: "accessibility-audit",
    category: "Acessibilidade",
    problem: "Semântica, foco, contraste e teclado exigem auditoria completa.",
    currentStatus: "partial",
    priority: "alta",
    evidence: ["Testes básicos de acessibilidade"],
    nextStep: "Adicionar axe automatizado e checklist WCAG operacional.",
    estimatedEffort: "1 a 2 dias",
  },
  {
    id: "docx-performance",
    category: "Performance",
    problem: "Parsing local de DOCX pode degradar com arquivos grandes.",
    currentStatus: "partial",
    priority: "media",
    evidence: ["Chunks separados", "Exportadores carregados sob demanda"],
    nextStep: "Medir tempo de importação e mover parsing pesado para Web Worker.",
    estimatedEffort: "2 a 3 dias",
  },
  {
    id: "governance-roadmap",
    category: "Governança",
    problem: "Checklist rico precisa virar roadmap rastreável.",
    currentStatus: "partial",
    priority: "media",
    evidence: ["Matriz de cobertura versionada"],
    nextStep: "Quebrar matriz em milestones trimestrais e issues vinculadas a testes.",
    estimatedEffort: "1 dia",
  },
];

export function coverageByStatus(status: CoverageStatus): NormativeCoverageItem[] {
  return NORMATIVE_COVERAGE_MATRIX.filter((item) => item.currentStatus === status);
}

export function highPriorityPendingCoverage(): NormativeCoverageItem[] {
  return NORMATIVE_COVERAGE_MATRIX.filter(
    (item) => item.priority === "alta" && item.currentStatus !== "implemented",
  );
}
