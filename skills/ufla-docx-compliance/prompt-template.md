# Ativação da Skill ufla-docx-compliance

Para validar um arquivo DOCX contra o Manual de Normalização da UFLA:

```
@ufla-docx-compliance validar [caminho-para-arquivo.docx]
```

Exemplo:
```
@ufla-docx-compliance validar teste-final.docx
```

A skill irá:
1. Analisar o DOCX (margens, fontes, espaçamentos, títulos, referências, tabelas, etc.)
2. Comparar cada item contra o CHECKLIST_SITE_UFLA_MANUAL.md
3. Gerar relatório em markdown com status (✅ ❌ ⚠️ 🔍)
4. Sugerir correções (código ou manual)

Parâmetros opcionais:
- `--report nome.md` — salva relatório em arquivo específico
- `--json` — saída em JSON
- `--verbose` — detalhamento completo
