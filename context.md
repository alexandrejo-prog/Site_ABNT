---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Contexto do Projeto — Site_ABNT

> Manual de bordo para IA. Consulte SEMPRE antes de realizar qualquer alteração ou responder sobre o projeto.

---

## 1. VISÃO GERAL
- **Nome:** Site_ABNT
- **Objetivo:** Editor e normalizador de trabalhos acadêmicos que exporta documentos DOCX em conformidade estrita com o Manual de Normalização da UFLA (6ª edição) e normas ABNT vigentes.
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx`, Tiptap (editor rich-text), Vitest.
- **Deploy:** Vercel (SPA)
- **Testes:** 122 arquivos de teste, 1033 testes (10 skipped), executados via `npm run verify` ou `npm test`.

---

## 2. ESTRUTURA DE DIRETÓRIOS
```
Site_ABNT/
├── .agents/                          # Configurações do agente IA
│   ├── AGENTS.md                     # Regras gerais do agente (idioma, conduta)
│   └── skills/                       # Skills personalizadas do agente
│       ├── site_abnt_ufla/           # Instruções do projeto principal
│       │   ├── SKILL.md
│       ├── ufla_docx_rules/          # Regras globais de formatação UFLA/ABNT
│       │   ├── SKILL.md
│       ├── abnt_latest_rules/        # Regras das normas ABNT quando a UFLA for omissa
│       │   ├── SKILL.md
│       └── ufla_docx_compliance/     # Validador automático de DOCX
│           └── SKILL.md
├── src/                              # Código-fonte da aplicação React
│   ├── App.tsx                       # Componente principal da aplicação
│   ├── components/                   # Componentes React de UI
│   ├── services/                     # Serviços de importação e utilitários
│   ├── export-docx.ts                # Geração de Dissertação, Tese e TCC (Monografia)
│   ├── export-article-docx.ts        # Geração de Artigo científico
│   ├── export-cpg-docx.ts            # Geração de Resumo expandido CPG
│   ├── export-research-project-docx.ts # Geração de Projeto de pesquisa (NBR 15287)
│   ├── docx-render-core.ts           # Renderização e conversão markdown → DOCX runs
│   ├── docx-shared.ts                # Utilitários compartilhados de parágrafos/runs
│   ├── ufla-rules.ts                 # Constantes de espaçamento e tamanho (regras UFLA)
│   └── app-constants.ts              # Constantes de interface e traduções
├── tests/                            # Suíte com mais de 120 arquivos de teste
├── skills/                           # Ferramentas auxiliares do projeto (fora .agents)
│   └── ufla-docx-compliance/         # CLI/API de validação automática de DOCX
│       └── SKILL.md
├── Regras/                           # PDFs do Manual da UFLA e guias de formatos específicos
├── CHECKLIST_SITE_UFLA_MANUAL.md     # Checklist técnico de conformidade
├── PRD.md                            # Requisitos de Produto
├── SKILL.md                          # Instruções da IA na raiz do repositório
├── context.md                        # ← Este arquivo
└── TEMPLATE_Manual - Formato padrao.docx # Template oficial do Word fornecido pela UFLA
```

---

## 3. TIPOS DE TRABALHO SUPORTADOS
| Tipo de Trabalho | Exportador | Elementos Obrigatórios | Elementos Proibidos |
|---|---|---|---|
| **Tese** | [export-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, ficha catalográfica, folha aprovação, indicadores de impacto, resumo, abstract, sumário, referências | — |
| **Dissertação** | [export-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, ficha catalográfica, folha aprovação, indicadores de impacto, resumo, abstract, sumário, referências | — |
| **TCC/Monografia** | [export-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts) | Capa, folha de rosto, resumo, abstract, sumário, referências | Indicadores de impacto (opcional) |
| **Artigo Científico** | [export-article-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-article-docx.ts) | Título centralizado, autor centralizado, resumo, abstract, referências | Capa UFLA, folha de rosto, ficha catalográfica, indicadores de impacto, sumário |
| **Resumo Expandido CPG** | [export-cpg-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-cpg-docx.ts) | Título, autores, resumo, abstract, desenvolvimento, referências | Capa UFLA, folha de rosto, sumário, paginação, apêndices/anexos |
| **Projeto de Pesquisa** | [export-research-project-docx.ts](file:///C:/Users\User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-research-project-docx.ts) | Estrutura conforme ABNT NBR 15287:2025 | — |

---

## 4. REGRAS DA UFLA E DA ABNT
As constantes básicas de formatação estão definidas em [ufla-rules.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/ufla-rules.ts) e nos arquivos `.agents/skills/*/SKILL.md`.

**Princípios Importantes:**
- Margens: superior 3 cm, esquerda 3 cm, inferior 2 cm, direita 2 cm.  
- Tipografia: Times New Roman, preta (`#000000`). Tamanho 12 pt para texto geral, 11 pt para citação longa/legendas/fontes, 10 pt para paginação.  
- Espaçamento: 1,5 para corpo de texto corrido. Espaço simples para citações longas, notas, referências, resumo, abstract, legendas e fontes.  
- Parágrafo comum: Justificado com recuo de 1,25 cm na primeira linha.  
- Citação longa: Recuo de 4,0 cm da margem esquerda, sem aspas, tamanho 11 pt.  
- Referências: Alinhadas à esquerda, ordenadas em ordem alfabética (locale `pt-BR`), com recuo deslocante (*hanging indent*) de 0,5 cm, espaçamento simples, com título da obra em negrito.  
- **Omissões do Manual:** Quando o Manual UFLA for omisso, a ABNT mais recente (ex.: NBR 14724:2024, NBR 6023:2020) deve ser aplicada sem exceções.

---

## 5. FERRAMENTA DE CONFORMIDADE (`skills/ufla-docx-compliance`)
O repositório inclui um analisador automático que lê um arquivo `.docx` gerado e o avalia contra os critérios normativos do checklist.
- **Como executar (CLI):**  
  ```bash
  npm run skill:validate -- <caminho-do-docx>
  ```
- **Relatório:** JSON ou Markdown detalhando não conformidades (Erros Graves, Médios e Baixos).  
- **Validador de Aceitação:** Exportações que gerem erro de reparo no Word são reprovadas.

---

## 6. PENDÊNCIAS CONHECIDAS (Checklist UFLA/ABNT)
As pendências abaixo constam no [CHECKLIST_SITE_UFLA_MANUAL.md](file:///C:/Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\CHECKLIST_SITE_UFLA_MANUAL.md):
1. **Tabelas:** traço duplo superior/inferior (atualmente `SINGLE`).  
2. **Apêndices/Anexos:** ajustar quebra de seção para manutenção da numeração de páginas.  
3. **Folha de Aprovação:** título em inglês e campo de coorientador **[x]** (já implementado).  
4. **Referências com 4+ Autores:** itálico em “et al.” **[x]** (implementado).  
5. **Citação Direta Curta:** validação automática da estrutura autor‑data‑página **[x]** (validada).  
6. **Resumos:** validação da extensão (150‑500 palavras) **[x]** (validada).

---

## 6a. ÚLTIMAS CORREÇÕES (01/08/2026)
1. **SUMÁRIO estático do CPG removido** — `export-cpg-docx.ts` não gera mais SUMÁRIO em `resumo_expandido_cpg`/`artigo_completo_cpg` (CPG proíbe sumário; contexto do congresso). Removidos `cpgSummaryParagraphs` e a chamada em `cpgFullChildren`.
2. **Matriz por tipo de trabalho** — novo teste `tests/worktype-format-matrix.test.ts` (38 testes) valida por tipo: SUMÁRIO/TOC real, quebra de página antes de ABSTRACT, margens e autor real.
   - Monografia/Dissertação/Tese/Projeto: **SUMÁRIO com TOC real + quebra de página antes de ABSTRACT**.
   - Artigo/Resumo CPG/Resumo Expandido CPG/Artigo Completo CPG: **SEM SUMÁRIO; ABSTRACT na mesma página** (formato do congresso, por design).
3. Testes atualizados que esperavam SUMÁRIO no CPG: `tests/cpg-first-page.test.ts`, `tests/guardrails-pente-fino.test.ts`.
4. `npm run verify` 100% verde: 122 arquivos, 1033 testes (10 skipped), build OK.

---

## 7. COMANDOS ÚTEIS
```bash
npm run dev              # Inicia o servidor de desenvolvimento SPA
npm test                 # Executa testes unitários e de integração com Vitest
npm run build            # Executa o build de produção (tsc build + vite compile)
npm run verify           # Executa testes e build (validador oficial de PR)
npm run skill:validate   # Valida um arquivo DOCX gerado contra o checklist UFLA/ABNT
```

---

## 8. REGRAS PARA A IA
1. **SEMPRE** consulte `[ufla-docx-rules/SKILL.md](file:///C:/Users/User/Desktop/Alexandre/Site_ABNT/.agents/skills/ufla-docx-rules/SKILL.md)` antes de criar ou modificar geradores de documentos.  
2. **NÃO** altere estilos sem confirmar conformidade no `CHECKLIST_SITE_UFLA_MANUAL.md`.  
3. **MANTENHA** este arquivo atualizado conforme novas pendências ou mudanças de escopo.  
4. **EXPLIQUE** termos técnicos em português nas interações com o usuário.