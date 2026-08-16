---
name: abnt_latest_rules
description: Regras das normas ABNT mais recentes quando o Manual UFLA for omisso (NBR 14724:2024, 6023:2020/2023, 10520:2023, 15287:2025).
---

# SKILL: abnt_latest_rules — Normas ABNT Vigentes (suplemento)

O Manual UFLA 6ª ed. delega ao ABNT quando omisso. **Precedência normativa:**
1. Manual UFLA 6ª ed. (sempre primeiro).
2. Template oficial do Word (`TEMPLATE_Manual - Formato padrao.docx`, raiz).
3. ABNT vigente abaixo.

## Normas-Chave

| Norma | Usada para | Notas |
|---|---|---|
| NBR 14724:2024 | Trabalhos acadêmicos (estrutura geral) | ABNT mais recente da estrutura |
| NBR 6023:2020 | Referências | + ABNT 6023:2023 errata/mudanças de formatos digitais |
| NBR 10520:2023 | Citações | citação direta curta autor-data-página |
| NBR 6024 | Numeração progressiva (máx. 5 níveis — quinária) | check até nível 5 |
| NBR 15287:2025 | Projeto de pesquisa | export `export-research-project-docx.ts` |
| NBR 6034 | Índice remissivo | campo `indice` (pós-textual) |
| NBR 17225 | Tabelas | head rows + acessibilidade |

## Referências (NBR 6023)

- Online exige **'Disponível em:'** + **'Acesso em:'** (data de acesso BLOQUEANTE).
- Ordem alfabética pt-BR (`localeCompare "pt-BR" base`).
- Recuo deslocante 0,5 cm; título da obra em negrito; "et al." em itálico.
- Tipos extras §25.14 do Manual: patente, jornal, periódico, audiovisual, sonoro,
  partitura, iconográfico, cartográfico, tridimensional, dados de pesquisa,
  correspondência, evento.

## Integração

- Validador: `skills/ufla-docx-compliance` (checklist-checker com `--type`).
- Normalizador: `src/references-normalizer.ts` (detecção de tipo + destaque).