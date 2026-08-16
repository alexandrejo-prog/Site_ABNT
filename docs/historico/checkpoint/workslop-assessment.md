# CHECKPOINT ANTI-WORKSLOP — SITE_ABNT / UFLA

**Data:** 2026-08-14 · **HEAD:** `ac62c49` (branch `feat/ufla-render-validation`, working tree sem commit)
**Fonte normativa:** Manual UFLA 6ª ed. (10/03/2025) — PDF oficial hash `49929de3…ca66` (ver `artifacts/ufla-audit/manual/manual-ufla-source.md`)
**Escopo desta etapa:** nenhuma alteração de código/teste/report.md/artefatos oficiais. Apenas inspeção, verificação e dois relatórios de checkpoint (`checkpoint/workslop-assessment.{md,json}`).

> **Fato novo e bloqueador desta rodada:** a árvore de trabalho contém uma implementação **em andamento e não registrada** de `w:tblHeader` para tabelas importadas (`ImportedTable.headerRowIndex` em `src/imported-tables.ts`, mudanças em `import-docx.ts`, `word-structure-extractor.ts`, `academic-table-reconstructor.ts`, `export-docx.ts`, `docx-render-core.ts`, `export-cpg-docx.ts`). Essa implementação quebrou o round-trip vivo de tabelas: **Quadro 2 se perde na saída**. Como consequência, **a suíte está vermelha** e as contagens do relatório canônico já não descrevem o estado atual.

---

## 1. Mapa de evidências (verificado em 2026-08-14)

Status: `CONFIRMADO` (evidência direta/artefato atual), `PARCIAL`, `NÃO CONFIRMADO`, `DESATUALIZADO` (não descreve o estado atual), `CONTRADITÓRIO` (duas evidências divergem), `NÃO APLICÁVEL`.

