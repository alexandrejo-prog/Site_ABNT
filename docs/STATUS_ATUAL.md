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
- WORKSLOP-002 (documentos duplicados): [x] Resolvido 2026-08-14 15:35 — 16 docs obsoletos removidos (13 via git, 3 com backup tar); histórico único = `checkpoint/` + `docs/decisions/`
- WORKSLOP-003 (gates aprovam estado ≠ código): [ ] Pendente — guarda de frescor nos testes que leem artifacts (ver skill evidence-regeneration)
- WORKSLOP-004 (decisões não registradas): [x] Resolvido — docs/decisions/001..003 + skills em .agents/skills/

## Minimização (2026-08-14 15:35)

Decisão registrada (anti-workslop): **reduzir lixo regenerável e redundância, NÃO reduzir a camada de verificação.**

| Métrica | Antes | Depois |
|---|---|---|
| Pasta total (com node_modules) | 432 MB / 21.751 arq. | 434 MB / 20.757 arq. (node_modules 324 MB + .kilo 61 MB = 89% do peso) |
| Sem node_modules (critério <50 MB) | 104 MB | **41 MB ✓** |
| Projeto real (sem node_modules/.kilo/.freebuff) | 5.277 arq. | **494 arq. / 29 MB** (artifacts 24 MB = evidência regenerável) |
| Arquivos de teste | 185 | 184 em 14 pastas-categoria (reorganizados 2026-08-14 15:45) |
| Documentos .md | 26 | 14 (cada um com finalidade única) |

**Removido:** `.npm-cache` (46 MB), `dist` (2 MB), `temp/`+`tmp/` (regeneráveis), ~130 scripts one-off (`debug-*`, `temp-*`, `tmp-*`, `probe-*`), 16 docs obsoletos, 7 artefatos obsoletos (logs do Word, `Copy.pdf`, `document.pdf` duplicado), `tests/__qa-generate-cpg.test.ts` (escrevia DOCX em `tmp/` sem NENHUMA asserção — não era um teste).

**Testes — reorganizados em categorias (decisão registrada):** a suíte (1,5 MB) foi agrupada em `tests/{import,export,preservation,ooxml,rendering,accessibility,editor,guardrails,integration,meta,unit}/` + `acceptance/` + `regression/` + `test-utils/`, com imports relativos e caminhos de artefato corrigidos automaticamente. NÃO foram fundidos em arquivos-gigante (4-7 arquivos) nem apagados testes verdes: isso eliminaria a camada de verificação que pega regressões reais (Quadro 2, PAGEREF, OOXML) e quebra a depuração — o oposto do anti-workslop. Removido apenas o gerador sem asserção. Resultado: **1472 passed / 10 skipped / 0 failed** (184 arquivos, lint 0 erros).

**Decisões pendentes do usuário (não toquei por serem estado de ferramentas):**
- `rm -rf .kilo` — 61 MB / 3.671 arquivos: node_modules da ferramenta Kilo Code, não é conteúdo do projeto (agora no `.gitignore`).
- `.freebuff/` (12 MB) — banco de estado do Freebuff; adicionado ao `.gitignore`, não pode ser apagado.
- `artifacts/` (24 MB) — evidência canônica; agora no `.gitignore`, regenerável por `npm run verify` + `scripts/ufla-compliance/regenerate-official-artifacts.ts`.

**Backup:** `backup-minimizacao-20260814.tar.gz` (3 docs não versionados; o restante é recuperável do git history ou regenerável).

## Regras para IAs
1. Nunca editar números de evidência à mão: rodar `scripts/ufla-compliance/regenerate-official-artifacts.ts` (computa tudo da mesma rodada).
2. Antes de mudar tabelas, ler `docs/decisions/001` e `002` (heurística de cabeçalho causou regressão).
3. Registrar toda decisão em `docs/decisions/NNN-*.md` e atualizar ESTE arquivo.
4. Suíte verde antes de regenerar evidências; FULL_COMPLIANCE_GATE permanece FAILED até todos os gates passarem.
