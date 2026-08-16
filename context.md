---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Contexto do Projeto — Site_ABNT

> Manual de bordo para IA. Consulte SEMPRE antes de realizar qualquer alteração ou responder sobre o projeto.

---

## 1. VISÃO GERAL
- **Nome:** Site_ABNT
- **Objetivo:** Editor e normalizador de trabalhos acadêmicos que exporta documentos DOCX em conformidade estrita com o Manual de Normalização da UFLA (6ª edição) e normas ABNT vigentes.
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx`, Tiptap (editor rich-text), Vitest, KaTeX (equações no preview), Playwright (e2e), pdf.js (análise física de PDF), Word COM (renderização/PDF de referência).
- **Deploy:** Vercel (SPA)
- **Testes:** 209 arquivos, 1684 testes (10 skipped) — `npm run verify`, `npm test`, `npm run e2e` (Playwright 13 fluxos), `npm run ufla:audit` (11 gates). Estado completo: `docs/STATUS_ATUAL.md` (canônico).

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
5. **Citação Direta Curta:** validação completa autor‑data‑página **[x]** (implementado em 03/08 — `validateShortCitation` em `validators.ts`; ver 6e).  
6. **Resumos:** validação da extensão (150‑500 palavras) **[x]** (validada).

---

## 6a. ÚLTIMAS CORREÇÕES (01/08/2026)
1. **SUMÁRIO estático do CPG removido** — `export-cpg-docx.ts` não gera mais SUMÁRIO em `resumo_expandido_cpg`/`artigo_completo_cpg` (CPG proíbe sumário; contexto do congresso). Removidos `cpgSummaryParagraphs` e a chamada em `cpgFullChildren`.
2. **Matriz por tipo de trabalho** — novo teste `tests/worktype-format-matrix.test.ts` (38 testes) valida por tipo: SUMÁRIO/TOC real, quebra de página antes de ABSTRACT, margens e autor real.
   - Monografia/Dissertação/Tese/Projeto: **SUMÁRIO com TOC real + quebra de página antes de ABSTRACT**.
   - Artigo/Resumo CPG/Resumo Expandido CPG/Artigo Completo CPG: **SEM SUMÁRIO; ABSTRACT na mesma página** (formato do congresso, por design).
3. Testes atualizados que esperavam SUMÁRIO no CPG: `tests/cpg-first-page.test.ts`, `tests/guardrails-pente-fino.test.ts`.
4. **Fechamento P1–P5/P7 das pendências do checklist:**
   - **P1** tabela IBGE com traço duplo superior/inferior — `ibgeTable` em `docx-shared.ts` usa `BorderStyle.DOUBLE` (mantidas bordas laterais ausentes e `insideHorizontal` SINGLE).
   - **P3** título em inglês na folha de aprovação — campo `englishTitle` em `ufla-rules.ts`/`app-constants.ts` (visível só em dissertação/tese) e render em `approvalPageChildren()` em `export-docx.ts`.
   - **P4** coorientador na folha de aprovação — bloco `Coorientador(a) - UFLA` adicionado em `approvalPageChildren()`.
   - **P5/P7** já existiam (`references-normalizer.ts` itálico em "et al."; `validators.ts` `resumo-word-count` 150-500).
   - **P6** validação completa autor-data-página mantida adiada (risco de falso-positivo).
   - Novo teste `tests/pendencias-7-fixes.test.ts` (5 testes) cobre P1-P4.
5. `npm run verify` 100% verde: 123 arquivos, 1038 testes (10 skipped), build OK.
6. **Listas de ilustrações e tabelas implementadas** — `export-docx.ts`:
   - `collectListItems()` detecta legendas (Figura/Quadro/Gráfico/Mapa/Imagem/Ilustração → ilustração; Tabela → tabela) nos blocos do corpo e em imagens/tabelas importadas, na ordem do texto.
   - `buildListaIlustracoes()` e `buildListaTabelas()` geram páginas pré-textuais após Abstract/Indicadores e antes do Sumário, com título centralizado/maiúsculas/negrito.
   - Cada entrada: `Tipo N - Título` + tab com leader de pontos + `PAGEREF` (página à direita, atualizada pelo Word) + recuo deslocante 0,5 cm (`hanging`) para títulos longos em escada.
   - Legendas do corpo envolvidas com `BookmarkStart`/`BookmarkEnd` (`bookmarkedCaptionParagraph()`) para o `PAGEREF` apontar.
   - Novo teste `tests/lista-ilustracoes.test.ts` (9 testes) cobre título, ordem, formato, páginas à direita e escada.
7. `npm run verify` 100% verde: 124 arquivos, 1047 testes (10 skipped), build OK.

---

## 6b. PRÉ-VISUALIZAÇÃO FIEL AO DOCX COM EDIÇÃO (01/08/2026)
1. **Renderizador HTML fiel** — `src/preview-html.ts` exporta `buildPreviewHtml(input: DocxGenerationInput): string`.
   - Reutiliza `parseEditorContent`, `cleanMojibakeText`, `detectCaption`, `detectTabbedTableBlock`, `inlineMarkupToHtml`/`escapeHtml`, `normalizeReferences`, `buildFlowingImpactText`, `UFLA_RULES`/`CPG_RULES`, `getWorkTypeRequirements`, `normalizeWorkType` — sem duplicar lógica dos exportadores.
   - Páginas: capa (logo `/assets/ufla-logo.jpeg`), folha de rosto (`preview-title-page`), resumo/abstract, indicadores de impacto, listas de ilustrações/tabelas, sumário, corpo, referências, apêndices/anexos.
   - Variantes por tipo via `previewTemplateFor(workType)` → `data-template="general|article|cpg|research-project"`.
   - Fidelidade via classes CSS e atributos `data-first-line-cm="1.25"`, `data-long-quote-cm="4"`, `data-font-size="11pt"`.
2. **Estilos** — `src/preview-styles.css`: página A4 (21×29,7 cm) com margens `3cm 2cm 2cm 3cm`, Times New Roman, corpo 1,5 com recuo 1,25 cm justificado, espaço simples em referências/citações longas/resumo/abstract, citação longa 4 cm/11 pt, referências com hanging 0,5 cm, tabelas com bordas, `@media print`.
3. **Modal de edição** — `src/components/PreviewModal.tsx`: portal em `document.body`, `role="dialog"` acessível, Escape fecha, trava scroll, zoom 50–150%, modos Visualizar/Editar, `contentEditable` sincronizado via `editorHtmlToMarkup`/`editorMarkupToHtml`, toolbar (negrito/itálico/sublinhado/Título 1/Título 2/Citação/Parágrafo) via `editorCommandAdapter`, campos de metadados (autor/título/subtítulo/orientador/coorientador/ano), botão "Gerar DOCX" usa o conteúdo editado.
4. **Integração** — `src/App.tsx`: botão "Visualizar" no header (ícone `Eye`), estado `isPreviewOpen`, handlers `handleOpenPreview`/`handleClosePreview`/`handleCommitPreviewEditorText` (se `editorMode === "references"` grava em `referencias`, senão no editor)/`handleGenerateFromPreview`; `src/main.tsx` importa `preview-styles.css`.
5. **Testes** — `tests/preview-html.test.ts` (21), `tests/preview-modal.test.tsx` (9), `tests/preview-matrix.test.ts` (15). `npm run verify` 100% verde: 127 arquivos, 1092 testes (10 skipped), build OK. Commit `cd708f0` pushado.

---

## 6c. CORREÇÕES P1–P3 DO MODAL DE PREVIEW (01/08/2026)
1. **P1 — "Gerar DOCX" no modal não usava campos de metadados editados** — o clique disparava `handleGenerateDocx` com `fields` antigos (inputs usavam `defaultValue`+`onBlur`, e o setState assíncrono não chegava antes do clique), bloqueando por `author-required`.
   - `src/App.tsx`: `handleGenerateDocx(fieldOverrides?: Partial<AcademicFields>)` mescla overrides em `fields` antes de `runValidation`/`generate`/`buildDownloadFileName`/`finalVersionPendingReport`; `handleGenerateFromPreview(overrides)` fecha o modal e gera com overrides; botão do header usa `() => handleGenerateDocx()` para não passar `MouseEvent`.
   - `src/components/PreviewModal.tsx`: `onGenerate` agora recebe `(overrides?: Partial<AcademicFields>) => void`; `editableFieldValuesRef` coleta valores no `onChange`; `collectEditableFieldOverrides()` percorre `EDITABLE_FIELDS` (author/title/subtitle/advisor/coadvisor/year); o botão "Gerar DOCX" envia os overrides.
   - Validação de campos obrigatórios **mantida** (bloqueio com vazios é intencional e testado; o checkbox funciona pelo header).
2. **P2 — legenda/fonte duplicadas no preview** — `src/preview-html.ts`: `importedImageHtml`/`importedTableHtml` agora recebem `presentTexts?: Set<string>` e só emitem caption/source se o corpo **não** os contiver (via `normalizeForDetection`); nova `bodyTextsInBody(bodyBlocks)`; 4 chamadas (general/article/cpg/research-project) passam os textos do corpo. No DOCX as ocorrências extras eram `altText` (metadado não-visível) + lista de ilustrações (legítima) — o corpo real tem 1 legenda + 1 fonte.
3. **P3 — sumário do preview sem números de página** — `summaryHtml()` agora recebe `bodyStartPage` (páginas pré-textuais + sumário) e gera cada entrada com `<span class="preview-summary-page">N</span>`; CSS novo em `preview-styles.css`: `.preview-summary` em flex com `.preview-summary-leader` (linha pontilhada) e página à direita. Números simulados (o DOCX usa TOC/PAGEREF real do Word).
4. **Testes permanentes** — `tests/preview-html.test.ts` +4 (Bug 4 dedup imagem, entradas com página, corpo não começa na página 1); `tests/preview-modal.test.tsx` +2 (overrides enviados; `{}` sem edição). Tipagem do mock `onGenerate` corrigida (`Mock<(overrides?: Partial<AcademicFields>) => void>`).
5. Temporários `tests/repro-*.test.ts(x)` removidos (15 arquivos). `npm run verify` 100% verde: 127 arquivos, 1101 testes (10 skipped), build OK.

---

## 6d. AUDITORIA VALIDADOR × GERADOR — 7/7 TIPOS APROVADOS (03/08/2026)
Objetivo: comprovar que o validador `skills/ufla-docx-compliance` não precisa mais de revisão manual. Gerei DOCX de teste para os 7 tipos e corrigi divergências reais do validador (bugs de detecção e itens estruturais fora de contexto). **Todos os 7 tipos passam com `exit 0`.**

1. **Correções no gerador `src/export-docx.ts`**:
   - Heading `REFERÊNCIAS` só era suprimido quando a palavra aparecia no corpo em prosa — condição `[...includes(...)]` substituída por lista explícita (`REFERENCIAS`/`REFERENCIAS BIBLIOGRAFICAS`/`BIBLIOGRAFICAS`) com remoção de numeração. Dissertação/tese/TCC voltaram a emitir a seção.
   - Indentação corrigida em `src/export-docx.ts:1100` (`font: UFLA_RULES.typography.fontFamily`) e `REFERENCE_FONT`/`REFERENCE_SIZE` passam a usar as constantes `UFLA_RULES`.
2. **Bug do artigo (2ª geração no mesmo processo)** — removida a flag module-level `_articleReferencesAdded` em `src/export-article-docx.ts`; a 2ª chamada de `generateArticleDocxBlob` não perdia mais as referências.
3. **Bugs do validador** (`skills/ufla-docx-compliance/src/`):
   - `docx-analyzer.ts`: autor da capa lido do primeiro parágrafo **com texto** (antes lia o parágrafo da logo, vazio → autor incorreto).
   - `docx-analyzer.ts`: `hasLogo` agora case-insensitive (`/ufla|logo|image|drawing/i`) — o altText do logo é "Logo UFLA" (maiúsculo) e não casava; projeto de pesquisa passou a reconhecer o logo.
   - `docx-analyzer.ts` + `types.ts`: novo campo `resumo.titleCentered` — item 11.1 passou a checar o título `RESUMO` (antes lia o `SUMÁRIO`).
   - `checklist-checker.ts` + `index.ts`: validador agora é **ciente do tipo de trabalho** (`--type=...`). Itens estruturalmente inaplicáveis (capa UFLA/sumário em artigo e CPG, paginação no resumo curto, anexos/apêndices) viram `unchecked` ("não verificado") em vez de `fail`.
   - `index.ts`: itens `unchecked` não contam mais como GRAVE/MÉDIO/BAIXO nas somas (antes itens excluídos de severidade grave faziam `passed=false` mesmo com 0 falhas).
4. **Evidências (saída real do validador, `exit` code)**:
   - `dissertacao-validacao.docx` → `--type=dissertacao` → **exit 0**
   - `tese-validacao.docx` → `--type=tese` → **exit 0**
   - `tcc-validacao.docx` → `--type=tcc` → **exit 0**
   - `artigo-validacao.docx` → `--type=artigo` → **exit 0**
   - `resumo-cpg-validacao.docx` → `--type=resumo_cpg` → **exit 0**
   - `resumo-expandido-cpg-validacao.docx` → `--type=resumo_expandido_cpg` → **exit 0**
   - `projeto-pesquisa-validacao.docx` → `--type=projeto_pesquisa` → **exit 0**
   - Relatórios em `tmp/*3..5.md`; DOCX novos na raiz (o conteúdo de `validation-docs/` é de 30/07 — **antigo**, não regenerado).
5. **Testes** — `skills/ufla-docx-compliance/tests/ufla-docx-compliance.test.ts` +5 testes (exclusão por tipo artigo/resumo_cpg, item 11.1 via `resumo.titleCentered`, unchecked não conta como grave, `validateDocx` com `workType`). `npm run verify` 100% verde: **128 arquivos, 1108 testes (10 skipped), build OK**.

---

## 6e. REFORÇO DE VALIDAÇÃO POR BLOCOS — R14→R8 (03/08/2026)
Sequência executada contra o `CHECKLIST_SITE_UFLA_MANUAL_v3.md` (seções A–F). Todos os blocos verde: **131 arquivos, 1141 testes (10 skipped), build OK**.

1. **Bloco 1 — R14 higiene de fixtures** — `generate-all-validation.ts` (na raiz, importa `./src/...`) gera 8 tipos canônicos em `tmp/scope-docs/*-full.docx` (**monografia** no lugar de `tcc`, alinhado ao mapeamento operacional); `run-validations.cjs` (na raiz) valida os 8 com `--type`. `validation-docs/` antigo (30/07) foi descartado (03/08) e `teste-final.docx` ficou na raiz, regenerado por `scripts/generate-fixtures.mjs`.
2. **Bloco 2 — C.1/C.2/C.3/C.5/C.7 revalidados em DOCX real** — novo `tests/v3-regression-docx-real.test.ts` (5): gera monografia com tabela/anexo/apêndice, roda o `analyzeDocx` do validador e asserts A4 (11906×16838 twip), margens 3/3/2/2 cm, capa (autor/título maiúsculo), sumário e `checkCompliance(monografia)` com 58 ok/0 falha. **Bônus:** ao compilar o validador pelo build raiz, expôs 7 erros latentes de tipagem em `skills/ufla-docx-compliance/src/` (locatorBold com `string|undefined`, vars mortas `isA4`/`headerRef`/`hasHeader`/`hasBlueColor`, import morto `normalizeOperationalType`) — todos corrigidos.
3. **Bloco 3 — R9/P6 citação direta curta autor‑data‑página** — `validateShortCitation` em `validators.ts` (NBR 10520:2023): `citation-year-missing`, `citation-author-missing`, `citation-page-missing` (warning) e `citation-direct-locator` (info, só quando há aspas — evita falso‑positivo em citação indireta). Testes: `tests/citation-locator.test.ts` (7).
4. **Bloco 4 — R6 referências ABNT ampliada** — `references-validator.ts` ganhou `reference-order`: valida ordem alfabética usando a mesma chave do gerador (`getAuthorKey`), `localeCompare` pt-BR base. Testes: `tests/ref-validator.test.ts` (9, +3 de ordem).
5. **Bloco 5 — R10 pré-textuais no preview** — `tests/preview-matrix.test.ts` (21, +6): dissertação/tese renderizam ficha catalográfica, folha de aprovação, indicadores e lista de ilustrações; monografia tem folha de aprovação; artigo/resumo CPG não têm ficha/aprovação.
6. **Bloco 6 — R8 tela única + preview integrados** — novo `tests/app-preview-flow.test.tsx` (3): "Visualizar" abre o `role="dialog"`, "Gerar DOCX" no modal gera via overrides e fecha, edição no modal comita e não gera sem ação.

---

## 6f. FECHAMENTO DE BACKLOG — R6/R10/R11/R12/R13 (03/08/2026)
Sequência executada em ordem única (sem refazer comprovados R9/P6 e R14). Todos os blocos verde: **134 arquivos, 1153 testes (10 skipped), build OK**.

1. **R6 — referência de livro sem editora** — `references-validator.ts` ganhou `reference-livro-publisher-missing` (NBR 6023: `Local: Editora, ano`), via `looksLikeBookWithoutPublisher` (detecção de forma quando `detectedType` vira `desconhecido`). Testes: `tests/ref-validator.test.ts` (11, +2). C.6 no checklist.
2. **R10 — Errata como elemento pré-textual** — novo campo `errata` em `ufla-rules.ts` (tipo+default+`ACADEMIC_FIELD_KEYS`), render em `export-docx.ts` (`optionalPage("Errata")` antes da Dedicatória) e `preview-html.ts` (`optionalFrontPage`); rótulo em `app-constants.ts` (exigido por `keyboard-accessibility.test.tsx`). Testes: `tests/pre-textuais-opcionais.test.ts` (3).
3. **R11 — "et al." em itálico no corpo** — `docx-render-core.ts` (`tokenizeMarkup` → novo `applyEtAlItalic`, que divide runs em `et al.` com itálico estático e mescla adjacentes) compartilhado por todos os exportadores; `export-docx.ts` refatorou `textRunsForSingleLine` (única cópia local) para delegar ao core; preview em `editor-markup.ts` (`inlineMarkupToHtml` embrulha `et al.` em `<em>`). Testes: `tests/et-al-corpo.test.ts` (3).
4. **R12 — listas de abreviaturas/símbolos e glossário** — 3 campos novos em `ufla-rules.ts` (`listaAbreviaturas`, `listaSimbolos`, `glossario`), ocultados por tipo via `HIDDEN_PRETEXTUAL` em `app-constants.ts`; render DOCX (`optionalPage("Lista de abreviaturas"/"Lista de símbolos"/"Glossário")` + contagem de páginas pré-textuais) e preview (`optionalFrontPage`). Testes: `tests/listas-abreviaturas-simbolos.test.ts` (3).
5. **R13 — tipo específico de referência "evento"** — `references-normalizer.ts` ganhou `detectedType "evento"` (trabalhos em anais/congressos, NBR 6023): `eventReference` (exige `In:` + palavra-chave de evento no restante) + `eventHighlight` (destaca o nome do evento após `In:`), testado com congresso em caixa alta. Teste em `tests/references-normalizer.test.ts` (32, +1).
   - **Nota — ambiguidade `In:`:** referência de **evento** e **capítulo de livro** usam o marcador `In:`. A distinção atual depende da presença de palavra-chave de evento (`anais|congresso|simposio|seminario|encontro|conferencia|reuniao`) no restante após `In:`; caso contrário, cai em `capitulo`. Registrar esta regra para evitar erro de normalização futura ao adicionar novos formatos de referência.
6. **R14 — confirmado já concluído** (8 tipos canônicos, `run-validations.cjs`, tabela B2) — sem novo trabalho.
7. `npm run verify` 100% verde: 134 arquivos, 1153 testes (10 skipped), build OK.

---

## 6g. FECHAMENTO DO ROADMAP DE PRODUTO E CONFIABILIDADE (03/08/2026)
Backlog de produto e confiabilidade concluído em 5 fases (A–E), cada uma fechada com `npm run verify` verde. Nenhum teste pré-existente foi ajustado e a conformidade UFLA/ABNT foi preservada.

1. **Fase A (UX-01, UX-02, UX-03, TEC-03)** — mapa de progresso (`flow-progress.ts`/`FlowProgress`), navegação por campo (`field-navigation.ts`, `fieldKey` em `validators.ts`), erro amigável (`error-utils.ts`) e autosave com hora (`lastSavedAt`). Verify: 138/1174.
2. **Fase B (UX-04, OP-02, PROD-02)** — selo de saída (`output-type.ts`), guia rápido colapsável (`ValidationSidebar`) e exemplo demonstrativo (`demo-example.ts`). Verify: 141/1188.
3. **Fase C (PROD-01)** — onboarding de primeiro uso (`onboarding.ts`/`FirstUseGuide`), descartável via `localStorage`. Verify: 143/1197.
4. **Fase D (TEC-02, TEC-01)** — persistência robusta (`draft-storage-error.ts`; `saveDraft` devolve `{ ok, kind }`) e equivalência legacy↔Tiptap por round-trip (`editor-equivalence.ts`). Verify: 145/1207 e 146/1212.
5. **Fase E (TEC-04, OP-01)** — `PreviewModal` via `React.lazy`+`Suspense` (lazy-load do `docx`) e observabilidade (`observability.ts`). Verify final: 147/1216.

Números finais: **147 arquivos, 1216 testes (10 skipped), build OK**. Relatório oficial: `docs/RELATORIO_ROADMAP_BACKLOG.md`. Redução do bundle principal: **791,72 kB → 732,85 kB** (gzip 215,03 → 198,61 kB).

---

## 6h. LINT NO GATE + CI CONSOLIDADA (04/08/2026)
Fechamento da etapa de qualidade da CI, sem alterar lógica do projeto. Lint **0 erros e 0 warnings**, verify exit 0.

1. **Lint integrado ao gate** — `npm run lint` adicionado ao `verify.yml` (executa antes de `npm test`/`npm run build`). Os 5 erros restantes foram zerados com mudanças mínimas: lazy init de `useState` em `EditorRuler.tsx` (elimina setState síncrono no effect), disables pontuais de `no-control-regex` (sanitização intencional em `docx-render-core.ts`) e `set-state-in-effect` (sync com `localStorage` em `useDraft.ts`), e `catch (err) { void err }` em `tests/acceptance-docx-audit.test.ts`. Commit `7e74312`.
2. **CI consolidada em um único workflow** — `ci.yml` (Node 20, sem lint) removido; `verify.yml` (Node 24 + lint + testes + build, push+PR) vira pipeline único. Branch `main` não protegida, sem dependências externas → remoção segura. Commit `4ded2ad`.
3. **Validação real no GitHub bem-sucedida** — no commit `4ded2ad`, apenas `Verify` dispara (1 workflow por push): `success` em 1m10s, todos os passos verdes (ci → lint → test → build). Annotation de depreciação do Node 20 eliminada da config; restou só o aviso infra do runner de `actions/checkout@v4`/`setup-node@v4`, fora do nosso controle.
4. **`react-hooks/exhaustive-deps` zerado (0 warnings)** — sem `eslint-disable` novo, apenas deps/refs estáveis: `replaceFields` (instável) capturado em `replaceFieldsRef` via effect *latest-ref* em `App.tsx` (evita loop infinito de render); demais ausências eram refs estáveis (`editorRef`, `lastAppliedEditorTextRef`, `editorContentVersionRef`) adicionadas às deps; em `useDraft.ts`, snapshot inicial `initialHasContentRef` preserva o guard de montagem sem re-restore a cada tecla. Commit `a6bc255`. Validado no GitHub: `Verify` `success` em 1m10s, annotations de React Hooks removidas (restou só o aviso infra do runner).

---

## 6i. UFLA-023 EQUAÇÕES E FÓRMULAS (§3.2.8 MANUAL UFLA) (14/08/2026)
Implementação da regra UFLA-023: equações/fórmulas destacadas no texto, numeração em algarismos arábicos entre parênteses **alinhada à direita**, centralizadas, com espaçamento maior (1,5) para acomodar expoentes/índices; texto preservado e alerta quando a equação nativa (OMML) não puder ser recriada (§22 instruções consolidadas).

1. **Causa raiz** — `TEXT_TOKEN_PATTERN` em `src/word-structure-extractor.ts` não capturava `<m:t>` (OMML), perdendo silenciosamente o texto de equações na importação. Agora o padrão inclui `<m:t(?:\s[^>]*)?>([\s\S]*?)<\/m:t>` com grupo alternado (`match[1] ?? match[2]`).
2. **Detecção `hasMath`** — `ImportedParagraph`/`ImportedBlock` ganharam `hasMath?: boolean`; detecção via `/m:oMath.../` em `src/word-structure-extractor.ts` (linha 693); `paragraphBlockFromMetadata` propaga; `normalizeBlock`/`splitInlineAcademicText` em `src/import-normalizer.ts` propagam `hasMath` nos blocos reconstruídos (senão o marcador se perdia na normalização).
3. **Marcador `[EQ]` no rascunho** — `src/import-docx.ts` prefixa `[EQ] ` em linhas com `hasMath` no `editorText`; `editorTextWithImageMarkers` agora não usa o fallback quando há blocos com matemática; contagem `mathBlocks` + alerta `mathMessages`: "N equação(ões)/fórmula(s) detectada(s)... texto preservado como '[EQ]', equação nativa (OMML) não é recriada automaticamente; verifique formatação centralizada com numeração à direita".
4. **Renderização** — novo tipo `equation` em `EditorBlockType`/`parseEditorContent` (`src/export-docx.ts` detecta `[EQ] `); helper compartilhado `equationParagraph` em `src/docx-render-core.ts`: centralizado (`w:jc center`), tab stop direito em 9072 twips (16 cm), espaçamento 1,5 (`w:line=360`), itálico; número `(N.N)` extraído do fim e alinhado à direita. Aplicado em **todos** os exportadores: `export-docx.ts`, `export-article-docx.ts`, `export-cpg-docx.ts`, `export-research-project-docx.ts`.
5. **Auditoria OOXML** — `scripts/ufla-compliance/ooxml-checks.ts` ganhou checagem `equation-format`: se houver OMML sem parágrafo centralizado com tab direito, emite falha (`error`, "Manual UFLA 3.2.8").
6. **Testes** — novo `tests/ufla-equations.test.ts` (10): importação OMML (`m:oMath` e `m:oMathPara`) preserva texto como `[EQ]`, negativo sem alerta, `parseEditorContent` gera bloco `equation`, `equationParagraph` centraliza com tab direito (inspeção do root OOXML), serialização via `Packer`, e 2 testes de checagem `runOoxmlChecks` (sem falso positivo).
7. **Verify** — `npm run lint` 0 erros, `npm run build` OK, `npm test` **184 arquivos, 1452 testes passed (10 skipped)**.

---

## 6j. ESTABILIZAÇÃO DA BRANCH + VALIDAÇÃO AMPLIADA (15/08/2026)
Sequência executada para deixar `npm run verify` 100% verde e ampliar a cobertura do validador contra o Manual UFLA. **195 arquivos, 1515 testes (10 skipped), build OK, tsc limpo.**

1. **Correções do trabalho em andamento (`feat/ufla-render-validation`)** — o alias `@scripts` no tsconfig puxou `scripts/ufla-compliance/` para o programa de tipos e expôs ~30 erros latentes, quebrando o build:
   - `gate.ts` reescrito com tipagem correta: `checkTables` inteligente (linha única aceita — DECISION_002) usado no gate, gaps dos validadores mapeados com `section`, `technical` com os campos novos (omml, citationsValidator, referencesValidator, sectionsValidator, figuresValidator, tablesValidator); `runFullComplianceGate` preservado.
   - `audit-all.ts`, `audit-references.ts`, `audit-citations.ts`, `audit-figures.ts`, `audit-pretextual.ts`, `audit-sections.ts`, `report.ts`, `document-type-matrix.ts`, `validate-document-structure.ts` (agora aceita `explicitType`), `validate-page-layout.ts` (usa `UFLA_RULES.page.widthTwip/heightTwip` e o recuo real), `validate-equations.ts`, `validate-pagination.ts` — tipos e imports limpos.
   - `report.ts` refatorado para aceitar `ExpandedAuditResult` OU `UnifiedAuditResult` de forma defensiva (não lança com resultado vazio) e criar o diretório do relatório.
2. **Track changes/comentários/bookmarks/vMerge completados** — `src/word-structure-extractor.ts` calculava `commentId`/`moveId`/`permissionId` mas não os propagava: agora `extractRunsFromParagraphXml` copia para os runs, o parágrafo agrega `commentIds`/`moveIds`/`permissionIds` e `paragraphBlockFromMetadata` os propaga aos blocos; corrigida a lógica de intervalo (fim do comentário vem depois do run — antes exigia `end <= runEnd`).
3. **Testes novos corrigidos** — `tests/import/import-track-changes.test.ts` reescrito com DOCX mínimo real (JSZip) testando `w:ins`, comentário, bookmarks e vMerge; `tests/ufla-compliance/validate-omml.test.ts` gera DOCX real sem matemática para o caso de sucesso; `tests/ufla-compliance/report.test.ts` passa com o report defensivo.
4. **Validador da skill ampliado (`skills/ufla-docx-compliance`)** — novos itens no `checklist-checker.ts`:
   - **3.11–3.14 Capa**: autor 14 pt, título 16 pt, local/ano 14 pt e logo 7 × 2,85 cm (dimensões lidas de `wp:extent` no bloco da capa). Detecção corrigida: autor = primeiro parágrafo com texto que NÃO seja a linha institucional; título = primeiro negrito/centralizado/longo APÓS o autor (exclui instituição e autor); local = `LAVRAS – MG`.
   - **15.7–15.10 Sumário semântico**: entradas TOC (estilos `TOC1-3`/`ufla_sumario_*`) não incluem pré-textuais, incluem referências, apêndices e anexos quando existem; com TOC ainda não atualizado pelo Word → `unchecked` (não falso-positivo).
   - **18.2 Numeração quinária**: profundidade máxima de 5 níveis (ABNT NBR 6024 / Manual §18).
   - 4 testes novos (40 no total do arquivo da skill).
5. **Gate de scripts**: `validateSections` agora também verifica o limite quinário (máx. 5 níveis).
6. **Validação ao vivo** no DOCX gerado: 65/75 itens OK; as falhas restantes são do artefato de auditoria (baseline sem orientador/curso/refs ordenadas e sem imagem de logo — não são bugs do gerador).

---

## 6k. CONFORMIDADE COMPLETA + GATES DE EVIDÊNCIA FÍSICA (14/08/2026)
Estado documentado no canônico `docs/STATUS_ATUAL.md`. Branch `feat/ufla-render-validation`.

1. **Fonte normativa registrada** — Manual UFLA 6ª ed. (10/03/2025), PDF oficial hash `49929de3…ca66`, 48 requisitos com fonte/seção/página em `artifacts/ufla-audit/manual/manual-ufla-requirements.json`.
2. **FULL COMPLIANCE GATE APROVADO** — `npm run ufla:audit` orquestra lint → typecheck:scripts → regenerate (Word COM + PDF físico + gate expandido + gates) → verify; 11/11 gates passed; `artifacts/ufla-compliance/report.md` é o canônico (mesma rodada, sem stale).
3. **Análise física do PDF implementada** — imagens via opList/CTM, tabelas via grade de colunas alinhadas + **bordas desenhadas** (`re`+`eoFill`, cobre tabelas de 2 linhas/questiónario), equações por glifos matemáticos Unicode; `analyze-pdf-physical.ts` emite contagens **por página**.
4. **Conciliação DOCX→PDF página-a-página** — `coverage-docx-pdf.ts`: cada tabela OOXML registra a página física onde foi renderizada (`tables.pageMap`) + reverse map (`pageMapping`); gate `coverageDocxPdfGate` (35/35 tabelas casadas, razão 1.29 na banda [0.7,1.8]).
5. **Paginação resolvida (UFLA-AMBIGUOUS-1, DECISION-010)** — contagem contínua a partir da folha de rosto (folha de rosto = 1); numeração visível inicia na Introdução com o valor contado (nunca reinício em 1); OOXML `pgNumType start=13` ↔ PDF físico folha 18=13.
6. **Runner self-hosted do Word documentado** — `docs/RUNNER_WORD.md`; gate de regressão `ufla:pdfref` + workflow de refresh (`pdf-reference-refresh.yml`) abrindo PR com a nova referência.

## 6l. EQUAÇÕES OMML NATIVAS (UFLA-023, §3.2.8) + PREVIEW FIEL
1. **OMML cru re-injetado** — o `<m:oMathPara>` original viaja no rascunho como token `\uF001OMML:<base64>\uF001` e é re-injetado no XML pós-Packer (frações/raízes preservadas).
2. **LaTeX→OMML no editor** — `parseLatexMath` cobre `\frac`, `\sqrt[n]`, `x^2`, `x_i`, `\int/\sum/\prod/\lim` (m:nary/m:func nativos) com aninhamento; botão **ƒx Equação** na toolbar + numeração automática por seção `(2.1)`.
3. **Numeração como campo SEQ real** — `equationSeqInstruction` (`SEQ Eq \s 1 \* ARABIC`) via `w:fldSimple` (equações digitadas) ou fldChar (OMML cru importado); Word recalcula ao abrir; tabulação à direita 9072 twips.
4. **Preview com KaTeX** — `omml-to-latex.ts` (novo, 16/08) converte OMML→LaTeX (tokenizador XML de pilha, sem DOM) e o KaTeX renderiza com a mesma fidelidade do Word; fallback gracioso para texto achatado.
5. **Auditoria OOXML** — `ooxml-checks.ts` `equation-format`: OMML exige parágrafo centralizado com tab direito (Manual 3.2.8).

## 6m. FICHA CATALOGRÁFICA, CAPA E APROVAÇÃO (FÍSICA)
1. **Ficha §6.1 completa** — campo `fichaCatalografica` + upload de imagem; exportação prioriza imagem e cai para texto; estilo `ufla_ficha_catalografica` (espaço simples).
2. **Ficha no VERSO da folha de rosto** — `validate-cover-layout.ts` verifica a página seguinte à folha de rosto contém "FICHA CATALOGRÁFICA" (Manual §3.1.3); cartão na metade inferior quando há Cutter real (≥40% erro / ≥50% aviso).
3. **Cutter** — `catalog-card.ts`: `hasCutterNumber` (`[A-Z]\d{1,4}[a-z]?` ou CDU); Cutter ausente na ficha em TEXTO bloqueia a versão final (`catalog-card-cutter-missing`); **ficha gerada automaticamente** (`generateCatalogCard`: tabela Cutter-Sanborn Silva→S586 etc. + fallback `[A-Z]\d{2}`); botão "Gerar ficha provisória" na UI.
4. **Capa por coordenadas** — ordem estrita institucional→autor→título→local/ano com gaps em banda [10,350]pt, sem sobreposição; autor 14 pt, título 16 pt, local/ano 14 pt, logo 7×2,85 cm.
5. **Grade física da banca** — folha de aprovação: ≥3 linhas de membros em posições y distintas na metade inferior; linhas sobrepostas (gap<8pt) ou fora da margem rejeitadas.

## 6n. TABELAS (w:tblHeader), PAISAGEM E ROUND-TRIP
1. **Cabeçalho repetido (w:tblHeader)** — patch pós-Packer marca a primeira linha em trPr (Manual §23.3, NBR 17225); decisões `docs/decisions/001`/`002` (heurística de cabeçalho causou regressão do Quadro 2 — ler antes de mudar tabelas).
2. **Traço duplo superior/inferior** — `ibgeTable` usa `BorderStyle.DOUBLE`; bordas laterais ausentes e `insideHorizontal` SINGLE.
3. **Paisagem para tabelas largas** — tabelas 6+ colunas / importadas de seção landscape / largura OOXML > 8504 twips viram SEÇÃO PAISAGEM própria (16838×11906) com numeração continuada; validada no PDF físico (página A4-paisagem 842×595).
4. **Preservação de embeds** — round-trip preserva 11/11 imagens (capa reconstruída pelo template, F-007 encerrado), 35/35 tabelas, 138/138 referências; `compare-preservation.ts` recomputa a cada rodada.
5. **Listas de ilustrações/tabelas** — `collectListItems` detecta legendas na ordem do texto; páginas pré-textuais com título centralizado/maiúsculas/negrito + PAGEREF (página à direita, recuo deslocante 0,5 cm).

## 6o. GATES POR TIPO, E2E E GOVERNANÇA
1. **Gate por tipo** — 15 tipos (4 padrão + 3 drafts editáveis + 8 formatos da Coleção) — 15/15 PASSED; física PDF por tipo (A4, paginação OOXML↔PDF, margem inferior limpa); `formatsCrossGate` 18 formatos × 20 requisitos.
2. **E2E Playwright 13 fluxos** — `tests/e2e/app-workflow.spec.ts` data-driven: 6 templates + 8 formatos da Coleção (patente, revisão sistemática, estudo de caso, software, cultivar, relatório de estágio, proposta de intervenção), cada um com requiredFields próprios; **axe no navegador real** (violações critical/serious = 0).
3. **Lighthouse** — a11y 100, performance 86, best-practices 92 (orçamentos a11y ≥90, perf ≥70, BP ≥80, SEO ≥80).
4. **CI** — `verify.yml` (Node 24 + lint + testes + build + ci-checks sem Word); `e2e.yml` (Playwright + Lighthouse); `pdf-regression.yml` (runner self-hosted com Word); `pdf-reference-refresh.yml` (workflow_dispatch + PAT_PDF_REFERENCE).
5. **Freshness anti-stale** — `sourceFingerprint` (sha256 de src/+scripts/+package.json) embutido em todos os artefatos; `checkArtifactFreshness` valida; suíte única (1× npm test por rodada, −25s); renders per-type paralelos (pool 3) + skip de re-render por digest (auditoria em ~135–146s).

## 6p. OUTROS FECHAMENTOS
1. **Referências online NBR 6023** — tipo `online` com 'Disponível em:' e **'Acesso em:' BLOQUEANTE** (reference-access-missing vira erro); assistência no editor anexa "Acesso em: d mmm. aaaa".
2. **Tipos de referência §25.14 ampliados** — patente, jornal, periódico, audiovisual, sonoro, partitura, iconográfico, cartográfico, tridimensional, dados de pesquisa, correspondência (50 testes).
3. **Notas de rodapé** — validação 24.1–24.3 (footnotes.xml, fonte menor espaço simples, Times); botão na UI insere `[^N]` + definição ao fim.
4. **Religação de referências cruzadas** — bookmarks/PAGEREF no round-trip: token `[x:ANCHOR~texto]` → `InternalHyperlink` + bookmark estável nos headings/legendas.
5. **Comentários/track changes** — alerta explícito no round-trip: marcações de revisão (w:ins/w:del) e comentários NÃO são reemitidos (texto incorporado).
6. **Snapshot de paginação p/ CI** — `snapshots/preview-docx-snapshot.json`: preview + digest determinístico do DOCX + referência PDF commitada; gates `previewDiffGate` (6 templates ≥0.963), `previewPdfReferenceGate`, `checkPdfReferenceGate`.
7. **Preservação de imagens em grupo** — figura composta com legenda compartilhada importada como grupo; imagens de apêndice preservadas.

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