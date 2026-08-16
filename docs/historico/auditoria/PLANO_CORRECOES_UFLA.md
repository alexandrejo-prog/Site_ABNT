# PLANO DE CORRECOES — DOCX UFLA

**Data:** 2026-08-14  
**Status:** EM PROGRESSO  
**Autorizacao:** Recebida

---

## OBJETIVO

Fazer todas as correcoes necessarias para que o DOCX gerado atenda integralmente ao Manual de Normalizacao da UFLA 6a edicao (marco 2025).

---

## ESTADO ATUAL

### Repositorio
- **Local:** C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA
- **GitHub:** alexandrejo-prog/Site_ABNT
- **Branch:** main (6e78948)
- **Node.js:** 24.x (fixado em package.json)

### Testes
- **Total:** 1471 passed / 1 failed / 10 skipped
- **Falha:** tests/tables-preservation.test.ts (Quadro 2)
- **Lint:** 0 errors
- **Build:** OK

### Conformidade
- **FULL_COMPLIANCE_GATE:** FAILED
- **RENDERED_LAYOUT_GATE:** FAILED
- **Bloqueadores:** 8 criticos

---

## BLOQUEADORES CRITICOS

### 1. w:tblHeader em Tabelas (PRIORIDADE 1)
**Status:** 0/35 tabelas com w:tblHeader  
**Arquivos:** src/imported-tables.ts, src/export-docx.ts  
**Acao:** Implementar w:tblHeader em todas as tabelas

### 2. Equacoes OMML (PRIORIDADE 2)
**Status:** Equacoes como imagem/MathML  
**Arquivos:** src/export-docx.ts, src/docx-render-core.ts  
**Acao:** Implementar m:oMath (OMML)

### 3. UFLA-023 (PRIORIDADE 3)
**Status:** Parcial  
**Acao:** Especificar e implementar lacunas

### 4. UFLA-044 (PRIORIDADE 4)
**Status:** Nao conforme  
**Acao:** Especificar e implementar

### 5. Rodapes (PRIORIDADE 5)
**Status:** Findings pendentes  
**Arquivos:** src/export-docx.ts  
**Acao:** Corrigir findings

### 6. Paginacao (PRIORIDADE 6)
**Status:** Ambiguidade  
**Arquivos:** src/docx-toc-field-patch.ts  
**Acao:** Resolver ambiguidade

### 7. Analisador Fisico (PRIORIDADE 7)
**Status:** Cobertura incompleta  
**Arquivos:** tests/ooxml.ts  
**Acao:** Expandir cobertura

### 8. Acessibilidade NBR 17225 (PRIORIDADE 8)
**Status:** Lacunas  
**Arquivos:** src/accessibility-checklist.ts  
**Acao:** Mapear e corrigir

---

## PLANO DE ACAO

### FATIA 1: Tabelas + w:tblHeader
1. Corrigir regressao do Quadro 2
2. Implementar w:tblHeader em 35/35 tabelas
3. Validar preservacao
4. Suite verde: 1472/0/10

### FATIA 2: Equacoes OMML
1. Investigar exigencia do Manual
2. Implementar m:oMath
3. Validar edicao no Word
4. Testar acessibilidade

### FATIA 3: UFLA-023
1. Especificar lacunas
2. Implementar
3. Validar

### FATIA 4: UFLA-044
1. Especificar lacunas
2. Implementar
3. Validar

### FATIA 5: Rodapes
1. Listar findings
2. Corrigir
3. Validar

### FATIA 6: Paginacao
1. Resolver ambiguidade
2. Validar PAGEREF

### FATIA 7: Analisador Fisico
1. Expandir cobertura
2. Documentar

### FATIA 8: Acessibilidade
1. Mapear lacunas NBR 17225
2. Implementar
3. Validar com leitor de tela

---

## ENTREGAVEIS

1. **Codigo corrigido** — Todas as 8 fatias
2. **Testes verdes** — 1472+/0/10
3. **DOCX conforme** — Atende Manual UFLA
4. **Evidencias** — DOCX, PDF, OOXML, relatorios
5. **Documentacao** — Atualizada

---

## PROXIMOS PASSOS

1. **Imediato:** FATIA 1 (Tabelas)
2. **Curto prazo:** FATIA 2-4 (Equacoes, UFLA-023/044)
3. **Medio prazo:** FATIA 5-8 (Rodapes, Paginacao, Analisador, A11y)

---

**FULL_COMPLIANCE_GATE:** FAILED (ate conclusao)

**Gerado em:** 2026-08-14
**Commit:** 6e78948718791ba6f3a522ec5d72d47fa630f59a
