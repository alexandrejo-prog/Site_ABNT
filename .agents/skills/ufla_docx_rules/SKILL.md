---
name: ufla_docx_rules
description: Regras globais de formatação UFLA/ABNT para geradores de DOCX. Consulte SEMPRE antes de criar ou modificar exportadores.
---

# SKILL: ufla_docx_rules — Regras de Formatação UFLA

Fonte normativa: **Manual UFLA 6ª ed. (2025)** — `MANUAL_NORMALIZACAO_2024.md` na raiz
(extração oficial). Regras completas e por seção em `docs/STATUS_ATUAL.md` e
`docs/STATUS_ATUAL.md` e `artifacts/ufla-compliance/report.md`. Implementação em `src/ufla-rules.ts` (constantes) e
`src/docx-shared.ts`/`src/docx-render-core.ts` (parágrafos/runs compartilhados).

## Constantes Obrigatórias (src/ufla-rules.ts)

- **Página:** SEMPRE **A4 retrato** (210×297 mm — 11906×16838 twips) via
  `UFLA_RULES.page`; paisagem apenas para tabelas largas (DECISION-009).
  Diretiva principal: o DOCX deve atender plenamente ao Manual UFLA.
- **Margens:** superior 3 cm, esquerda 3 cm, inferior 2 cm, direita 2 cm (A4).
- **Tipografia:** Times New Roman preta (`#000000`). Corpo 12 pt; citação longa /
  legenda / fonte 11 pt; paginação 10 pt.
- **Espaçamento:** 1,5 no corpo corrido; simples em citações longas, notas,
  referências, resumo, abstract, legendas e fontes.
- **Parágrafo comum:** justificado, recuo 1,25 cm na 1ª linha.
- **Citação longa:** recuo 4,0 cm da margem esquerda, sem aspas, 11 pt.
- **Referências:** alinhadas à esquerda, ordem alfabética pt-BR, recuo deslocante
  0,5 cm, espaço simples, título da obra em negrito.
- **Paginação:** contagem contínua a partir da folha de rosto (folha de rosto = 1);
  número visível inicia na Introdução com o valor contado (DECISION-010).

## Omissões do Manual

Quando o Manual UFLA for omisso, aplique a **ABNT mais recente** (ver skill
`abnt_latest_rules`), sem exceções.

## Regras Específicas (resumo por seção)

| Tema | Manual UFLA | Implementação |
|---|---|---|
| Equações | §3.2.8 — centralizadas, numeração à direita (seq/parênteses) | bloco `equation` + `equationSeqInstruction` |
| Tabelas | §23.3, NBR 17225 — traço duplo sup/inf, `w:tblHeader` na 1ª linha | `IBGE_TABLE`, patch pós-Packer |
| Notas de rodapé | §21 — fonte menor, espaço simples | `[^N]` + footnotes.xml |
| Ficha catalográfica | §6.1, §3.1.3 — verso da folha de rosto, Cutter | campo `fichaCatalografica` + `generateCatalogCard` |
| Índice remissivo | §3.1.2.4.4, NBR 6034 — fim do doc, ordem alfabética | campo `indice` |

**Atenção — tabelas:** antes de mudar a heurística de cabeçalho, ler
`docs/decisions/001` e `002` (regressão do Quadro 2).

## Validação

- `npm run verify` — testes + build (obrigatório antes de commit).
- `npm run skill:validate -- <docx>` — valida um DOCX contra o checklist.
- `npm run ufla:audit` — auditoria completa (11 gates, requer Word).