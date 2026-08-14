# DECISION-003: Correção da preservação de tabelas (reconstrução semântica conservadora)

## Contexto

A FATIA 1 exigia que a implementação de `w:tblHeader` não sacrificasse a
preservação de conteúdo. A regressão do Quadro 2 (DECISION-001) mostrou que a
classificação `reconstructAcademicTable` pode **destruir conteúdo** quando
trata tabelas limpas (não originadas de PDF convertido) como
`grouped-with-authors`.

## Problema

`tableNeedsSemanticDecision` (import-docx.ts) envia tabelas com mais de 3
colunas para a reconstrução semântica. Com a heurística de cabeçalho antiga
(por vocabulário), o Quadro 2 era classificado `unreconstructable` e caía no
fallback que preserva as linhas cruas (`editable-table`). A heurística nova
mudou essa classificação e a reconstrução passou a descartar conteúdo.

## Opções Consideradas

1. **Reconstrução só para origem PDF-convertida** — restringir a reconstrução
   semântica a tabelas com `layoutWarning`/status de PDF-convertido, e usar o
   fallback cru para o restante. Prós: elimina a classe inteira de regressões.
   Contras: tabelas legítimas de PDF que hoje são reconstruídas voltariam ao
   formato cru (mudança de comportamento ampla, fora da fatia).
2. **Só reverter a heurística de cabeçalho (DECISION-001)** e manter o gate de
   reconstrução atual — Prós: restaura a baseline validada (1466 verdes) com a
   mudança mínima; preservação garantida para os casos reais da dissertação.
   Contras: o risco teórico de reconstrução destrutiva permanece para tabelas
   que casem vocabulário erroneamente.
3. Adicionar salvaguarda de integridade: comparar texto original vs
   reconstruído antes de aplicar `semantic-reconstructed-table` — Prós:
   preventivo e localizado. Contras: mais superfície de mudança na fatia atual.

## Decisão

**Opção 2 agora + Opção 3 como melhoria registrada.** Nesta fatia, restauramos
a detecção conservadora (DECISION-001), que devolve a baseline validada. A
salvaguarda de integridade (opção 3) fica como melhoria futura: antes de aceitar
`semantic-reconstructed-table`, comparar o texto concatenado original com o
reconstruído e rebaixar para `editable-table` em caso de perda.

## Implementação

- Arquivos modificados: `src/academic-table-reconstructor.ts`,
  `tests/import-docx-tables.test.ts`.
- Testes: regressão Quadro 2 (5 colunas sem vocabulário) — conteúdo integral
  preservado, sem reconstrução "Grupo/Conteúdo/Autores".

## Resultado

- npm test: **1473 passed / 10 skipped / 0 failed**
- Round-trip vivo (`tests/tables-preservation.test.ts`): 35/35 tabelas
  preservadas, conteúdo por célula verificado.
- DOCX regenerado mantém todas as 7 linhas do Quadro 2.

## Gates Atualizados

- CONTENT_PRESERVATION_GATE: PASSED
- PARAGRAPH_DIFF_GATE: PASSED (Δ58, 0 perdidos)
- FULL_COMPLIANCE_GATE: FAILED (esperado)

## Referências

- DECISION-001 (causa raiz), DECISION-002 (w:tblHeader)
- `tests/tables-preservation.test.ts` (round-trip vivo)
- WORKSLOP-003 do checkpoint: gates lendo artefatos sem validar frescor

## Status

- [x] Implementado
- [x] Testado
- [x] Documentado
- [x] Evidências regeneradas
- [ ] (futuro) salvaguarda de integridade texto original vs reconstruído
