# DECISION 002 — 10 tabelas sem w:tblHeader (auditoria semÃ¢ntica)

**Data:** 2026-08-14  
**Branch:** `feat/ufla-render-validation`  
**Commit de referÃªncia:** `6b5c108fc754dd8eb10dd4b87e531a393afd0864`

## Contexto

O `fullComplianceGate` apontava 10/35 tabelas sem `w:tblHeader`. Antes de emitir marcaÃ§Ã£o, foi realizada auditoria semÃ¢ntica no DOCX canÃ´nico (`artifacts/ufla-compliance/normalized-dissertacao.docx`) para classificar cada tabela quanto Ã  existÃªncia de cabeÃ§alho descritor de colunas.

## MÃ©todo

Para cada tabela sem `w:tblHeader`, analisou-se:

- Quantidade de linhas;
- ConteÃºdo da linha 1 (candidata a cabeÃ§alho);
- ConteÃºdo da linha 2 (se existir);
- AdequaÃ§Ã£o Ã  NBR 17225/2025 (item 7.2.1) e ao Manual UFLA (Â§3.2.5);
- DecisÃ£o: SIM / NÃ£o / AmbÃ³guo para "cabeÃ§alho semÃ¢ntico real".

## Resultado da auditoria

```
TABELAS AUDITADAS: 10/10
TABELAS COM CABEÃ§ALHO SEMÃ¢NTICO: 0/10
TABELAS SEM CABEÃ§ALHO: 5/10
EXCEÃ§ÃµES EDITORIAIS: 5/10
```

### ClassificaÃ§Ã£o detalhada

| Tabela | Linhas | Linha 1 | Linha 2 | CabeÃ§alho semÃ¢ntico | AÃ§Ã£o |
|---|---|---|---|---|---|
| 1 | 26 | [vazio] | [vazio] | NÃ£o | Manter sem header |
| 2 | 8 | TÃ©tico (spanning) | "Categoria | QuestÃµes | AvaliaÃ§Ã£o" | AmbÃ³guo | Exigir intervenÃ§Ã£o editorial |
| 3 | 7 | TÃ©tico (spanning) | "Categorias | Unidade de registro | Unidade de contexto" | AmbÃ³guo | Exigir intervenÃ§Ã£o editorial |
| 4 | 27 | Texto fragmentado | Texto fragmentado | NÃ£o | Manter sem header |
| 5 | 6 | TÃ©tico (spanning) | "Categoria | QuestÃ£o | AvaliaÃ§Ã£o" | AmbÃ³guo | Exigir intervenÃ§Ã£o editorial |
| 6 | 1 | Dado puro (questionÃ¡rio) | â€” | NÃ£o | Manter sem header |
| 7 | 14 | TÃ©tico da avaliaÃ§Ã£o | "Categorias | CritÃ©rios | Perguntas | AÃ§ÃµesRIUFLA" | AmbÃ³guo | Exigir intervenÃ§Ã£o editorial |
| 8 | 14 | Fragmento textual | Dados mistos | NÃ£o | Manter sem header |
| 9 | 3 | TÃ©tico ("Cronograma...") | "AÃ§Ã£o | Atividade | ResponsÃ¡vel | Cronograma" | AmbÃ³guo | Exigir intervenÃ§Ã£o editorial |
| 10 | 13 | Dado puro (cronograma) | Dados mistos | NÃ£o | Manter sem header |

## DecisÃ£o tÃ©cnica

1. **Nenhuma das 10 tabelas receberÃ¡ `w:tblHeader` automaticamente.**
2. **5 tabelas (2, 3, 5, 7, 9)** possuem cabeÃ§alho semÃ¢ntico real, mas na **linha 2**. Para emitir `w:tblHeader` corretamente, Ã  necessÃ¡ria **reorganizaÃ§Ã£o editorial** (mover descritores para a linha 1 ou combinar tÃ©tulo+cabeÃ§alho).
3. **5 tabelas (1, 4, 6, 8, 10)** sÃ£o **dado puro** (texto corrido, questionÃ¡rio, cronograma) sem estrutura de cabeÃ§alho. Manter sem `w:tblHeader`.

## Impacto nos gates

- `renderedLayoutGate`: **PASSED** (236 pÃ¡ginas; 0 overlaps/cutoffs/blankPages; PAGEREF resolvido; notas de rodapÃ© detectadas).
- `fullComplianceGate`: **FAILED**.
  - Gap residual de tabelas: **editorial**, nÃ£o de cÃ³digo.
  - AÃ§Ã£o recomendada: abrir issue de intervenÃ§Ã£o editorial para as 5 tabelas ambÃ³guas.

## PrÃ³ximos passos

1. Manter o cÃ³digo de exportaÃ§Ã£o/importaÃ§Ã£o inalterado para estas tabelas.
2. Registrar as 5 exceÃ§Ãµes editoriais em `docs/CHECKLIST.md`.
3. Opcional: criar issue `UFLA-EDITORIAL-001` com a lista das tabelas 2, 3, 5, 7, 9 e a aÃ§Ã£o necessÃ¡ria.

## ReferÃªncias

- NBR 17225/2025, item 7.2.1 — header row deve identificar colunas.
- Manual UFLA, Â §3.2.5 — tabelas devem ter cabeÃ§alho descritor.
- WCAG 2.1, 1.3.1 — informaÃ§Ãµes e relacionamentos devem ser semanticamente identificÃ¡veis.

```
FULL_COMPLIANCE_GATE: FAILED (gap editorial de tabelas)
```
