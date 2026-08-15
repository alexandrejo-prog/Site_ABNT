# CHECKLIST — Conformidade UFLA Integral

> Base: Manual de Normalização da UFLA (6ª ed., 2025) + ABNT vigentes
> Status: Em andamento — correções iniciadas em 2026-08-14

---

## HIGH — Bloqueadores de conformidade verdadeira

| # | Pendência | Arquivo(s) | Status | Observação |
|---|-----------|------------|--------|------------|
| 1 | `validateDocumentStructure()` — validar sequência pré-textual → textual → pós-textual por tipo de trabalho | `scripts/ufla-compliance/validate-document-structure.ts` | ✅ | Matriz REQ-001..020 por tipo; integrado ao gate (15/08) |
| 2 | `validatePageLayout()` — margens 3/3/2/2 cm + A4 11906×16838 twips | `scripts/ufla-compliance/validate-page-layout.ts` | ✅ | Lê `<w:pgSz>`/`<w:pgMar>`; usa `UFLA_RULES.page.widthTwip` |
| 3 | `validateTypography()` — Times New Roman, 12/11/10 pt, espaçamento, recuo 1,25 cm | `scripts/ufla-compliance/validate-page-layout.ts` | ✅ | Fonte, 12 pt, recuo 1,25 cm via constantes |
| 4 | Preview de equações UFLA-023 — `[EQ]` centralizado, itálico, tab stop direito | `src/preview-html.ts`, `src/preview-styles.css` | ✅ | `equationHtml` + `.preview-equation` já implementados |
| 5 | Validador UFLA-023 no compliance checker — OMML, centralização, tab stop | `skills/ufla-docx-compliance/src/checklist-checker.ts`, `scripts/ufla-compliance/ooxml-checks.ts` | ✅ | Item `equation-format` no OOXML checks; equações centralizadas com tab direito; OMML cru re-injetado no export |
| 5a | Equações avançadas (frações/raízes): OMML cru da origem preservado | `src/word-structure-extractor.ts`, `src/docx-render-core.ts`, `src/docx-toc-field-patch.ts` | ✅ | Token `\uF001OMML:base64\uF001` no rascunho; patch pós-Packer re-injeta `<m:oMathPara>` (round-trip testado) |
| 5b | Ficha catalográfica §6.1: texto colado OU imagem da ficha oficial | `src/ufla-rules.ts`, `src/export-docx.ts`, `src/components/MetadataFields.tsx` | ✅ | Campo `fichaCatalografica` + upload de imagem na UI; estilo `ufla_ficha_catalografica` |
| 5c | Cabeçalho repetido de tabelas `w:tblHeader` | `src/fix-table-headers.ts`, `src/docx-toc-field-patch.ts` | ✅ | Patch pós-Packer marca a primeira linha em `trPr` (Manual §23.3) |
| 5d | Validação de notas de rodapé §21 (fonte menor, espaço simples, TNR) | `skills/ufla-docx-compliance/src/checklist-checker.ts`, `docx-analyzer.ts` | ✅ | Itens 24.1–24.3; analisa `word/footnotes.xml` |

---

## MEDIUM — Fidelidade, round-trip e acessibilidade

| # | Pendência | Arquivo(s) | Status | Observação |
|---|-----------|------------|--------|------------|
| 6 | Ficha catalográfica: sair de hardcoded `true` e detectar campos reais | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | ⬜ | Implementar detecção de ficha vs placeholder |
| 7 | Folha de rosto: validar natureza do trabalho, curso, orientador, título inglês | `skills/ufla-docx-compliance/src/docx-analyzer.ts` | ⬜ | Análise de parágrafos por tipo de trabalho |
| 8 | TOC: validar campo `TOC \o "1-3" \h` real, não só presença de headings | `skills/ufla-docx-compliance/src/checklist-checker.ts` | ⬜ | Verificar `w:fldChar` begin/separate/end |
| 9 | Track changes/comments — extrair `<w:ins>`/`<w:del>` e `w:comment` | `src/word-structure-extractor.ts` | ✅ | changeKind/comentários propagados a runs, parágrafos e blocos; teste com DOCX real |
| 10 | Bookmarks/cross-references — extrair `<w:bookmarkStart>`/`<w:bookmarkEnd>` | `src/word-structure-extractor.ts` | 🔄 | Extração ✅; preservação de alvos de referência cruzada pendente |
| 11 | Merge vertical de células — propagar conteúdo de `vMerge-continue` | `src/word-structure-extractor.ts` | ✅ | cellMerges vMerge-restart/continue extraídos e testados |
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
| 25 | Compliance checker: ficha catalográfica com detecção real | `skills/ufla-docx-compliance/src/` | ✅ | `catalogCard.exists/hasPlaceholder` detectado no analisador; ficha gerada com texto/imagem do usuário |

---

## Como usar este checklist

- ⬜ = pendente
- 🔄 = em andamento
- ✅ = concluído

Atualizar status após cada conclusão. Itens HIGH devem ser fechados primeiro para garantir conformidade mínima.
