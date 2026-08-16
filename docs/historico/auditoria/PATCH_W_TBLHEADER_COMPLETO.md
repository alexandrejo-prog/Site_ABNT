# PATCH COMPLETO: Implementacao de w:tblHeader

**Data:** 2026-08-14  
**Fatia:** 1  
**Prioridade:** MAXIMA

---

## ARQUIVO 1: src/imported-tables.ts

### Localizacao: Funcao de processamento de tabelas (~linha 150-250)

**ADICIONAR** ao processar cada tabela:

```typescript
// Ao identificar uma tabela importada, marcar primeira linha como cabecalho
if (tableElement && tableElement.rows && tableElement.rows.length > 0) {
  // Identificar linha de cabecalho (primeira linha por padrao)
  const headerRowIndex = 0;
  
  // Marcar tabela como tendo cabecalho
  if (!tableElement.properties) {
    tableElement.properties = {};
  }
  
  tableElement.properties.hasHeader = true;
  tableElement.properties.headerRowCount = 1;
  tableElement.properties.headerRowIndex = headerRowIndex;
  
  // Marcar linha especifica como cabecalho
  if (tableElement.rows[headerRowIndex]) {
    tableElement.rows[headerRowIndex].isHeader = true;
  }
}
```

---

## ARQUIVO 2: src/export-docx.ts

### Localizacao: Funcao de geracao de w:tbl (~linha 800-1000)

**MODIFICAR** a geracao de `w:tblPr` para incluir `w:tblHeader`:

```typescript
function generateWtbl(table: Table): string {
  const hasHeader = table.properties?.hasHeader ?? false;
  const headerRowCount = table.properties?.headerRowCount ?? 0;
  
  return `
    <w:tbl>
      <w:tblPr>
        ${hasHeader ? '<w:tblHeader/>' : ''}
        <w:tblW w:w="9350" w:type="dxa"/>
        <w:tblLook w:val="0820"/>
      </w:tblPr>
      
      ${table.rows.map((row, idx) => {
        const isHeader = idx < headerRowCount;
        return generateWtr(row, isHeader);
      }).join('')}
    </w:tbl>
  `;
}
```

---

## ARQUIVO 3: src/docx-render-core.ts

### Localizacao: Renderizador de tabelas (~linha 300-400)

**MODIFICAR** para renderizar w:tblHeader:

```typescript
function renderTable(table: Table): string {
  const hasHeader = table.properties?.hasHeader ?? false;
  const headerRowCount = table.properties?.headerRowCount ?? 0;
  
  const tblPr = `
    <w:tblPr>
      ${hasHeader ? '<w:tblHeader/>' : ''}
      <w:tblInd w:type="dxa" w:w="0"/>
      <w:tblCellMar>
        <w:top w:type="dxa" w:w="0"/>
        <w:right w:type="dxa" w:w="0"/>
        <w:bottom w:type="dxa" w:w="0"/>
        <w:left w:type="dxa" w:w="0"/>
      </w:tblCellMar>
    </w:tblPr>
  `;
  
  const rows = table.rows.map((row, idx) => {
    const isHeader = idx < headerRowCount;
    return renderRow(row, isHeader);
  }).join('');
  
  return `
    <w:tbl>
      ${tblPr}
      ${rows}
    </w:tbl>
  `;
}
```

---

## VALIDACAO

```bash
npm test -- tests/tables-preservation.test.ts
npm test
npm run build
```

**Meta:** 1472/0/10

---

**Commit:** 8d0a1ccbb4b324c7456da5046e916398fa36e151
