# DECISION 003 — Regra de paginaÃ§Ã£o (UFLA-AMBIGUOUS-1)

**Data:** 2026-08-14  
**Branch:** `feat/ufla-render-validation`  
**Commit de referÃªncia:** `6b5c108fc754dd8eb10dd4b87e531a393afd0864`

## Contexto

O `fullComplianceGate` apontava `UFLA-AMBIGUOUS-1` como pendÃªncia: nÃ£o estava clara a regra de numeraÃ§Ã£o de pÃ¡ginas (contÃ©nua vs reinÃ©cio em 1).

## DecisÃ£o

Adotar a regra **contÃ©nua**, conforme prÃ¡tica comum em teses/dissertaÃ§Ãµes:

1. **PÃ¡ginas prÃ©-textuais** (capa, folha de rosto, ficha catalogrÃ¡fica, folha de aprovaÃ§Ã£o, dedicatÃ³ria, agradecimentos, epÃ©grafe, resumos, sumÃ¡rio, listas) **nÃ£o exibem nÃºmero visÃ©vel**, mas **sÃ£o contadas** na sequÃªncia.
2. **IntroduÃ§Ã£o** (ou primeiro capÃ©tulo textual) inicia a **paginaÃ§Ã£o visÃ©vel** com **nÃºmero 1** (ou n, se a contagem prÃ©via for mantida).
3. A numeraÃ§Ã£o segue **contÃ©nua** atÃ© o fim (referÃªncias, apÃªndices, anexos).

## ImplementaÃ§Ã£o no checker

O checker `pagination-start` deve validar:

- Se a primeira pÃ¡gina com nÃºmero visÃ©vel corresponde Ã  introduÃ§Ã£o/capÃ©tulo 1.
- Se a sequÃªncia numÃ©rica Ã  contÃ©nua a partir daÃ©.
- Se pÃ¡ginas prÃ©-textuais nÃ£o exibem nÃºmero visÃ©vel.

## CritÃ©rio de aceite

- `pagination-start` verde para documentos que seguem a regra acima.
- `fullComplianceGate` atualiza status de `UFLA-AMBIGUOUS-1` para **resolvido**.

## ReferÃªncias

- Manual UFLA (seÃ§Ã£o de paginaÃ§Ã£o).
- NBR 14724 (estrutura de trabalhos acadÃªmicos).

```
FULL_COMPLIANCE_GATE: FAILED (UFLA-AMBIGUOUS-1 pendente de validaÃ§Ã£o no checker)
```
