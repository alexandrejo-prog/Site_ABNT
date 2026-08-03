# ufla-docx-compliance

Skill de validação de arquivos DOCX contra o **Manual de Normalização da UFLA — 6ª edição**.

## Funcionalidades

- ✅ Analisa DOCX: margens, fontes, espaçamentos, títulos, tabelas, referências, sumário, paginação
- ✅ Compara cada item contra o `CHECKLIST_SITE_UFLA_MANUAL.md`
- ✅ É **ciente do tipo de trabalho**: itens estruturalmente inaplicáveis (ex.: sumário e capa UFLA em artigo/CPG) são marcados como *não verificado* em vez de *falha*
- ✅ Gera relatório markdown com status (✅ ❌ ⚠️ 🔍)
- ✅ Sugere correções no código ou passos manuais para o Word
- ✅ Ativável por chat (`@ufla-docx-compliance`) ou por CLI

## Como usar

### Via chat (ativando a skill)

```
@ufla-docx-compliance validar teste-final.docx
```

### Via CLI

```bash
npx tsx skills/ufla-docx-compliance/src/index.ts teste-final.docx
```

### Com opções

```bash
# Relatório JSON
npx tsx skills/ufla-docx-compliance/src/index.ts teste-final.docx --json

# Salvar relatório em arquivo
npx tsx skills/ufla-docx-compliance/src/index.ts teste-final.docx --report=relatorio.md

# Modo verbose com sugestões
npx tsx skills/ufla-docx-compliance/src/index.ts teste-final.docx --verbose

# Combinado
npx tsx skills/ufla-docx-compliance/src/index.ts teste-final.docx --report=relatorio.md --verbose

# Tipo de trabalho (permite classificar itens estruturais como não verificados)
# Valores: dissertacao | tese | monografia (=tcc) | artigo | resumo_cpg | resumo_expandido_cpg | artigo_completo_cpg | projeto_pesquisa
npx tsx skills/ufla-docx-compliance/src/index.ts tmp/scope-docs/artigo-full.docx --type=artigo --report=relatorio.md
```

### Via npm script

```bash
npm run skill:validate -- teste-final.docx
npm run skill:validate -- teste-final.docx --json
npm run skill:validate -- teste-final.docx --report=relatorio.md
```

## Arquivos

```
skills/ufla-docx-compliance/
├── src/
│   ├── index.ts             # Ponto de entrada (CLI + API)
│   ├── types.ts             # Tipos compartilhados
│   ├── docx-analyzer.ts     # Análise do DOCX (XML)
│   ├── checklist-checker.ts # Verificação contra checklist
│   ├── report-generator.ts  # Geração de relatório markdown
│   ├── fix-suggester.ts     # Sugestões de correção
│   └── skill-activator.ts   # Ativação via chat
├── tests/
│   └── ufla-docx-compliance.test.ts
├── skill-config.json        # Configuração da skill
├── prompt-template.md       # Template de ativação
└── README.md
```

## Estrutura dos relatórios

O relatório markdown inclui:

1. **Resumo** — contagem de OK / Não conforme / Parcial / Não verificado
2. **Pendências por gravidade** — GRAVE / MÉDIO / BAIXO
3. **Detalhamento por seção** — tabela com status, item, severidade, local
4. **Sugestões de correção** — arquivo, linha, snippet de código ou passos manuais
5. **Propriedades do documento** — margens, fonte, parágrafos, tabelas, referências

## Testes

```bash
npx vitest run skills/ufla-docx-compliance/tests/ --environment node
```
