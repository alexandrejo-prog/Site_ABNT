
# Relatório de Conformidade — Normas UFLA 6ª ed. (Manuais de Normalização)

> **Data:** 29/07/2026
> **Status:** 987 testes passando, 0 falhas, 10 skipped
> **Fixture files:** `teste-final.docx`, `TEMPLATE_Manual - Formato padrão.docx` — ambos gerados pelo sistema

---

## Sumário Executivo por Tipo

| Tipo Documento | Status | Graves | Médios | Baixos | OK |
|---|---|---|---|---|---|
| Tese / Dissertação / TCC | ⚠️ Quase conforme | 1 | 1 | 1 | 23 |
| Artigo Científico | ⚠️ Quase conforme | 0 | 1 | 1 | 15 |
| CPG (Comitê) | ⚠️ Quase conforme | 1 | 1 | 1 | 18 |
| Projeto de Pesquisa | ❌ Não conforme | 1 | 3 | 2 | 17 |
| Componentes Compartilhados | ⚠️ Atenção | 2 bugs | 1 warning | 2 info | — |

---

## 1. TESES / DISSERTAÇÕES / TCC (`src/export-docx.ts`)

### Já corrigidos (itens que estavam quebrados e foram arrumados)
| Item | O que foi feito | Linha |
|---|---|---|
| heading1 alinhamento (seções primárias) | `CENTER` → `LEFT` | 1171 |
| heading3 negrito | `bold: false` → `bold: true` no estilo e no TextRun | 172, 1212 |
| numeração de página textual | `start: textualStartPage` → `start: 1` | 2125-2127 |
| ano em negrito na folha de rosto | `bold: false` → `bold: true` | 1749 |

### Pendências

| # | Severidade | Item | Manual UFLA | Local | Código atual | Esperado |
|---|---|---|---|---|---|---|
| T1 | 🔴 GRAVE | Recuo citação longa | §5.6 p.26: 4cm da margem esq. | L1227 | `1440` (1,25cm) | `cmToTwip(4)` (≈5670) |
| T2 | 🟡 MÉDIO | Legenda tabela/figura no topo | Todas as legendas 12pt | `styleCaption` | `size: 22` (11pt) | `size: 24` (12pt) |
| T3 | 🔵 BAIXO | Rótulo "Palavras-chave" / "Keywords" sem negrito | §5.2.3.5 | Função de montagem | `bold: false` | `bold: true` |

---

## 2. ARTIGO CIENTÍFICO (`src/export-article-docx.ts`)

### Já corrigidos
| Item | O que foi feito | Linha |
|---|---|---|
| Margem artigo (header/footer) | Adicionado `header` e `footer` no objeto de margem | 280-281 |

### Pendências

| # | Severidade | Item | Manual UFLA | Local | Código atual | Esperado |
|---|---|---|---|---|---|---|
| A1 | 🟡 MÉDIO | "Referências" em MAIÚSCULO | §8.1 | Geração título seção | `Referências` | `REFERÊNCIAS` |
| A2 | 🔵 BAIXO | Espaçamento título (linha simples vs 1,5) | §8.1.1 | Título do artigo | `SINGLE` | `1.5` (ou vice‑versa — confirmar) |

---

## 3. CPG / COMITÊ (`src/export-cpg-docx.ts`)

### Já corrigidos (commit `ddbfedf`)
- Recuo deslocante referências: `1078` → `284` (0,5cm)
- "REFERÊNCIAS" alinhamento `CENTER` → `LEFT`
- Margens: `1440` → `1980` (3cm→3,5cm esq, 2cm→2,5cm dir)

### Pendências

| # | Severidade | Item | Manual UFLA | Local | Código atual | Esperado |
|---|---|---|---|---|---|---|
| C1 | 🔴 GRAVE | Sumário gerado para CPG multi‑página | CPG não tem sumário | Geração de TOC | Inclui `TableOfContents` | Remover sumário |
| C2 | 🟡 MÉDIO | heading1 não uppercase no `sectionTitle` | §6.2.1 | Geração título seção | `capitalize` apenas | Forçar uppercase |
| C3 | 🔵 BAIXO | Legenda 10pt (esperado 11pt) | Especificação CPG | `styleCaption` | `size: 20` (10pt) | `size: 22` (11pt) |

---

## 4. PROJETO DE PESQUISA (`src/export-research-project-docx.ts`)

### Já corrigidos
| Item | O que foi feito | Linha |
|---|---|---|
| Numeração página textual | `start: PROJECT_TEXTUAL_START_PAGE` → `start: 1` | 430 |
| Ano negrito na folha de rosto | `bold: false` → `bold: true` | 120 |
| Recuo deslocante referências | `720` → `cmToTwip(0.5)` | 402 |

### Pendências

