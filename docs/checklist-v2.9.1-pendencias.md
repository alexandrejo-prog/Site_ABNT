# Checklist de pendências — v2.9.1

Status honesto da branch `fix/importacao-docx-convertido-pdf-v2.9.1` após a auditoria do DOCX gerado em `dissertacao-andrade-2025(2)(1).docx`.

## Estado geral

A branch melhorou substancialmente a importação de dissertação convertida de PDF para DOCX. Ela ainda não deve ser tratada como 100% finalizada. A abertura de PR só deve ocorrer se as limitações remanescentes forem aceitas como conhecidas e houver aviso revisável claro ao usuário.

## Correções confirmadas no DOCX auditado

- Folha de rosto preserva a natureza correta: Programa de Pós-Graduação em Administração Pública, área de concentração em Gestão Pública, Tecnologias e Inovação, para obtenção do título de Mestre.
- Não aparece mais o fallback indevido `Mestre em Ciências`.
- Folha de aprovação não está contaminada com resumo/agradecimentos.
- Orientador da banca aparece como `Prof. Dr. Dany Flavio Tonelli — Orientador`.
- AGRADECIMENTOS não contém o texto do RESUMO.
- RESUMO contém texto e Palavras-chave.
- ABSTRACT contém texto e Keywords.
- INDICADORES DE IMPACTO, IMPACT INDICATORS e LISTA DE SIGLAS aparecem como seções com aviso revisável quando o conteúdo não é preservado automaticamente.
- LISTA DE QUADROS preserva entradas detectáveis de Quadro 1 a Quadro 16.
- LISTA DE GRÁFICOS aparece com Gráfico 1 a Gráfico 11.
- SUMÁRIO permanece como campo atualizável.
- Corpo textual segue ordem geral melhor: INTRODUÇÃO → REFERENCIAL TEÓRICO → METODOLOGIA → RESULTADOS E DISCUSSÃO → CONCLUSÃO → REFERÊNCIAS.
- Placeholders técnicos `[Imagem detectada: rId...]`, `[[Imagem importada preservada: ...]]` e `[[Tabela importada preservada: ...]]` não aparecem como texto no DOCX final.
- Há tabelas reais no DOCX final (`w:tbl`).
- A duplicação imediata de legenda/fonte do Quadro 1 foi reduzida: a legenda e a fonte aparecem uma vez no trecho auditado.

## Bloqueadores antes de declarar pronto sem ressalvas

### 1. Gráficos/imagens do corpo — preservação de casos confiáveis

**Situação atual:** o DOCX gerado preserva o logo da capa e, a partir desta correção, também os gráficos acadêmicos do corpo que aparecem com legenda e fonte próximas (11 de 57 mídias no Andrade). As demais 46 mídias — maioria da galeria de gráficos de apêndice sem legenda/fonte individual — permanecem como aviso revisável, sem inserção em local incorreto.

**Critérios de aceite atendidos:**

- Logo da capa não conta como gráfico preservado.
- Gráficos acadêmicos com legenda/fonte próximas aparecem no DOCX final como imagens reais (`w:drawing` + bytes em `word/media`), inclusive em `wp:inline` e `wp:anchor`.
- Imagens sem legenda/fonte confiável geram aviso revisável claro ao usuário, sem placeholder técnico no `document.xml`.
- Nenhum placeholder técnico (`[Imagem detectada: rId...]`, `[[Imagem importada preservada: ...]]`) aparece no documento final.

### 2. Primeira referência ainda parece truncada no DOCX gerado

**Situação atual:** a seção REFERÊNCIAS do DOCX auditado começa com `1995. Seção 1.` antes de aparecer `BRASIL. Decreto nº 1.590...` mais adiante. Isso indica que ainda existe fragmento inicial solto ou referência quebrada não saneada no DOCX final.

**Ação necessária:** impedir que a seção REFERÊNCIAS comece com fragmento sem autor/título. Se não for possível reconstruir a primeira referência, remover ou deslocar o fragmento órfão para aviso revisável.

**Critérios de aceite:**

- REFERÊNCIAS não começa com `1995. Seção 1.`.
- A primeira entrada da seção deve começar por autor, instituição ou norma identificável.
- Se a referência real for `BRASIL. Decreto nº 1.590...`, o termo `BRASIL.` deve aparecer antes de `1995`.
- REFERÊNCIAS não começa com `Fonte:`, `Quadro`, `Gráfico`, itens normativos soltos ou fragmentos do corpo.

## Melhorias importantes, mas não bloqueadoras para v2.9.1 se houver aviso claro

### 3. Ficha catalográfica real ainda não preservada integralmente

