---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Site_ABNT_UFLA

## Objetivo

Você trabalha no projeto **Site_ABNT**, um sistema que permite a importação, edição, normalização e exportação de trabalhos acadêmicos (Teses, Dissertações, TCCs, Artigos, Resumos e Projetos de Pesquisa) em estrita conformidade com:

- **Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA (6ª edição, 2025)**
- **Normas ABNT vigentes** (quando o manual da UFLA for omisso ou delegar regras)

O projeto prioriza a estabilidade do código, a compatibilidade de abertura sem erros/reparações com o Microsoft Word, simplicidade de arquitetura e cobertura de testes automatizados.

---

## Prioridade e Coerência Normativa

Ao atualizar ou corrigir os exportadores DOCX, siga a seguinte precedência de regras:
1. **Manual da UFLA 6ª edição** (e os guias específicos presentes no diretório [Regras](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/Regras)).
2. **Template oficial do Word fornecido pela UFLA** ([TEMPLATE_Manual - Formato padrao.docx](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/TEMPLATE_Manual%20-%20Formato%20padrao.docx)).
3. **Normas ABNT vigentes** (especialmente NBR 14724:2024 para Trabalhos Acadêmicos, NBR 6023:2020 para Referências, NBR 10520:2023 para Citações, NBR 15287:2025 para Projetos de Pesquisa).

Se uma regra não constar no manual da UFLA, **aplique a norma ABNT mais recente**. Nunca improvise regras visuais sem amparo normativo.

---

## Escopo Técnico e Operacional

O Site_ABNT **não é um conversor de PDF**. 
- **Formatos de Entrada Aceitos:** DOCX, Markdown (.md) e Texto (.txt).
- **Formatos de Entrada Rejeitados:** PDF, ODT, RTF e HTML.
- **Saída Única:** DOCX nativo gerado com a biblioteca `docx` do npm.

### Princípios de Preservação Estrutural
Toda exportação de DOCX deve preservar:
- Estilo e hierarquia das seções (`Heading1`, `Heading2`, `Heading3`, etc.).
- Imagens com legendas no topo e fontes na parte inferior.
- Tabelas abertas (padrão IBGE) e quadros fechados.
- Referências ordenadas alfabeticamente, alinhadas à esquerda e com recuo deslocante (*hanging indent*).
- Notas de rodapé e citações longas recuadas a 4 cm com espaçamento simples e fonte 11pt.
- Sumário dinâmico utilizando o campo de código de campo `TOC` do Word.
- Numeração de páginas no canto superior direito usando o campo `PAGE` do Word, visível apenas a partir da Introdução, embora contada desde a folha de rosto.

---

## Arquitetura do Projeto

- **Localização dos Exportadores (no diretório `src/`):**
  - [export-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-docx.ts): Dissertação, Tese, TCC/Monografia.
  - [export-article-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-article-docx.ts): Artigo científico.
  - [export-cpg-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-cpg-docx.ts): Resumo expandido CPG.
  - [export-research-project-docx.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/export-research-project-docx.ts): Projeto de pesquisa (NBR 15287).
  - [docx-render-core.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/docx-render-core.ts): Núcleo compartilhado de renderização do DOCX.
  - [docx-shared.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/docx-shared.ts): Funções de bloco compartilhadas.
  - [ufla-rules.ts](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/src/ufla-rules.ts): Constantes e dimensões tipográficas da UFLA.
- **Validador de Conformidade (`skills/ufla-docx-compliance`):**
  - Uma ferramenta integrada de auditoria do DOCX contra o checklist normativo (Manual UFLA + ABNT); canônico de status: [docs/STATUS_ATUAL.md](../docs/STATUS_ATUAL.md).
  - Execute-a para validar as alterações nos exportadores.

---

## Fluxo de Desenvolvimento e Validação

1. **Ramificação (Branch):** Nunca altere a branch `main` diretamente. Crie sempre uma branch funcional (`feat/` ou `fix/`).
2. **Desenvolvimento:** Implemente somente o necessário para a regra acadêmica, evitando refatorações que afetem arquivos não relacionados.
3. **Validação e Build:** Antes de fazer commit, execute localmente:
   ```bash
   npm run verify
   ```
   Isso executa os testes do Vitest e valida o build de tipos TypeScript.
4. **Verificação de Compliance:** Valide o arquivo DOCX gerado de teste rodando a ferramenta de conformidade:
   ```bash
   npm run skill:validate -- <caminho-do-docx>
   ```
5. **Garantia Microsoft Word:** Todo DOCX produzido deve ser aberto perfeitamente pelo Microsoft Word sem exibir caixas de mensagem exigindo reparação (como `OpenAndRepair = true`). Se o Word precisar reparar o arquivo, a alteração estrutural no código é considerada inválida.

---

## Filosofia de Trabalho da IA

1. **Consultar Sempre:** Sempre leia o [context.md](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/context.md) e a skill [ufla-docx-rules](file:///C:/Users/User/Desktop/Alexandre/Site_Normas_UFLA/Site_ABNT/.agents/skills/ufla-docx-rules/SKILL.md) antes de propor mudanças de layout, tipografia ou espaçamentos.
2. **Idioma:** Todas as conversas, planos e explicações devem ser feitos em Português (Brasil).
3. **Preservar Testes:** Nunca remova testes existentes sem uma justificativa explícita e aprovação do usuário. Se as regras mudaram, adapte os testes correspondentes.