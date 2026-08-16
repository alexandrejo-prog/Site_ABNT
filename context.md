---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Contexto do Projeto — Site_ABNT

> Manual de bordo para IA. Consulte SEMPRE antes de realizar qualquer alteração ou responder sobre o projeto.

---

## SUMÁRIO EXECUTIVO

Editor/normalizador acadêmico que exporta DOCX em **conformidade plena com o Manual de Normalização da UFLA (6ª ed.)** e ABNT vigente — diretiva principal (§8, regra 9). Página padrão: **A4** (outros tamanhos cancelados por ora — pendência opcional futura).

- **Números (16/08):** 217 arquivos, 1731 testes (10 skipped), lint 0/0, e2e 13/13, auditoria **11/11 gates**, `sourceFingerprint 3bd3c7f7…`. Canônico: `docs/STATUS_ATUAL.md` (números); evidência: `artifacts/ufla-compliance/report.md`.
- **Como ler (TOC):** §1 visão · §2 estrutura de diretórios · §3 tipos de trabalho · §4 regras UFLA/ABNT · §5 ferramenta de conformidade · §6 pendências + rodadas recentes (6q–6w) · §7 comandos · §8 regras para a IA.
- **Histórico de rodadas 6a–6p (01/08–15/08):** arquivado — ler somente sob demanda em `docs/historico/contexto-rodadas/contexto-6a-6p.md`.

---

