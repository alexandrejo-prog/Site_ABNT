---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Skill — site_abnt_ufla

Esta habilidade orienta o desenvolvimento e a manutenção do projeto **Site_ABNT**, um editor e normalizador de trabalhos acadêmicos projetado especificamente para atender aos padrões da UFLA e ABNT.

## 1. Escopo Funcional do Sistema
- **Entradas Aceitas:** DOCX, Markdown (.md) e Texto (.txt).
- **Entradas Rejeitadas:** PDF, ODT, RTF, HTML. Não é permitido restaurar ou converter esses formatos.
- **Saída:** Arquivo `.docx` gerado programaticamente via biblioteca `docx` em React/TypeScript, 100 % compatível com o Microsoft Word.

## 2. Fluxo Operacional
1. **Importação:** Leitura do arquivo (docx, md, txt) e conversão para o modelo de dados interno.  
2. **Edição Rich‑Text:** Interface do usuário (Tiptap) que permite visualizar e ajustar os dados.  
3. **Normalização:** Aplicação das regras do manual da UFLA e da ABNT.  
   - Quando o Manual da UFLA não definir uma regra, a skill `abnt_latest_rules` entra em vigor, garantindo conformidade com as normas ABNT mais recentes (NBR 14724:2024, NBR 6023:2020, NBR 10520:2023, etc.).  
4. **Exportação DOCX:** Geração do arquivo estruturado.  
5. **Auditoria automática:** O pipeline valida se o DOCX possui a estrutura de tags XML correta e abre no Word.

## 3. Diretrizes de Arquitetura e Código
- **Estabilidade:** Evite refatorações em larga escala ou a inclusão de dependências externas sem necessidade comprovada.  
- **Localização dos Exportadores:** Todos os scripts de geração DOCX permanecem no diretório `src/`:
  - `src/export-docx.ts` (Teses, Dissertações, TCCs / Monografias)  
  - `src/export-article-docx.ts` (Artigos Científicos)  
  - `src/export-cpg-docx.ts` (Resumos Expandidos CPG)  
  - `src/export-research-project-docx.ts` (Projetos de Pesquisa)  
  - `src/docx-render-core.ts` (Núcleo compartilhado de renderização)  
  - `src/docx-shared.ts` (Utilitários XML e run/paragraph do docx)  
  - `src/ufla-rules.ts` (Regras tipográficas básicas)  
- **Código Limpo:** Priorize funções puras, tipagem estrita com TypeScript e testes próximos da implementação.

## 4. Testes e Validação Obrigatória
Antes de finalizar qualquer modificação no código:
1. Execute os testes unitários com `npm test`.  
2. Certifique‑se de que o build compila sem erros com `npm run build`.  
3. Utilize a skill de compliance do próprio projeto para validar o DOCX gerado:  
   ```bash
   npm run skill:validate -- <caminho-do-arquivo.docx>
   ```  
4. Revise os relatórios gerados por essa ferramenta para garantir que a conformidade (OK/Não conforme) esteja 100 % verde para o tipo de trabalho manipulado.

## 5. Complementos de Conformidade ao Manual da UFLA
- **Campos condicionais:** O componente `MetadataFields.tsx` renderiza o campo **Coorientador** apenas quando preenchido.  
- **Título em Inglês:** Para teses e dissertações a folha de aprovação inclui o título em inglês, conforme a regra pendente da segunda fase.  
- **Data de aprovação e membros da banca:** Inseridos dinamicamente na folha de aprovação e validados pelo pipeline de conformidade.  
- **Escala automática de imagens:** Imagens que ultrapassem 10 cm de largura são redimensionadas automaticamente para caber nas margens (largura máxima ≈ 16 cm).  
- **Uso da skill `abnt_latest_rules`:** Sempre que o Manual da UFLA não definir uma regra, essa skill aplica as normas ABNT vigentes.  
- **Validação de conformidade:** O comando `npm run skill:validate` verifica que o DOCX gerado está 100 % verde em todos os itens marcados como `[x]` no checklist.

Base directory for this skill: C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\.agents\skills\site_abnt_ufla  
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.  
Note: file list is sampled.

<skill_files>

</skill_files>