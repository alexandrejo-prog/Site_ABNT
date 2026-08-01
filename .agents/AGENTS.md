# Diretrizes e Regras do Agente — Site_ABNT

Este arquivo contém as diretrizes e regras de comportamento para a inteligência artificial ao atuar no projeto **Site_ABNT**.

## 1. Idioma e Explicações
- **Idioma Principal:** Todas as explicações, comentários de plano de implementação, diálogos e documentações adicionais devem ser redigidos em **Português (Brasil)**.
- **Termos Técnicos:** Ao encontrar ou usar termos em inglês no código ou na arquitetura, explique-os brevemente em português no diálogo com o usuário, se relevante.

## 2. Convenções do Projeto
- **Tecnologias:** React 18, TypeScript 5, Vite, biblioteca `docx` (para exportação), editor `Tiptap` (rich-text) e `Vitest` para testes unitários/integração.
- **Estilização:** CSS Vanilla ou Tailwind (conforme convenções encontradas nos arquivos do projeto). Não introduzir bibliotecas de estilo adicionais sem autorização.
- **Componentes:** Manter os componentes do React pequenos, reutilizáveis e focados.
- **Exportadores:** Todos os exportadores DOCX devem permanecer no diretório `src/` (ex: `src/export-docx.ts`, `src/export-article-docx.ts`, etc.), não os movendo para subpastas a menos que haja uma refatoração explicitamente aprovada.

## 3. Prioridade e Conformidade Normativa
- Ao realizar modificações nos geradores de DOCX, a prioridade máxima é a conformidade normativa, seguindo rigorosamente a ordem de precedência:
  1. **Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA, 6ª edição** (2025).
  2. **Template oficial do formato padrão da UFLA** em Word.
  3. **Normas ABNT vigentes** (quando o Manual da UFLA for omisso ou remeter a elas), destacando:
     - **NBR 14724:2024** — Trabalhos acadêmicos
     - **NBR 6023:2020** — Referências
     - **NBR 10520:2023** — Citações
     - **NBR 15287:2025** — Projeto de pesquisa
     - **NBR 6028:2021** — Resumos
     - **NBR 6027:2012** — Sumário
     - **NBR 6024:2012** — Numeração progressiva
- **Sem improvisos:** Se o manual ou a ABNT exigirem uma formatação (ex: espaçamento simples em citações longas ou fontes em 11pt para legendas), ela deve ser implementada de forma exata. Se não houver regra de design explícita, consulte o template UFLA do Word ou siga o padrão clássico da ABNT.

## 4. Garantia de Compatibilidade com o Word
- Qualquer arquivo DOCX gerado pelo sistema **deve abrir sem mensagens de reparação** no Microsoft Word.
- O pipeline de aceitação oficial simula a abertura e conversão via Word usando `OpenAndRepair = false` e `Fields.Update()`. Se o Word falhar ao abrir ou exigir reparo, a alteração de código está incorreta.
- Sempre preserve relacionamentos XML (`document.xml.rels`), IDs de mídia, sumários (`TOC`), e campos `PAGEREF`.

## 5. Fluxo de Trabalho e Testes
- **Validação Local:** Antes de propor qualquer alteração, certifique-se de executar `npm run verify` (ou `npm test` e `npm run build`) para verificar a integridade estrutural e tipagem.
- **Validação de Conformidade:** Sempre execute o validador de conformidade UFLA do próprio projeto usando:
  ```bash
  npm run skill:validate -- <caminho-do-docx>
  ```
  Isso garante que os arquivos gerados estão de fato em conformidade antes do encerramento da tarefa.
