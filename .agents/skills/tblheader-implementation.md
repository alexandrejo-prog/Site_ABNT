# SKILL: Implementação e manutenção de w:tblHeader

## Objetivo
Emitir e preservar a linha de cabeçalho semântica (`<w:tblHeader/>`) em tabelas
importadas e exportadas, conforme NBR 17225/2025 (WCAG 1.3.1), sem perder
conteúdo no round-trip.

## Quando Usar
- Ao tocar em importação/exportação de tabelas;
- Ao alterar `academic-table-reconstructor.ts` ou a classificação de tabelas;
- Ao validar acessibilidade de tabelas (FULL_COMPLIANCE_GATE).

## Fluxo
1. Leia `docs/decisions/001-tblheader-regressao-quadro-2.md` e
   `docs/decisions/002-tblheader-implementation.md` ANTES de mudar qualquer
   coisa (a heurística de "rótulos curtos" causou regressão — não repetir).
2. Regra central: **nunca** classificar tabela limpa como
   `grouped-with-authors`/`generic-academic` sem vocabulário de cabeçalho
   (categoria|grupo|fase|vantagem|autor|ano|data|fonte|perfil|questão|...).
   Sem vocabulário → `editable-table` (preserva tudo).
3. `headerRowIndex` vem de: (a) `<w:tblHeader/>` declarado na origem
   (respeitar `w:val="false"`), ou (b) convenção primeira linha com 2+ linhas.
4. Exporte com `tableHeader: true` apenas na linha do cabeçalho; linha única
   NÃO recebe `w:tblHeader`.
5. Rode a suíte de tabelas e o round-trip vivo (abaixo).

## Comandos
```bash
npx vitest run tests/import-docx-tables.test.ts tests/tables-preservation.test.ts
npm test
npm run lint
npm run build
```

## Critérios de Aceite
- Round-trip vivo com 0 tabelas perdidas (35/35 na dissertação de referência);
- `w:tblHeader` presente em tabelas com linha de cabeçalho; ausente em tabelas
  de linha única;
- Conteúdo de cada célula preservado (teste de células);
- Suíte 100% verde.

## Riscos
- Reconstrução semântica pode descartar a linha de cabeçalho e embaralhar
  colunas (regressão do Quadro 2 — DECISION-001);
- Marcar linha de dados como cabeçalho polui a leitura assistiva (WCAG).

## Referências
- `docs/decisions/001-tblheader-regressao-quadro-2.md`
- `docs/decisions/002-tblheader-implementation.md`
- ECMA-376: `w:trPr`/`w:tblHeader` · NBR 17225/2025 (WCAG 1.3.1)
