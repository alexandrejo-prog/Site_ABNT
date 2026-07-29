import type { ChecklistItem, FixSuggestion } from "./types";

const CODE_FIXES: Record<string, { file: string; line: number; snippet: string }> = {
  "2.1": {
    file: "src/export-docx.ts",
    line: 2037,
    snippet: `page: { size: { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 } }`,
  },
  "2.2": {
    file: "src/export-docx.ts",
    line: 2041,
    snippet: `margin: { top: 1701, bottom: 1134, left: 1701, right: 1134 }`,
  },
  "15.1": {
    file: "src/export-docx.ts",
    line: 1477,
    snippet: `buildSummary(bodyBlocks, references, fields, textualStartPage)`,
  },
  "21.1": {
    file: "src/docx-render-core.ts",
    line: 1,
    snippet: `tableToParagraph (detectTabbedTableBlock → Table)`,
  },
  "22.1": {
    file: "src/export-docx.ts",
    line: 1999,
    snippet: `buildReferences(references)`,
  },
  "25.4": {
    file: "src/export-docx.ts",
    line: 1999,
    snippet: `buildReferences(references)`,
  },
};

const MANUAL_FIXES: Record<string, string[]> = {
  "2.2": [
    "Abra o DOCX no Word",
    "Vá em Layout > Margens > Margens Personalizadas",
    "Defina Superior: 3cm, Esquerda: 3cm, Inferior: 2cm, Direita: 2cm",
    "Clique em OK",
    "Salve o documento",
  ],
  "2.6": [
    "Selecione todo o texto (Ctrl+A)",
    "Vá em Página Inicial > Fonte",
    "Selecione 'Times New Roman'",
    "Defina tamanho 12",
    "Clique em OK",
  ],
  "21.1": [
    "Posicione o cursor onde deseja a tabela",
    "Vá em Inserir > Tabela",
    "Selecione o número de linhas e colunas",
    "Preencha os dados",
    "Selecione a tabela e vá em Design > Bordas",
    "Selecione 'Todas as Bordas'",
    "Adicione título acima: 'Tabela 1 - Título'",
    "Adicione fonte abaixo: 'Fonte: elaborado pelo autor.'",
  ],
  "22.7": [
    "Selecione o título de cada referência",
    "Aplique Negrito (Ctrl+N)",
    "Mantenha o restante da referência em formato normal",
  ],
  "22.9": [
    "Selecione todas as referências",
    "Clique com botão direito > Parágrafo",
    "Em Recuo > Especial > selecione 'Deslocante'",
    "Defina '1cm'",
    "Clique em OK",
  ],
  default: [
    "Corrigir diretamente no Word conforme a norma ABNT/UFLA",
    "Salvar e reexportar",
  ],
};

export function suggestFix(item: ChecklistItem): FixSuggestion {
  const codeFix = CODE_FIXES[item.id];
  const manualSteps = MANUAL_FIXES[item.id] || MANUAL_FIXES.default;

  return {
    itemId: item.id,
    description: item.description,
    severity: item.severity,
    fixType: item.fixType,
    codeFile: codeFix?.file,
    codeLine: codeFix?.line,
    codeSnippet: codeFix?.snippet,
    manualSteps,
  };
}

export function suggestFixes(items: ChecklistItem[]): FixSuggestion[] {
  return items
    .filter((i) => i.status === "fail" || i.status === "partial")
    .map(suggestFix);
}
