---
name: ufla_docx_rules
description: Guia de regras do Manual de Normalização da UFLA (6ª ed.) e ABNT aplicáveis ao Site_ABNT.
---

# Regras Normativas de Geração — UFLA & ABNT

Esta habilidade consolida os requisitos normativos do **Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA (6ª ed., 2025)** e das **Normas ABNT mais recentes** (quando o manual for omisso) para guiar o desenvolvimento do gerador de DOCX.

## 1. Regra de Precedência Normativa
Sempre que houver conflitos de estilização, siga a seguinte prioridade:
1. **Manual da UFLA 6ª edição** (e seus guias de tipos específicos).
2. **Template oficial do Word fornecido pela UFLA**.
3. **ABNT mais recentes** (nas omissões ou quando a regra do manual remeter diretamente a elas).

---

## 2. Configurações Globais do Documento
- **Formato da Página:** A4 (21,0 × 29,7 cm) -> `width: 11906 twip`, `height: 16838 twip`.
- **Margens:**
  - Superior: 3,0 cm (`1701 twip`)
  - Esquerda: 3,0 cm (`1701 twip`)
  - Inferior: 2,0 cm (`1134 twip`)
  - Direita: 2,0 cm (`1134 twip`)
- **Tipografia:**
  - Fonte principal: **Times New Roman** (ou similar serifada como Liberation Serif, DejaVu Serif).
  - Cor: **Exclusivamente preta** (`#000000`) para todo texto acadêmico e títulos. Proibido o uso de azul (exceto links hyper-ativos em azul, se configurado pelo usuário).
  - Tamanho da fonte:
    - **12pt:** Texto comum, títulos de seções primárias/secundárias, sumário, legendas de figuras e tabelas.
    - **11pt:** Citações longas (mais de 3 linhas), fontes de figuras/tabelas, notas descritivas (natureza do trabalho na folha de rosto e de aprovação).
    - **10pt:** Paginação (cabeçalho).
- **Espaçamento e Parágrafos:**
  - Espaçamento de **1,5** (360 twip) para todo o texto corrido e títulos de seções.
  - Espaçamento **simples** (240 twip) para: citações longas, referências, natureza do trabalho, resumos, tabelas, quadros, legendas e fontes.
  - Sem espaçamento antes ou depois entre parágrafos (configurar `before: 0` e `after: 0` nos estilos acadêmicos).
  - Alinhamento: **Justificado** para o corpo do texto acadêmico.
  - Recuo de primeira linha: **1,25 cm** (`709 twip`).

---

## 3. Elementos Pré-textuais
- **Capa (Obrigatória):**
  - **Logo da UFLA:** No topo, centralizado, com aproximadamente 7 cm de largura por 2,85 cm de altura.
  - **Autor:** Centralizado, letras maiúsculas, em negrito, 14pt.
  - **Título:** Centralizado, letras maiúsculas, em negrito, 16pt, espaçamento 1,5.
  - **Subtítulo (se houver):** Separado por dois pontos, letras minúsculas (exceto iniciais de nomes próprios), sem negrito.
  - **Local e Estado:** LAVRAS - MG (ou cidade da instituição correspondente), centralizado, letras maiúsculas, em negrito, 14pt.
  - **Ano:** Centralizado, em negrito, 14pt, posicionado ao fim da página.
  - **Páginas:** A capa não exibe número de página e não entra na contagem de páginas do trabalho.
- **Folha de Rosto (Obrigatória):**
  - **Autor:** Centralizado, maiúsculas, em negrito, 12pt.
  - **Título:** Centralizado, maiúsculas, em negrito, 12pt, idêntico ao da capa.
  - **Subtítulo:** Separado por dois pontos, minúsculas, sem negrito.
  - **Nota descritiva/Natureza:** Recuada a 8 cm da margem esquerda (ou do meio da mancha gráfica), espaço simples, fonte 11pt, alinhamento justificado.
  - **Orientador / Coorientador:** Centralizados, tamanho 12pt, espaço simples.
  - **Local e Ano:** Centralizados ao final da página, tamanho 12pt.
- **Ficha Catalográfica (Obrigatória):**
  - Reservar espaço em página inteira no verso da folha de rosto (sem número de página, sem entrar na contagem total de páginas).
  - Exibir aviso de que deve ser gerada pelo sistema oficial da Biblioteca Universitária da UFLA.