| Afirmação | Evidência | Data | Commit | Reproduzível | Status |
|---|---|---|---|---|---|
| 1466 testes passando, 10 pulados, 0 falhas (185 arquivos) | `report.md` §1; `gates.json` codeGate | 2026-08-14 14:29 (−03) | ac62c49 (working tree) | sim (`npm test`) | **DESATUALIZADO** — verificado agora: **1471 passed / 1 failed / 10 skipped** (185 arquivos) |
| Estado atual da suíte: 1471 passed, 1 failed (tables-preservation), 10 skipped | execução `npm test` (14:46 e 14:53, rodada isolada do arquivo) | 2026-08-14 14:46 | working tree | sim | **CONFIRMADO** |
| Falha `tests/tables-preservation.test.ts`: "Quadro 2 Política institucional de informação…" sem correspondência na saída | saída `npm test`; teste faz round-trip vivo (baseline→gerado→reimportado) | 2026-08-14 14:46 | working tree | sim (determinística, 2 execuções) | **CONFIRMADO** |
| Lint 0 erros / 0 warnings | `npm run lint` exit 0 | 2026-08-14 14:46 | working tree | sim | **CONFIRMADO** |
| Build OK (`tsc -b && vite build`) | `npm run build` exit 0 | 2026-08-14 14:47 | working tree | sim | **CONFIRMADO** |
| `npm run verify` aprovado | `report.md` §1 | 2026-08-14 14:29 | working tree | sim | **DESATUALIZADO** — verify = testes + build; suíte atual tem 1 falha |
| Nenhum teste escreve artefato oficial | `tests/test-utils/test-evidence.ts` (grava em `os.tmpdir()`); `footer-requirements.test.ts` grava em `testEvidenceDir()` | 2026-08-14 | working tree | sim (inspeção) | **CONFIRMADO** |
| Preservação: Δ58 não-vazios; refs 138/138; tabelas 35/35; imagens 6/6; 0 mojibake | `paragraph-diff.json` (1609→1551, Δ58, lost 0), `content-preservation.json` (refs 138/138, tabelas 35/35, imagens 6/6), `report.md` §3 | 2026-08-14 14:29 | working tree | sim (scripts) | **CONTRADITÓRIO** — artefato diz preservado; o round-trip vivo atual perde o Quadro 2 |
| PAGEREF resolvido após atualização de campos | `word-manifest.json` (pagesBefore=pagesAfter=pagesAfterToc=235); `rendered-analysis.json`; PDF (LISTA DE ILUSTRAÇÕES: FIGURA 1→23, GRÁFICO 1→77…) | 2026-08-14 14:18Z | working tree | requer Word COM | **CONFIRMADO** (artefato; não re-executado nesta rodada) |
| Word abriu sem reparo e exportou PDF | `word-manifest.json` `openedByRepair=false`, `approved=true`, `exitCode=0` | 2026-08-14 14:18Z | working tree | requer Word | **CONFIRMADO** (artefato) |
| 235 páginas A4 (595,3×841,9 pt); margens 3/3/2/2 cm; 0 overlaps; 0 cutoffs; 0 páginas em branco | `rendered-analysis.json` (physical.summary: totalOverlaps 0, totalCutoffs 0, blankPages []); `pdf-physical-analysis.json` | 2026-08-14 14:29 | working tree | requer Word + pdfjs | **CONFIRMADO** (artefato) |
| Cobertura física: 2718 elementos, 1037 passed, 0 failed, **1681 not-detected** | `rendered-analysis.json` (coverage: images/tables = not-detected) | 2026-08-14 14:29 | working tree | sim | **CONFIRMADO** |
| RENDERED_LAYOUT_GATE reprovado por cobertura incompleta | `gates.json`, `rendered-analysis.json` (renderedLayoutGate failed) | 2026-08-14 14:29 | working tree | sim | **CONFIRMADO** |
| Overlap antigo (failedPages=[11]) não tem correspondência no artefato atual | `audit-history.jsonl` (antigo `RENDERED_LAYOUT_NOT_COVERED`, failedPages [11]) vs `pdf-physical-analysis.json` (0 overlaps) | 2026-08-14 | — | — | **CONFIRMADO** (diagnóstico; o artefato atual não reproduz o overlap) |
| 19 falhas anteriores eram causadas por testes/analisadores/caminhos | `auditoria-simples-estado.md` (19 falhas em 7 arquivos); estado atual (1 falha, outro teste) confirma correção posterior | 2026-08-14 | — | — | **CONFIRMADO** (histórico) |
| UFLA-023 parcial: equação centralizada + número à direita; sem OMML nativo | `report.md` §5; `reference-completo.docx`; `tests/ufla-equations.test.ts` (10) | 2026-08-14 | working tree | sim | **CONFIRMADO** (parcial por definição) |
| Importação OMML preserva texto como `[EQ]`; alerta quando nativo não recriado | `tests/ufla-equations.test.ts`; `context.md` §6i | 2026-08-14 07:14 | working tree | sim | **CONFIRMADO** |
| 0/35 tabelas com `w:tblHeader` | `report.md` §6 (acessibilidade); inspeção OOXML | 2026-08-14 14:29 | working tree | sim (analisador OOXML) | **PARCIAL** — verdadeiro no artefato da rodada, mas a árvore atual já contém implementação em andamento (`headerRowIndex` em `imported-tables.ts`, sem commit, sem registro no `context.md`) |
| UFLA-044: 27/27 estilos `ufla_*` definidos; outlineLvl 0/1/2; classificados L1=66, L2=51, L3=0 | `report.md` §2; `UFLA-044-spec.json`; `docx-heading-semantics.test.ts` | 2026-08-14 | working tree | sim | **CONFIRMADO** (artefato + testes) |
| "Estilos `ufla_*` NÃO implementado (1 não implementado)" | `auditoria-simples-estado.md` §6 | 2026-08-14 12:45 | working tree | — | **DESATUALIZADO** — superado pela linha anterior (implementado e testado) |
| Acessibilidade: imagens 6/6 com alt text, inline 6/6; hierarquia validada; "Acesso em:" em 146 refs | `report.md` §6; checagens OOXML | 2026-08-14 | working tree | sim | **CONFIRMADO** |
| Acessibilidade NBR 17225 parcial (tabelas/equações pendentes) | `report.md` §5–6; `gates.json` fullComplianceGate | 2026-08-14 | working tree | sim | **CONFIRMADO** (parcial por definição) |
| codeGate passed (1466/0) | `gates.json` | 2026-08-14 14:29 | working tree | — | **DESATUALIZADO** — suíte atual tem 1 falha |
| ooxmlGate passed | `gates.json`; `word-manifest.json`; 3 achados não-estruturais documentados (toc-style falso positivo, ordem da fonte, pagination-start) | 2026-08-14 | working tree | requer Word | **CONFIRMADO** (artefato) |
| contentPreservationGate passed | `gates.json` | 2026-08-14 14:29 | working tree | — | **CONTRADITÓRIO** — teste vivo atual perde o Quadro 2 |
| FULL_COMPLIANCE_GATE failed | `gates.json` (overall failed; conformidade UFLA NÃO declarada) | 2026-08-14 | working tree | sim | **CONFIRMADO** |
| `coverage/docx-conformity-report.txt`: "CONFORMIDADE GERAL: APROVADO" | arquivo `coverage/docx-conformity-report.txt` (sem data/commit) | desconhecida | — | — | **CONTRADITÓRIO** — conflita com fullComplianceGate failed e com as lacunas registradas |
| Manual UFLA 6ª ed. (10/03/2025) é a fonte vigente; PDF oficial 150 pág., 6,03 MB, hash `49929de3…ca66` | `artifacts/ufla-audit/manual/manual-ufla-source.md` | 2026-08-14 | — | sim (URL + hash) | **CONFIRMADO** |
| 48 requisitos rastreados: 29 covered, 12 partial, 7 not-covered, 0 not-implemented | `manual-ufla-requirements.json` (resumoStatus) | 2026-08-14 | — | sim | **CONFIRMADO** |
| UFLA-023 §3.2.8 p.73; UFLA-044 §28.1; ambiguidade de paginação §3.2.7 p.73 | `manual-ufla-requirements.json` (fonte/seção/página); `report.md` §5 | 2026-08-14 | — | — | **CONFIRMADO** (fonte e página documentadas) |
| FINDING-FOOTER-001..008: 3 partial (entrada atual), 2 not-implemented, 1 not-covered, 1 resolved, 1 N/A | `status-final-etapa.md`; `findings/*.json` | 2026-08-14 | working tree | — | **CONFIRMADO** (artefato) |
| F-007: 7 imagens em cabeçalho/ficha catalográfica não importadas (fora do escopo 6/6 do corpo) | `report.md` §3 | 2026-08-14 | working tree | sim | **CONFIRMADO** |
| Implantação de `w:tblHeader` em andamento, sem registro de decisão | `git diff` de `src/imported-tables.ts` (+`headerRowIndex`), `import-docx.ts`, `word-structure-extractor.ts`, `academic-table-reconstructor.ts`, `export-docx.ts`, `docx-render-core.ts`, `export-cpg-docx.ts`, `tests/import-docx-tables.test.ts` — todos modificados **após** 14:29 | 2026-08-14 14:37+ | working tree (sem commit) | sim (git diff) | **CONFIRMADO** |

