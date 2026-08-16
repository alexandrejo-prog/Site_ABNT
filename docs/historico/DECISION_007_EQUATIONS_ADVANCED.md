# DECISION 007 — EquaÃ§Ãµes avanÃ§adas (fraÃ§Ãµes/raÃ©zes)

**Data:** 2026-08-14

## Contexto

EquaÃ§Ãµes bÃ¡sicas (UFLA-023) estÃ£o cobertas com OMML nativo (`m:oMath`, `m:r`, `m:t`).

EquaÃ§Ãµes avanÃ§adas (fraÃ§Ãµes `m:f`, raÃ©zes `m:rad`, matrizes `m:m`) estÃ£o sendo renderizadas como texto achatado.

## DecisÃ£o

**LimitaÃ§Ã£o documentada:** fraÃ§Ãµes/raÃ©zes ficam achatadas em `m:r/m:t` nesta fase.

**ImplementaÃ§Ã£o futura:** injeÃ§Ã£o de OMML cru de origem para preservar estrutura matemÃ¡tica completa.

## ImplementaÃ§Ã£o (futuro)

1. Extrair OMML cru do DOCX original (`<m:oMath>...</m:oMath>` completo)
2. Injetar no DOCX gerado sem simplificar para `m:r/m:t`
3. Preservar `m:f`, `m:rad`, `m:m`, `m:nary`, etc.

## CritÃ©rio de aceite

- EquaÃ§Ãµes bÃ¡sicas: OMML nativo (coberto)
- EquaÃ§Ãµes avanÃ§adas: OMML cru injetado (pendente)
- `fullComplianceGate`: FAILED atÃ© implementaÃ§Ã£o

## Status

```
FULL_COMPLIANCE_GATE: FAILED
  - EquaÃ§Ãµes avanÃ§adas: limitaÃ§Ã£o documentada
```
