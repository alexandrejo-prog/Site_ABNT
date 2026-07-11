# Checklist de pendências — v2.9.1

Status honesto da branch `fix/importacao-docx-convertido-pdf-v2.9.1` após reavaliação remota e conferência do DOCX gerado mais recente.

## Estado geral

A branch melhorou substancialmente a importação de dissertação convertida de PDF para DOCX, mas ainda não deve ser considerada pronta para PR/merge enquanto os itens bloqueadores abaixo não forem resolvidos ou explicitamente aceitos como limitações conhecidas com aviso revisável claro ao usuário.

## Correções já confirmadas no DOCX mais recente

- Folha de rosto preserva a natureza correta: Programa de Pós-Graduação em Administração Pública, área de concentração em Gestão Pública, Tecnologias e Inovação, para obtenção do título de Mestre.
- Não aparece mais o fallback indevido `Mestre em Ciências`.
- Folha de aprovação não está mais contaminada com resumo/agradecimentos.
- Orientador da banca aparece como `Prof. Dr. Dany Flavio Tonelli — Orientador`.
- AGRADECIMENTOS não contém mais o texto do RESUMO.
- RESUMO contém texto e Palavras-chave.
- ABSTRACT contém texto e Keywords.
- INDICADORES DE IMPACTO, IMPACT INDICATORS e LISTA DE SIGLAS aparecem como seções com aviso revisável quando o conteúdo não é preservado automaticamente.
- LISTA DE GRÁFICOS aparece com Gráfico 1 a Gráfico 11.
- SUMÁRIO permanece como campo atualizável.
- Corpo textual segue ordem geral melhor: INTRODUÇÃO → REFERENCIAL TEÓRICO → METODOLOGIA → demais seções.
- Placeholders técnicos `[Imagem detectada: rId...]`, `[[Imagem importada preservada: ...]]` e `[[Tabela importada preservada: ...]]` não aparecem como texto no DOCX final.

## Bloqueadores antes de PR

### 1. LISTA DE QUADROS cortada

**Situação atual:** o DOCX gerado mostra somente Quadro 1, Quadro 2 e Quadro 3 na LISTA DE QUADROS.

**Esperado:** preservar Quadro 1 a Quadro 16 quando detectáveis no DOCX convertido.

**Ação necessária:** ajustar o coletor da LISTA DE QUADROS para aceitar entradas longas e quebradas em múltiplas linhas, sem cortar a lista apenas porque uma entrada não termina com número de página na mesma linha.

**Critérios de aceite:**

- LISTA DE QUADROS contém Quadro 1 a Quadro 16 quando a fonte permitir.
- LISTA DE QUADROS não contém `Fonte:`.
- LISTA DE QUADROS não captura legendas do corpo.
- LISTA DE QUADROS termina antes de LISTA DE GRÁFICOS.

### 2. Gráficos/imagens do corpo não preservados

**Situação atual:** o DOCX gerado preserva o logo da capa, mas não preserva os gráficos do corpo como imagens. O diagnóstico informado pelo agente local indicou 57 mídias detectadas e 0 preservadas automaticamente.

**Risco:** o sistema pode parecer ter preservado imagens porque há logo na capa, mas os gráficos acadêmicos do corpo não foram importados visualmente.

**Ação necessária:** implementar diagnóstico explícito e/ou preservação controlada de imagens acadêmicas com legenda/fonte próxima.

**Critérios de aceite:**

- Logo da capa não conta como gráfico preservado.
- Se gráficos acadêmicos forem preserváveis, aparecem no DOCX final como imagens reais.
- Se gráficos acadêmicos não forem preserváveis, há aviso revisável claro ao usuário.
- O aviso deve informar quantidade detectada/preservada/revisão manual quando possível.
- Nenhum placeholder técnico aparece no document.xml final.

### 3. Duplicação de legenda/fonte nas tabelas

**Situação atual:** quadros/tabelas aparecem como estrutura tabular, mas ainda há duplicação sequencial de legenda e fonte, como `Quadro 1...` repetido e `Fonte: ...` repetida.