**Leitura do mapa:** a única afirmação central falsa/desatualizada hoje é a contagem da suíte (1466/0/10) e tudo que dela deriva (codeGate, verify, contentPreservationGate). Lint e build seguem verdes. Todos os demais gates e artefatos físicos/OOXML foram confirmados a partir de artefatos com hash e metadados, com a ressalva de que dependem de Word para re-renderização.

---

## 2. Fonte única de verdade

**Documento canônico do estado da auditoria: `artifacts/ufla-compliance/report.md`** (revalidação 2026-08-14, HEAD `ac62c49`, working tree; metadados de data/commit/gerador no próprio arquivo).

Regra: todo outro documento de status/conformidade deve (a) apontar para o canônico, (b) informar sua própria data e commit, (c) ser marcado `histórico` ou `atual`, (d) **não repetir números divergentes** de testes/gates/findings.

### Classificação dos documentos existentes

**Fonte normativa (autoridade):**
- `artifacts/ufla-audit/manual/manual-ufla-source.md` — registro oficial da fonte (URL, hash, edição, data).
- `artifacts/ufla-audit/manual/manual-ufla-requirements.json` — 48 requisitos com fonte/seção/página.
- `artifacts/ufla-audit/manual/manual-ufla-6ed-2025.pdf` + `-extracted.txt` — PDF oficial baixado + extração.
- `artifacts/ufla-audit/manual/UFLA-044-spec.{json,md}` — especificação UFLA-044.
- `MANUAL_DE_NORMALIZACAO_2024.md` (raiz) — extração verificada da 6ª ed. (ver manual-ufla-source.md, sobreposição 100%).
- `TEMPLATE_Manual - Formato padrao.docx` — template oficial do Word (UFLA).
- `UFLA_MANUAL_INSTRUCOES_CONSOLIDADAS.md`, `NBR15287_PROJETO_PESQUISA.md`, `STATUS_NORMATIVO.md` (parcial: histórico de status, ver abaixo).

**Artefato/evidência gerada:**
- Tudo sob `artifacts/` (DOCX, PDF, JSON, hashes, manifests) — evidências com metadados `generatedAt/commit/branch/manualEdition/status`.
- `coverage/docx-conformity-report.txt` — evidência de checagem OOXML, mas **sem data/commit e com conclusão CONTRADITÓRIA**; deve ser regenerado com metadados ou arquivado como histórico.

