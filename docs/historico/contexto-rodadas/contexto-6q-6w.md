# context.md - historico de rodadas recentes (secoes 6q-6w, 16/08/2026)

> Arquivado em 16/08/2026 (2o corte de boot): rodadas 6q-6w (fechamento do WIP,
> proximos passos, indice remissivo, bundle, reorg da documentacao, A1-A4, A2-A3)
> ja registradas no canonico docs/STATUS_ATUAL.md (itens 26c-28a).
> Estado atual: docs/STATUS_ATUAL.md (numeros) + context.md secoes 6x (rodada atual).
> Historico integral preservado no git (git log de context.md).

---
## 6q. FECHAMENTO DO WIP + HIGIENE DE GOVERNANÇA (16/08/2026)
Sincronização do manual de bordo com o canônico `docs/STATUS_ATUAL.md`. **210 arquivos, 1688 testes (10 skipped), build OK, lint 0/0, 11/11 gates.**

1. **Preview de equações importadas igual ao Word** — `src/omml-to-latex.ts` (novo): conversor OMML→LaTeX (tokenizador XML de pilha, sem DOM/DOMParser) com cobertura de `m:f` (frac), `m:rad`, `m:sSup/sSub/sSubSup/sPre`, `m:nary` (∫/∑/∏), `m:limLow/limUpp`, `m:d` (delimitadores), `m:func`, `m:acc/m:bar`, `m:eqArr`; `preview-html.ts` usa `ommlToLatex` quando o bloco carrega o token `\uF001OMML:` → KaTeX renderiza a fração real do Word (não texto achatado). 15 testes do conversor + 1 de regressão do preview.
2. **Conciliação física DOCX→PDF página-a-página** — `coverage-docx-pdf.ts` ganhou `tables.pageMap` (página física de cada tabela OOXML) e `pageMapping` (reverse map página→índices), evidenciando LAYOUT não só presença; `analyze-per-type-pdfs.ts` detecta conteúdo invadindo a margem inferior (área do rodapé, DECISION-010) e registra a posição exata do 1º número visível (`headerNumber`); 3 testes novos.
3. **axe no e2e real** — `app-workflow.spec.ts` injeta axe-core no navegador real (app compilado) ao fim de cada um dos 13 fluxos, com preview aberto: violações critical/serious = 0.
4. **Higiene** — arquivo acidental `null` (0 bytes) removido; `scripts/update-fingerprints.ts` (utilitário avulso, redundante — `regenerate` já computa `sourceFingerprint`) arquivado/removido; DECISION-010: `docs/DECISION_010_PAGINATION.md` virou stub histórico apontando para o canônico `docs/decisions/010-paginacao-contagem-folha-rosto.md`.
5. **Commits granulares** — 5 commits: `de96890` (OMML→LaTeX preview), `2c5457e` (conciliação página-a-página + margem inferior), `41b568c` (evidência da conciliação no gate + snapshot), `0eab8e8` (axe no e2e), `93254ac` (stub histórico DECISION-010).

## 6r. FECHAMENTO DE PRÓXIMOS PASSOS + GOVERNAÇA GIT/CI (16/08/2026)
Sete passos executados. **Merge do PR #20 (RAMO-20) em `main` (`6cd1e73`), proteção de branch ativada, bundle KaTeX enxuto, DECISION-011.**

