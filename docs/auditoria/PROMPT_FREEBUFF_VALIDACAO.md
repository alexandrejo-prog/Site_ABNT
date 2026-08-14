# PROMPT PARA FREEBUFF — VALIDACAO FATIA 1 (TABELAS)

**Data:** 2026-08-14 16:20  
**Fatia:** 1 (Tabelas + w:tblHeader)

---

## TAREFA

Validar localmente se `w:tblHeader` esta sendo gerado corretamente nas tabelas do DOCX.

---

## PASSOS

### 1. RODAR TESTES DE OOXML

```bash
cd C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT

npm test -- tests/ooxml/docx-ooxml-layout.test.ts --reporter=verbose
npm test -- tests/preservation/tables-preservation.test.ts --reporter=verbose
npm test -- tests/import/import-docx-tables.test.ts --reporter=verbose
```

### 2. GERAR DOCX DE TESTE

- Usar o site para gerar DOCX
- Ou usar script de teste

### 3. VALIDAR NO WORD

- [ ] Word abriu sem reparo
- [ ] Tabelas com cabecalho repetido
- [ ] 0 overlaps, 0 cutoffs

### 4. EXTRAIR OOXML (OPCIONAL)

```bash
# Extrair DOCX e verificar word/document.xml
# Procurar por: <w:tblHeader/>
```

### 5. VALIDAR COM FERRAMENTAS

```bash
npm test -- tests/ooxml/acceptance-docx-audit.test.ts --reporter=verbose
```

---

## CRITERIOS DE ACEITE

- [ ] Testes OOXML: 100% passando
- [ ] Word: Abre sem reparo
- [ ] Tabelas: Cabecalho repetido
- [ ] w:tblHeader: 35/35 tabelas

---

**SE TUDO OK:**
```bash
git add src/imported-tables.ts src/export-docx.ts src/docx-render-core.ts
git commit -m "feat(tables): implementa w:tblHeader em 35/35 tabelas"
git push origin main
```

---

**BOM TRABALHO! 🚀**
