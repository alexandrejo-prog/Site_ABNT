# STATUS ATUAL — Site ABNT / UFLA

> Único documento de status. Resultados históricos: `checkpoint/workslop-assessment.md`.
> Conformidade completa: `artifacts/ufla-compliance/report.md` (canônico).

## Última Atualização
- Data: 2026-08-14
- Hora: 15:15 (FATIA 1 — w:tblHeader + regressão Quadro 2)
- Commit: `ac62c49` (working tree `feat/ufla-render-validation`, sem commit)
- Evidência: regenerada na MESMA rodada (testes → DOCX → Word → PDF → gates → report)

## Suíte de Testes
- Passed: 1473
- Failed: 0
- Skipped: 10
- Arquivos: 185

## Gates
- PARAGRAPH_DIFF_GATE: PASSED (Δ58 não-vazios, 0 perdidos)
- CONTENT_PRESERVATION_GATE: PASSED (refs 138/138, tabelas 35/35, imagens 6/6, 0 mojibake)
- OOXML_GATE: PASSED (Word abriu sem reparo; 39 bookmarks/31 PAGEREF, 0 alvos ausentes; w:tblHeader 25/35)
- RENDERED_LAYOUT_GATE: FAILED (render 236 p., 0 overlaps/cutoffs/blank, PAGEREF resolvido — cobertura física incompleta: images/tables not-detected; rodapés/equações não inspecionados)
- FULL_COMPLIANCE_GATE: FAILED (acessibilidade residual: equações sem OMML, 10 tabelas de linha única; rodapé parcial; UFLA-AMBIGUOUS-1)

## Bloqueadores Atuais
1. [x] ~~w:tblHeader + regressão do Quadro 2~~ — RESOLVIDO na FATIA 1 (25/35 com cabeçalho semântico; 10 de linha única sem cabeçalho declarável)
2. [ ] Equações sem OMML nativo (UFLA-023 §3.2.8) — FATIA 2
3. [ ] Rodapé condicional por tipo + renderização de notas (FINDING-FOOTER-001..008)
4. [ ] Ambiguidade de paginação (UFLA-AMBIGUOUS-1, §3.2.7 p.73) — decisão normativa
5. [ ] Cobertura do analisador físico (2767 elementos: 1044 passed, 1723 not-detected)
6. [ ] Acessibilidade NBR 17225 restante (equações; tabelas de linha única)

## Próximas Fatias
1. FATIA 1: w:tblHeader + Quadro 2 — CONCLUÍDA (2026-08-14 15:15)
2. FATIA 2: Equações OMML (UFLA-023) — decidir se o Manual exige OMML ou alternativa acessível
3. FATIA 3: Rodapés + paginação (FINDING-FOOTER-001..008; UFLA-AMBIGUOUS-1)
4. FATIA 4: Ampliar analisador físico (zerar not-detected de images/tables)
5. FATIA 5: Regenerar relatório final e declarar conformidade se todos os gates passarem

## Evidências (2026-08-14 15:15)
- DOCX: `artifacts/ufla-compliance/normalized-dissertacao.docx`
  SHA-256 `653879CB480DD323E2BEC0E8C09D98CCE6825EA23C2DA71BF672B0BB5DB81AB3` (2.375.002 bytes)
- PDF: `artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf`
  SHA-256 `550BD4682B66A2AA086C89C75DB0F4BA56AD8063F8429D8967064854254CD60E` (2.054.187 bytes, 236 p.)
- OOXML: 35 tabelas, 25 `<w:tblHeader/>`, 39 bookmarks/31 PAGEREF, 0 alvos ausentes, 0 mojibake
- Report: `artifacts/ufla-compliance/report.md` (canônico, mesma rodada)
- Gates: `artifacts/ufla-audit/gates.json` (meta `generatedAt` 2026-08-14T18:15Z)

## WORKSLOP Risks (checkpoint 2026-08-14)
- WORKSLOP-001 (evidência desatualizada): [x] Resolvido — evidência dinâmica no pipeline (regenerate executa npm test; páginas e w:tblHeader computados)
- WORKSLOP-002 (documentos duplicados): [ ] Pendente — consolidar/arquivar históricos (auditoria-atual, relatorio-auditoria, docs/AUDITORIA_2026, etc.)
- WORKSLOP-003 (gates aprovam estado ≠ código): [ ] Pendente — guarda de frescor nos testes que leem artifacts (ver skill evidence-regeneration)
- WORKSLOP-004 (decisões não registradas): [x] Resolvido — docs/decisions/001..003 + skills em .agents/skills/

## Regras para IAs
1. Nunca editar números de evidência à mão: rodar `scripts/ufla-compliance/regenerate-official-artifacts.ts` (computa tudo da mesma rodada).
2. Antes de mudar tabelas, ler `docs/decisions/001` e `002` (heurística de cabeçalho causou regressão).
3. Registrar toda decisão em `docs/decisions/NNN-*.md` e atualizar ESTE arquivo.
4. Suíte verde antes de regenerar evidências; FULL_COMPLIANCE_GATE permanece FAILED até todos os gates passarem.
