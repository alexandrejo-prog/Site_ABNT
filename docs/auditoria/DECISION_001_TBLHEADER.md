# DECISION-001: Implementacao de w:tblHeader em Tabelas

**Data:** 2026-08-14  
**Status:** EM IMPLEMENTACAO  
**Fatia:** 1 (Prioridade Maxima)

---

## CONTEXTO

O DOCX gerado atualmente nao contem `w:tblHeader` nas tabelas, o que faz com que os cabecalhos nao se repitam em paginas subsequentes quando a tabela e longa. Isso viola o Manual de Normalizacao da UFLA 6a edicao e a especificacao ECMA-376 (OOXML).

---

## PROBLEMA

**Estado Atual:**
- 0/35 tabelas com `w:tblHeader`
- Quadro 2 perdido no round-trip (regressao em `tests/tables-preservation.test.ts`)
- Implementacao em andamento em `src/imported-tables.ts` com `headerRowIndex`

**Impacto:**
- Tabelas multi-pagina nao repetem cabecalho no Word
- Nao conformidade com Manual UFLA
- Nao conformidade com ECMA-376

---

## FONTES NORMATIVAS

### Manual UFLA 6a Edicao (Marco 2025)
- **Secao:** 3.1.2.1.8 (Tabelas)
- **Requisito:** Tabelas devem ter cabecalho repetido em paginas subsequentes

### ECMA-376 (OOXML)
- **Elemento:** `w:tblHeader`
- **Localizacao:** Dentro de `w:tblPr` (tabela properties)
- **Funcao:** Indicar qual(is) linha(s) sao cabecalho a repetir

---

## IMPLEMENTACAO

### Estrutura OOXML

```xml
<w:tbl>
  <w:tblPr>
    <w:tblHeader/>  <!-- Marca a tabela como tendo cabecalho repetido -->
  </w:tblPr>
  <w:tr>  <!-- Linha 1: Cabecalho -->
    <w:tc>...</w:tc>
  </w:tr>
  <w:tr>  <!-- Linha 2+: Corpo -->
    <w:tc>...</w:tc>
  </w:tr>
</w:tbl>
```

### Arquivos Modificados

1. **src/imported-tables.ts**
   - Adicionar `headerRowIndex` para identificar linha de cabecalho
   - Marcar tabela com `w:tblHeader` no OOXML

2. **src/export-docx.ts**
   - Incluir `w:tblHeader` em `w:tblPr` ao gerar tabelas
   - Garantir que primeira linha (ou linhas) sejam marcadas como cabecalho

3. **src/docx-render-core.ts**
   - Renderizar `w:tblHeader` corretamente no OOXML
   - Validar estrutura da tabela

4. **tests/tables-preservation.test.ts**
   - Adicionar teste especifico para `w:tblHeader`
   - Validar Quadro 2 no round-trip

---

## CRITERIOS DE ACEITE

- [ ] 35/35 tabelas com `w:tblHeader`
- [ ] Quadro 2 preservado no round-trip
- [ ] Suite verde: 1472/0/10
- [ ] Word abre DOCX sem reparo
- [ ] Cabecalhos se repetem em tabelas multi-pagina

---

## RISCOS

1. **Regressao de preservacao** — Quadro 2 pode se perder
   - **Mitigacao:** Teste especifico para Quadro 2

2. **Tabelas sem cabecalho claro** — Algumas tabelas podem nao ter cabecalho obvio
   - **Mitigacao:** Analisar caso a caso, usar primeira linha como padrao

3. **Compatibilidade com Word antigo** — Word 2010 ou anterior
   - **Mitigacao:** Testar em Word 2016, 2019, 365

---

## REFERENCIAS

- ECMA-376 Part 1: https://www.ecma-international.org/publications-and-standards/standards/ecma-376/
- Manual UFLA 6a edicao: https://bibliotecauniversitaria.ufla.br/servicos-biblioteca/manual-de-normalizacao
- w:tblHeader spec: https://docs.microsoft.com/en-us/office/open-xml/044c4c47-2e37-47bf-8581-8e80f422461f

---

## STATUS

- [ ] Implementado
- [ ] Testado
- [ ] Validado
- [ ] Documentado

---

**Proximo:** Aguardar implementacao e testes