1. **PR #20 mergeado + main verde** — checks `verify` + `e2e` (Lighthouse via mediana, `3759246`) passaram; merge `6cd1e73`; **Verify success + E2E/Lighthouse success** no main; Vercel Production deploy success. `pdf-reference-refresh` continua falhando em 0s por falta do runner self-hosted com Word (esperado — gate Word-free já roda no `verify.yml`).
2. **Proteção de branch em `main`** — exige PR + status checks `verify` e `e2e` (strict=true), review obrigatório (1), `enforce_admins=false` (dono pode mergear). `pdf-reference` NÃO é check obrigatório (runner self-hosted ausente bloquearia PRs).
3. **DECISION-011** — `docs/decisions/011-validacao-ao-vivo-baseline-artefato.md`: a validação `skill:validate` sobre o baseline de auditoria (65/75 ok) tem 10 "falhas" que são **características do baseline** (sem orientador/curso, refs fora de ordem, sem `wp:extent` de logo) — **não são regressões do gerador**; o gate canônico `ufla:audit` (11/11) não passa por `skill:validate`. Menção curta no `STATUS_ATUAL.md`.
4. **Campo SEQ verificado empiricamente no Word** — DOCX com 3 equações + `updateFields` via COM → números `1`, `2`, `3` recalculados pelo campo `SEQ Eq \s 1 \* ARABIC` (evidência da plataforma alvo). LibreOffice não-instalado aqui: o `SimpleField(seqInstr, number)` embute **resultado em cache**, então o LO exibe o número correto mesmo sem recalcular (risco residual não-bloqueante).
5. **Bundle KaTeX enxuto (perf)** — CSS do KaTeX movido de `main.tsx` (caminho crítico) para `PreviewModal.tsx` (chunk lazy): **CSS principal 111.2 kB → 81.0 kB (−30 kB, −27%)**; CSS do KaTeX (30 kB) baixa junto com o modal, só quando o preview abre. `npm test` 1684 passed, lint 0/0, auditoria re-regenerada (11/11 gates).
6. **Limpeza de branches** — **80 branches merged deletadas** (front/*, sug/*, wt-* antigas, nomes aleatórios). 29 não-merged **avaliadas e preservadas**: todas têm +1 commit redundante (markers de worktree ou conteúdo já no main — confirmado `wt-alias-vitest`, `validate-omml.test.ts` existem no main). 10 worktrees ativas intactas.
7. **`docs/CHECKLIST.md` marcado HISTÓRICO** — aponta para `docs/STATUS_ATUAL.md` (canônico) e `artifacts/ufla-compliance/report.md`; números 15/08 preservados sem edição à mão (regra 5 da IA).

## 6s. ELEMENTOS OPCIONAIS DO MANUAL — ÍNDICE REMISSIVO (16/08/2026)
Avaliação dos elementos **opcionais** do Manual UFLA 6ª ed. contra o gerador (PDF oficial conferido via PyMuPDF — hash `49929de3…ca66` íntegro, 150 pág). Todos os demais opcionais já existiam (errata §3.1.2.1.3, dedicatória §3.1.2.1.5, agradecimentos §3.1.2.1.6, epígrafe §3.1.2.1.7, listas de ilustrações/tabelas/abreviaturas/símbolos §3.1.2.1.11–13, glossário §3.1.2.4.2, apêndices/anexos §3.1.2.4.3, lombada §3.1.1.2 = física, NBR 12225). **Faltava apenas o Índice remissivo (§3.1.2.4.4 / NBR 6034/2004): impresso no final do documento, após o anexo, em paginação consecutiva; título "ÍNDICE" centralizado/maiúsculas/negrito; termos em ordem alfabética com páginas separadas por vírgula (não consecutivo) ou hífen (contínuo); remissivas "termo ver termo".**

1. **Campo `indice`** — novo em `ufla-rules.ts` (interface `AcademicFields`, default `indice: ""`; fora de `ACADEMIC_FIELD_KEYS`/`AcademicFieldKey` por mesma razão de `glossario` — campos pós-textuais opcionais não entram no tipo de union de confiança). Label "Índice remissivo" em `app-constants.ts` e oculto para artigo/CPG via `HIDDEN_PRETEXTUAL`. Key de navegação em `field-navigation.ts`.
2. **DOCX** — `export-docx.ts`: bloco `pushRun` após `Anexos` → `pageBreak() + sectionTitle("Índice")` (centralizado/negrito/maiúsculas via `ufla_titulo_sem_indicativo`) + corpo simples; entrada "ÍNDICE" adicionada ao sumário (`collectSummaryEntries`, após referências/anexos/apêndices).
3. **Preview** — `preview-html.ts`: `indice` propagado por `summaryHtml`/`collectPreviewSummaryEntries`/`calculateRealPages` (com default `""` para não quebrar artigo/CPG/projeto) e página pós-textual após `Anexos` com `pageNumberHeader(indicePage)`.
4. **Sanitização** — `work-type-field-normalizer.ts` limpa `indice` em `sanitizeArticleFields`/`sanitizeCpgFields`; nota do bloco pós-textual em `validators.ts` atualizada ("glossário e índice são suportados").
5. **Testes** — `tests/unit/indice-remissivo.test.ts` (4): renderiza após anexos, não emite quando vazio, preview pós-anexo, título centralizado (`<w:jc w:val="center">`).
6. **Verify** — `npm run ufla:audit` regenerate com Word (141s, **11/11 gates**) atualizou `sourceFingerprint` (`4e4c5c3…`→`06090a55…`) e resolveu os 3 testes de freshness; `npm test` **210 arquivos, 1688 testes (10 skipped)**, lint 0/0, build OK.

## 6t. OTIMIZAÇÃO DE BUNDLE — LIGHTHOUSE PERF 65→99 (16/08/2026)
Ogate Lighthouse flakou no PR #21 (mediana 65 < 70 por contenção do runner). Investigação do caminho crítico revelou que o **preload inicial baixava 1.36 MB de JS** desnecessariamente e o JS crítico foi reduzido **−76%**:

1. **Causa raiz 1 — `main.tsx` puxava `docx-libs` (428 KB) no preload** — `import "./docx-toc-field-patch"` era feito estaticamente no entry, e o patch (monkey-patch do `Packer.toBlob`) é reaplicado/importado dentro do `export-docx.ts` (chunk lazy). Remover o import do entry transferiu `docx` + `jszip` para o chunk de exportação, carregado só ao "Gerar DOCX". **Comportamento preservado (patch idempotente).**
2. **Causa raiz 2 — `import-docx` (mammoth, ~490 KB) estava no bundle crítico** — `ImportBlock.tsx` importava `importDocumentFile` estaticamente; agora o import é **dinâmico** (`await import("../import-docx")`) dentro do `handleChange`, carregando mammoth + `docx-render-core` + `jszip` só quando o usuário importa um arquivo. Os mocks de `vi.mock("../../src/import-docx")` nos testes .tsx continuam válidos (interceptam o import interceptável).
3. **Causa raiz 3 — `docx-render-core` (importa `docx` em runtime) vazava para o caminho eager** via `references-normalizer`→`references-validator`→`validators`. Extraído `cleanMojibakeText` para **`src/text-utils.ts`** (módulo puro, sem a lib `docx`); `docx-render-core` re-exporta por compatibilidade (importadores existentes intactos). `references-normalizer` agora importa de `text-utils`.
4. **`vite.config.ts` — manualChunks em forma de função** — antes `manualChunks: { 'import-libs': ['mammoth'] }` não casava com `mammoth/mammoth.browser` (o chunk saía vazio e mammoth caía no `index.js`). Agora prefixos de pacote (`/node_modules/docx|jszip/`, `/node_modules/mammoth/`, `/node_modules/lucide-react/`, `/node_modules/react/…`) recebem vendor chunks próprios.
5. **Resultado do bundle** — `index.js` **773 KB → 187 KB (−76%)**; preload inicial `index + docx-libs + icons + react-vendor` (1.36 MB) → `index + react-vendor + icons` (0.34 MB, −75%); `import-libs` (mammoth 487 KB) e `docx-libs` (428 KB) só carregam sob demanda. Código do app permanece o mesmo (nenhum teste de comportamento alterado).
6. **Lighthouse** — local: perf **85→99**, a11y 100, best-practices 92-96 (na 1ª execução, sem retry). Projeção: mediana ≥ 90 no CI.
7. **Validação** — `npm test` 210/1688 green; `npm run e2e` 13/13; lint 0/0; `npm run ufla:audit` **11/11 gates** (fingerprint regenerado `9f7798a7…`); `npm run verify` OK. Snapshot de paginação regenerado na auditoria.

## 6u. REORGANIZAÇÃO DA DOCUMENTAÇÃO + AUDITORIA FRESCA (16/08/2026)
PR #22 (`docs/housekeeping-reorg`) — reduzir a releitura por rodada. Auditoria re-regenerada no fim: **210 arquivos, 1688 testes (10 skipped), 147s, 11/11 gates, `sourceFingerprint` `9f7798a7…`**.

1. **Mapa central `docs/README.md`** — o que ler por tarefa (canônico vs histórico); regra de ouro: `docs/STATUS_ATUAL.md` (status) e `artifacts/ufla-compliance/report.md` (evidência) são os únicos com números.
2. **Histórico consolidado em `docs/historico/`** — 23 arquivos movidos (git mv): `docs/auditoria/*` (11 de 14/08), stubs `DECISION_002/003/006/007/008/010*`, `CHECKLIST*.md`, `ISSUE_19_TABELAS_HEADER.md`, `checkpoint/workslop-assessment.*`, `MANUAL_DE_NORMALIZACAO_2024.md` e `NBR15287_PROJETO_PESQUISA.md` → `manuais/`. `MANUAL_NORMALIZACAO_2024.md` ficou na raiz (fonte citada em `src/footer-rules.ts` e testada).
3. **Skills reais em `.agents/skills/`** — as 4 skills que este arquivo já referenciava (site_abnt_ufla, ufla_docx_rules, abnt_latest_rules, ufla_docx_compliance) + `.agents/AGENTS.md`; 3 skill-files avulsos de contexto preservados.
4. **Referências quebradas corrigidas** — SKILL.md/context.md apontavam para `CHECKLIST_SITE_UFLA_MANUAL.md` (inexistente) → agora para o canônico; `STATUS_ATUAL.md` referenciava `checkpoint/workslop-assessment.md` → `docs/historico/checkpoint/`; `docs/decisions/001` idem.
5. **Teste do CHECKLIST ajustado** — `tests/meta/checklist.test.ts` verificava `docs/CHECKLIST.md` (movido); agora verifica `docs/historico/CHECKLIST.md` + presença do canônico `docs/STATUS_ATUAL.md`.
6. **Fonte única DECISION-010** — `docs/DECISION_010_PAGINATION.md` virou stub histórico apontando para `docs/decisions/010-paginacao-contagem-folha-rosto.md` (regra do checkpoint: um canônico, sem números duplicados).
7. **`docs/historico/checklists/checklist-14-correcoes.md`** — checklist das 14 correções da análise criteriosa, 100% `[x]` (arquivado após conclusão; ativo: `docs/checklist-15-melhorias.md`).

## 6v. CHECKLIST-14: A1 (TOKEN OMML CORROMPIDO) + A4 (CORRIDA DO REGISTRY OMML) (16/08/2026)
Implementadas as 2 correções prioritárias do `docs/historico/checklists/checklist-14-correcoes.md` (Bloco A — crash/perda). `npm test` **211 arquivos, 1695 testes (10 skipped)**, lint 0/0, auditoria 140s, 11/11 gates, `sourceFingerprint` `7d1dfd16…`.

1. **A1 — token OMML não derruba export/preview** — `ommlContentTokenDecode` (`docx-render-core.ts`) agora envolve `atob()` em try/catch: base64 inválido (editado/corrompido) degrada para `""` + `console.warn`; o `parseEditorContent` (fonte única dos 4 exportadores E do preview) segue com o bloco `equation` achatado (m:r/m:t) — sem crash.
2. **A4 — registry OMML escopado por geração** — `rawOmmlSeq` virou contador MONOTÔNICO (IDs únicos entre gerações; `clearRawOmmlRegistry` não o reseta mais); o patch pós-Packer CONSUMEr a entrada ao substituir o marcador (`rawOmmlDeleteMarker`, `docx-toc-field-patch.ts`); `clearRawOmmlRegistry()` removido dos 4 `generate*` (limpar no início apagava os registros de outra geração em voo — pool 3 de renders). Resultado: gerações paralelas não colidem nem vazam `\uF000UFLAOMML_`.
3. **Testes** — `tests/regression/omml-token-robustness.test.ts` (7): A1 round-trip válido, decode inválido→`""`+aviso, `[EQ]` corrompido sem throw (bloco achatado), DOCX sem marcador vazando; A4 `Promise.all` de 2 `generateDocxBlob` com OMML distintos (a/b vs c/d) e monografia×artigo — cada DOCX só com o OMML próprio, `rawOmmlRegistrySize()===0`.
4. **Próximo** — A2 (aviso de perda de formatação na importação) e A3 (placeholder de imagem inválida) seguem abertos no checklist-14; A1/A4 marcados `[x]`.

## 6w. CHECKLIST-14: A2 (PERDA DE FORMATAÇÃO NA IMPORTAÇÃO) + A3 (PLACEHOLDER DE IMAGEM) (16/08/2026)
`npm test` **212 arquivos, 1699 testes (10 skipped)**, lint 0/0, auditoria 11/11 gates, `sourceFingerprint` `715e5401…`.

1. **A2 — importação avisa perda de formatação** — `collectFormattingLossWarning` (`import-docx.ts`, padrão do `collectChangeWarnings`): varre os runs da estrutura OOXML; se houver `bold/italic/underline`, o resultado de importação ganha aviso informativo — "O rascunho preserva o texto, mas NÃO a formatação de caracteres — revise o destaque no documento final". O extrator (`word-structure-extractor.ts`) já detectava os flags; faltava avisar.
2. **A3 — imagem com id inválido não some** — `importedImageParagraph` (`export-docx.ts`): id inválido/stale agora emite placeholder visível `[Imagem importada: dados originais indisponíveis (id: …)]` (o preview já tinha fallback; o DOCX sumia com a linha). O artigo já tinha fallback próprio.
3. **Decisão de folha (cancelada por ora)** — NÃO implementar outros tamanhos de folha: **A4 é o padrão brasileiro e o default** (`UFLA_RULES.page` 11906×16838 twips retrato; paisagem só para tabelas largas, DECISION-009). Registrado como **pendência opcional futura** em `docs/checklist-14-correcoes.md` (seção "Fora de escopo (cancelado)"). Diretiva principal documentada em AGENTS.md, SKILL.md, `ufla_docx_rules`, `docs/README.md`, context.md §8 (regra 9) e STATUS_ATUAL (Regras para IAs, regra 5): **o DOCX gerado deve atender plenamente ao Manual de Normalização da UFLA**.
4. **Testes** — `tests/regression/import-formatting-placeholder.test.ts` (4): A2 positivo (DOCX com `w:b`/`w:i`/`w:u` → aviso; texto preservado) e negativo (sem formatação → sem aviso); A3 (marcador com id inexistente → placeholder no DOCX, sem o marcador cru; sem marcador → sem placeholder).
5. **Próximo** — B5 (dead code em `references-normalizer.detect()`) e B6 (`ooxmlGate` computado de verdade) seguem abertos no checklist-14; A1–A4 marcados `[x]`.

