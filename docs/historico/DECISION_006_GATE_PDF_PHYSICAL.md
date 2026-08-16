# DECISION 006 — Físico PDF no fullComplianceGate

**Data:** 2026-08-14

## Decisão

Integrar analyze-pdf-physical.ts ao gate.ts para validar automaticamente:
- Overlaps de elementos
- Cutoffs de conteúdo
- Páginas em branco

## Execução

```bash
ts-node scripts/ufla-compliance/gate.ts \
  artifacts/ufla-compliance/normalized-dissertacao.docx \
  artifacts/ufla-compliance/dissertacao-rendered.pdf
```

## Status

FULL_COMPLIANCE_GATE: FAILED
  - Tabelas: issue #19
  - Equações: limitação documentada
