# INSTRUCOES PARA IA — APLICAR CORRECOES W:TBLHEADER

**Data:** 2026-08-14 16:25  
**Autorizacao:** Recebida

---

## TAREFA

Implementar `w:tblHeader` em todas as tabelas.

---

## ARQUIVOS PARA MODIFICAR

### 1. src/imported-tables.ts

**ADICIONAR:**
```typescript
if (tableElement && tableElement.rows && tableElement.rows.length > 0) {
  const headerRowIndex = 0;
  
  if (!tableElement.properties) {
    tableElement.properties = {};
  }
  
  tableElement.properties.hasHeader = true;
  tableElement.properties.headerRowCount = 1;
  
  if (tableElement.rows[headerRowIndex]) {
    tableElement.rows[headerRowIndex].isHeader = true;
  }
}
```

### 2. src/export-docx.ts

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

### 3. src/docx-render-core.ts

**MODIFICAR:**
```typescript
function renderTable(table: Table): string {
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

---

## VALIDACAO

```bash
npm test
npm run lint
npm run build
```

**Meta:** 1472/0/10

---

**Commit:** 115a84d5662f4b01c18dc798a2c9d6944d9be644
