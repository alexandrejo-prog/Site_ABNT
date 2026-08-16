# Issue #19 — Tabelas sem w:tblHeader

**Status**: ❌ FAILED (10/35 tabelas)
**Prioridade**: 🚨 CRÃ·TICA (Regra Principal UFLA/ABNT)

## Problema

10 tabelas no documento nÃ£o possuem cabeÃ§alho repetido (w:tblHeader), o que:
- Viola conformidade ABNT/UFLA
- Prejudica acessibilidade
- Quebra semÃ¢ntica de tabelas longas

## Como corrigir no Word

### Passo a passo

1. **Abrir o documento** dissertacao.docx no Word

2. **Identificar tabelas sem header**:
   - Tabelas que se estendem por mÃºltiplas pÃ¡ginas
   - Tabelas sem primeira linha repetida no topo

3. **Adicionar cabeÃ§alho**:
   - Selecionar a **primeira linha** da tabela
   - Clique direito → Propriedades da Tabela
   - Tab **Linha**
   - Marcar ✅ "Repetir como linha de cabeÃ§alho nas pÃ¡ginas superiores"
   - OK

4. **Repetir** para as 10 tabelas afetadas

5. **Salvar** o documento

### ValidaÃ§Ã£o pÃ³s-correÃ§Ã£o

```bash
# Re-executar gate
./scripts/run-gate.sh
```

**Resultado esperado**:
```
w:tblHeader (tabelas): PASSED
```

## ReferÃªncias

- DECISION_002: Tabelas sem header
- ABNT NBR 14724:2011
- Manual UFLA — SeÃ§Ã£o de Tabelas