**Ação necessária:** quando uma tabela preservada consumir legenda/fonte, não renderizar novamente os mesmos parágrafos imediatamente antes/depois da tabela.

**Critérios de aceite:**

- `w:tbl` continua presente no DOCX final.
- Legenda do Quadro 1 não aparece duplicada em sequência.
- Fonte do Quadro 1 não aparece duplicada em sequência.
- Texto das células permanece.

### 4. Primeira referência possivelmente truncada

**Situação atual:** versões anteriores indicavam risco de a primeira referência começar com `1995. Seção 1.` sem `BRASIL. Decreto...` antes.

**Ação necessária:** auditar a seção REFERÊNCIAS no DOCX final mais recente e impedir perda evidente do início da primeira referência.

**Critérios de aceite:**

- REFERÊNCIAS não começa com fragmento sem autor/título.
- Se a primeira referência for `BRASIL. Decreto nº 1.590...`, o termo `BRASIL.` deve ser preservado antes de `1995`.
- REFERÊNCIAS não começa com `Fonte:`, `Quadro`, `Gráfico`, itens normativos soltos ou fragmentos do corpo.

## Melhorias importantes, mas não bloqueadoras para v2.9.1 se houver aviso claro

### 5. Ficha catalográfica real ainda não preservada integralmente

**Situação atual:** o sistema exibe aviso honesto de ficha detectada e não gera ficha provisória falsa.

**Aceitável para v2.9.1:** sim, desde que o aviso fique claro.

**Melhoria futura:** preservar texto estruturado da ficha real quando a conversão permitir ou permitir upload/substituição manual da ficha oficial.

### 6. Indicadores de impacto e lista de siglas aparecem como aviso, não conteúdo completo

**Situação atual:** seções aparecem, mas com aviso revisável.

**Aceitável para v2.9.1:** sim, se o sistema informa claramente que não conseguiu preservar o conteúdo automaticamente.

**Melhoria futura:** melhorar extração desses blocos de header/textbox/objetos ancorados do DOCX convertido.

### 7. Formatação fina de tabelas convertidas de PDF

**Situação atual:** tabelas são preservadas como `w:tbl`, mas células podem ficar quebradas em muitas linhas curtas por ruído da conversão PDF→DOCX.

**Aceitável para v2.9.1:** parcialmente, desde que os dados não sejam perdidos e haja aviso de revisão.

**Melhoria futura:** reconstrução de largura de colunas, mesclagem simples e limpeza de quebras artificiais.

## Regressões que não podem voltar

- Não voltar a gerar `Mestre em Ciências` quando a fonte diz apenas `Mestre`.
- Não voltar a contaminar AGRADECIMENTOS com RESUMO.
- Não voltar a contaminar folha de aprovação com resumo/agradecimentos/listas.
- Não voltar a inserir `[Imagem detectada: rId...]` no corpo.
- Não voltar a inserir marcadores internos no DOCX final.
- Não tocar em `src/docx-toc-field-patch.ts` sem necessidade real.
- Não commitar `_diagnostico/`, PDFs/DOCXs reais, DOCXs gerados, `dist/`, `node_modules/`, `PR_BODY.md` ou `RELEASE_*.md`.

## Próxima sequência recomendada

1. Corrigir LISTA DE QUADROS cortada.
2. Implementar aviso revisável explícito para gráficos/imagens do corpo não preservados ou preservar imagens acadêmicas quando houver posição confiável.
3. Remover duplicação sequencial de legenda/fonte em tabelas.
4. Auditar e corrigir início da seção REFERÊNCIAS.
5. Gerar novo DOCX local com Andrade_2025.docx.
6. Conferir manualmente o DOCX gerado.
7. Rodar `npm test` e `npm run build`.
8. Só então abrir PR da v2.9.1.

## Status de prontidão

- Pronto para PR: não.
- Pronto para merge: não.
- Pronto para nova rodada local do agente: sim.
- Principal bloqueador técnico: importação parcial de elementos visuais/lista de quadros e duplicações em tabelas.