**Situação atual:** o sistema exibe aviso honesto de ficha detectada e não gera ficha provisória falsa.

**Aceitável para v2.9.1:** sim, desde que o aviso fique claro.

**Melhoria futura:** preservar texto estruturado da ficha real quando a conversão permitir ou permitir upload/substituição manual da ficha oficial.

### 4. Indicadores de impacto, impact indicators e lista de siglas aparecem como aviso, não conteúdo completo

**Situação atual:** seções aparecem, mas com aviso revisável.

**Aceitável para v2.9.1:** sim, se o sistema informa claramente que não conseguiu preservar o conteúdo automaticamente.

**Melhoria futura:** melhorar extração desses blocos de header/textbox/objetos ancorados do DOCX convertido.

### 5. Formatação fina de tabelas convertidas de PDF

**Situação atual:** tabelas são preservadas como `w:tbl`, mas células podem ficar quebradas em muitas linhas curtas por ruído da conversão PDF→DOCX.

**Aceitável para v2.9.1:** parcialmente, desde que os dados não sejam perdidos e haja aviso de revisão.

**Melhoria futura:** reconstrução de largura de colunas, mesclagem simples e limpeza de quebras artificiais.

## Regressões que não podem voltar

- Não voltar a gerar `Mestre em Ciências` quando a fonte diz apenas `Mestre`.
- Não voltar a cortar LISTA DE QUADROS para apenas três itens quando a fonte contém Quadro 1 a Quadro 16.
- Não voltar a contaminar AGRADECIMENTOS com RESUMO.
- Não voltar a contaminar folha de aprovação com resumo/agradecimentos/listas.
- Não voltar a inserir `[Imagem detectada: rId...]` no corpo.
- Não voltar a inserir marcadores internos no DOCX final.
- Não tocar em `src/docx-toc-field-patch.ts` sem necessidade real.
- Não commitar `_diagnostico/`, PDFs/DOCXs reais, DOCXs gerados, `dist/`, `node_modules/`, `PR_BODY.md` ou `RELEASE_*.md`.

## Próxima sequência recomendada

1. Corrigir REFERÊNCIAS para não iniciar com `1995. Seção 1.`.
2. Confirmar visualmente o aviso revisável de imagens/gráficos não preservados no painel do site.
3. Gerar novo DOCX local com `Andrade_2025.docx`.
4. Conferir manualmente o DOCX gerado.
5. Rodar `npm test` e `npm run build`.
6. Abrir PR da v2.9.1 somente se esses pontos estiverem resolvidos ou explicitamente documentados como limitação conhecida.

## Status de prontidão

- Pronto para PR: ainda não, enquanto a primeira referência iniciar truncada.
- Pronto para merge: não.
- Pronto para nova rodada local do agente: sim.
- Principal bloqueador técnico atual: início truncado da seção REFERÊNCIAS.

## Atualização desta rodada — primeira referência corrigida

- Bloqueador `REFERÊNCIAS` corrigido: o DOCX final não inicia mais com `1995. Seção 1.`.
- Causa confirmada: o DOCX convertido de PDF quebrava a primeira referência normativa em blocos/parágrafos artificiais; o fragmento iniciado por ano virava item independente e era ordenado antes das demais referências.
- Correção: o normalizador junta fragmentos iniciados por ano com o ato normativo institucional contíguo, inclusive entre parágrafos separados, e descarta fragmentos órfãos iniciados por ano quando não há autor/instituição associado.
- Auditoria local do DOCX de Andrade confirmou `BRASIL. Decreto nº 1.590...` preservado antes do complemento `1995. Seção 1.` quando detectado no DOCX fonte.
- Aviso revisável de imagens/gráficos confirmado: 57 mídias detectadas, 0 imagens acadêmicas preservadas automaticamente e 57 exigindo revisão manual; logo/capa não conta como gráfico acadêmico preservado.
- `LISTA DE QUADROS` segue preservando `Quadro 1` a `Quadro 16`; `LISTA DE GRÁFICOS` segue com `Gráfico 1` a `Gráfico 11`; tabelas seguem como `w:tbl`.
- Resumo, abstract, agradecimentos, folha de rosto, folha de aprovação e sumário atualizável não regrediram na auditoria local.
- Limitações conhecidas permanecem: gráficos/imagens acadêmicas do corpo exigem reinserção manual quando a conversão PDF-DOCX não permite posicionamento confiável; ficha, indicadores e siglas podem permanecer como aviso revisável.
- Pronto para PR: sim, com limitações conhecidas documentadas, após `npm test`, `npm run build` e `git diff --check` passarem.
