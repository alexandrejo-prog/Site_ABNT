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
| RENDERED_LAYOUT_GATE | ✅ PASSED | 0 overlaps/cutoffs/blank, PAGEREF resolvido — análise física real: 6 imagens (opList/CTM) e 37 regiões de tabela (grade de colunas) detectadas |
| FULL_COMPLIANCE_GATE | ✅ PASSED | Gate expandido: 10/10 categorias verdes; CONFORMIDADE UFLA APROVADA no report.md |

## Gaps Remanescentes

```
FULL_COMPLIANCE_GATE: APROVADO (gates.json overall=passed; report.md declara CONFORMIDADE UFLA APROVADA)

Resolvidas em 15/08:
- Equações avançadas: OMML cru re-injetado via token + patch pós-Packer (DECISION_008)
- Ficha catalográfica: texto OU imagem da ficha oficial (Manual §6.1) — campo + upload na UI
- w:tblHeader: marca a 1ª linha de cada tabela em trPr, respeitando DECISION-002 (linha única NÃO recebe cabeçalho — NBR 17225/WCAG 1.3.1)
- Notas de rodapé: itens 24.1–24.3 no checker (footnotes.xml, fonte menor, espaço simples, TNR) + botão na UI
- Tipos de referência §25.14: normalizador cobre os 20 modelos (50 testes)
- Análise física do PDF: detecção REAL de imagens (opList/CTM) e tabelas (grade de colunas alinhadas) — fim do coverage not-detected
- Gates computados pela regeneração: regenerate-official-artifacts.ts executa o gate expandido real (nada hardcodado)

Pendências declaradas (não bloqueiam conformidade do DOCX):
- Lombada (§3.1) — fechada: Manual consolidado determina "Não gerar no MVP" (elemento físico de impressão)
- Ilustração multipágina (§23.3) — item 25.9 no checker (alerta + marcas continua/continuação/conclusão)
- Religação de alvos de referência cruzada (bookmarks/PAGEREF) — extração ✓ + religação por label (`[x:ANCHOR~texto]` → `InternalHyperlink` + bookmark `SECAO_`/`LISTA_`) nos 4 exportadores
- Fidelidade do preview (header simulado, page-break ABSTRACT, axe) — não afeta o DOCX
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
- Botão de nota de rodapé na UI (numeração sequencial automática; Manual §21)
- Headings mistos ABNT (1.1.A, A.1) na detecção de nível; strip de pontuação final de títulos no import
- Lombada fechada (Manual: "Não gerar no MVP"); ilustração multipágina com item 25.9 no checker
- Análise física real: 6 imagens (opList/CTM) + 37 regiões de tabela (grade de colunas) — renderedLayoutGate PASSED
- Branch estabilizada: build verde, tsc limpo, lint 0/0, 1539 testes; FULL COMPLIANCE GATE APROVADO

## Próximos Passos

1. ✅ Regenerar artefatos oficiais — CONCLUÍDO (gates.json overall=passed; report.md declara CONFORMIDADE UFLA APROVADA)
2. ~~Preservação de alvos de referência cruzada (bookmarks/PAGEREF) — melhoria futura~~ → religação implementada (round-trip) em 2026-08-15
3. Fidelidade do preview (header simulado, page-break ABSTRACT condicional, auditoria axe)

## Decisões Técnicas

- DECISION_001..008: documentadas em `docs/decisions/`
- Regras 1-6: aplicadas
- gate.ts: FULL_COMPLIANCE_GATE operacional
- vitest.config.ts: timeout 60s, slowTestThreshold 10s, exclude node_modules/dist
