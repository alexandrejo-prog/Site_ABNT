# CHECKLIST UFLA — CONFORMIDADE PLENA

> Base: Manual de Normalização da UFLA (6ª ed., 2025) + ABNT vigentes
> Objetivo: garantir que o DOCX gerado atende **plenamente** ao Manual, com
> validação automática, cobertura máxima e priorização clara.

---

## CRITICAL — Conformidade estrutural mínima obrigatória

Sem estes itens, o documento **não pode** ser considerado conforme.

| # | Item | Regra/Seção Manual UFLA | Status | Arquivo(s) | Notas |
|---|------|--------------------------|--------|------------|-------|
| 1 | Sequência pré-textual → textual → pós-textual correta por tipo de trabalho | §3.1 | ⬜ | `src/validators.ts`, `src/ufla-rules.ts` | Validar bloco-a-blocos contra `getWorkTypeRequirements()` |
| 2 | Capa com identificação UFLA, título, autor, natureza do trabalho, curso, programa, local e ano | §3.1.1 | ⬜ | `src/export-docx.ts`, `src/export-article-docx.ts`, `src/export-cpg-docx.ts`, `src/export-research-project-docx.ts` | Verificar presença e ordem |
| 3 | Folha de rosto com título, autor, orientador, coorientador (se houver), natureza, curso, programa, local e ano | §3.1.2 | ⬜ | `src/export-docx.ts` | Dissertação/tese/TCC |
| 4 | Ficha catalográfica completa (campos obrigatórios) | §3.1.3 | ⬜ | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | Sair de hardcoded `true`; detectar campos reais |
| 5 | Folha de aprovação com título, autor, natureza, curso, programa, orientador, coorientador (se houver), local, ano e assinaturas | §3.1.4 | ⬜ | `src/export-docx.ts` | Título em inglês e coorientador já implementados |
| 6 | Resumo (150–500 palavras) + palavras-chave em português | §3.1.5 | ⬜ | `src/validators.ts` | `resumo-word-count` já implementado |
| 7 | Abstract correspondente em inglês + keywords | §3.1.6 | ⬜ | `src/validators.ts` | Mesmas regras do resumo |
| 8 | Sumário com TOC real (PAGEREF atualizado pelo Word) | §3.1.7 | ⬜ | `src/export-docx.ts`, `src/export-article-docx.ts` | Verificar campo `TOC \o "1-3" \h` |
| 9 | Margens A4: superior 3 cm, esquerda 3 cm, inferior 2 cm, direita 2 cm | §3.1.8 | ⬜ | `src/validators.ts`, `src/docx-shared.ts` | Ler `<w:pgMar>` do DOCX gerado |
| 10 | Fonte Times New Roman, preta, 12 pt corpo geral, 11 pt citação longa/legendas/fontes, 10 pt paginação | §3.1.9 | ⬜ | `src/validators.ts`, `src/ufla-rules.ts` | Percorrer `w:rPr`/`w:pPr` |
| 11 | Espaçamento 1,5 no corpo de texto corrido; espaço simples em citações, notas, referências, resumo, abstract, legendas | §3.1.10 | ⬜ | `src/validators.ts`, `src/ufla-rules.ts` | Verificar `w:spacing`/`line` |
| 12 | Parágrafo comum justificado com recuo 1,25 cm na primeira linha | §3.1.11 | ⬜ | `src/validators.ts`, `src/ufla-rules.ts` | Verificar `w:ind firstLine` |
| 13 | Citação longa: recuo 4 cm da esquerda, sem aspas, 11 pt | §3.1.12 | ⬜ | `src/validators.ts`, `src/ufla-rules.ts` | Verificar `w:ind left` + tamanho |
| 14 | Referências: alinhadas à esquerda, ordem alfabética pt-BR, hanging indent 0,5 cm, espaço simples, título em negrito | §3.1.13 | ⬜ | `src/validators.ts`, `src/references-normalizer.ts` | `validateReferencesText()` já existe |
| 15 | Numeração de páginas a partir da folha de rosto, visível a partir da introdução | §3.2.7 | ⬜ | `scripts/ufla-compliance/validate-pagination.ts` | UFLA-AMBIGUOUS-1 resolvida; integração no gate |
| 16 | Rodapés: número de página em 10 pt, centralizado | §3.2.8 | ⬜ | `src/export-docx.ts`, `src/validators.ts` | FINDING-FOOTER-001..008 cobertos |
| 17 | Equações/fórmulas: centralizadas, itálico, numeração em algarismos arábicos entre parênteses alinhada à direita | §3.2.9 | ✅ | `src/export-docx.ts`, `src/docx-render-core.ts`, `src/validators.ts` | UFLA-023 implementada; OMML cru re-injetado (frações/raízes preservadas) |
| 18 | Ilustrações: legenda acima/abaixo, formato "Figura N – Descrição", numeração sequencial, fonte | §3.2.10 | ⬜ | `src/export-docx.ts`, `src/validators.ts` | |
| 19 | Tabelas/quadros: traço duplo superior/inferior, título acima, fonte abaixo, `w:tblHeader` quando houver cabeçalho | §3.2.11 | ✅ | `src/docx-shared.ts`, `src/fix-table-headers.ts` | `w:tblHeader` na primeira linha (trPr) garantido por patch pós-Packer |
| 20 | Títulos de seções: negrito, caixa alta para nível 1, numeração progressiva ABNT NBR 6024 | §3.2.12 | ⬜ | `src/validators.ts`, `src/heading-fragment-repair.ts` | |