- **Folha de Aprovação (Obrigatória):**
  - Mesma estrutura de cabeçalho da folha de rosto.
  - Adicionar data de aprovação, linhas para assinaturas dos membros da banca com suas respectivas titulações e instituições.
  - Para Teses e Dissertações, incluir o título em inglês correspondente.
- **Resumo e Abstract (Obrigatórios):**
  - Título RESUMO / ABSTRACT em maiúsculas, negrito, centralizado, tamanho 12pt.
  - Texto justificado, em parágrafo único, espaçamento simples, sem recuo de primeira linha.
  - Palavras-chave / Keywords: iniciadas em negrito (**Palavras-chave:**), seguidas pelos termos separados por ponto e finalizadas com ponto (ex: Termo1. Termo2. Termo3.), em espaçamento simples.
- **Sumário (Obrigatório):**
  - Título SUMÁRIO em maiúsculas, negrito, centralizado, tamanho 12pt.
  - Deve refletir perfeitamente os títulos e subtítulos de seções textuais com seus números de página correspondentes.
  - O sumário é gerado via campo dinâmico do Word (`TOC` field) com hiperlinks.

---

## 4. Elementos Textuais
- **Paginação:**
  - Numeração visível começa a partir da **Introdução** (primeira seção textual).
  - Os números de página devem aparecer no cabeçalho, no canto superior direito, com fonte de tamanho 10pt.
  - O número de página deve ser gerado através do campo nativo do Word (`PAGE` field), garantindo atualização automática.
  - A contagem de páginas inicia-se na folha de rosto (página 2), mas a numeração só fica visível a partir da introdução.
- **Títulos das Seções (Numeração Progressiva):**
  - Seções Primárias: Maiúsculas, Negrito (ex: **1 INTRODUÇÃO**). Iniciam sempre em nova página.
  - Seções Secundárias: Maiúsculas, Sem Negrito (ex: 1.1 REVISÃO DE LITERATURA).
  - Seções Terciárias: Minúsculas, Negrito (ex: **1.1.1 Métodos de Análise**).
  - Seções Quaternárias: Minúsculas, Itálico (ex: *1.1.1.1 Análise Estatística*).
  - Seções Quinárias: Minúsculas, Sem Negrito e Sem Itálico (ex: 1.1.1.1.1 Considerações).
- **Citações Longas (mais de 3 linhas):**
  - Recuo de 4,0 cm da margem esquerda.
  - Fonte tamanho 11pt, espaçamento simples, sem recuo de primeira linha, sem aspas.
- **Figuras, Quadros e Tabelas:**
  - Legenda/Título: Colocado **acima** do elemento, tamanho 12pt (ou 11pt dependendo do tipo do trabalho), no formato: "Figura 1 - Título da Figura" (em negrito no prefixo).
  - Fonte e Notas: Colocadas **abaixo** do elemento, tamanho 11pt, alinhadas à margem esquerda do elemento ou centralizadas. Formato: "Fonte: Sobrenome (Ano)".
  - Tabelas: Padrão IBGE (laterais abertas, sem linhas verticais).

---

## 5. Elementos Pós-textuais
- **Referências (Obrigatórias):**
  - Título REFERÊNCIAS em maiúsculas, negrito, centralizado, tamanho 12pt.
  - Espaçamento simples, com uma linha em branco (espaço simples) separando cada referência.
  - Alinhamento à **esquerda** (proibido justificar referências).
  - Recuo deslocante (**hanging indent**) de 0,5 cm (`283 twip`).
  - Ordem estritamente **alfabética** pelo sobrenome do primeiro autor (usando o método `localeCompare` do JavaScript com o locale `pt-BR`).
  - Título da obra destacado (geralmente em **negrito**).
  - Se houver 4 ou mais autores, o manual permite usar o nome do primeiro seguido de "et al." em itálico (*et al.*).
- **Itálico de "et al." (regra transversal):** "et al." deve constar **em itálico** tanto nas referências quanto **no corpo das citações**. Implementação centralizada em `src/docx-render-core.ts` (`tokenizeMarkup` → `applyEtAlItalic`), reutilizada por todos os exportadores; preview em `src/editor-markup.ts` (embrulha em `<em>`). Garantido por `tests/et-al-corpo.test.ts`.
- **Apêndices e Anexos (Opcionais):**
  - Devem ser identificados por letras maiúsculas consecutivas, travessão e seus respectivos títulos (ex: APÊNDICE A – Roteiro de entrevista).
  - A paginação continua de forma sequencial ao corpo do trabalho.
