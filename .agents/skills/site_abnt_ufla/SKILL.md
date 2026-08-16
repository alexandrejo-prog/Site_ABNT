---
name: site_abnt_ufla
description: Instruções do projeto Site_ABNT (abrangente). Fonte narrativa: context.md; status: docs/STATUS_ATUAL.md.
---

# SKILL: site_abnt_ufla — Visão Geral do Projeto

Instruções abrangentes do projeto. **Fonte única de narrativa:**

- **Manual de bordo (SEMPRE ler):** `context.md` — estrutura, regras, pendências,
  rodadas recentes (seções 6q–6w), comandos; histórico 6a–6p arquivado em
  `docs/historico/contexto-rodadas/contexto-6a-6p.md`.
- **Status canônico:** `docs/STATUS_ATUAL.md` (contagens/gates/números da rodada).
- **Mapa da documentação:** `docs/README.md` (o que ler por tarefa).

## Tipos de trabalho suportados

| Tipo | Exportador |
|---|---|
| Tese / Dissertação / TCC-Monografia | `src/export-docx.ts` |
| Artigo científico | `src/export-article-docx.ts` |
| Resumo expandido CPG / Artigo completo CPG | `src/export-cpg-docx.ts` |
| Projeto de pesquisa (NBR 15287) | `src/export-research-project-docx.ts` |
| 8 formatos da Coleção Produção Acadêmica | roteados para estrutura de artigo |

## Stack

React 18 + TypeScript 5 + Vite, lib `docx`, Tiptap, Vitest, KaTeX (preview),
Playwright (e2e), pdf.js (PDF físico), Word COM (renders de referência). Deploy Vercel SPA.

## Comandos rápidos

```bash
npm run dev         # dev server
npm test            # Vitest (1688 testes, 10 skipped)
npm run verify      # testes + build (gate oficial)
npm run e2e         # Playwright 13 fluxos + axe
npm run ufla:audit  # auditoria completa (11 gates, requer Word)
npm run skill:validate -- <docx> --type=<tipo>   # valida um DOCX
```

## Regra de ouro

Antes de criar/modificar geradores de documento, carregue `ufla_docx_rules`.
Nunca altere estilos sem confirmar no checklist normativo. Consultar `context.md`
sempre.