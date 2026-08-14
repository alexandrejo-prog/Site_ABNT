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
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx`, Tiptap (editor rich-text), Vitest.
- **Deploy:** Vercel (SPA)
- **Testes:** 122 arquivos de teste, 1033 testes (10 skipped), executados via `npm run verify` ou `npm test`.

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
│       └── ufla_docx_compliance/     # Validador automático de DOCX
│           └── SKILL.md
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
│   ├── ufla-rules.ts                 # Constantes de espaçamento e tamanho (regras UFLA)
│   └── app-constants.ts              # Constantes de interface e traduções
├── tests/                            # Suíte com mais de 120 arquivos de teste
├── skills/                           # Ferramentas auxiliares do projeto (fora .agents)
│   └── ufla-docx-compliance/         # CLI/API de validação automática de DOCX
│       └── SKILL.md
├── Regras/                           # PDFs do Manual da UFLA e guias de formatos específicos
├── CHECKLIST_SITE_UFLA_MANUAL.md     # Checklist técnico de conformidade
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
As pendências abaixo constam no [CHECKLIST_SITE_UFLA_MANUAL.md](file:///C:/Users\User/Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\CHECKLIST_SITE_UFLA_MANUAL.md):
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

## 7. COMANDOS ÚTEIS
```bash
npm run dev              # Inicia o servidor de desenvolvimento SPA
npm test                 # Executa testes unitários e de integração com Vitest
npm run build            # Executa o build de produção (tsc build + vite compile)
npm run verify           # Executa testes e build (validador oficial de PR)
npm run skill:validate   # Valida um DOCX; use --type para classificar itens estruturais: --type=artigo|resumo_cpg|projeto_pesquisa|...
```

---

## 8. REGRAS PARA A IA
1. **SEMPRE** consulte `[ufla-docx-rules/SKILL.md](file:///C:/Users/User/Desktop/Alexandre/Site_ABNT/.agents/skills/ufla-docx-rules/SKILL.md)` antes de criar ou modificar geradores de documentos.  
2. **NÃO** altere estilos sem confirmar conformidade no `CHECKLIST_SITE_UFLA_MANUAL.md`.  
3. **MANTENHA** este arquivo atualizado conforme novas pendências ou mudanças de escopo.  
4. **EXPLIQUE** termos técnicos em português nas interações com o usuário.