**Plano/rastreio:**
- `PRD.md`, `CHECKLIST_SITE_UFLA_MANUAL.md`, `CHECKLIST.md` (checklist operacional, 13/08), `docs/RELATORIO_ROADMAP_BACKLOG.md`, `docs/RELATORIO_FINAL_FUNCIONALIDADE.md`, `docs/CPG_ESTIMATIVA_PAGINAS.md`, `docs/CI_VERIFY.md`.

**Atual:**
- `artifacts/ufla-compliance/report.md` (canônico) — **mas precisa de regeneração imediata**: números da suíte já desatualizados (ver §1).
- `context.md` — manual de bordo vivo; seções 6a–6i são histórico de decisões com contagens; **falta registrar o trabalho de `w:tblHeader` em andamento** (não há seção 6j).

**Histórico / duplicado / obsoleto (devem apontar para o canônico ou ser arquivados):**
- `artifacts/ufla-audit/audit-report.md` — **duplicado** do canônico (mesma rodada, mesmos números).
- `artifacts/ufla-audit/status-final-etapa.md` — histórico da etapa de rodapé (14/08 06:25).
- `auditoria-simples-estado.md` (raiz, 12:45) — histórico: descreve suíte vermelha (19 falhas) e UFLA-044 não implementado; ambos superados.
- `auditoria-atual.md`, `relatorio-auditoria.md` (raiz) — **obsoletos/duplicados**: contagens aproximadas (1275/1300+), sem data confiável, sem referência ao canônico.
- `docs/AUDITORIA_2026.md` — histórico (03/08; 1216 testes).
- `docs/AUDITORIA_STATUS.md`, `docs/HOMOLOGACAO_FINAL.md` — histórico de homologação (baseline antigo `f1f80cd`, 564 testes).
- `STATUS_NORMATIVO.md` — histórico (branch `debug/manual-ufla-sumario`).
- `MANUAL_NORMALIZACAO_2024.md` (raiz) — provável duplicata de `MANUAL_DE_NORMALIZACAO_2024.md` (bytes diferentes); confirmar qual é a extração oficial e arquivar a outra.
- `CHECKLIST.md` — 13/08, duplica parte do `CHECKLIST_SITE_UFLA_MANUAL.md`; consolidar.

**Não-classificados/ruído de sessão (não versionar; candidatos a limpeza):**
- `tmp-*.mjs/py/ts`, `debug-*.{ts,mjs,ps1}`, `scripts/temp-*.py/txt`, `probe-*.docx`, `test-footnote.docx`, `teste-final.docx`, `tmp-test-*.docx`, `.freebuff/`, `.kilo/` — inspeções e documentos de teste sem papel de evidência oficial.

---

## 3. As quatro camadas (separação obrigatória)

| Camada | O que é | Onde | Status desta rodada |
|---|---|---|---|
| **Código** | O que o sistema implementa (importadores, exportadores, validador, UI) | `src/`, `skills/ufla-docx-compliance/src/` | Estável; **contém trabalho não registrado de `w:tblHeader`** |
| **Testes** | O que foi verificado automaticamente | `tests/` (185 arquivos) | **VERMELHO**: 1471/1/10 — falha em `tables-preservation.test.ts` |
| **Evidência gerada** | DOCX/PDF/XML/JSON/hashes/análises | `artifacts/ufla-compliance/`, `artifacts/ufla-audit/`, `coverage/` | Gerada 14:29 com metadados; **pré-data das mudanças atuais** |
| **Conformidade** | O que o Manual UFLA exige; se a evidência atende | `report.md`, `manual-ufla-requirements.json`, `gates.json` | FULL COMPLIANCE **NÃO** declarada; gates rendered/full failed |

Proibições reafirmadas (não são equivalentes):
- teste passando ≠ conformidade UFLA (há 29/48 requisitos covered e ainda assim fullComplianceGate failed);
- DOCX abrindo ≠ conformidade completa (Word abre sem reparo e ainda há gaps de acessibilidade);
- PDF sem overlap ≠ acessibilidade (0 overlaps, mas tabelas sem `w:tblHeader` e equações sem OMML);
- estilo definido ≠ estilo corretamente aplicado (27/27 definidos ≠ aplicação verificada em todos os títulos).

---

## 4. Avaliação workslop (10 perguntas)

