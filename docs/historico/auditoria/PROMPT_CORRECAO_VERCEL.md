# PROMPT PARA FREEBUFF — CORRIGIR ERRO VERCEL

**Data:** 2026-08-14 16:40  
**Urgencia:** CRITICA  
**Erro:** Build Vercel falhando com 48 erros TypeScript

---

## PROBLEMA

Commits da FATIA 1 adicionaram infraestrutura de footnotes/equacoes mas **NAO criaram os arquivos**:

- `src/docx-styles.ts` ❌
- `src/footer-rules.ts` ❌
- `src/footer-reporting.ts` ❌
- `src/docx-heading-semantics.ts` ❌
- `src/hooks/useKeyboardShortcuts.ts` ❌
- `scripts/ufla-compliance/ooxml-checks.ts` ❌

**Funcoes faltando em `draft-storage.ts`:**
- `createNamedDraft`, `deleteNamedDraft`, `exportDraftAsJson`, etc.

**Tipos quebrados:**
- `DocxStructure` requer `footnotes` mas arquivos nao fornecem

---

## SOLUCAO RECOMENDADA

**Remover imports de footnotes/equacoes dos arquivos da FATIA 1:**

1. `export-cpg-docx.ts` — Remover `import { DOCUMENT_STYLES }`
2. `export-docx.ts` — Remover `equationParagraph`, `styles: DOCUMENT_STYLES`
3. `field-detector.ts` — Remover `footnotes` de `DocxStructure`
4. `import-normalizer.ts` — Remover `footnotes`
5. `draft-storage.ts` — Exportar funcoes faltando

---

## ACAO

1. Remover imports
2. Commit: `fix(vercel): remove footnotes/equations imports da FATIA 1`
3. Push e validar Vercel

---

**BOM TRABALHO! 🚀**
