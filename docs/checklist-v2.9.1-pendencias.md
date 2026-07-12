# Checklist de pendências — v2.9.1

Status honesto da branch `fix/importacao-docx-convertido-pdf-v2.9.1` após a auditoria final do DOCX gerado a partir de `_diagnostico/andrade-2025/Andrade_2025.docx`.

## Estado geral

A branch melhorou substancialmente a importação de dissertação convertida de PDF para DOCX. A auditoria final local confirma os critérios de regressão (folha de rosto, folha de aprovação, pré-textuais, corpo, referências, imagens e tabelas). O conjunto está **pronto para revisão**, mas a importação de DOCX convertido de PDF continua sendo heurística e **não deve ser descrita como perfeita nem 100% finalizada**: limitações conhecidas permanecem e o aviso revisável é parte do contrato de uso.

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
- Imagens acadêmicas do corpo com legenda/fonte próximas são preservadas como imagens reais no DOCX final (11 de 57 mídias no Andrade: `w:drawing` + bytes em `word/media`, em `wp:inline` e `wp:anchor`). O logo da capa não entra em `importedImages` e não conta como gráfico preservado.
- As 46 mídias restantes (galeria de apêndice sem legenda/fonte individual) geram aviso revisável claro, sem inserção em local incorreto e sem placeholder técnico.

## Bloqueadores antes de declarar pronto sem ressalvas

### 1. Gráficos/imagens do corpo — preservação de casos confiáveis

**Situação atual:** o DOCX gerado preserva o logo da capa e, a partir desta correção, também os gráficos acadêmicos do corpo que aparecem com legenda e fonte próximas (11 de 57 mídias no Andrade). As demais 46 mídias — maioria da galeria de gráficos de apêndice sem legenda/fonte individual — permanecem como aviso revisável, sem inserção em local incorreto.

**Critérios de aceite atendidos:**

- Logo da capa não conta como gráfico preservado.
- Gráficos acadêmicos com legenda/fonte próximas aparecem no DOCX final como imagens reais (`w:drawing` + bytes em `word/media`), inclusive em `wp:inline` e `wp:anchor`.
- Imagens sem legenda/fonte confiável geram aviso revisável claro ao usuário, sem placeholder técnico no `document.xml`.
- Nenhum placeholder técnico (`[Imagem detectada: rId...]`, `[[Imagem importada preservada: ...]]`) aparece no documento final.

### 1.1. Correlação flexível de imagens (até 10 blocos)

**Situação atual:** a janela de correlação entre imagem, legenda e fonte foi ampliada de 7 para 10 blocos. A ordem pode ser legenda antes/imagem depois/fonte depois, imagem antes/legenda depois/fonte depois, legenda antes/fonte antes/imagem depois, imagem entre legenda e fonte, ou imagem logo depois de Fonte se a legenda estiver próxima antes.

**Critérios de aceite atendidos:**

- Casos confiáveis preservam `w:drawing`.
- Casos ambíguos (várias imagens próximas da mesma legenda) geram aviso revisável.
- Nenhum marcador interno aparece no `document.xml`.
- Logo não conta como gráfico.
- `insertionHint` indica o ponto mais seguro (`after-caption`, `before-source`, `between-caption-and-source`, `original-position`).

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

**Situação atual:** tabelas agora preservam `w:tblGrid`/`w:gridCol`, `w:tcW`, `gridSpan`/`vMerge`, e recebem larguras proporcionais e bordas simples. Células usam `Times New Roman` 12. Quebras artificiais dentro de células são limpas conservadoramente. Quando o layout é complexo ou sem largura definida, o sistema avisa para revisão manual.

**Aceitável para v2.9.1:** sim, com aviso de layout frágil quando necessário.

**Melhoria futura:** reconstrução perfeita de mesclagem complexa e largura exata quando o DOCX fonte não expõe metadados de tabela.

### 6. Colunas fantasmas em tabelas de PDF convertido

**Situação atual:** tabelas simples (ex.: Quadro 2 com 2 colunas lógicas) podem chegar com 4 a 6 colunas artificiais estreitas e vazias após conversão PDF→DOCX. O sistema agora detecta e remove essas colunas antes da exportação.

**Critérios de aceite atendidos:**
- Colunas completamente vazias são removidas.
- Colunas quase vazias (menos de 10% das linhas com texto significativo) são colapsadas na coluna anterior.
- Texto das colunas fantasmas é preservado na coluna adjacente.
- `columnCount` e `estimatedColumnWidths` são recalculados.
- `w:tbl` e `TableCell` width são mantidos no DOCX final.

**Aceitável para v2.9.1:** sim, com aviso "Colunas artificiais do PDF convertido foram colapsadas." quando aplicável.

**Melhoria futura:** detectar palavras fragmentadas entre colunas artificiais sem perder o restante do texto.

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

1. Revisar PR #15 com as limitações conhecidas documentadas.
2. Confirmar visualmente o aviso revisável de imagens/gráficos não preservados no painel do site.
3. Gerar novo DOCX local com `Andrade_2025.docx` para conferência manual.
4. Rodar `npm test` e `npm run build` antes do merge.
5. Manter `_diagnostico/`, DOCXs reais e gerados fora do commit.

## Status de prontidão

- Pronto para PR: sim.
- Pronto para merge direto: não.
- Pronto para revisão: sim.
- 100% concluído: não.
- Limitações conhecidas: sim, documentadas.

### 7. Tabelas ilegíveis podem ser renderizadas como texto estruturado

**Situação atual:** quando uma tabela continua ilegível mesmo após remover colunas fantasmas (muitas células vazias, largura insuficiente, muitas colunas), o sistema renderiza o quadro como texto estruturado com legenda, conteúdo e aviso revisável, em vez de manter uma `w:tbl` quebrada.

**Critérios de aceite atendidos:**
- legenda, conteúdo e fonte são mantidos;
- aviso revisável é inserido para revisão manual;
- não há duplicação de legenda/fonte;
- tabelas legíveis continuam como `w:tbl`.

**Aceitável para v2.9.1:** sim, como fallback para preservar conteúdo e legibilidade.


