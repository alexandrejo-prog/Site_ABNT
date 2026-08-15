# STATUS ATUAL — Site ABNT / UFLA

> Único documento de status. Resultados históricos: `checkpoint/workslop-assessment.md`.
> Conformidade completa: `artifacts/ufla-compliance/report.md` (canônico).

## Última Atualização
- Data: 2026-08-15
- Hora: 12:25 (Atualização pós-sugestões)
- Branch: `feat/ufla-render-validation`
- Commit: `a07a95e` (merge de `origin/feat/ufla-render-validation`)
- Evidência: regenerada na MESMA rodada (testes → DOCX → Word → PDF → gates → report)

## Suíte de Testes
- Passed: 1494
- Failed: 0
- Skipped: 10
- Arquivos: 186

## Gates
- PARAGRAPH_DIFF_GATE: PASSED (Δ58 não-vazios, 0 perdidos)
- CONTENT_PRESERVATION_GATE: PASSED (refs 138/138, tabelas 35/35, imagens 6/6, 0 mojibake)
- OOXML_GATE: PASSED (Word abriu sem reparo; 39 bookmarks/31 PAGEREF, 0 alvos ausentes; w:tblHeader 25/35)
- RENDERED_LAYOUT_GATE: PASSED (render 236 p., 0 overlaps/cutoffs/blank, PAGEREF resolvido)
- FULL_COMPLIANCE_GATE: FAILED (acessibilidade residual: equações sem OMML, 10 tabelas de linha única; UFLA-AMBIGUOUS-1 resolvida)

## Bloqueadores Atuais
1. [ ] Equações avançadas sem OMML nativo (UFLA-023 §3.2.8) — FATIA 2
2. [ ] Cobertura do analisador físico (images/tables not-detected)
3. [ ] Acessibilidade NBR 17225 restante (equações; tabelas de linha única)

## Resolução UFLA-AMBIGUOUS-1
- **Decisão:** paginação contínua a partir da Introdução
- **Base:** Manual UFLA §3.2.7 p.73
- **Status:** DECISION_003 documentada; checker `pagination-start` implementado
- **Impacto:** desbloqueia `fullComplianceGate` para este item

## Próximas Fatias
1. FATIA 2: Equações OMML (UFLA-023) — decidir se o Manual exige OMML ou alternativa acessível
2. FATIA 3: Rodapés + paginação (FINDING-FOOTER-001..008; UFLA-AMBIGUOUS-1) — CONCLUÍDA
3. FATIA 4: Ampliar analisador físico (zerar not-detected de images/tables)
4. FATIA 5: Regenerar relatório final e declarar conformidade se todos os gates passarem

## Evidências (2026-08-15 12:25)
- DOCX: `artifacts/ufla-compliance/normalized-dissertacao.docx`
- PDF: `artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf` (236 p.)
- OOXML: 35 tabelas, 25 `<w:tblHeader/>`, 39 bookmarks/31 PAGEREF, 0 alvos ausentes, 0 mojibake
- Report: `artifacts/ufla-compliance/report.md` (canônico, mesma rodada)
- Gates: `artifacts/ufla-audit/gates.json` (meta `generatedAt` 2026-08-15T12:25Z)
- Resumo status: 48 itens (31 covered, 10 partial, 7 not-covered)

## Regras para IAs
1. Nunca editar números de evidência à mão: rodar `scripts/ufla-compliance/regenerate-official-artifacts.ts` (computa tudo da mesma rodada).
2. Antes de mudar tabelas, ler `docs/decisions/001` e `002` (heurística de cabeçalho causou regressão).
3. Registrar toda decisão em `docs/decisions/NNN-*.md` e atualizar ESTE arquivo.
4. Suíte verde antes de regenerar evidências; FULL_COMPLIANCE_GATE permanece FAILED até todos os gates passarem.