| # | Severidade | Item | Manual UFLA | Local | Código atual | Esperado |
|---|---|---|---|---|---|---|
| R1 | 🔴 GRAVE | Nome autor na capa não uppercase | §5.1 capa | Capa | Nome como fornecido | `toUpperCase()` |
| R2 | 🟡 MÉDIO | heading3 não negrito | §5.3.2 | L187 | Condicional exclui heading3 | Incluir heading3 no bold |
| R3 | 🟡 MÉDIO | Nome autor folha rosto não uppercase | §5.1 folha rosto | Folha rosto | Nome como fornecido | `toUpperCase()` |
| R4 | 🟡 MÉDIO | Subtítulo capa não uppercase | §5.1 | Capa | Subtítulo como fornecido | `toUpperCase()` |
| R5 | 🔵 BAIXO | Recuo natureza trabalho ~4cm (vs ~8cm) | §5.1 folha rosto | L160+ | `2880` (4cm) | `cmToTwip(7.5)` (~5760) |
| R6 | 🔵 BAIXO | Corpo resumo/abstract espaçamento 1,5 (vs simples) | §5.2.3.1 | Geração resumo | `1.5` | `SINGLE` |

---

## 5. COMPONENTES COMPARTILHADOS (`src/docx-shared.ts`, `src/ufla-rules.ts`)

### Pendências

| # | Severidade | Item | Arquivo | Descrição |
|---|---|---|---|---|
| S1 | 🔴 BUG | `cleanMojibakeText` substitui `à` com espaço comum | `ufla-rules.ts` | Usa `" "` (espaço comum) → usar `\u00A0` (NBSP) |
| S2 | 🔴 BUG | Faltam 8 mapeamentos mojibake maiúsculos | `ufla-rules.ts` | `À, Á, Â, Ã, É, Í, Ó, Ú` ausentes no `mojibakeMap` |
| S3 | 🟡 WARNING | `run()` não chama `cleanMojibakeText` | `docx-shared.ts` | Texto passa direto sem limpeza |
| S4 | 🟡 WARNING | `centered()` não chama `cleanMojibakeText` | `docx-shared.ts` | Texto passa direto sem limpeza |
| S5 | ℹ️ INFO | Duas funções `centeredParagraph`‑like com espaçamentos diferentes | `docx-shared.ts` / `export-docx.ts` | Uma usa `SINGLE`, outra `1.5` |
| S6 | ℹ️ INFO | `unnumberedTitle` privada em `export-docx.ts` vs compartilhada | `export-docx.ts:1740` | Versão privada usa `1.5`, versão compartilhada usa `SINGLE` |
| S7 | ℹ️ INFO | `pageNumberHeader` duplicado em 3 exporters | Múltiplos | Refatorar para `docx-shared.ts` |

---

## 6. Matriz de Conformidade Detalhada

Legenda: ✅ OK | ⚠️ Não conforme | ❌ GRAVE | — Não aplicável

| Requisito | Manual UFLA | Tese/Diss/TCC | Artigo | CPG | Proj. Pesq. |
|---|---|---|---|---|---|
| **Margens** | | | | | |
| Margem esquerda 3cm | §4.1 | ✅ | ✅ | ✅ | ✅ |
| Margem superior 3cm | §4.1 | ✅ | ✅ | ✅ | ✅ |
| Margem direita 2cm | §4.1 | ✅ | ✅ | ✅ | ✅ |
| Margem inferior 2cm | §4.1 | ✅ | ✅ | ✅ | ✅ |
| Recuo 1ª linha parágrafo 1,25cm | §5.3.1 | ✅ | ✅ | ✅ | ✅ |
| Recuo citação longa 4cm | §5.6 | ❌ **1,25cm** | — | — | — |
| **Fonte** | | | | | |
| Times New Roman 12pt corpo | §4.2 | ✅ | ✅ | ✅ | ✅ |
| Legenda tabela/figura 12pt | §5.9 | ⚠️ **11pt** | ⚠️ **11pt** | ⚠️ **11pt** | ⚠️ **11pt** |
| Citação longa 11pt | §5.6 | ✅ | — | — | — |
| Nota rodapé 10pt | §5.7 | ✅ | — | — | — |
| **Espaçamento** | | | | | |
| Texto 1,5 linhas | §5.3.1 | ✅ | ✅ | ✅ | ✅ |
| Citação longa simples | §5.6 | ✅ | — | — | — |
| Nota rodapé simples | §5.7 | ✅ | — | — | — |
| Referências simples | §8.1 | ✅ | ✅ | ✅ | ✅ |
| Entre parágrafos 0pt | §5.3.1 | ✅ | ✅ | ✅ | ✅ |
| **Numeração** | | | | | |
| Capa/rosto não contam | §5.1 | ✅ | — | ✅ | ✅ |
| Folha rosto pág. 1 | §5.1 | ✅ | — | ✅ | ✅ |
| Algarismos romanos pré‑textual | §5.2 | ✅ | — | ✅ | ✅ |
| Arábicos a partir 1ª textual | §5.2 | ✅ | — | ✅ | ✅ |
| **Elementos Pré‑textuais** | | | | | |
| Capa conforme | §5.1 | ✅ | ✅ | ✅ | ⚠️ **autor maiúsculo** |
| Folha de rosto conforme | §5.1 | ✅ | ✅ | ✅ | ⚠️ **autor maiúsculo** |
| Ficha catalográfica | §5.2.1 | ✅ | — | — | — |
| Errata | §5.2.2 | ✅ | — | — | — |
| Agradecimentos | §5.2.4 | ✅ | — | — | — |
| Epígrafe | §5.2.6 | ✅ | — | — | — |
| Resumo em português | §5.2.3.1 | ✅ | ✅ | ✅ | ⚠️ **espaçamento** |
| Abstract em inglês | §5.2.3.2 | ✅ | ✅ | ✅ | ⚠️ **espaçamento** |
| Palavras-chave negrito | §5.2.3.5 | ⚠️ **não bold** | ⚠️ **não bold** | ⚠️ **não bold** | ⚠️ **não bold** |
| Sumário automático | §5.2.7 | ✅ | — | ❌ **indevido** | — |
| Lista de ilustrações | §5.2.8 | ✅ | — | — | — |
| Lista de tabelas | §5.2.9 | ✅ | — | — | — |
| Lista de abreviaturas | §5.2.10 | ✅ | — | — | — |
| **Elementos Textuais** | | | | | |
| heading1 (seção primária) maiúsculo | §6.2.1 | ✅ | — | ⚠️ **não uppercase** | ⚠️ **não uppercase** |
| heading2 (seção secundária) | §6.2.2 | ✅ | — | ✅ | ✅ |
| heading3 (seção terciária) negrito | §6.2.3 | ✅ *(corrigido)* | — | ✅ | ❌ **não negrito** |
| **Elementos Pós‑textuais** | | | | | |
| REFERÊNCIAS título maiúsculo | §8.1 | ✅ | ⚠️ **não uppercase** | ✅ | ✅ |
| Recuo deslocante 0,5cm | §8.1 | ✅ | ✅ | ✅ | ✅ |
| Apêndices | §9.1 | ✅ | — | — | — |
| Anexos | §9.2 | ✅ | — | — | — |
| Glossário | §10 | ✅ | — | — | — |
| Índice remissivo | §11 | ✅ | — | — | — |
| **Componentes Compartilhados** | | | | | |
| Limpeza mojibake (8 maiúsculas) | — | ❌ **faltam 8** | ❌ **faltam 8** | ❌ **faltam 8** | ❌ **faltam 8** |
| NBSP no `à` mojibake | — | ❌ **espaço comum** | ❌ **espaço comum** | ❌ **espaço comum** | ❌ **espaço comum** |

