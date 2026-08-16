---
name: ufla_docx_compliance
description: Validador automático de DOCX contra o Manual UFLA/ABNT (CLI skill:validate). Local: skills/ufla-docx-compliance.
---

# SKILL: ufla_docx_compliance — Validação Automática de DOCX

Ferramenta integrada em `skills/ufla-docx-compliance/` que lê um `.docx` gerado e o
avalia contra o checklist normativo (Manual UFLA + ABNT). **NÃO exigir revisão
manual** — os itens estruturalmente inaplicáveis por tipo viram `unchecked`.

## Como executar

```bash
npm run skill:validate -- <caminho-do-docx>
npm run skill:validate -- <docx> --type=artigo          # ciente do tipo de trabalho
npm run skill:validate -- <docx> --type=dissertacao     # (ou tese/tcc/monografia/...)
```

Tipos: `monografia|dissertacao|tese|artigo|resumo_cpg|resumo_expandido_cpg|artigo_completo_cpg|projeto_pesquisa`.

## Saída

- **JSON ou Markdown** com gravidade (GRAVE/MÉDIO/BAIXO) por item.
- Itens `unchecked` NÃO contam nas somas (ex.: capa/sumário não exigidos em artigo/CPG).
- Exportações que gerem erro de reparo no Word são **reprovadas** (validador de aceitação).

## Circuito de auditoria completa (gates)

- `npm run ufla:audit` — 11 gates (lint → typecheck:scripts → regenerate com Word COM
  + PDF físico → verify). Canônico: `artifacts/ufla-compliance/report.md`.
- `npm run ufla:pdfref` — gate de regressão PDF (requer Word; runner self-hosted).

## Caso de uso para a IA

Após alterar exportadores, gere um DOCX de teste e valide:
```bash
npm run verify
node scripts/generate-fixtures.mjs   # gera DOCX de teste (se preciso)
npm run skill:validate -- teste-final.docx --type=monografia
```
Se o item estiver `fail` e o tipo exigir, corrija o gerador; se for estruturalmente
inapropriado (ex.: capa em artigo), trate como `unchecked` derivado do tipo, não como bug.