---

## HIGH — Fidelidade, round-trip e acessibilidade

Itens que afetam preservação de conteúdo, acessibilidade ou fidelidade ao DOCX de origem.

| # | Item | Regra/Seção Manual UFLA | Status | Arquivo(s) | Notas |
|---|------|--------------------------|--------|------------|-------|
| 21 | `validateDocumentStructure()` — validação automática da sequência pré-textual → textual → pós-textual | §3.1 | ✅ | `scripts/ufla-compliance/validate-document-structure.ts` | Matriz REQ-001..020 por tipo; integrado ao gate (15/08) |
| 22 | `validatePageLayout()` — margens 3/3/2/2 cm + A4 11906×16838 twips | §3.1.8 | ✅ | `scripts/ufla-compliance/validate-page-layout.ts` | Lê `<w:pgSz>`/`<w:pgMar>`; usa `UFLA_RULES.page.widthTwip` |
| 23 | `validateTypography()` — Times New Roman, 12/11/10 pt, espaçamento, recuo 1,25 cm | §3.1.9 | ✅ | `scripts/ufla-compliance/validate-page-layout.ts` | Fonte, 12 pt, recuo 1,25 cm (567 twips via constantes) |
| 24 | Preview de equações UFLA-023 — `[EQ]` centralizado, itálico, tab stop direito | §3.2.9 | ⬜ | `src/preview-html.ts`, `src/preview-styles.css` | Adicionar `case "equation"` e `.preview-equation` |
| 25 | Validador UFLA-023 no compliance checker — OMML, centralização, tab stop | §3.2.9 | ⬜ | `skills/ufla-docx-compliance/src/checklist-checker.ts` | Item `3.2.8` em `checkCompliance()` |
| 26 | Ficha catalográfica: detecção real de campos (não hardcoded) | §3.1.3 | ⬜ | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | Implementar detecção de ficha vs placeholder |
| 27 | Folha de rosto: validar natureza do trabalho, curso, orientador, título inglês | §3.1.2 | ⬜ | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | Análise de parágrafos por tipo de trabalho |
| 28 | TOC: validar campo `TOC \o "1-3" \h` real, não só presença de headings | §3.1.7 | ⬜ | `skills/ufla-docx-compliance/src/checklist-checker.ts` | Verificar `w:fldChar` begin/separate/end |
| 29 | Track changes/comments — extrair `<w:ins>`/`<w:del>` e `w:comment` | Import | ✅ | `src/word-structure-extractor.ts` | changeKind/comentários propagados a runs, parágrafos e blocos; teste com DOCX real |
| 30 | Bookmarks/cross-references — extrair `<w:bookmarkStart>`/`<w:bookmarkEnd>` | Import | 🔄 | `src/word-structure-extractor.ts` | Extração ✅; preservação de alvos de referência cruzada pendente |
| 31 | Merge vertical de células — propagar conteúdo de `vMerge-continue` | Import | ✅ | `src/word-structure-extractor.ts` | cellMerges vMerge-restart/continue extraídos e testados |
| 32 | Soft hyphens e hifenização — remover `\u00AD`/`\u200B` | Import | ⬜ | `src/import-normalizer.ts` | `cleanText()` deve normalizar quebras de linha |
| 33 | Aspas inteligentes — normalizar `""`/`''`/`«»` para retas | Import | ⬜ | `src/import-normalizer.ts` | `normalizeQuotes()` em `cleanText()` |
| 34 | Janela de busca de legenda ampliada — expandir `nearestText()` para documento completo | Import | ⬜ | `src/import-docx.ts` | Usar OOXML `<w:caption>` quando disponível |
| 35 | Repair de títulos: suporte a 3+ linhas fragmentadas | Import | ⬜ | `src/heading-fragment-repair.ts` | Loop iterativo ou sliding window |
| 36 | Preview: page-break antes de ABSTRACT condicional por tipo | Preview | ⬜ | `src/preview-html.ts`, `src/preview-styles.css` | Baseado em `getWorkTypeRequirements()` |
| 37 | Preview: simular header/página com número de página | Preview | ⬜ | `src/preview-html.ts` | Overlay de header para fidelidade |
| 38 | Acessibilidade: auditoria axe para PreviewModal | Preview | ⬜ | `tests/accessibility/preview-modal-a11y.test.tsx` | Focus trap, `role="dialog"`, `aria-modal`, Escape |

