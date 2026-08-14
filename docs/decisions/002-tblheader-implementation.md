# DECISION-002: Implementação de `w:tblHeader` (acessibilidade NBR 17225)

## Contexto

A auditoria de acessibilidade (NBR 17225 / WCAG 2.2, critério 1.3.1) apontava
`0/35` tabelas com a linha de cabeçalho identificada (`<w:tblHeader/>`), o que
impede leitores de tela de associar células de dados aos cabeçalhos. A FATIA 1
do checkpoint exige completar essa implementação **sem** perder conteúdo.

## Problema

Não existia no pipeline import→export a informação "qual linha é o cabeçalho".
A primeira tentativa (incompleta, não registrada) quebrou a preservação
(ver DECISION-001).

## Opções Consideradas

1. **Pipeline declarativo: extrair `<w:tblHeader/>` do DOCX de origem +
   convenção "primeira linha com 2+ linhas"** — Prós: fiel à fonte quando
   declarada; simples; cobre o caso comum; não depende de heurística frágil.
   Contras: tabela cujo cabeçalho não é a primeira linha depende de declaração
   explícita na origem.
2. Detecção semântica automática (vocabulário/estilo) — Contras: a tentativa
   demonstrou risco alto de reclassificação e perda de conteúdo (DECISION-001);
   semântica de negrito atual (primeira linha) já é a convenção do projeto.
3. Marcar todas as linhas como cabeçalho — Contras: semanticamente errado
   (WCAG); leitores de tela anunciariam dados como cabeçalhos.

## Decisão

**Opção 1.** Trilha declarativa em três camadas:
- `word-structure-extractor.ts`: `extractTableHeaderRows()` lê `<w:tblHeader/>`
  (respeitando `w:val="false"`) e devolve índices originais das linhas;
- `import-docx.ts` (`importedTablesFromStructure`): `headerRowIndex` =
  primeiro índice declarado na origem (re-mapeado após filtro de linhas
  vazias), ou `0` quando a tabela tem 2+ linhas e a primeira é não vazia
  (convenção atual de negrito da primeira linha);
- exportação (`export-docx.ts`, `docx-render-core.ts`): `tableHeader: true`
  na linha `headerRowIndex` (tabelas preservadas) e na linha de headers das
  tabelas reconstruídas semanticamente.

## Implementação

- Arquivos modificados: `src/word-structure-extractor.ts`,
  `src/imported-tables.ts` (+`headerRowIndex`), `src/import-docx.ts`,
  `src/export-docx.ts`, `src/docx-render-core.ts`, `src/export-cpg-docx.ts`,
  `src/academic-table-reconstructor.ts` (detecção conservadora, DECISION-001).
- Testes adicionados: bloco `w:tblHeader — identificação semântica de linha de
  cabeçalho (NBR 17225 / WCAG 1.3.1)` em `tests/import-docx-tables.test.ts`:
  6 cenários (origem declarada, primeira linha padrão, linha única sem
  cabeçalho, `w:val="false"`, tabela reconstruída, índice após filtro de
  linhas vazias) + regressão do Quadro 2.

## Resultado

- npm test: **1473 passed / 10 skipped / 0 failed**
- DOCX regenerado: 35 tabelas, **25 com `<w:tblHeader/>`** (10 de linha única,
  sem cabeçalho semântico declarável);
- Word: abriu sem reparo; PDF de 236 páginas; 0 overlaps/cutoffs/blank;
- round-trip vivo: 35/35 tabelas preservadas (0 perdidas).

## Gates Atualizados

- OOXML_GATE: PASSED
- CONTENT_PRESERVATION_GATE: PASSED
- RENDERED_LAYOUT_GATE: FAILED (cobertura física incompleta — fora da fatia)
- FULL_COMPLIANCE_GATE: FAILED (esperado; acessibilidade residual de equações)

## Referências

- NBR 17225/2025 (WCAG 2.2, 1.3.1) — cabeçalhos de tabela
- ECMA-376 Part 1: `CT_TrPr`/`w:tblHeader`
- Manual UFLA 6ª ed. (2025) — §3.1.2.1.x (tabelas/quadros)

## Status

- [x] Implementado
- [x] Testado
- [x] Documentado
- [x] Evidências regeneradas