| # | Pergunta | Resposta | Evidência |
|---|---|---|---|
| 1 | Há afirmações sem evidência? | **SIM** | `auditoria-atual.md`/`relatorio-auditoria.md` usam aproximações (~620, ~70 conforme…) sem artefato; `coverage/docx-conformity-report.txt` sem data/commit e "APROVADO" contradiz os gates; `docs/AUDITORIA_2026.md` (1216 testes) superado sem marcação |
| 2 | Há artefatos desatualizados? | **SIM** | `report.md`/`gates.json` (1466/0) vs árvore atual (1471/1); arquivos-fonte mudaram após 14:29 sem regeneração de evidência nem commit |
| 3 | Há relatórios duplicados? | **SIM** | ≥8 documentos concorrentes de status (auditoria-atual, relatorio-auditoria, auditoria-simples-estado, audit-report.md, status-final-etapa.md, docs/AUDITORIA_2026, docs/AUDITORIA_STATUS, docs/HOMOLOGACAO_FINAL, STATUS_NORMATIVO, coverage/docx-conformity-report.txt) |
| 4 | Há prompts que repetem instruções sem registrar decisões? | **PARCIAL** | `context.md` 6a–6i registra bem as decisões; porém o trabalho de `w:tblHeader` (decisão técnica relevante) não está registrado; dezenas de scripts temporários indicam iterações não consolidadas |
| 5 | Há correções sem teste de regressão? | **PARCIAL** | A maioria tem teste (ex.: `pendencias-7-fixes.test.ts`); os 3 achados OOXML "explicados" (toc-style, ordem da fonte, pagination-start) e o UFLA-AMBIGUOUS-1 dependem de análise manual no checker, sem teste de regressão dedicado |
| 6 | Há testes que escrevem artefatos oficiais? | **NÃO** | `tests/test-utils/test-evidence.ts` grava em `os.tmpdir()`; `footer-requirements.test.ts` grava em `testEvidenceDir()` (verificado) |
| 7 | Há gates que podem aprovar estado diferente do código? | **SIM** | `physical-analysis-gates.test.ts`, `physical-overlap/cutoff`, `blank-page-detection`, `page-count-consistency`, `ufla-encoding-mojibake`, `tests/acceptance/*` **leem** `artifacts/ufla-compliance/*.json` sem regenerá-los no caminho de teste; artefatos de 14:29 aprovam enquanto o código mudou depois (o teste vivo `tables-preservation` é o único que pegou a regressão) |
| 8 | Há regras UFLA sem fonte e página? | **NÃO** | 48/48 requisitos em `manual-ufla-requirements.json` têm fonte/seção/página; IDs internos (UFLA-023, UFLA-044, UFLA-AMBIGUOUS-1) estão mapeados no mesmo arquivo |
| 9 | Há funcionalidades prometidas que não existem? | **PARCIAL** | O canônico é honesto (conformidade não declarada); mas `coverage/docx-conformity-report.txt` "APROVADO" e `relatorio-auditoria.md` (itens ✅ Conforme) prometem mais do que os gates atestam |
| 10 | Há trabalho repetido por decisões não registradas? | **PARCIAL** | A decisão de `w:tblHeader` não registrada + suíte vermelha exige retrabalho de diagnóstico; histórico de contexto é bom no geral |

### Findings workslop (problemas localizados — o projeto NÃO é workslop como um todo)

**WORKSLOP-001 — Evidência canônica desatualizada minutos após a geração**
- *Problema:* `report.md`/`gates.json` declaram `codeGate passed (1466/0/10)` e `contentPreservationGate passed` para um estado que a árvore de trabalho já não é (1471/1/10, Quadro 2 perdido). Quem consultar o canônico acreditará em suíte verde.
- *Evidência:* comparação entre `gates.json` (14:29) e execução `npm test` (14:46/14:53); mtimes de `src/imported-tables.ts` e demais (posteriores a 14:29).
- *Impacto:* alto — decisões de continuidade baseadas em números falsos; gate code "passed" com suíte vermelha.
- *Ação mínima:* regenerar evidência oficial (testes → artefatos → `gates.json` → `report.md`) em **uma única rodada** com o estado final do código; gravar metadados (data/commit/hash) e tornar a regeneração um comando único de `npm run`.
- *Critério de encerramento:* `report.md` e `gates.json` descrevem exatamente o estado do `npm test` executado na mesma rodada, e o próprio `npm test` passa (0 falhas).