---

## MEDIUM — Completude, validação semântica e experiência

Itens que melhoram a confiabilidade do validador e a experiência do usuário.

| # | Item | Regra/Seção Manual UFLA | Status | Arquivo(s) | Notas |
|---|------|--------------------------|--------|------------|-------|
| 39 | Validação de referências bibliográficas (ordem alfabética pt-BR, formato ABNT NBR 6023) | §3.1.13 | ⬜ | `src/validators.ts`, `skills/ufla-docx-compliance/src/checklist-checker.ts` | Chamar `validateReferencesText()` |
| 40 | Validação de citações em texto (autor-data-página, ABNT NBR 10520) | §4 | ⬜ | `src/validators.ts`, `skills/ufla-docx-compliance/src/checklist-checker.ts` | Verificar correspondência com referências |
| 41 | Validação de numeração progressiva (ABNT NBR 6024) | §3.2.12 | ⬜ | `src/validators.ts`, `src/heading-fragment-repair.ts` | Máximo 5 níveis |
| 42 | Validação de figuras e legendas (formato, numeração, fonte) | §3.2.10 | ⬜ | `src/validators.ts`, `src/import-docx.ts` | |
| 43 | Auditoria automática pré-textual (todos os elementos obrigatórios por tipo) | §3.1 | ✅ | `scripts/ufla-compliance/audit-pretextual.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 44 | Auditoria automática textual (introdução, desenvolvimento, conclusão) | §3.1 | ✅ | `scripts/ufla-compliance/audit-textual.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 45 | Auditoria automática pós-textual (referências, glossário, apêndices, anexos) | §3.1 | ✅ | `scripts/ufla-compliance/audit-posttextual.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 46 | Auditoria automática de referências (ABNT NBR 6023) | §3.1.13 | ✅ | `scripts/ufla-compliance/audit-references.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 47 | Auditoria automática de citações (ABNT NBR 10520) | §4 | ✅ | `scripts/ufla-compliance/audit-citations.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 48 | Auditoria automática de figuras e tabelas | §3.2.10, §3.2.11 | ✅ | `scripts/ufla-compliance/audit-figures.ts` | Implementado em 2026-08-15; tipos limpos em 15/08 |
| 49 | Auditoria automática de seções (numeração progressiva) | §3.2.12 | ✅ | `scripts/ufla-compliance/audit-sections.ts` | Inclui limite quinário (máx. 5 níveis) desde 15/08 |
| 50 | Relatório HTML unificado de auditoria | — | ✅ | `scripts/ufla-compliance/report.ts` | Refatorado 15/08: aceita Expanded/Unified sem lançar; cria diretório |
| 51 | Preview CSS: consumir `data-font-size` via atributos de dados | Preview | ⬜ | `src/preview-styles.css` | `[data-font-size="11pt"] { font-size: 11pt; }` |
| 52 | Validação de `et al.` em itálico nas referências | §3.1.13 | ⬜ | `skills/ufla-docx-compliance/src/checklist-checker.ts` | Check em `reference runs` |
| 53 | Heading fragments: suporte a sufixos numéricos/letras (`1.1.A`, `A.1`) | Import | ⬜ | `src/heading-fragment-repair.ts` | Regex mais abrangente |
| 54 | Normalizador: expandir strip de pontuação final de títulos (`:`, `...`) | Import | ⬜ | `src/heading-fragment-repair.ts` | `[:.\-–—…]+$` |
| 55 | Import: distinguir `w:br` de `w:br w:type="page"` corretamente | Import | ⬜ | `src/word-structure-extractor.ts` | Evitar line breaks artificiais |
| 56 | Compliance checker: ficha catalográfica com detecção real | §3.1.3 | ⬜ | `skills/ufla-docx-compliance/src/` | Depende do item 26 |

---

## LOW — Detalhes, edge cases e refinamentos

Itens de baixo impacto que não bloqueiam conformidade, mas melhoram robustez.

| # | Item | Regra/Seção Manual UFLA | Status | Arquivo(s) | Notas |
|---|------|--------------------------|--------|------------|-------|
| 57 | Referências: validar DOI/URL em referências eletrônicas | §3.1.13 | ⬜ | `src/validators.ts`, `scripts/ufla-compliance/audit-references.ts` | |
| 58 | Citações: validar até 3 autores explícitos; `et al.` para 4+ | §4 | ⬜ | `src/validators.ts`, `scripts/ufla-compliance/audit-citations.ts` | |
| 59 | Equações: alertar quando OMML nativo não puder ser recriado | §3.2.9 | ✅ | `src/export-docx.ts`, `src/import-docx.ts` | UFLA-023; OMML cru avançado re-injetado via token + patch pós-Packer (DECISION_008 implementada) |
| 60 | Tabelas de linha única: aceitar ausência de `w:tblHeader` sem falhar | §3.2.11 | ⬜ | `src/validators.ts`, `scripts/ufla-compliance/gate.ts` | DECISION-002 documentada |
| 61 | Apêndices/Anexos: validar separador explícito e numeração contínua | §3.1.14 | ⬜ | `src/validators.ts`, `src/export-docx.ts` | |
| 62 | Glossário: validar presença e formatação quando declarado | §3.1.15 | ⬜ | `src/validators.ts`, `src/export-docx.ts` | |
| 63 | Lista de abreviaturas/símbolos: validar presença e formatação | §3.1.16 | ⬜ | `src/validators.ts`, `src/export-docx.ts` | |
| 64 | Dedicatória/Agradecimentos/Epígrafe: validar opcionalidade e posição | §3.1.17 | ⬜ | `src/validators.ts` | |
| 65 | Errata: validar posição antes da dedicatória quando presente | §3.1.18 | ⬜ | `src/validators.ts`, `src/export-docx.ts` | |
| 66 | Indicadores de impacto: validar presença condicional por tipo | §3.1.19 | ⬜ | `src/validators.ts`, `src/export-docx.ts` | Obrigatório em dissertação/tese; opcional em TCC |
| 67 | Tipo de trabalho específico: Artigo científico não deve ter capa UFLA, folha de rosto, ficha catalográfica, sumário, paginação | §3.1 | ⬜ | `src/validators.ts`, `src/export-article-docx.ts` | |
| 68 | Tipo de trabalho específico: Resumo Expandido CPG não deve ter capa, folha de rosto, sumário, paginação, apêndices/anexos | §3.1 | ⬜ | `src/validators.ts`, `src/export-cpg-docx.ts` | |
| 69 | Tipo de trabalho específico: Projeto de pesquisa deve seguir ABNT NBR 15287:2025 | §3.1 | ⬜ | `src/validators.ts`, `src/export-research-project-docx.ts` | |
| 70 | `et al.` em itálico no corpo do texto (não só nas referências) | §4 | ⬜ | `src/docx-render-core.ts` | `applyEtAlItalic` já implementado |
| 71 | Nomes de programas PPG em caixa alta/negrito quando aplicável | §3.1.2 | ⬜ | `src/ufla-ppg-programs.ts`, `src/export-docx.ts` | |

---

## Como usar este checklist

- ⬜ = pendente
- 🔄 = em andamento
- ✅ = concluído

**Regra:** fechar primeiro todos os itens **CRITICAL**, depois **HIGH**, depois **MEDIUM** e finalmente **LOW**.

## Critério de conformidade plena

- Todos os itens **CRITICAL** fechados (✅)
- Nenhum item **HIGH** em estado de falha confirmada
- Score de conformidade ≥ 95%
- Todos os gates automáticos (`npm run verify`, `npm run skill:validate`, gates UFLA) verdes

## Arquivos de referência

- Manual: `MANUAL_DE_NORMALIZACAO_2024.md`, `MANUAL_NORMALIZACAO_2024.md`
- Decisões: `docs/decisions/001-*.md`, `002-*.md`, `003-*.md`
- Status: `docs/STATUS_ATUAL.md`
- Auditoria automática: `scripts/ufla-compliance/audit-*.ts`, `gate.ts`, `report.ts`
