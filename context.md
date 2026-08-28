---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Contexto do Projeto — Site_ABNT

> Manual de bordo para IA. Consulte SEMPRE antes de realizar qualquer alteração ou responder sobre o projeto.

---

## SUMÁRIO EXECUTIVO

Editor/normalizador acadêmico que exporta DOCX em **conformidade plena com o Manual de Normalização da UFLA (6ª ed.)** e ABNT vigente — diretiva principal (§8, regra 9). Página padrão: **A4** (outros tamanhos cancelados por ora — pendência opcional futura).

- **Números (27/08):** 228 arquivos, 1801 testes (10 skipped), lint 0/0, e2e 13/13, auditoria **13/13 gates**, `sourceFingerprint 5c8fd96d70a81f61`. Canônico: `docs/STATUS_ATUAL.md` (números); evidência: `artifacts/ufla-compliance/report.md`. (Rodada 16/08: 217 arquivos, 1731 testes, `a0eb33bd…` — histórico no git.)
- **Como ler (TOC):** §1 visão · §2 estrutura de diretórios · §3 tipos de trabalho · §4 regras UFLA/ABNT · §5 ferramenta de conformidade · §6 pendências + rodada atual (7a) · §7 comandos · §8 regras para a IA.
- **Histórico de rodadas:** arquivado (6a–6p e 6q–6w) — ler sob demanda em `docs/historico/contexto-rodadas/` (`contexto-6a-6p.md` e `contexto-6q-6w.md`).

---