**WORKSLOP-002 — Status/quantidades concorrentes em múltiplos documentos**
- *Problema:* 8+ documentos repetem status, contagens de testes e conclusões com valores divergentes (1275, 1300+, 1216, 1466, 1471) e sem marcação de histórico.
- *Evidência:* `auditoria-atual.md`, `relatorio-auditoria.md`, `auditoria-simples-estado.md`, `docs/AUDITORIA_2026.md`, `docs/AUDITORIA_STATUS.md`, `docs/HOMOLOGACAO_FINAL.md`, `STATUS_NORMATIVO.md`, `artifacts/ufla-audit/audit-report.md`, `status-final-etapa.md`.
- *Impacto:* médio — leitores (inclusive IAs) citam números errados; retrabalho de auditoria.
- *Ação mínima:* cada documento ganha cabeçalho `Histórico — data, commit, aponta para artifacts/ufla-compliance/report.md`; os obsoletos (auditoria-atual, relatorio-auditoria, docs/AUDITORIA_2026) são arquivados ou apagados; manter apenas README/CONTEXT/DECISIONS/TESTING/AUDIT + `artifacts/`.
- *Critério de encerramento:* exatamente um documento (canônico) contém status/gates/contagens atuais; nenhum outro repete números divergentes.

**WORKSLOP-003 — Gates/testes leem artefatos sem validar frescor**
- *Problema:* testes físicos (overlap/cutoff/blank/paginação/mojibake) passam lendo `artifacts/ufla-compliance/*.json` mesmo quando o código mudou; podem aprovar estado ≠ código.
- *Evidência:* `tests/physical-overlap.test.ts`, `physical-cutoff.test.ts`, `blank-page-detection.test.ts`, `page-count-consistency.test.ts`, `ufla-encoding-mojibake.test.ts`, `tests/acceptance/rendered-layout.test.ts` leem artefatos; código mudou após a geração e a suíte "de artefato" continuaria verde.
- *Impacto:* médio-alto — falso sinal de qualidade; foi o que permitiu conviver com o `w:tblHeader` quebrado.
- *Ação mínima:* adicionar guarda de frescor (mtime/hash dos artefatos vs commit/`generatedAt` no meta de cada JSON) no preflight e nos testes que leem artefatos; ou tornar esses testes `describe.skipIf` quando artefato ausente/velho.
- *Critério de encerramento:* com código alterado após a geração dos artefatos, os testes físicos **falham** (ou pulam) até a regeneração — nunca aprovam em silêncio.

**WORKSLOP-004 — Trabalho em andamento não registrado + regressão introduzida**
- *Problema:* implementação de `w:tblHeader` começada sem registro de decisão em `context.md`/DECISIONS, sem commit e **sem manter a suíte verde** (perde o Quadro 2 no round-trip).
- *Evidência:* `git diff` de 8 arquivos-fonte modificados após 14:29; falha determinística em `tests/tables-preservation.test.ts`.
- *Impacto:* alto — suíte vermelha bloqueia qualquer reivindicação de código; risco de perder a correção se alguém der `git clean`/reset.
- *Ação mínima:* terminar ou reverter o `w:tblHeader` em uma fatia pequena com teste red/green, registrar a decisão (DECISIONS/context 6j) e só então regenerar evidências.
- *Critério de encerramento:* suíte verde (0 falhas), teste de regressão cobrindo "nenhuma tabela perdida no round-trip com `w:tblHeader`", decisão registrada.

**Classificação de risco geral: MÉDIO-ALTO.** A arquitetura, os testes e o pipeline de evidência são sólidos e recuperáveis; os problemas são localizados em documentação/evidência/processo, não no código-base.

---

## 5. Checkpoint de decisão

**DECISÃO: CONTINUAR.**

Justificativa objetiva:
- Baseline reproduzível: `artifacts/baselines/dissertacao-referencia.docx` tem hash fixo (`F2B2B6CD…`); os geradores e o pipeline (`scripts/ufla-compliance/regenerate-official-artifacts.ts`) são versionados.
- Conteúdo confiável: evidências atuais (OOXML, render, preservação) têm hash/metadados e são coerentes entre si; a divergência é pontual (suíte).
- Arquitetura coerente: exportadores/importadores/validador com testes de round-trip vivo; nenhum sinal de arquitetura irrecuperável.
- Testes com relação ao código: o round-trip vivo funcionou (pegou a regressão real).
- Requisitos rastreáveis: 48/48 com fonte/seção/página.
- Correções preserváveis: o estado verde (1466) é recuperável revertendo os hunks do `w:tblHeader` na working tree (não há commits intermediários perdidos).
- Custo de recuperação ≪ reimplementação.

Não se aplica PAUSAR (fonte normativa está documentada e baixada), REESTRUTURAR (a redundância é de documentos, não de código), RECOMEÇAR PARCIALMENTE (nenhuma camada está inconsistente em si — apenas evidência não regenerada) nem RECOMEÇAR DO ZERO (baseline reproduzível, conteúdo confiável, arquitetura coerente).

---

## 6. Critério de continuidade (baseline fixado)