## 1. VISÃO GERAL
- **Nome:** Site_ABNT
- **Objetivo:** Editor e normalizador de trabalhos acadêmicos que exporta documentos DOCX em conformidade estrita com o Manual de Normalização da UFLA (6ª edição) e normas ABNT vigentes.
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx`, Tiptap (editor rich-text), Vitest, KaTeX (equações no preview), Playwright (e2e), pdf.js (análise física de PDF), Word COM (renderização/PDF de referência).
- **Deploy:** Vercel (SPA)
- **Testes:** 212 arquivos, 1699 testes (10 skipped) — `npm run verify`, `npm test`, `npm run e2e` (Playwright 13 fluxos), `npm run ufla:audit` (11 gates). Estado completo: `docs/STATUS_ATUAL.md` (canônico).

---

## 2. ESTRUTURA DE DIRETÓRIOS
```
Site_ABNT/
├── .agents/                          # Configurações do agente IA
│   ├── AGENTS.md                     # Regras gerais do agente (idioma, conduta)
│   └── skills/                       # Skills personalizadas do agente
│       ├── site_abnt_ufla/           # Instruções do projeto principal
│       │   ├── SKILL.md
│       ├── ufla_docx_rules/          # Regras globais de formatação UFLA/ABNT
│       │   ├── SKILL.md
│       ├── abnt_latest_rules/        # Regras das normas ABNT quando a UFLA for omissa
│       │   ├── SKILL.md
│       ├── ufla_docx_compliance/     # Validador automático de DOCX
│       │   └── SKILL.md
│       ├── evidence-regeneration.md  # Skill avulsa: regeneração anti-workslop
│       ├── tables-preservation-testing.md  # Skill avulsa: round-trip de tabelas
│       └── tblheader-implementation.md    # Skill avulsa: w:tblHeader semântico
├── src/                              # Código-fonte da aplicação React
│   ├── App.tsx                       # Componente principal da aplicação
│   ├── components/                   # Componentes React de UI
│   ├── services/                     # Serviços de importação e utilitários
│   ├── export-docx.ts                # Geração de Dissertação, Tese e TCC (Monografia)
│   ├── export-article-docx.ts        # Geração de Artigo científico
│   ├── export-cpg-docx.ts            # Geração de Resumo expandido CPG
│   ├── export-research-project-docx.ts # Geração de Projeto de pesquisa (NBR 15287)
│   ├── docx-render-core.ts           # Renderização e conversão markdown → DOCX runs
│   ├── docx-shared.ts                # Utilitários compartilhados de parágrafos/runs
│   ├── omml-to-latex.ts              # Conversor OMML → LaTeX para preview (eq. importadas)
│   ├── ufla-rules.ts                 # Constantes de espaçamento e tamanho (regras UFLA)
│   └── app-constants.ts              # Constantes de interface e traduções
├── tests/                            # Suíte com mais de 200 arquivos de teste
├── scripts/
│   └── ufla-compliance/              # Auditoria e gates (Word COM + PDF físico + OOXML)
│       ├── regenerate-official-artifacts.ts  # Comando único de regeneração (npm run ufla:audit)
│       ├── run-ufla-audit.ts         # Orquestrador com lock + fail-fast
│       ├── analyze-pdf-physical.ts   # Análise física do PDF (imagens/tabelas/equações por página)
│       ├── analyze-per-type-pdfs.ts  # Física PDF por tipo de trabalho (A4, paginação, margem)
│       ├── coverage-docx-pdf.ts      # Conciliação DOCX→PDF página-a-página (pageMap)
│       ├── check-pdf-reference.ts    # Gate de regressão PDF vs referência fixa (ufla:pdfref)
│       ├── ooxml-checks.ts           # Checagens OOXML (estrutura, paginação, equações)
│       ├── validate-*.ts             # Validadores (pagination, cover-layout, equations, ...)
│       ├── ci-checks.ts              # Checks de CI sem Word (18 formatos × 15 tipos)
│       └── snapshots/preview-docx-snapshot.json  # Snapshot de paginação/DOCX/PDF commitado
├── skills/                           # Ferramentas auxiliares do projeto (fora .agents)
│   └── ufla-docx-compliance/         # CLI/API de validação automática de DOCX
│       └── SKILL.md
├── artifacts/                        # Evidências geradas (git-ignored, regeneradas pela auditoria)
│   ├── ufla-compliance/              # report.md canônico, PDFs, JSONs, content-preservation
│   └── ufla-audit/                   # gates.json, rendered-analysis.json, findings
├── docs/
│   ├── README.md                     # Mapa da documentação (o que ler por tarefa — LEIA SEMPRE)
│   ├── STATUS_ATUAL.md               # Documento canônico de status (única fonte de verdade)
│   ├── decisions/NNN-*.md            # Decisões canônicas registradas (001–012)
│   ├── RUNNER_WORD.md                # Operação do runner self-hosted com Word
│   └── historico/                    # Estado antigo (14/08) — auditoria, checkpoint, checklists, manuais avulsos
├── Regras/                           # PDFs do Manual da UFLA e guias de formatos específicos
├── PRD.md                            # Requisitos de Produto
├── SKILL.md                          # Instruções da IA na raiz do repositório
├── context.md                        # ← Este arquivo
└── TEMPLATE_Manual - Formato padrao.docx # Template oficial do Word fornecido pela UFLA
```

---

## 3. TIPOS DE TRABALHO SUPORTADOS
| Tipo de Trabalho | Exportador | Elementos Obrigatórios | Elementos Proibidos |
|---|---|---|---|
| **Tese** | [export-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, ficha catalográfica, folha aprovação, indicadores de impacto, resumo, abstract, sumário, referências | — |
| **Dissertação** | [export-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, ficha catalográfica, folha aprovação, indicadores de impacto, resumo, abstract, sumário, referências | — |
| **TCC/Monografia** | [export-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, resumo, abstract, sumário, referências | Indicadores de impacto (opcional) |
| **Artigo Científico** | [export-article-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-article-docx.ts) | Título centralizado, autor centralizado, resumo, abstract, referências | Capa UFLA, folha de rosto, ficha catalográfica, indicadores de impacto, sumário |
| **Resumo Expandido CPG** | [export-cpg-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-cpg-docx.ts) | Título, autores, resumo, abstract, desenvolvimento, referências | Capa UFLA, folha de rosto, sumário, paginação, apêndices/anexos |
| **Projeto de Pesquisa** | [export-research-project-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-research-project-docx.ts) | Estrutura conforme ABNT NBR 15287:2025 | — |

---

## 4. REGRAS DA UFLA E DA ABNT
As constantes básicas de formatação estão definidas em [ufla-rules.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/ufla-rules.ts) e nos arquivos `.agents/skills/*/SKILL.md`.

**Princípios Importantes:**
- Margens: superior 3 cm, esquerda 3 cm, inferior 2 cm, direita 2 cm.  
- Tipografia: Times New Roman, preta (`#000000`). Tamanho 12 pt para texto geral, 11 pt para citação longa/legendas/fontes, 10 pt para paginação.  
- Espaçamento: 1,5 para corpo de texto corrido. Espaço simples para citações longas, notas, referências, resumo, abstract, legendas e fontes.  
- Parágrafo comum: Justificado com recuo de 1,25 cm na primeira linha.  
- Citação longa: Recuo de 4,0 cm da margem esquerda, sem aspas, tamanho 11 pt.  
- Referências: Alinhadas à esquerda, ordenadas em ordem alfabética (locale `pt-BR`), com recuo deslocante (*hanging indent*) de 0,5 cm, espaçamento simples, com título da obra em negrito.  
- **Omissões do Manual:** Quando o Manual UFLA for omisso, a ABNT mais recente (ex.: NBR 14724:2024, NBR 6023:2020) deve ser aplicada sem exceções.

---

## 5. FERRAMENTA DE CONFORMIDADE (`skills/ufla-docx-compliance`)
O repositório inclui um analisador automático que lê um arquivo `.docx` gerado e o avalia contra os critérios normativos do checklist.
- **Como executar (CLI):**  
  ```bash
  npm run skill:validate -- <caminho-do-docx>
  ```
- **Relatório:** JSON ou Markdown detalhando não conformidades (Erros Graves, Médios e Baixos).  
- **Validador de Aceitação:** Exportações que gerem erro de reparo no Word são reprovadas.

---

## 6. PENDÊNCIAS CONHECIDAS (Checklist UFLA/ABNT)
As pendências abaixo constam no checklist normativo (status canônico: `docs/STATUS_ATUAL.md`; evidência: `artifacts/ufla-compliance/report.md`):
1. **Tabelas:** traço duplo superior/inferior **[x]** (implementado — `BorderStyle.DOUBLE` em `docx-shared.ts`).  
2. **Apêndices/Anexos:** numeração de páginas contínua **[x]** (já na mesma seção textual; teste cobre).  
3. **Folha de Aprovação:** título em inglês e coorientador **[x]** (implementado — dissertação/tese; `englishTitle` no form).  
4. **Referências com 4+ Autores:** itálico em “et al.” **[x]** (implementado).  
5. **Citação Direta Curta:** validação completa autor‑data‑página **[x]** (implementado em 03/08 — `validateShortCitation` em `validators.ts`; histórico: 6e em `docs/historico/contexto-rodadas/contexto-6a-6p.md`).  
6. **Resumos:** validação da extensão (150‑500 palavras) **[x]** (validada).

---

## 6a–6p. HISTÓRICO DE RODADAS ARQUIVADO (01/08 a 15/08/2026)

As seções 6a–6p (narrativa das rodadas 01/08–15/08) foram arquivadas em
`docs/historico/contexto-rodadas/contexto-6a-6p.md` (histórico preservado no git).
Números e estado atual: `docs/STATUS_ATUAL.md` (canônico). Rodadas recentes: 6q–6w abaixo.

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
7. **`docs/checklist-14-correcoes.md`** — checklist dinâmico das 14 correções da análise criteriosa (Blocos A/B/C com critério de aceite e teste de prova).

## 6v. CHECKLIST-14: A1 (TOKEN OMML CORROMPIDO) + A4 (CORRIDA DO REGISTRY OMML) (16/08/2026)
Implementadas as 2 correções prioritárias do `docs/checklist-14-correcoes.md` (Bloco A — crash/perda). `npm test` **211 arquivos, 1695 testes (10 skipped)**, lint 0/0, auditoria 140s, 11/11 gates, `sourceFingerprint` `7d1dfd16…`.

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

## 6x. CHECKLIST-14 100% CONCLUÍDO — B5–B7 + C8–C14 (16/08/2026)
Todas as 14 correções do `docs/checklist-14-correcoes.md` implementadas, testadas e marcadas `[x]`. `npm test` **217 arquivos, 1731 testes (10 skipped)**, lint 0/0, `npm run e2e` **13/13**, auditoria **142s, 11/11 gates**, `sourceFingerprint 3bd3c7f7…`, FULL COMPLIANCE APROVADO. **32 testes novos** nesta rodada.

1. **B5 — dead code** — duplicata de `researchDataMatch` removida em `references-normalizer.detect()` (todos os `detectedType` seguem alcançáveis).
2. **B6 — ooxmlGate computado** — `regenerate-official-artifacts.ts` invoca `runOoxmlChecks` na mesma rodada; `evaluateOoxmlGate` falha se `openedByRepair=true` ou achado estrutural (error); `toc-style` virou warning quando o campo TOC existe (falso positivo do gerador — TOC1-3 populados no update). Testes: `tests/ufla-compliance/ooxml-gate.test.ts` (5).
3. **B7 — tab direito unificado** — `UFLA_RULES.page.tabRightTwip` (9072) usado em listas ilustrações/tabelas (leader de pontos) e equações; grep 9071 = 0.
4. **C8 — exportadores deduplicados** — `referenceRunToTextRun(run, font?, size?)` parametrizado, `getAuthorKey`/`dedupeReferences`/`sortReferencesByAuthorKey` em `docx-shared.ts`; `pageNumberHeader` do shared no export-docx/article; `splitParagraphs` do core no export-docx; research-project ordena pela chave ABNT (igual export-docx). Saída preservada: snapshot de paginação e física 11/11 inalterados.
5. **C9 — layout consolidado** — `UFLA_RULES.spacing.referenceHangingCm/Twip` (0,5 cm) nos 3 hanging; `PORTRAIT_CONTENT_TWIP` via margens; capa do artigo via `coverTitle/AuthorFontSizePt`; `paragraphFirstLineTwip` no artigo.
6. **C10 — ficha validada** — `src/image-asset-utils.ts`: `isValidImageBytes` (magic PNG/JPEG/WebP), `readImageDimensions` (IHDR/SOF — fallback sem distorção), limite 10 MB; upload recusa com erro amigável; export cai p/ texto se os bytes não forem imagem. Testes: `image-asset-utils` (6) + `ficha-upload-validation` (3).
7. **C11 — citação sem falso-positivo** — `(IBGE)`, `(Tabela 2)`, `(2020)` sozinhos não geram warning; `SILVA (2024)` não gera `citation-author-missing`; `(SILVA, p. 15)` ainda acusa ano ausente. `tests/unit/citation-locator.test.ts` 13 testes.
8. **C12 — importação limitada** — 60 MB de arquivo + teto de descompressão 500 MB medido no diretório central SEM descomprimir (`assertReasonableUncompressedSize`), antes do mammoth e no `extractDocxStructure`. `tests/import/import-limits.test.ts` (5).
9. **C13 — foco do modal** — `PreviewModal` devolve o foco ao elemento que abriu o modal ao fechar (WCAG 2.4.3); teste jsdom novo.
10. **C14 — rascunhos corrompidos visíveis** — `draftCorruptionIssues` detecta JSON inválido/shape errado sem apagar; banner `role="alert"` no gerenciador com "Descartar dados corrompidos" (decisão explícita). `tests/editor/draft-corruption.test.ts` (6).
11. **Próximo** — sem pendências do checklist-14; fechar o `e2e`/`verify` já rodou 13/13 e 1731; próximas frentes naturais: documentação da rodada e novos itens de robustez.

---

## 7. COMANDOS ÚTEIS
```bash
npm run dev              # Inicia o servidor de desenvolvimento SPA
npm test                 # Executa testes unitários e de integração com Vitest
npm run build            # Executa o build de produção (tsc build + vite compile)
npm run verify           # Executa testes e build (validador oficial de PR)
npm run e2e              # Playwright 13 fluxos no navegador real (axe incluído)
npm run ufla:audit       # Auditoria completa UFLA (lint → typecheck → regenerate Word COM → gates; 11 gates)
npm run ufla:pdfref      # Gate de regressão do PDF de referência (requer Word; runner self-hosted)
npm run skill:validate   # Valida um DOCX; use --type para classificar itens estruturais: --type=artigo|resumo_cpg|projeto_pesquisa|...
```

---

## 8. REGRAS PARA A IA
1. **SEMPRE** consulte `[ufla-docx-rules/SKILL.md](file:///C:/Users/User/Desktop/Alexandre/Site_ABNT/.agents/skills/ufla-docx-rules/SKILL.md)` antes de criar ou modificar geradores de documentos.  
2. **NÃO** altere estilos sem confirmar conformidade no checklist normativo (canônico: `docs/STATUS_ATUAL.md`; evidência: `artifacts/ufla-compliance/report.md`).  
3. **MANTENHA** este arquivo atualizado conforme novas pendências ou mudanças de escopo.  
4. **EXPLIQUE** termos técnicos em português nas interações com o usuário.
5. **FONTE ÚNICA DE VERDADE** — status/gates/contagens vivem em `docs/STATUS_ATUAL.md` (canônico) e `artifacts/ufla-compliance/report.md`; nunca duplicar números em outro arquivo sem marcar como histórico (data + commit + apontar para o canônico).
6. **DECISÕES** — registrar toda decisão normativa/técnica em `docs/decisions/NNN-*.md` (não criar resumos avulsos em `docs/DECISION_*`; esses devem apontar para `docs/decisions/`).
7. **EVIDÊNCIA** — nunca editar números de evidência à mão: rodar `npm run ufla:audit` (regenera artefatos/gates/report da mesma rodada).
8. **TABELAS** — antes de mudar a heurística de cabeçalho, ler `docs/decisions/001` e `002` (regressão do Quadro 2).
9. **DIRETIVA PRINCIPAL** — o DOCX gerado deve atender **plenamente** ao Manual de Normalização da UFLA; página sempre **A4** (11906×16838 twips retrato; paisagem só para tabelas largas, DECISION-009). Confira `UFLA_RULES.page` a cada mudança nos exportadores e valide com `npm run ufla:audit` (perTypePhysicalGate confere A4 físico 595.32×841.92 pt nos 15 tipos).