---

## 7. Resumo das Correções Necessárias

### Prioridade ALTA (Graves — afetam a formatação visível)
| Item | Esforço | Exporters afetados | Complexidade |
|---|---|---|---|
| Recuo citação longa 4cm | 1 linha | 1 (Tese/Diss/TCC) | 🔵 Baixa |
| Sumário removido do CPG | ~5 linhas | 1 (CPG) | 🔵 Baixa |
| Nome autor uppercase capa/folha rosto | ~4 linhas | 1 (Proj. Pesq.) | 🔵 Baixa |
| Subtítulo capa uppercase | ~2 linhas | 1 (Proj. Pesq.) | 🔵 Baixa |

### Prioridade MÉDIA
| Item | Esforço | Exporters afetados | Complexidade |
|---|---|---|---|
| Legenda 11pt→12pt | 1 linha | 4 (todos) | 🔵 Baixa |
| Palavras-chave bold | ~2 linhas | 4 (todos) | 🔵 Baixa |
| heading3 bold no projeto pesquisa | 1 linha | 1 (Proj. Pesq.) | 🔵 Baixa |
| heading1 uppercase no CPG | 1 linha | 1 (CPG) | 🔵 Baixa |
| "Referências" uppercase no artigo | 1 linha | 1 (Artigo) | 🔵 Baixa |
| Resumo espaçamento simples | 1 linha | 1 (Proj. Pesq.) | 🔵 Baixa |

### Prioridade BAIXA (refatoração / bugs silenciosos)
| Item | Esforço | Complexidade |
|---|---|---|
| Adicionar 8 maiúsculas ao mojibakeMap | ~2 linhas | 🔵 Baixa |
| Trocar espaço comum por NBSP | 1 caractere | 🔵 Baixa |
| Unificar `centeredParagraph` duplicado | ~10 linhas | 🟡 Média |
| Extrair `pageNumberHeader` para shared | ~15 linhas | 🟡 Média |
| Chamar `cleanMojibakeText` em `run()` e `centered()` | ~2 linhas | 🔵 Baixa |

---

## 8. Conclusão

**Situação atual:** 987 testes passando, 0 falhas. As fixtures foram geradas a partir do próprio motor DOCX, e todos os testes de snapshot foram atualizados.

**Não conformidades remanescentes:** 6 graves, 8 médias, 5 baixas distribuídas entre os 5 módulos.

**Esforço total estimado:** ~2-3 horas de desenvolvimento + 1-2 horas para atualização de snapshots (assumindo ~10-12 fixtures precisando de regeneração).

**Risco:** Baixo. A maioria das correções são mudanças de constantes (tamanho fonte, recuo, booleanos). As únicas alterações de lógica são:
1. Remover sumário do CPG (condicional)
2. Adicionar uppercase em campos de nome/subtítulo
3. Adicionar mojibake faltantes
