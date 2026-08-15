# CHECKLIST — Conformidade UFLA Integral

> Base: Manual de Normalização da UFLA (6ª ed., 2025) + ABNT vigentes
> Status: Em andamento — correções iniciadas em 2026-08-14

---

## HIGH — Bloqueadores de conformidade verdadeira

| # | Pendência | Arquivo(s) | Status | Observação |
|---|-----------|------------|--------|------------|
| 1 | `validateDocumentStructure()` — validar sequência pré-textual → textual → pós-textual por tipo de trabalho | `src/validators.ts`, `src/ufla-rules.ts` | ⬜ | Comparar bloco-a-blocos contra `getWorkTypeRequirements()` |
| 2 | `validatePageLayout()` — margens 3/3/2/2 cm + A4 11906×16838 twips | `src/validators.ts` | ⬜ | Ler `<w:pgSz>` e `<w:pgMar>` do DOCX gerado |
| 3 | `validateTypography()` — Times New Roman, 12/11/10 pt, espaçamento, recuo 1,25 cm | `src/validators.ts` | ⬜ | Percorrer `w:rPr`/`w:pPr` e comparar com constantes UFLA |
| 4 | Preview de equações UFLA-023 — `[EQ]` centralizado, itálico, tab stop direito | `src/preview-html.ts`, `src/preview-styles.css` | ⬜ | Adicionar `case "equation"` e `.preview-equation` |
| 5 | Validador UFLA-023 no compliance checker — OMML, centralização, tab stop | `skills/ufla-docx-compliance/src/checklist-checker.ts` | ⬜ | Item `3.2.8` em `checkCompliance()` |

---

## MEDIUM — Fidelidade, round-trip e acessibilidade

| # | Pendência | Arquivo(s) | Status | Observação |
|---|-----------|------------|--------|------------|
| 6 | Ficha catalográfica: sair de hardcoded `true` e detectar campos reais | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | ⬜ | Implementar detecção de ficha vs placeholder |
| 7 | Folha de rosto: validar natureza do trabalho, curso, orientador, título inglês | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | ⬜ | Análise de parágrafos por tipo de trabalho |
| 8 | TOC: validar campo `TOC \o "1-3" \h` real, não só presença de headings | `skills/ufla-docx-compliance/src/checklist-checker.ts` | ⬜ | Verificar `w:fldChar` begin/separate/end |
| 9 | Track changes/comments — extrair `<w:ins>`/`<w:del>` e `w:comment` | `src/word-structure-extractor.ts` | ⬜ | Surface como warnings no import |
| 10 | Bookmarks/cross-references — extrair `<w:bookmarkStart>`/`<w:bookmarkEnd>` | `src/word-structure-extractor.ts` | ⬜ | Preservar alvos de referências cruzadas |
| 11 | Merge vertical de células — propagar conteúdo de `vMerge-continue` | `src/word-structure-extractor.ts` | ⬜ | Herdar texto da célula `vMerge-restart` acima |
| 12 | Soft hyphens e hifenização — remover `\u00AD`/`\u200B` | `src/import-normalizer.ts` | ⬜ | `cleanText()` deve normalizar quebras de linha |
| 13 | Aspas inteligentes — normalizar `""`/`''`/`«»` para retas | `src/import-normalizer.ts` | ⬜ | `normalizeQuotes()` em `cleanText()` |
| 14 | Janela de busca de legenda ampliada — expandir `nearestText()` para documento completo | `src/import-docx.ts` | ⬜ | Usar OOXML `<w:caption>` quando disponível |
| 15 | Repair de títulos: suporte a 3+ linhas fragmentadas | `src/heading-fragment-repair.ts` | ⬜ | Loop iterativo ou sliding window |
| 16 | Preview: page-break antes de ABSTRACT condicional por tipo | `src/preview-html.ts`, `src/preview-styles.css` | ⬜ | Baseado em `getWorkTypeRequirements()` |
| 17 | Preview: simular header/página com número de página | `src/preview-html.ts` | ⬜ | Overlay de header para fidelidade |
| 18 | Acessibilidade: auditoria axe para PreviewModal | `tests/accessibility/preview-modal-a11y.test.tsx` | ⬜ | Focus trap, `role="dialog"`, `aria-modal`, Escape |

---

## LOW — Detalhes e edge cases

| # | Pendência | Arquivo(s) | Status | Observação |
|---|-----------|------------|--------|------------|
| 19 | Referências: validar ordem alfabética pt-BR no validator principal | `src/validators.ts` | ⬜ | Chamar `validateReferencesText()` |
| 20 | Preview CSS: consumir `data-font-size` via atributos de dados | `src/preview-styles.css` | ⬜ | `[data-font-size="11pt"] { font-size: 11pt; }` |
| 21 | Validação de `et al.` em itálico nas referências | `skills/ufla-docx-compliance/src/checklist-checker.ts` | ⬜ | Check em `reference runs` |
| 22 | Heading fragments: suporte a sufixos numéricos/letras (`1.1.A`, `A.1`) | `src/heading-fragment-repair.ts` | ⬜ | Regex mais abrangente |
| 23 | Normalizador: expandir strip de pontuação final de títulos (`:`, `...`) | `src/heading-fragment-repair.ts` | ⬜ | `[:.\-–—…]+$` |
| 24 | Import: distinguir `w:br` de `w:br w:type="page"` corretamente | `src/word-structure-extractor.ts` | ⬜ | Evitar line breaks artificiais |
| 25 | Compliance checker: ficha catalográfica com detecção real | `skills/ufla-docx-compliance/src/` | ⬜ | Depende do item 6 |

---

## Como usar este checklist

- ⬜ = pendente
- 🔄 = em andamento
- ✅ = concluído

Atualizar status após cada conclusão. Itens HIGH devem ser fechados primeiro para garantir conformidade mínima.