Baseline alvo (restaurar antes de abrir nova frente):

```text
último estado verde: 1476+ testes (1466+ passed, 0 failed, 10 skipped);
lint aprovado; build aprovado; verify aprovado;
preservação aprovada (round-trip vivo: 0 tabelas perdidas);
OOXML aprovado (Word abre sem reparo);
renderização física reproduzida (235 p., 0 overlaps/cutoffs/blank; PAGEREF resolvido);
FULL_COMPLIANCE_GATE ainda FAILED (esperado nesta fase).
```

**BLOQUEADORES REAIS (ordem):**
1. Suíte vermelha por regressão de tabelas (Quadro 2 perdido) — **bloqueia tudo**.
2. Tabelas sem `w:tblHeader` (0/35) — NBR 17225 / WCAG 1.3.1.
3. Equações sem OMML nativo (UFLA-023 §3.2.8) — acessibilidade NBR 17225.
4. Rodapé condicional por tipo + renderização de notas (FINDING-FOOTER-001..008).
5. Ambiguidade de paginação (UFLA-AMBIGUOUS-1, §3.2.7 p.73) — decisão normativa pendente.
6. Cobertura do analisador físico (1681/2718 not-detected: images/tables; rodapés) — gate renderedLayout.

Não abrir frentes novas até resolver a #1 e regenerar a evidência.

---

## 7. Próximo trabalho em fatias pequenas

**Fatia 1 (imediata) — corrigir tabelas acessíveis (`w:tblHeader`) sem perder conteúdo:**
1. Teste red: reproduzir a perda do Quadro 2 (já reproduzida — `tests/tables-preservation.test.ts` falha).
2. Corrigir o round-trip: nenhuma tabela pode ser perdida na importação/exportação com a marcação de cabeçalho.
3. Teste green: (a) tabelas importadas com cabeçalho identificado emitem `<w:tblHeader/>`; (b) negativo (sem cabeçalho → sem marcação); (c) regressão "0 tabelas perdidas" com e sem `w:tblHeader`.
4. Suíte completa verde + lint + build.
5. Regenerar evidências oficiais (`regenerate-official-artifacts.ts`) → novos hashes/artefatos.
6. Atualizar `gates.json` + `report.md` (canônico) com números da mesma rodada.
7. Registrar decisão (DECISIONS/context §6j): critério de identificação da linha de cabeçalho.
- *Critério de encerramento da fatia:* suíte verde, `w:tblHeader` presente em ≥1 tabela do artefato regenerado, 0 tabelas perdidas, report.md coerente com a suíte.

**Fatia 2 — OMML nativo (UFLA-023):** confirmar no Manual (§3.2.8 p.73) e na arquitetura se a exigência é `m:oMath` ou alternativa acessível (texto + MathML); teste red/green; evidência; decisão registrada.

**Fatia 3 — Rodapés e paginação:** fechar FINDING-FOOTER-003/004 (not-implemented), 001/002/006/007 (partial), 008 (not-covered); decidir UFLA-AMBIGUOUS-1 com citação normativa.

**Fatia 4 — Ampliar analisador físico:** detectar imagens/tabelas (e rodapé/notas) no PDF para zerar not-detected; só então `renderedLayoutGate` pode passar.

**Fatia 5 — Regenerar relatório final** com todas as evidências da mesma rodada e declarar conformidade apenas se todos os gates passarem.

Cada fatia produz: 1 alteração pequena → teste red/green → resultado de suíte → artefato → decisão registrada → critério de encerramento. Se uma fatia não puder ser concluída com evidência, parar e registrar.

---

## 8. Melhoria mínima do fluxo das IAs

Já existente (manter): `artifacts/ufla-compliance/report.md` canônico; `manual-ufla-requirements.json` (48 reqs); formato de findings (`artifacts/ufla-audit/findings/*.json`); metadados de artefatos (`generatedAt/commit/branch/manualEdition/status`); nenhum teste escrevendo em artefatos oficiais.

