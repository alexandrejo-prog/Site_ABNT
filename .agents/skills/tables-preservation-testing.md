# SKILL: Teste de preservação de tabelas (round-trip vivo)

## Objetivo
Validar que nenhuma tabela é perdida nem corrompida no caminho
import → export → reimport (round-trip vivo sobre o baseline oficial).

## Quando Usar
- Antes e depois de QUALQUER mudança em `import-docx.ts`, `export-docx.ts`,
  `academic-table-reconstructor.ts`, `word-structure-extractor.ts`;
- Antes de regenerar evidências oficiais (gate CONTENT_PRESERVATION_GATE).

## Fluxo
1. Rode o round-trip vivo isolado:
   `npx vitest run tests/tables-preservation.test.ts`
2. Se falhar, inspecione com um dump input × output (ver
   `tests/test-utils/baseline-roundtrip.ts` e a regressão do Quadro 2 em
   DECISION-001) — compare caption, `headerRowIndex` e células por tabela.
3. Cause provável de regressão: classificação semântica errada
   (`grouped-with-authors`/`generic-academic`) para tabela sem vocabulário.
4. Corrija a causa (não o teste) e rode a suíte completa.

## Comandos
```bash
npx vitest run tests/tables-preservation.test.ts tests/import-docx-tables.test.ts
npm test
npm run lint
```

## Critérios de Aceite
- `tests/tables-preservation.test.ts`: contagem preservada, células
  preservadas, `w:tbl` com bordas emitido;
- `tests/import-docx-tables.test.ts`: 31 testes verdes (incl. w:tblHeader);
- Suíte completa verde antes de regenerar evidências.

## Riscos
- Teste lento (~5s) — não pular em CI;
- Heurísticas de reconstrução que descartam a linha de cabeçalho.

## Referências
- `tests/test-utils/baseline-roundtrip.ts`
- `docs/decisions/001-tblheader-regressao-quadro-2.md`
- `docs/decisions/003-tables-preservation-fix.md`
