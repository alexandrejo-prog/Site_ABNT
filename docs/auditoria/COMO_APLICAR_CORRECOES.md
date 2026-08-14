# COMO APLICAR AS CORRECOES — FATIA 1 (TABELAS)

**Data:** 2026-08-14 16:20  
**Status:** DOCUMENTACAO COMPLETA, AGUARDANDO IMPLEMENTACAO

---

## RESUMO RAPIDO

**O que fazer:** Implementar `w:tblHeader` em todas as tabelas  
**Arquivos:** 3 arquivos fonte  
**Tempo estimado:** 1-2 horas  
**Meta:** 1472/0/10 testes

---

## PASSO 1: PULL DO GITHUB

```bash
cd C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA
git pull origin main
```

---

## PASSO 2: LER DOCUMENTACAO

```bash
start docs\auditoria\LEIA_ME_PRIMEIRO.md
start docs\auditoria\PATCH_W_TBLHEADER_COMPLETO.md
```

---

## PASSO 3: ABRIR ARQUIVOS NO VS CODE

```bash
code src/imported-tables.ts
code src/export-docx.ts
code src/docx-render-core.ts
```

---

## PASSO 4: APLICAR MODIFICACOES

### 4.1 src/imported-tables.ts

**Local:** ~linha 150-250

**ADICIONAR:**
```typescript
if (tableElement && tableElement.rows && tableElement.rows.length > 0) {
  const headerRowIndex = 0;
  
  if (!tableElement.properties) {
    tableElement.properties = {};
  }
  
  tableElement.properties.hasHeader = true;
  tableElement.properties.headerRowCount = 1;
  tableElement.properties.headerRowIndex = headerRowIndex;
  
  if (tableElement.rows[headerRowIndex]) {
    tableElement.rows[headerRowIndex].isHeader = true;
  }
}
```

### 4.2 src/export-docx.ts

**Local:** ~linha 800-1000

**MODIFICAR:**
```typescript
function generateWtbl(table: Table): string {
  const hasHeader = table.properties?.hasHeader ?? false;
  
  return `
    <w:tbl>
      <w:tblPr>
        ${hasHeader ? '<w:tblHeader/>' : ''}
      </w:tblPr>
    </w:tbl>
  `;
}
```

### 4.3 src/docx-render-core.ts

**Local:** ~linha 300-400

**MODIFICAR:**
```typescript
function renderTable(table: Table): string {
  const hasHeader = table.properties?.hasHeader ?? false;
  
  const tblPr = `
    <w:tblPr>
      ${hasHeader ? '<w:tblHeader/>' : ''}
    </w:tblPr>
  `;
  
  return `<w:tbl>${tblPr}</w:tbl>`;
}
```

---

## PASSO 5: RODAR TESTES

```bash
npm test
npm run lint
npm run build
```

**Meta:** 1472/0/10

---

## PASSO 6: VALIDAR NO WORD

- [ ] Word abriu sem reparo
- [ ] Tabelas com cabecalho repetido
- [ ] 0 overlaps, 0 cutoffs

---

**FULL_COMPLIANCE_GATE:** FAILED

**Gerado em:** 2026-08-14 16:20
