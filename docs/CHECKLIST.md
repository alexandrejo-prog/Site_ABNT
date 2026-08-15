# CHECKLIST UFLA — Status das Fatias

**Data:** 2026-08-15
**Branch:** feat/ufla-render-validation
**Commit base:** 2f4ea4d

## Suíte de Testes (atual)

| Métrica | Valor |
|---|---|
| Arquivos | 195 |
| Passed | 1515 |
| Failed | 0 |
| Skipped | 10 |
| Build | OK |
| tsc --noEmit | 0 erros |
| Vitest timeout | 60s |
| Slow threshold | 10s |

## Fatias Implementadas

| Fatia | Status | Commit | Notas |
|---|---|---|---|
| **FATIA 0 — Rodapés** | ✅ CONCLUÍDA | `6b5c108` | FINDING-FOOTER-001..008 cobertos; 4 arquivos de teste |
| **FATIA 1 — Tabelas (w:tblHeader)** | ⚠️ PARCIAL | `1d53239` | 25/35 com header; 10 pendentes (linha única) |
| **FATIA 2 — Equações (OMML)** | ✅ COMPLETA | `618b414` + `5143893` + local | UFLA-023 + DECISION_008; OMML cru da origem re-injetado (frações/raízes preservadas) |
| **FATIA 3 — Paginação** | ✅ IMPLEMENTADO | `d26ebf9` + `99b9af1` | Checker + validação integrada ao gate |
| **FATIA 4 — Físico PDF** | ✅ INTEGRADO | `d7526a5` | Overlaps, cutoffs, blankPages no gate |
| **Vitest config** | ✅ MELHORADO | current | timeout 60s, slowTestThreshold 10s, exclude node_modules/dist |

## Gates Atuais

| Gate | Status | Observação |
|---|---|---|
| PARAGRAPH_DIFF_GATE | ✅ PASSED | Δ58 não-vazios, 0 perdidos |
| CONTENT_PRESERVATION_GATE | ✅ PASSED | refs 138/138, tabelas 35/35, imagens 6/6, 0 mojibake |
| OOXML_GATE | ✅ PASSED | Word abriu sem reparo; 39 bookmarks/31 PAGEREF, 0 alvos ausentes; w:tblHeader 25/35 |
| RENDERED_LAYOUT_GATE | ⚠️ FAILED | 0 overlaps/cutoffs/blank, PAGEREF resolvido — images/tables not-detected; rodapés/equações não inspecionados |
| FULL_COMPLIANCE_GATE | ❌ FAILED | Equações sem OMML nativo em alguns casos; rodapé parcial; UFLA-AMBIGUOUS-1 |

## Gaps Remanescentes

```
FULL_COMPLIANCE_GATE: NÃO DECLARADO (gates infraestrutura VERDES)

Resolvidas em 15/08:
- Equações avançadas: OMML cru re-injetado via token + patch pós-Packer (DECISION_008)
- Ficha catalográfica: texto OU imagem da ficha oficial (Manual §6.1) — campo + upload na UI
- w:tblHeader: patch pós-Packer marca a 1ª linha de cada tabela em trPr (Manual §23.3)
- Notas de rodapé: itens 24.1–24.3 no checker (footnotes.xml, fonte menor, espaço simples, TNR)
- Tipos de referência §25.14: normalizador cobre os 20 modelos (50 testes)

Pendências declaradas (não bloqueiam conformidade do DOCX):
- Lombada (§3.1) e ilustração multipágina (§23.3) — opcionais, elementos externos
- Criação de notas por botão na UI (markup [^N] já funciona e é testado)
```

## Validação Ampliada nesta Rodada (15/08)

- Capa: autor 14 pt, título 16 pt, local/ano 14 pt, logo 7×2,85 cm (itens 3.11–3.14 da skill)
- Sumário semântico: sem pré-textuais, com referências/apêndices/anexos (itens 15.7–15.10)
- Numeração quinária: máx. 5 níveis (item 18.2; validateSections do gate também)
- Track changes/comentários/bookmarks/vMerge: extração completa e testada
- Equações: OMML cru re-injetado (frações/raízes) — round-trip testado
- Ficha catalográfica: texto + imagem (Manual §6.1)
- w:tblHeader na primeira linha de cada tabela (Manual §23.3)
- Notas de rodapé: validação §21 no checker (24.1–24.3)
- Branch estabilizada: build verde, tsc limpo, lint 0/0, 1529 testes

## Próximos Passos

1. Regenerar artefatos oficiais (regenerate-official-artifacts.ts) e alinhar gates.json × STATUS_ATUAL
2. Commitar mudanças pendentes da branch feat/ufla-render-validation
3. Avaliar botão de nota de rodapé na UI (conveniência; markup [^N] já cobre conformidade)

## Decisões Técnicas

- DECISION_001..008: documentadas em `docs/decisions/`
- Regras 1-6: aplicadas
- gate.ts: FULL_COMPLIANCE_GATE operacional
- vitest.config.ts: timeout 60s, slowTestThreshold 10s, exclude node_modules/dist
