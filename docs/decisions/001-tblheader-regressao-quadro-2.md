# DECISION-001: Regressão do Quadro 2 no round-trip vivo

## Contexto

O checkpoint anti-workslop de 2026-08-14 (14:46) encontrou a suíte vermelha:
`tests/tables-preservation.test.ts` falhando — o **Quadro 2** ("Política
institucional de informação das instituições de ensino superior no Brasil.")
perdia sua linha de cabeçalho e tinha colunas embaralhadas na saída do
round-trip vivo (baseline → DOCX gerado → reimportação).

## Problema

Uma implementação em andamento e não registrada de `w:tblHeader` (8 arquivos
modificados após 14:29, sem commit e sem seção no `context.md`) introduziu, em
`src/academic-table-reconstructor.ts`, a heurística `looksLikeHeaderRow` com
fallback de "rótulos curtos em todas as colunas". Isso reclassificou o Quadro 2
(cabeçalho real **sem** vocabulário acadêmico reconhecível: "Instituição | Tipo
de Documento | De quando | De quem | Endereço eletrônico") como
`grouped-with-authors`:

1. `detectGroupColumn` + `detectAuthorsColumn` retornaram colunas erradas
   (datas viraram "Autores", URLs viraram "Conteúdo");
2. `reconstructGroupedAcademicTable` descartou a linha de cabeçalho
   (`headerSourceRow = 0`) e produziu "Grupo | Conteúdo | Autores";
3. o conteúdo original deixou de existir na saída → teste de preservação falhou.

## Opções Consideradas

1. **Reverter a heurística de cabeçalho para detecção por vocabulário** —
   Prós: restaura exatamente o comportamento da baseline (1466 testes verdes);
   mantém o plumbing de `w:tblHeader` (`headerRowIndex`) intacto. Contras:
   tabelas sem vocabulário não ganham cabeçalho via detecção semântica (o
   `w:tblHeader` ainda é aplicado por convenção "primeira linha = cabeçalho").
2. Manter a heurística e corrigir só a reconstrução — Contras: cascata de
   exceções; risco de novas regressões; classificação de tabelas limpas como
   PDF-convertidas é semanticamente errada.
3. Reescrever a classificação por completo — Contras: escopo grande, fora da
   fatia; base já validada por 1466 testes.

## Decisão

**Opção 1.** `detectAcademicTableHeader` volta a detectar cabeçalho apenas por
vocabulário acadêmico (`HEADER_VOCABULARY_RE`). Tabelas sem vocabulário ficam
`editable-table` (preservadas integralmente). A acessibilidade `w:tblHeader`
não é perdida: `ImportedTable.headerRowIndex` (vindo do `<w:tblHeader/>` do
DOCX de origem ou da convenção "primeira linha com 2+ linhas") continua
emitindo `<w:tblHeader/>` na exportação.

## Implementação

- Arquivos modificados: `src/academic-table-reconstructor.ts`
  (remoção de `isFullWidthTitleRow`/`looksLikeHeaderRow`; detecção por
  vocabulário), `tests/import-docx-tables.test.ts` (teste de regressão).
- Mudanças principais: detecção de cabeçalho conservadora; loops de
  reconstrução inalterados em comportamento (skip apenas da linha de cabeçalho
  detectada por vocabulário).
- Testes adicionados: "regressão Quadro 2: tabela sem vocabulário de cabeçalho
  permanece editable-table e preserva o conteúdo" (5 colunas, 6 linhas, sem
  "Grupo"/"Autores" na saída, com `w:tblHeader` na primeira linha).

## Resultado

- npm test: **1473 passed / 10 skipped / 0 failed** (185 arquivos)
- npm run lint: OK (0 warnings)
- npm run build: OK
- npm run verify: OK
- DOCX regenerado: `normalized-dissertacao.docx` com Quadro 2 íntegro
  (todas as 7 linhas presentes) e `w:tblHeader` em 25/35 tabelas.

## Gates Atualizados

- PARAGRAPH_DIFF_GATE: PASSED (Δ58, 0 perdidos)
- CONTENT_PRESERVATION_GATE: PASSED (tabelas 35/35 preservadas no round-trip)
- OOXML_GATE: PASSED (Word abriu sem reparo; 39 bookmarks / 31 PAGEREF, 0 alvos ausentes)
- RENDERED_LAYOUT_GATE: FAILED (cobertura física incompleta — esperado)
- FULL_COMPLIANCE_GATE: FAILED (esperado nesta fase)

## Referências

- Manual UFLA 6ª ed. (2025): NBR 17225/2025 (WCAG 1.3.1 — cabeçalho de tabela)
- ECMA-376: `<w:tblHeader/>` em `w:trPr`
- `checkpoint/workslop-assessment.md` (WORKSLOP-001/004)

## Status

- [x] Implementado
- [x] Testado
- [x] Documentado
- [x] Evidências regeneradas (DOCX/PDF/gates/report 2026-08-14 15:15)