Propostas mínimas:
1. **`CONTEXT.md`** (renomear/consolidar `context.md`): estado atual + histórico; registra decisões novas imediatamente (ex.: 6j `w:tblHeader`).
2. **`DECISIONS.md`**: decisões com data/commit/motivo/alternativas; seções 6a–6i do context migram o resumo para cá.
3. **`TESTING.md`** + scripts `npm run`: `preflight` (lint+build+test), `regen:evidence` (`regenerate-official-artifacts.ts`), `render` (`validate-word.ps1`), `test` — comandos únicos, documentados.
4. **Guarda de frescor**: artefatos JSON expõem `generatedAt`; testes que os leem falham/pulam se o artefato for anterior ao código (resolve WORKSLOP-003).
5. **Classificar/arquivar**: marcar como `Histórico` (data+commit+aponta para o canônico) ou remover: `auditoria-atual.md`, `relatorio-auditoria.md`, `auditoria-simples-estado.md`, `docs/AUDITORIA_2026.md`, `docs/AUDITORIA_STATUS.md`, `docs/HOMOLOGACAO_FINAL.md`, `STATUS_NORMATIVO.md`, `artifacts/ufla-audit/audit-report.md`, `status-final-etapa.md`, `MANUAL_NORMALIZACAO_2024.md` (duplicata provável).
6. **Finalidade única por arquivo**: README (começar) · CONTEXT (estado) · DECISIONS (decisões) · TESTING (comandos) · AUDIT/report.md (conformidade) · `artifacts/` (evidências). Não criar novos Markdown de status; quando necessário, dentro de `artifacts/` com metadados.

---

## 9. Relatório final desta etapa

### O que está comprovado (verificado nesta rodada)
- Suíte atual: **1471 passed / 1 failed / 10 skipped (185 arquivos)**; falha única em `tests/tables-preservation.test.ts` (Quadro 2 perdido).
- Lint 0 erros; build OK.
- Artefatos de 14:29 confirmam: Word abriu sem reparo e exportou PDF; 235 p. A4, margens 3/3/2/2; 0 overlaps/cutoffs/blank; PAGEREF resolvido; OOXML válido; refs 138/138, tabelas 35/35, imagens 6/6 (na rodada); 27/27 estilos `ufla_*`; alt text 6/6; FULL_COMPLIANCE_GATE failed (esperado).
- Fonte normativa documentada (Manual 6ª ed., hash, 48 requisitos com página).

### O que estava desatualizado (corrigido o entendimento, não o código)
- "1466/0/10" e derivados (`codeGate passed`, `verify aprovado`, `contentPreservationGate passed`) não descrevem a árvore atual.
- `auditoria-simples-estado.md` (19 falhas, UFLA-044 não implementado) superado.
- `coverage/docx-conformity-report.txt` "APROVADO" contradiz os gates.
- Overlap antigo (failedPages=[11]) não corresponde ao artefato atual.

### O que continua pendente
- Suíte verde (fatia 1) → regenerar evidências → atualizar canônico.
- `w:tblHeader` (0/35), OMML (UFLA-023), rodapés (FOOTER-001..008), ambiguidade de paginação, cobertura do analisador físico, acessibilidade NBR 17225.

### Redundâncias
- 8+ documentos de status concorrentes; 2 cópias do Manual na raiz; ~60 scripts temporários de inspeção; relatórios duplicados (`audit-report.md` = canônico).

### Riscos
- **Alto:** canônico desatualizado (WORKSLOP-001); suíte vermelha (WORKSLOP-004).
- **Médio-alto:** gates aprovam artefato ≠ código (WORKSLOP-003).
- **Médio:** documentos concorrentes (WORKSLOP-002).
- Estado verde não está commitado (working tree sem commit) — risco de perda; recomenda-se commit assim que a suíte voltar a verde (fora do escopo desta etapa).

---

DECISÃO: CONTINUAR
BASELINE: 1466+ passed / 0 failed / 10 skipped (verde), lint+build+verify OK, preservação e OOXML aprovados, renderização física reproduzida (235 p., 0 overlaps/cutoffs, PAGEREF resolvido), FULL_COMPLIANCE_GATE ainda FAILED
WORKSLOP RISK: MÉDIO-ALTO (localizado em evidência/processo: WORKSLOP-001 a 004; código, testes e pipeline aproveitáveis)
BLOQUEADORES REAIS: (1) suíte vermelha por regressão de tabelas (Quadro 2); (2) tabelas sem w:tblHeader; (3) equações sem OMML; (4) rodapés; (5) ambiguidade de paginação; (6) cobertura do analisador físico
PRÓXIMA FATIA: corrigir tabelas acessíveis (w:tblHeader) sem perder conteúdo — teste red/green, suíte verde, regenerar evidências, atualizar canônico, registrar decisão
CRITÉRIO DE ENCERRAMENTO: suíte verde (0 falhas), w:tblHeader presente no artefato regenerado, 0 tabelas perdidas, report.md/gates.json coerentes com a mesma rodada de testes, decisão registrada em DECISIONS/context
FULL_COMPLIANCE_GATE: FAILED (esperado; só pode passar após fechar os bloqueadores 2–6 e regenerar evidência na mesma rodada)