## 1. VISÃO GERAL
- **Nome:** Site_ABNT
- **Objetivo:** Editor e normalizador de trabalhos acadêmicos que exporta documentos DOCX em conformidade estrita com o Manual de Normalização da UFLA (6ª edição) e normas ABNT vigentes.
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx`, Tiptap (editor rich-text), Vitest, KaTeX (equações no preview), Playwright (e2e), pdf.js (análise física de PDF), Word COM (renderização/PDF de referência).
- **Deploy:** Vercel (SPA)
- **Testes:** 212 arquivos, 1699 testes (10 skipped) — `npm run verify`, `npm test`, `npm run e2e` (Playwright 13 fluxos), `npm run ufla:audit` (13 gates). Estado completo: `docs/STATUS_ATUAL.md` (canônico).

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
Números e estado atual: `docs/STATUS_ATUAL.md` (canônico). Rodadas 6q–6w (16/08) também arquivadas em `docs/historico/contexto-rodadas/contexto-6q-6w.md`; rodada atual: 6x abaixo.

## 6x. CHECKLIST-14 100% CONCLUÍDO — B5–B7 + C8–C14 (16/08/2026)
Todas as 14 correções do `docs/historico/checklists/checklist-14-correcoes.md` implementadas, testadas e marcadas `[x]`. `npm test` **217 arquivos, 1731 testes (10 skipped)**, lint 0/0, `npm run e2e` **13/13**, auditoria **147s, 11/11 gates**, `sourceFingerprint a0eb33bd…`, FULL COMPLIANCE APROVADO. **32 testes novos** nesta rodada.

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

## 6y. CPG CONFORME AO TEMPLATE TEXTUAL — MARGEM 2,5 cm + LEGENDA HELVETICA 10 pt (27/08/2026)

Fechamento das correções da rodada CPG (resumo expandido/artigo completo) usando **as instruções textuais oficiais do CPG da UFLA** (`docs/Templates_CPG/`) como fonte primária para estas verificações — a extração Word COM dos `.doc` deixa de ser autoritativa nas divergências. `npm test` **228 arquivos, 1797 testes (10 skipped)**, lint 0/0, auditoria **13/13 gates**, `sourceFingerprint f891c194cd…`, FULL COMPLIANCE APROVADO (canônico: `docs/STATUS_ATUAL.md`).

1. **Margem inferior CPG 2,5 cm** — `CPG_RULES.margins` (`src/ufla-rules.ts`): `bottomCm 1.7 → 2.5` (`bottomTwip` 1418). Template §1: sup. 3,5 / **inf. 2,5** / lat. 3,0 cm, A4 coluna única, sem cabeçalhos/rodapés, números de página suprimidos.
2. **Legenda de figura/tabela = Helvetica 10 pt negrito** — template §4 (centralizada, recuada 0,8 cm, 6 pt antes/depois). `CPG_RULES.typography` ganhou `captionFontFamily: "Helvetica"` e `captionFontSizePt: 10`; `cpgCaptionParagraph` (`src/export-cpg-docx.ts`): `bold`, `size 20` (10 pt×2), Helvetica.
3. **Legenda de TABELA também no padrão CPG** — o caminho `tabbedTableBlock` (tabelas tabuladas, ex. "Tabela 1 …") usava a legenda UFLA (Times 12). `src/docx-render-core.ts` ganhou opção `captionRenderer` em `tabbedTableBlock` (sem mudança no default UFLA/artigo/research-project); CPG injeta `cpgCaptionParagraph`. Verificado em XML: `w:sz w:val="20"` + `w:rFonts ascii=Helvetica` + `<w:b/>` para figura E tabela.
4. **Checagem CPG permanente** — `scripts/cpg-compliance-check.mjs`: 2 novos checks `CAPTION_FONT_BOLD` e `CAPTION_CENTERED`; 5 DOCX de exemplo → **90/90 PASS** (margens bottom 1418 twips confirmadas).
5. **Extras da rodada (fase anterior 26/08)** — logo institucional nas capas (monografia/dissertação/tese/TCC/projeto-pesquisa): `logoParagraph` em `src/export-docx.ts` e `src/docx-shared.ts` agora emite imagem + texto "UNIVERSIDADE FEDERAL DE LAVRAS" (pdf.js não lê texto de imagem); bug A3 em `analyze-per-type-pdfs.ts` (`pageTwoNumbered` agora é a página física 2). CPG não usa logo (usuário confirmou).

---

## 6z. CPG — PRIMEIRA PÁGINA CORRIGIDA (AFILIAÇÃO ÚNICA + REFERÊNCIAS SEM DUPLICAÇÃO) (27/08/2026)

Correção do cabeçalho do DOCX CPG que saía "desconfigurado" quando a afiliação era repetida por autor (¹/²/³ com o mesmo texto) e as referências entravam tanto no campo quanto no editor. `npm test` **228 arquivos, 1797 testes (10 skipped)**, lint 0/0, auditoria **13/13 gates** (147s), `sourceFingerprint 4841352398a47e12`, FULL COMPLIANCE APROVADO (canônico: `docs/STATUS_ATUAL.md`).

1. **Unidade do template é "Departamento"** — instruções textuais/template CPG (`tmp/cpg-comparison/templates/`, Word COM): P003–P005 = `1Departamento de Ciência da Computação/ICET – Universidade Federal de Lavras (UFLA)`, `2Departamento de Agronomia/ESAL…`, `3Departamento de Zootecnia/FZMV…` (uma linha de afiliação por autor, centralizada, Times 12; e-mails Courier New 10). Quando o autor escreve "Instituto de Ciências Naturais/ICN" (ex. PPGECA), mantém-se o texto do autor — o que importa é não duplicar.
2. **Afiliação deduplicada** — `dedupeCpgAffiliations` (`src/cpg-content-filter.ts`): remove linhas repetidas de `fields.program` quando a identidade é idêntica após ignorar o marcador sobrescrito/numeral (`AFFILIATION_MARKER_PATTERN`, `affiliationIdentity`). Aplicado no exportador (`affiliationParagraphs`, `src/export-cpg-docx.ts`) e no preview (`cpgPreview`, `src/preview-html.ts`).
3. **Referências sem duplicação** — `splitCpgReferences` (`src/cpg-content-filter.ts`): se o editor contém a seção "Referências Bibliográficas" (título + parágrafos), remove-a do corpo e usa o título do editor; senão, mantém apenas blocos `type:"reference"`. Ambos os fluxos concatenam campo (`fields.referencias`) + editor e deduplicam (`dedupeReferences`, sorteio ABNT — `referenceParagraphs` em `src/export-cpg-docx.ts` recebe o título do editor).
4. **Preview alinhado ao exportador** — `cpgPreview` agora também passa por `stripCpgForbiddenSections` + `splitCpgReferences` + `dedupeCpgAffiliations` e preserva o campo referencias (corrigido um bug intermediário que omitia `fields.referencias` — o snapshot de paginação voltou a 2 páginas no resumo expandido).
5. **Raiz da duplicidade** — `src/field-detector.ts:1528` grava as linhas de afiliação repetidas do DOCX importado em `fields.program` (que outros fluxos usam como "Programa…"); no modo CPG `program` = linhas de afiliação e `course` = e-mails (rótulo já tratado). Validação end-to-end do repro `tmp/repro-cpg-header.mts` (3 autores/afiliações iguais + referência duplicada) → XML com 1 afiliação, 1 seção de referências e sem "Referências Bibliográficas" no corpo.

## 7a. CPG — VETTING DE 4 PONTOS DO USUÁRIO (27/08/2026)

Fechamento dos 4 apontamentos do usuário sobre o DOCX/preview CPG (cirílico: rodada 6z), com as instruções textuais/template CPG como fonte primária. `npm test` **228 arquivos, 1799 testes (10 skipped)**, lint 0/0, auditoria **13/13 gates** (149s), `sourceFingerprint 75f8fb47e8a283b8`, FULL COMPLIANCE APROVADO (canônico: `docs/STATUS_ATUAL.md`; check CPG `cpg-compliance-check.mjs` 90/90 PASS).

1. **Referências consecutivas MESCLADAS (lei + órgão + livro viram um item)** — causa em `isReferenceStartLine` (`src/references-normalizer.ts:158`): (a) autor institucional de palavra única fora da lista curta (`CAPES.`) falhava — regex de all-caps exigia `\s`; (b) autoria ABNT múltipla (`DARDOT, Pierre; LAVAL, Christian.`) falhava — regex de autor pessoal exigia período logo após o 1º autor. Corrigido: 1º regex aceita múltiplos autores `NOME, X; NOME, X.` (`(?:\s*;\s*…)*\.`) e novo regex `/^[A-ZÀ-Ú]{2,8}\.\s+\p{Lu}/u` cobre sigla institucional de palavra única. Teste de regressão em `tests/unit/references-normalizer.test.ts` (exemplo literal: `BRASIL. Lei nº 11.091…` + `CAPES. Relatório Quadrienal…` + `DARDOT, Pierre; LAVAL, Christian.…` → **3** referências, nenhuma mesclada).
2. **Referências CPG SEM negrito** (template P045–P049 = Times 12 plano; UFLA mantém título em negrito) — `referenceParagraphs` (`src/export-cpg-docx.ts:338`): `referenceRunToTextRun({ ...item, bold: false }, …)`; preview: `referencesHtml(references, { noBold: true })` no `cpgPreview` via novo parâmetro de `referencesHtml`/`referenceRunHtml` (`src/preview-html.ts`). Itálico do título preservado. Teste em `tests/export/export-docx.test.ts` (para `DARDOT` e `SILVA`: sem `<w:b/>` no parágrafo).
3. **E-mails do CPG = Courier New 10** (template P006; usuário confirmou manter) — DOCX já correto (`emailFontFamily`/`emailFontSizePt`); o **preview** estava Times 12: `cpgPreview` agora chama `centeredLine(fields.course, false, CPG_RULES.typography.emailFontSizePt, "preview-monospace")` e o CSS ganhou `.preview-centered.preview-monospace` (`src/preview-styles.css`). Afiliações do preview corrigidas de 11 pt → **12 pt** (template P003–P005 = Times 12), alinhando com o `BODY_SIZE_PT`.
4. **Fontes dos subtítulos 12 pt — só confirmação** — `sectionTitleFontSizePt: 13` / `subsectionTitleFontSizePt: 12` (`CPG_RULES`, `src/ufla-rules.ts`) já coincidem com o template (P021 seções 13 / P022–P023 subtítulos 12): **nenhuma mudança de código**.

## 7b. CPG — AFILIAÇÕES SEGUEM O ESPAÇAMENTO DO TEMPLATE POR TIPO (27/08/2026)

Apontamento do usuário sobre o espaçamento 1,5 nas afiliações CPG com a instrução de seguir o template. `npm test` **228 arquivos, 1801 testes (10 skipped)**, lint 0/0, auditoria **13/13 gates** (143s), `sourceFingerprint 5c8fd96d70a81f61`, FULL COMPLIANCE APROVADO (canônico: `docs/STATUS_ATUAL.md`; check CPG `cpg-compliance-check.mjs` **94/94 PASS**).

1. **Template oficial difere por tipo** — Resumo Simples P003–P007 = afiliações **1,5** (`wdLineSpace1pt5`); Resumo Expandido P003–P005 e Artigo Completo P003–P005 = afiliações **espaço simples** (`wdLineSpaceSingle`). O código forçava `BODY_LINE` (360) para todos.
2. **Correção** — `affiliationParagraphs` (`src/export-cpg-docx.ts:114`): `const affiliationLine = workType === "resumo_cpg" ? BODY_LINE : SINGLE_LINE;` (termo tipográfico: afiliação/filiação = "affiliation/departamento" no cabeçalho), aplicado nos 2 fluxos (resumo e completo).
3. **Preview alinhado** — `cpgPreview` (`src/preview-html.ts`) usa `preview-affiliation-1-5` (resumo simples) vs `preview-affiliation-single` (expansado/artigo); CSS novo em `src/preview-styles.css`.
4. **Check reforçado** — `scripts/cpg-compliance-check.mjs`: `AFFILIATION_1_5_SPACING` valida 360 nas afiliações centralizadas (resumo simples); novos `NO_1_5_SPACING_ANYWHERE` e `AFFILIATION_SINGLE_SPACING` (zero 360 + afiliações simples nos demais). 5 DOCX de exemplo → **94/94 PASS** (antes 90, +4 checks).
5. **Testes novos** — `tests/export/cpg-first-page.test.ts`: afiliação `w:line="240"` no resumo expandido e sem `w:line="360"`; afiliação `w:line="360"` no resumo simples.

---

## 7. COMANDOS ÚTEIS
```bash
npm run dev              # Inicia o servidor de desenvolvimento SPA
npm test                 # Executa testes unitários e de integração com Vitest
npm run build            # Executa o build de produção (tsc build + vite compile)
npm run verify           # Executa testes e build (validador oficial de PR)
npm run e2e              # Playwright 13 fluxos no navegador real (axe incluído)
npm run ufla:audit       # Auditoria completa UFLA (lint → typecheck → regenerate Word COM → gates; 13 gates)
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

