# Importação de DOCX convertido de PDF - v2.9.1

Este diagnóstico trata documentos DOCX gerados a partir de PDF aprovado. O PDF aprovado deve ser usado como referência estrutural confiável; o DOCX convertido deve ser tratado como fonte ruidosa, sujeita a deslocamentos de títulos, caixas de texto, imagens, quadros, gráficos e elementos pré-textuais.

Conversores PDF para Word podem colocar títulos como RESUMO, ABSTRACT, AGRADECIMENTOS, SUMÁRIO e outros elementos em `header*.xml`, `footer*.xml`, caixas de texto, shapes ou objetos ancorados. Nesses casos, o corpo textual pode conter o texto acadêmico real sem que o título exista como parágrafo normal.

Por isso, a importação deve usar delimitadores textuais confiáveis quando eles existirem, especialmente `Palavras-chave:` e `Keywords:`. A presença desses delimitadores deve orientar candidatos a resumo e abstract, com baixa confiança quando a estrutura indicar conversão de PDF.

Quando o documento importado contém ‘Palavras-chave:’, o texto imediatamente anterior, até o limite estrutural anterior mais provável, deve ser candidato a RESUMO, mesmo que o título RESUMO não esteja no corpo textual.

Quando o documento importado contém ‘Keywords:’, o texto imediatamente anterior, após o bloco de resumo/palavras-chave, deve ser candidato a ABSTRACT, mesmo que o título ABSTRACT não esteja no corpo textual.

Campos reais detectados no documento importado devem ser preservados, especialmente natureza do trabalho, orientador, ficha catalográfica, folha de aprovação, indicadores de impacto e listas pré-textuais. A regra de ouro é: nunca inventar campos acadêmicos sensíveis. Quando a importação tiver baixa confiança, o sistema deve avisar o usuário para revisar os campos extraídos antes de gerar o DOCX.

## Etapa 2 — Imagens importadas

Os marcadores técnicos como `[Imagem detectada: rId22]` são diagnósticos internos e não devem entrar no corpo acadêmico, no editorText, nas seções, nas referências ou no DOCX final como parágrafos comuns.

Quando os bytes da imagem estiverem acessíveis em `word/media/*`, a imagem deve ser representada internamente com id estável, relationship id original, arquivo, mime type, bytes, posição aproximada, legenda/fonte próximas e status `preserved`. No editor, essa imagem pode aparecer como um bloco amigável de imagem importada; no DOCX gerado, deve virar uma imagem real.

Quando a imagem for detectada, mas não puder ser preservada, ela deve gerar aviso revisável separado, com status `detected-but-not-preserved`, sem inserir placeholder textual no documento acadêmico. Placeholders herdados de diagnóstico devem ser tratados como `ignored-placeholder`.

## Correção crítica — ancoragem de imagens e elementos pré-textuais detectados

- Imagens de capa, logotipo UFLA, header/footer ou sem legenda/fonte próximas não são mais reinseridas automaticamente no corpo. Elas geram aviso revisável e permanecem disponíveis no DOCX original.
- Imagens acadêmicas são preservadas quando estão na seção textual/pós-textual (após a introdução) e próximas de legenda/fonte, em qualquer ordem (legenda antes da imagem e fonte depois, imagem antes da legenda e fonte depois, ou legenda e fonte separadas por até 5 blocos). Quando não há legenda/fonte confiável nas proximidades, a imagem é advertida como `Imagem detectada, mas não inserida automaticamente por baixa confiança de posicionamento. Revise e reinsira manualmente se necessário.`
- Não é gerado bloco artificial concentrando todas as imagens entre introdução e os demais capítulos. A ancoragem aproximada é respeitada sempre que possível; quando não for, a imagem fica como aviso.
- Ficha catalográfica e folha de aprovação reais detectadas não são substituídas por placeholders provisórios. Mensagens revisáveis orientam a preservação do documento oficial.
- Elementos pré-textuais adicionais (LISTA DE QUADROS, LISTA DE GRÁFICOS, LISTA DE TABELAS, LISTA DE SIGLAS) detectados são mantidos como páginas/seções textuais no fluxo pré-textual quando houver conteúdo.

## Correção crítica — natureza do trabalho preservada literalmente

- O importador/exportador não força mais `Mestre em`/`Doutor em` quando a fonte não contiver esses textos. A natureza do trabalho detectada é preservada literalmente, sem fallback genérico.
- Quando a fonte traz a natureza completa com programa/área de concentração, essa informação é mantida intacta no documento final.

## Etapa 7 — Teste de integração com fixture sintética

O teste sintético cobre logo da capa não reinserido no corpo, imagem sem legenda bloqueada, gráficos com legenda/fonte ancorados próximo ao conteúdo, ausência de bloco artificial de imagens, natureza preservada literalmente, ausência de “Mestre em Ciências” quando não está na fonte, ficha e folha como avisos revisáveis quando detectadas, além de resumo/abstract e listas pré-textuais preservadas.

## Etapa 3 — Tabelas e quadros importados

Tabelas e quadros extraídos de DOCX, especialmente DOCX convertido de PDF, devem ser preservados como dados estruturados, não como texto solto.

- Tabela preservada deve virar tabela real no DOCX final (`w:tbl`), mantendo linhas e colunas sempre que possível.
- Tabela não preservada deve gerar aviso revisável, não parágrafo acadêmico com lixo textual.
- Conteúdo tabular não deve ser descartado silenciosamente; se a confiança for baixa, o sistema deve avisar o usuário.
- Quadros convertidos como imagem devem seguir o fluxo de imagens (`ImportedDocumentImage`).
- Quadros convertidos como tabela devem seguir o fluxo tabular (`ImportedTable`).
- Legendas próximas (ex.: "Quadro 1 - ...", "Tabela 1 - ...") e fontes ("Fonte: ...") devem ser associadas à tabela quando possível.
- Tabelas em `header/footer` não são trazidas automaticamente para o corpo, salvo evidência clara de conteúdo acadêmico.
- O importador não deve introduzir marcadores técnicos como `[Tabela detectada: ...]` no corpo acadêmico.

Regra de prioridade:
1. não perder dados tabulares;
2. não transformar tabela em lixo textual;
3. preservar linhas e colunas quando possível;
4. manter legenda e fonte próximas;
5. gerar aviso revisável quando uma tabela/quadro não puder ser preservada.

## Correção crítica — RESUMO e ABSTRACT vazios

Após a implementação do suporte a tabelas, foi identificado que o DOCX gerado a partir de DOCX convertido de PDF estava produzindo páginas de RESUMO e ABSTRACT vazias.

 Causa raiz:
- Em DOCX convertido de PDF, os títulos `RESUMO` e `ABSTRACT` podem não existir como parágrafos separados.
- O campo `resumo` era preenchido pelo `recoverResumoByDelimiter`, que coletava todo o texto anterior a `Palavras-chave:`.
- Esse texto incluía seções pré-textuais como dedicatória, agradecimentos e epígrafe, que foram erroneamente atribuídas ao resumo.
- Na exportação, o conteúdo de `fields.resumo` aparecia na página de resumo, mas como o campo estava "sujo" com dedicatória/agradecimentos, o texto legítimo do resumo ficava ofuscado ou ausente.

 Correção aplicada:
- `field-detector.ts`: `collectBeforeDelimiter` agora para a coleta antes de seções pré-textuais como `DEDICATÓRIA`, `AGRADECIMENTOS`, `EPÍGRAFE`, `FICHA CATALOGRÁFICA`, `FOLHA DE APROVAÇÃO`, `LISTAS PRÉ-TEXTUAIS`.
- `field-detector.ts`: adicionada heurística `looksLikePersonalThanks` para identificar parágrafos de agradecimento/dedicatória (padrões como "A Deus", "Agradeço", "Aos meus", "Ao meu", "À") e evitar que sejam capturados como resumo.
- A mesma lógica foi aplicada ao fallback de abstract via `recoverAbstractByDelimiter`.

 Validação:
- Teste sintético (`tests/reproducao-resumo-abstract.test.ts`) confirma que, mesmo sem títulos `RESUMO`/`ABSTRACT` explícitos, o detector não captura dedicatória/agradecimentos.
- Teste de integração (`tests/import-docx-resumo-abstract-export.test.ts`) confirma que o DOCX final contém o resumo, palavras-chave, abstract e keywords corretos.
- Arquivo real local `_diagnostico/andrade-2025/Andrade_2025.docx` verificado manualmente: resumo, abstract, palavras-chave e keywords são preservados corretamente no DOCX final.

## Correção crítica — ordem dos blocos importados

A montagem estrutural do documento importado estava quebrada por múltiplos fatores combinados:

1. **Contaminação da folha de aprovação**: `detectApprovalSheet` percorria todo o documento até encontrar `REFERENCIAS`, capturando trechos de agradecimentos, resumo e listas pré-textuais no caminho. A correção impõe parada imediata em `RESUMO`, `ABSTRACT`, `PALAVRAS-CHAVE`, `KEYWORDS`, `AGRADECIMENTOS`, `DEDICATÓRIA`, `EPÍGRAFE`, `INDICADORES DE IMPACTO`, `IMPACT INDICATORS`, `LISTA DE QUADROS`, `LISTA DE GRÁFICOS`, `LISTA DE SIGLAS` e `1 INTRODUÇÃO`.

2. **Duplicação do resumo**: o `editorText` era construído a partir de `blocksToEditorText`, que incluía todo o texto de `INTRODUÇÃO` até `REFERENCIAS`. Quando o resumo era detectado por `splitResumo`/`recoverResumoByDelimiter` e colocado em `fields.resumo`, ele também permanecia no `editorText` e era duplicado na exportação. A solução mantém o resumo apenas em `fields.resumo` e não no fluxo do corpo.

3. **Deslocamento de legendas/fontes**: quadros e gráficos bloqueados por baixa confiança deixavam suas legendas e fontes espalhadas no corpo textual. A correção impede que `editorTextWithImageMarkers` replaque legendas/fontes órfãs após o bloco de imagens; avisos separados orientam a reinserção manual.

4. **Salto precoce para `5 CONCLUSÃO`**: o `editorText` parava em `REFERENCIAS`, então capítulos intermediários como `REFERENCIAL TEÓRICO`, `METODOLOGIA` e `RESULTADOS E DISCUSSÃO` não eram capturados. `blocksToEditorText` agora preserva todo o corpo de `INTRODUÇÃO` até o fim, sem parar em `REFERENCIAS`.

5. **Ordem do corpo quebrada**: combinado com o ponto anterior, a ordem `INTRODUÇÃO → REFERENCIAL TEÓRICO → METODOLOGIA → RESULTADOS E DISCUSSÃO → CONCLUSÃO → REFERÊNCIAS` agora é preservada.

6. **Natureza do trabalho truncada**: `detectWorkNature` parava em `FICHA CATALOGRÁFICA`/`FOLHA DE APROVAÇÃO`, mas incluiu o título da seção no resultado. A correção impede que delimitadores pré-textuais sejam adicionados ao `parts` antes do `break`.

7. **Isolamento de pré-textuais**: `collectPreTextualSection` agora para em seções pré-textuais conhecidas (`RESUMO`, `ABSTRACT`, `AGRADECIMENTOS`, `DEDICATÓRIA`, `EPÍGRAFE`, `INDICADORES DE IMPACTO`, `IMPACT INDICATORS`, `LISTA DE QUADROS`, `LISTA DE GRÁFICOS`, `LISTA DE SIGLAS`, `INTRODUÇÃO`, `REFERÊNCIAS`), impedindo vazamento entre seções.

### Arquivos alterados

- `src/field-detector.ts`
  - `detectApprovalSheet`: parada expandida para pré-textuais.
  - `detectWorkNature`: break antes de `push`, evitando inclusão de `Ficha catalográfica` no resultado.
  - `splitResumo`/`splitAbstract`: parada em todos os pré-textuais conhecidos.
  - `collectPreTextualSection`: parada em pré-textuais, introdução e referências.
  - `blocksToEditorText`: remove parada em `REFERENCIAS`, preserva corpo completo.
- `src/imported-document-blocks.ts`: modelo interno de blocos estruturais adicionado.
- `tests/field-detector-order.test.ts`: 6 testes de ordem e isolamento adicionados.
- `tests/import-docx-images.test.ts`: ajuste de expectativa para filtragem de header image.
- `tests/import-errors.test.ts`: ajuste de mensagem de erro para formato não suportado.
- `tests/docx-formal-audit.test.ts`: ajustes de texto para conformidade com nova estrutura.
- `tests/dissertation-flow-audit.test.ts`: ajustes de texto para nova página de aprovação.
- `tests/export-docx.test.ts`: remoção de bloco duplicado e ajustes.
- `tests/integration-import-flow.test.ts`: ajuste de tipo para `approvalMembers`.
- `src/import-docx.ts`: remoção de constantes não utilizadas.
- `docs/importacao-docx-convertido-pdf-v2.9.1.md`: esta seção.

### Comportamento esperado após correção

1. **Folha de aprovação**: contém apenas autor, título, natureza, linha de aprovação, membros da banca, orientador, local/ano. Não contém resumo, agradecimentos, listas ou sumário.
2. **Resumo**: aparece apenas na página `RESUMO`. Não é duplicado no corpo.
3. **Natureza**: preservada literalmente, incluindo programa e área de concentração quando detectados. Não usa fallback `Mestre em Ciências`/`Doutor em Ciências` quando a fonte não contém.
4. **Pré-textuais**: `AGRADECIMENTOS`, `INDICADORES DE IMPACTO`, `IMPACT INDICATORS`, `LISTA DE QUADROS`, `LISTA DE GRÁFICOS`, `LISTA DE SIGLAS` aparecem antes do `SUMÁRIO`.
5. **Corpo**: segue a ordem `1 INTRODUÇÃO → 2 REFERENCIAL TEÓRICO → 3 METODOLOGIA → 4 RESULTADOS E DISCUSSÃO → 5 CONCLUSÃO → REFERÊNCIAS`.
6. **Legendas órfãs**: não são inseridas no corpo; avisos separados orientam a reinserção manual.

### Validação

- `npm test`: **850 passed** (115 arquivos)
- `npm run build`: **built in 5.64s** (sem erros TypeScript)
- Teste sintético com documento completo valida ordem, isolamento e natureza literal.
- Arquivo real `_diagnostico/andrade-2025/Andrade_2025.docx` **não commitado**, verificado localmente.

## Correção crítica — divergência entre teste sintético e fluxo real

Os testes sintéticos iniciais passavam, mas o DOCX gerado a partir do arquivo real continuava errado porque a detecção e a montagem do fluxo real possuíam falhas distintas:

1. **Classificação incorreta do tipo de trabalho**: `detectWorkType` verificava `ACADEMIC_PRODUCTION_TYPES` antes dos tipos padrão (`tese`, `dissertacao`, `monografia`). Como o documento contém palavras como "reivindicações", "artigo", "estudo de caso" e "software" no corpo textual, ele era classificado como `patente_ufla` ou outro tipo de produção acadêmica. A correção move os padrões explícitos (`TESE`, `DISSERTACAO`, `MONOGRAFIA`, `PROJETO DE PESQUISA`) para o início da verificação, garantindo que documentos com natureza explícita de dissertação/tese sejam classificados corretamente.

2. **Contaminação da folha de aprovação**: `detectApprovalSheet` usava heurísticas muito amplas (`/institui[cç][aã]o/i`) que capturavam parágrafos de agradecimentos e resumo simplesmente por conter a palavra "instituição". A correção exige que a linha contenha simultaneamente um título acadêmico (`Prof.`, `Dra.`, `Dr.`) e uma instituição (`UFCG`, `UFMG`, `Universidade`, `Instituto`), além de limitar o tamanho da linha e rejeitar narrativas em primeira pessoa.

3. **Quebra prematura do `editorText` em referências artifactuais**: `editorTextWithImageMarkers` interrompia a coleta do corpo no primeiro heading `REFERÊNCIAS` encontrado. Em DOCX convertido de PDF, headings artifactuais de sumário aparecem antes do corpo real. A correção implementa `tocArtifactMode`: se `REFERÊNCIAS` for detectado antes de `CONCLUSÃO` e for seguido por parágrafos descritivos ("Na Introdução...", "REFERENCIAL TEÓRICO"), ele é ignorado até o próximo heading real.

4. **Work type no fluxo do site**: `App.tsx` chama `normalizeFieldsForSelectedModel` antes de gerar o DOCX. Quando o `workType` era errado (`patente_ufla`), o normalizador substituía a natureza correta por um fallback genérico. Com a classificação corrigida para `dissertacao`, o normalizador preserva a natureza literal.

### Arquivos alterados (etapa 2)

- `src/field-detector.ts`
  - `detectWorkType`: tipos padrão (`tese`, `dissertacao`, `monografia`) verificados antes de `ACADEMIC_PRODUCTION_TYPES`.
  - `detectApprovalSheet`: heurística restrita a linhas com título + instituição, rejeitando narrativas longas.
- `src/import-docx.ts`
  - `editorTextWithImageMarkers`: adicionado `tocArtifactMode` para ignorar headings `REFERÊNCIAS` artifactuais antes de `CONCLUSÃO`.
- `tests/real-flow-audit-andrade-local.test.ts`: teste local opcional que valida o DOCX real.
- `docs/importacao-docx-convertido-pdf-v2.9.1.md`: esta seção.

### Validação (atualizada)

- `npm test`: **853 passed** (116 arquivos)
- `npm run build`: **built in 5.11s** (sem erros TypeScript)
- Teste local com `_diagnostico/andrade-2025/Andrade_2025.docx`: 3 assertions passam.

## Ajuste final — folhas iniciais e pré-textuais

### Folha de rosto

A natureza do trabalho agora é limpa antes de ser inserida na folha de rosto. O trecho final que continha o orientador, local e ano era fruto da detecção no DOCX convertido de PDF, onde esses elementos ficavam colados ao final do parágrafo de natureza.

A função `stripTrailingAdvisorLocationYear` remove:
- menções a orientador/orientadora com nome;
- local de publicação (ex.: "LAVRAS-MG");
- ano (ex.: "2025").

Após a limpeza, `buildTitlePageSupplementalLines` insere:
- `Orientador(a): Prof. Dr. Dany Flavio Tonelli`
- `Programa: Administração Pública`
- `Curso:` (quando aplicável)

E a folha de rosto renderiza separadamente:
- natureza até "Mestre.";
- orientador;
- local;
- ano.

### Folha de aprovação

A folha de aprovação foi normalizada para evitar:
1. **Data duplicada**: `formatApprovalDate` remove o prefixo "APROVADA em " antes de inserir o rótulo "Aprovado em:", evitando "Aprovado em: APROVADA em 08 de julho de 2025..".
2. **Membros da banca colados**: `splitApprovalMembers` separa linhas como "Dra. Suzanne ... UFCG Dr. Rafael ... UFMG" em membros individuais.
3. **Orientador duplicado**: como a natureza agora não carrega o nome do orientador, `orientationLines` na folha de aprovação insere apenas:
   - `Prof. Dr. Dany Flavio Tonelli`
   - `Orientador(a) - UFLA`

### Pré-textuais

Quando detectados no DOCX importado, os pré-textuais são renderizados antes do SUMÁRIO na ordem:
1. AGRADECIMENTOS
2. RESUMO
3. ABSTRACT
4. INDICADORES DE IMPACTO
5. IMPACT INDICATORS
6. LISTA DE QUADROS
7. LISTA DE GRÁFICOS
8. LISTA DE SIGLAS
9. SUMÁRIO

Se o DOCX convertido de PDF não contiver esses elementos como texto extraível, o sistema emite aviso durante a importação. Nesses casos, não são gerados blocos artificiais.

### Ficha catalográfica

Mantido o fallback honesto:
```
Ficha catalográfica detectada no arquivo importado. Preserve ou substitua manualmente pela ficha oficial da Biblioteca Universitária da UFLA.
```

Não é gerada ficha provisória falsa nem inventados dados de biblioteca.

### Arquivos alterados (ajuste final)

- `src/export-docx.ts`
  - `stripTrailingAdvisorLocationYear`: limpa natureza removendo orientador/local/ano.
  - `formatApprovalDate`: normaliza data da folha de aprovação.
  - `splitApprovalMembers`: separa membros da banca em linhas individuais.
  - `approvalPageChildren`: usa as novas funções de formatação.
- `tests/real-flow-audit-andrade-local.test.ts`: adicionadas verificações para folha de rosto, folha de aprovação e ordem de pré-textuais.
- `docs/importacao-docx-convertido-pdf-v2.9.1.md`: esta seção.

### Validação (final)

- `npm test`: **854 passed** (116 arquivos)
- `npm run build`: **built in 5.82s**
- Teste local com `_diagnostico/andrade-2025/Andrade_2025.docx`: 7 assertions passam (3 skipped se arquivo não existir).

## Ajuste final v2 — pré-textuais, aprovação, tabelas, imagens e referências

### Pré-textuais detectados por conteúdo

Pré-textuais como `AGRADECIMENTOS`, `LISTA DE QUADROS`, `LISTA DE GRÁFICOS`, `LISTA DE SIGLAS`, `INDICADORES DE IMPACTO` e `IMPACT INDICATORS` são renderizados antes do `SUMÁRIO` quando detectados no DOCX importado, na ordem:

1. AGRADECIMENTOS
2. INDICADORES DE IMPACTO
3. IMPACT INDICATORS
4. LISTA DE QUADROS
5. LISTA DE GRÁFICOS
6. LISTA DE SIGLAS
7. SUMÁRIO

Se o DOCX convertido de PDF não contiver esses elementos como texto extraível, nenhum bloco artificial é gerado.

Detecção baseada em heurísticas de conteúdo (`looksLikeThanksBlock`, padrões de lista) quando o heading não existe como parágrafo normal.

### Folha de aprovação normalizada

1. **Membros divididos por título**: `splitApprovalMembers` usa regex para detectar títulos acadêmicos (`Prof.`, `Dra.`, `Dr.`) em strings coladas, separando cada membro individualmente.
2. **Instituições separadas por em-dash**: cada membro é formatado como `Título — Nome — Instituição`.
3. **Data em maiúsculas**: `formatApprovalDate` gera `APROVADO EM:` em vez de `Aprovado em:`.

### Tabelas preservadas como `w:tbl`

Tabelas extraídas de DOCX convertido de PDF são exportadas como tabelas reais no DOCX final (`w:tbl`), mantendo linhas e colunas sempre que possível. Geração fresh do DOCX de Andrade produziu **135 tabelas** reais.

### Marcadores de imagem removidos do DOCX final

Marcadores técnicos `[Imagem detectada: ...]` e `[Imagem: ...]` são removidos durante a normalização do texto (`import-normalizer.ts`). Imagens sem bytes preservados geram aviso revisável separado, sem placeholder textual no corpo acadêmico.

### Referências sem ruído

`collectReferences` varre para trás a partir de `INTRODUÇÃO` até o último heading `REFERÊNCIAS`, parando antes de appendix/apêndice/anexo e seções de corpo. `isLikelyNoiseReferenceItem` filtra parágrafos de texto narrativo, bojo de anexo e trechos que não são referências bibliográficas válidas.

### Arquivos alterados (ajuste final v2)

- `src/field-detector.ts`
  - `collectPreTextualByContent`: detecta pré-textuais por heurística de conteúdo.
  - `collectReferences`: varre de `INTRODUÇÃO` para trás, com filtro de noise.
  - `isLikelyNoiseReferenceItem`: filtra body text e appendix boilerplate.
- `src/export-docx.ts`
  - `splitApprovalMembers` / `extractMembersFromString`: regex para títulos acadêmicos.
  - `normalizeApprovalMember`: formata com em-dash.
  - `formatApprovalDate`: uppercase `APROVADO EM:`.
- `src/import-normalizer.ts`
  - `cleanText`: remove marcadores `[Imagem detectada: ...]` e `[Imagem: ...]`.
- `tests/export-docx.test.ts`, `tests/export-docx-thesis-dissertation.test.ts`, `tests/final-worktype-contract.test.ts`: atualizadas asserts para `APROVADO EM:`.

### Validação (ajuste final v2)

- `npm test`: **856 passed** (116 arquivos, 1 skipped)
- `npm run build`: **built in 6.81s**
- Teste local com `_diagnostico/andrade-2025/Andrade_2025.docx`: pré-textuais antes do sumário, aprovação normalizada, 135 tabelas como `w:tbl`, sem marcadores de imagem.

## Correção final — isolamento de pré-textuais, listas e imagens

Esta etapa fecha os bloqueadores observados no fluxo real de Andrade (2025), mantendo a regra de não inventar conteúdo acadêmico quando o DOCX convertido de PDF perde estrutura confiável.

- `AGRADECIMENTOS` agora para em delimitadores fortes de resumo/abstract (`A presente pesquisa teve como objetivo`, `This study aimed`, `Palavras-chave`, `Keywords`), evitando que o RESUMO seja capturado dentro dos agradecimentos.
- O RESUMO permanece no campo próprio e não deve aparecer duplicado no bloco de agradecimentos ou no corpo textual.
- Fragmentos soltos da banca, como `Prof.` em uma linha e `Dr. Dany Flavio Tonelli Orientador` na linha seguinte, são unidos antes da renderização, resultando em `Prof. Dr. Dany Flavio Tonelli — Orientador`.
- Quando `INDICADORES DE IMPACTO`, `IMPACT INDICATORS` e `LISTA DE SIGLAS` são esperados em DOCX convertido de PDF, mas o conteúdo não é extraível com segurança, o sistema insere aviso revisável em vez de criar texto artificial.
- `LISTA DE QUADROS`, `LISTA DE GRÁFICOS` e `LISTA DE TABELAS` preservam apenas entradas com paginação e param antes de legendas/fontes do corpo, evitando que `Fonte:` e captions reais sejam misturados à lista pré-textual.
- Tabelas extraídas continuam sendo exportadas como tabelas reais (`w:tbl`), com legenda/fonte associadas quando a posição é confiável, sem repetir grosseiramente caption e fonte como texto solto.
- No DOCX local de Andrade foram detectadas 57 entradas de mídia no pacote OOXML. Dessas, 11 imagens/gráficos acadêmicos do corpo com legenda e fonte próximas foram preservadas automaticamente como imagens reais (`w:drawing` + bytes em `word/media`). As demais 46 mídias — em grande parte a galeria de gráficos de apêndice sem legenda/fonte individual — exigem revisão manual. O logo/capa não é contado como gráfico acadêmico preservado.
- Referências continuam filtradas de forma conservadora para não receber texto narrativo do corpo, legendas, fontes, quadros, gráficos ou materiais de anexo/apêndice.

### Validação (correção final)

- Testes sintéticos cobrem isolamento de agradecimentos/resumo, limpeza de listas pré-textuais, aviso revisável para pré-textuais ausentes, diagnóstico honesto de imagens e normalização de banca.
- Teste local opcional `tests/real-flow-audit-andrade-local.test.ts` audita o DOCX real quando `_diagnostico/andrade-2025/Andrade_2025.docx` existe, e pula sem falhar quando o arquivo não está no repositório.

## Correção final — lista de quadros, imagens, tabelas e referências

Esta rodada corrige os últimos bloqueadores aceitos para v2.9.1 sem declarar a importação de DOCX convertido de PDF como perfeita.

- `LISTA DE QUADROS` deixou de exigir página na mesma linha para manter a entrada. O coletor agora aceita títulos longos, continuação em linha seguinte e número de página separado, preservando `Quadro 1` a `Quadro 16` quando essas entradas aparecem no DOCX convertido.
- A limpeza da lista para quando encontra `Fonte:`, reinício da numeração de quadros no corpo, `LISTA DE GRÁFICOS`, `LISTA DE SIGLAS`, `SUMÁRIO` ou `INTRODUÇÃO`. Assim, a lista não incorpora fontes nem legendas duplicadas do corpo.
- Auditoria local do Andrade: o importador detectou 57 mídias/imagens no DOCX original, 11 imagens/gráficos acadêmicos do corpo com legenda e fonte próximas foram preservadas automaticamente como imagens reais (`w:drawing` + bytes em `word/media`). As demais 46 mídias — em grande parte a galeria de gráficos de apêndice sem legenda/fonte individual — exigem revisão manual. O logo/capa não é contado como gráfico acadêmico preservado.
- Quando imagens/gráficos do corpo não podem ser posicionados com segurança, o aviso revisável informa detectadas/preservadas/revisão manual e orienta reinserção manual dos elementos deslocados pela conversão PDF-DOCX.
- Tabelas preservadas continuam saindo como `w:tbl`, mas legendas/fontes consumidas pelo `ImportedTable` não são repetidas imediatamente como parágrafos comuns no `editorText`.
- A primeira referência foi auditada contra o caso normativo `BRASIL. Decreto nº 1.590... 1995. Seção 1.`; o normalizador preserva o início institucional antes do ano quando a quebra de linha separa o ano do restante da referência.

### Validação local desta rodada

- Fixture sintética confirma `Quadro 1` a `Quadro 16` quando detectáveis, sem `Fonte:` e sem capturar `LISTA DE GRÁFICOS`.
- Teste de integração (`tests/import-docx-tables.test.ts`) confirma leitura de `w:tblGrid`/`w:gridCol`, detecção de `gridSpan`, limpeza de quebras artificiais em células e não duplicação de legenda/fonte.
- Teste local opcional com `_diagnostico/andrade-2025/Andrade_2025.docx` confirma 16 entradas na lista de quadros, `w:tbl` no DOCX final, aviso revisável de imagens, ausência de marcadores internos e referências sem truncamento inicial evidente.

## Melhoria — layout de tabelas importadas de DOCX convertido de PDF

### Problema original

Tabelas e quadros extraídos de DOCX convertido de PDF chegavam visualmente pobres no DOCX final:
- colunas ficavam estreitas;
- texto quebrava em muitas linhas curtas;
- células ficavam quase inutilizáveis;
- não havia preservação de `w:tblGrid`, `w:gridCol`, `w:tcW`, `gridSpan` ou `vMerge`.

### Correção aplicada

1. **Extração de grid e larguras (`src/word-structure-extractor.ts`)**
   - `w:tblGrid`/`w:gridCol` são lidos quando existem.
   - `w:tblPr`/`w:tblW` é lido para largura total da tabela.
   - `w:tcPr`/`w:tcW` é lido por célula quando disponível.
   - `w:gridSpan` e `w:vMerge` são detectados e sinalizados.

2. **Modelo rico de tabela (`src/imported-tables.ts`)**
   - `ImportedTable` agora inclui:
     - `estimatedColumnWidths`
     - `originalGridWidths`
     - `tableWidthTwips`
     - `hasGridSpan`
     - `hasVerticalMerge`
     - `layoutWarning`
     - `status` pode ser `preserved-with-layout-warning`

3. **Estimativa de largura (`src/import-docx.ts`)**
   - Quando `w:gridCol` existe, as larguras são convertidas para percentual proporcional.
   - Quando não existe, estima-se por quantidade de colunas.
   - Colunas são limitadas a mínimo de 5% para evitar larguras absurdas.

4. **Exportação com largura e formatação (`src/export-docx.ts`)**
   - `Table` é criada com `width: 100%`.
   - `TableCell` recebe `width` em percentual quando `estimatedColumnWidths` está disponível.
   - Bordas simples aplicadas.
   - Margens internas mínimas.
   - Fonte `Times New Roman`, tamanho 12.
   - Texto de célula limpo de quebras artificiais (`teletrabalho`, `implementação`).

5. **Limpeza de quebras artificiais (`src/import-docx.ts`)**
   - Função conservadora `cleanCellText` junta linhas quebradas no meio de palavras quando a próxima linha começa com minúscula.
   - Preserva quebras antes de bullets, números, ponto final, dois-pontos ou início de nova ideia.

6. **Aviso de layout frágil**
   - Tabelas com `gridSpan`, `vMerge`, muitas colunas (>8) ou layout sem largura recebem status `preserved-with-layout-warning`.
   - Aviso revisável: "Tabelas/quadros importados de DOCX convertido de PDF podem exigir revisao manual de layout."
   - O aviso aparece nas mensagens de importação, não dentro do corpo acadêmico.

7. **Sem duplicação de legenda/fonte**
   - Quando `ImportedTable` consome legenda e fonte próximas, o `editorText` não as reinsere como texto solto.
   - O DOCX final renderiza legenda, tabela e fonte uma única vez.

### Arquivos alterados (layout de tabelas)

- `src/word-structure-extractor.ts`
  - `parseTableBlock`: extrai `w:tblGrid`, `w:gridCol`, `w:tblW`, `w:tcW`, `gridSpan`, `vMerge`.
  - `ImportedBlock` do tipo `table` ganhou metadados de largura e merge.
- `src/imported-tables.ts`
  - `ImportedTable` enriquecido com `estimatedColumnWidths`, `originalGridWidths`, `tableWidthTwips`, `hasGridSpan`, `hasVerticalMerge`, `layoutWarning`, `status` ampliado.
- `src/import-docx.ts`
  - `importedTablesFromStructure` agora converte `string[][]` para `ImportedTableCell[][]`, aplica `cleanCellText`, calcula `estimatedColumnWidths` e define `preserved-with-layout-warning`.
  - `cleanCellText` remove quebras artificiais conservadoramente.
  - `editorTextWithImageMarkers` e `buildImportResult` tratam tabelas com layout warning.
- `src/export-docx.ts`
  - `importedTableParagraph` aplica `estimatedColumnWidths`, bordas, margens e fonte `Times New Roman`.
  - `TableCell` recebe `width` em percentual.
- `tests/import-docx-tables.test.ts`
  - Novos testes para grid, merge, limpeza de célula e estrutura de tabela no DOCX final.

### Limitações conhecidas

- Mesclagem complexa (`gridSpan`/`vMerge` avançados) não é reconstruída perfeitamente; o sistema avisa para revisão manual.
- Quando o DOCX convertido de PDF não contém `w:tblGrid`, as larguras são estimadas e podem não refletir a intenção original.
- Tabelas com muitas colunas ou largura total indefinida recebem aviso de layout frágil.

### Validação

- `npm test`: **874 passed** (116 arquivos, 1 skipped)
- `npm run build`: **built in 5.10s** (sem erros TypeScript)
- Testes sintéticos confirmam leitura de grid, detecção de merge, limpeza de quebras artificiais e não duplicação de legenda/fonte.
- Teste local opcional com `_diagnostico/andrade-2025/Andrade_2025.docx` permanece válido.

## Correção final — primeira referência truncada

Auditoria local do fluxo real confirmou que o DOCX convertido de PDF separava a primeira referência normativa em blocos/parágrafos artificiais. O complemento `1995. Seção 1.` podia chegar como item independente e, durante a ordenação alfabética das referências, subia para o início da seção `REFERÊNCIAS`.

Correção aplicada:

- `references-normalizer` agora junta fragmentos iniciados por ano com o ato normativo institucional contíguo, inclusive quando as partes chegam em parágrafos separados.
- Fragmentos órfãos iniciados por ano, como `1995. Seção 1.`, não são tratados como referência autônoma quando não houver autor/instituição associado.
- A normalização continua conservadora: não reescreve a lista inteira, não inventa conteúdo e não altera referências normais de autores pessoais.

Validação local:

- O DOCX gerado a partir de `_diagnostico/andrade-2025/Andrade_2025.docx` não inicia `REFERÊNCIAS` com `1995. Seção 1.`.
- A referência `BRASIL. Decreto nº 1.590, de 10 de agosto de 1995...` foi preservada antes do complemento de `1995. Seção 1.` quando detectada no DOCX fonte.
- O aviso revisável de imagens/gráficos permanece no fluxo de importação: 57 mídias detectadas no DOCX original, 11 imagens acadêmicas preservadas automaticamente e 46 itens exigindo revisão manual; o logo/capa não conta como gráfico acadêmico preservado.
- `LISTA DE QUADROS` segue preservando `Quadro 1` a `Quadro 16` quando detectável, sem incorporar `Fonte:`.
- `LISTA DE GRÁFICOS` segue preservando `Gráfico 1` a `Gráfico 11`.
- Tabelas continuam exportadas como tabelas reais (`w:tbl`).
- Resumo, abstract, agradecimentos, folha de rosto, folha de aprovação e sumário atualizável não regrediram na auditoria local.

## Status final real (pronto para revisão, não 100% finalizado)

- folha de rosto corrigida: natureza, orientador, local e ano são preservados corretamente;
- folha de aprovação corrigida: data, membros da banca e orientador normalizados, sem contaminação de resumo/agradecimentos;
- AGRADECIMENTOS isolado: não captura mais texto do RESUMO;
- RESUMO e ABSTRACT preservados: conteúdo, palavras-chave e keywords aparecem corretamente;
- LISTA DE QUADROS preserva Quadro 1 a Quadro 16;
- LISTA DE GRÁFICOS preserva Gráfico 1 a Gráfico 11;
- LISTA DE SIGLAS aparece como conteúdo ou aviso revisável;
- REFERÊNCIAS não começa mais com “1995. Seção 1.”;
- tabelas são preservadas como `w:tbl` quando possível;
- imagens acadêmicas preserváveis são importadas quando há posição confiável;
- imagens/gráficos sem posição confiável geram aviso revisável;
- logo da capa não conta como gráfico preservado;
- `src/docx-toc-field-patch.ts` não foi alterado.

### Limitações conhecidas

- DOCX convertido de PDF continua ruidoso.
- Imagens/gráficos sem âncora/posição confiável podem exigir reinserção manual.
- Tabelas vindas de PDF convertido podem manter formatação imperfeita.
- Ficha catalográfica pode continuar como aviso revisável se o layout real não for preservável.
- Indicadores/lista de siglas podem aparecer como aviso quando o conteúdo não for extraível com segurança.
- A versão não é 100% finalizada; é candidata a v2.9.1.

Validação local completa a partir de `_diagnostico/andrade-2025/Andrade_2025.docx` (DOCX não versionado). Todos os pontos abaixo foram conferidos no `document.xml` gerado e no `editorText` importado. O status é **pronto para revisão**, não "concluído/perfeito".

- Folha de rosto: contém `Administração Pública`, `Gestão Pública`, `Tecnologias e Inovação`; não contém `Mestre em Ciências`.
- Folha de aprovação: não contém resumo/agradecimentos nem `Prof.` isolado; contém `Prof. Dr. Dany Flavio Tonelli — Orientador`.
- Pré-textuais: `AGRADECIMENTOS` sem resumo; `RESUMO`/`ABSTRACT` com conteúdo; `Palavras-chave:` e `Keywords:` aparecem uma vez; `INDICADORES DE IMPACTO`, `IMPACT INDICATORS` e `LISTA DE SIGLAS` aparecem como conteúdo ou aviso; `LISTA DE QUADROS` preserva `Quadro 1` a `Quadro 16` sem `Fonte:`; `LISTA DE GRÁFICOS` preserva `Gráfico 1` a `Gráfico 11`; `SUMÁRIO` segue como campo atualizável.
- Corpo: ordem `INTRODUÇÃO → REFERENCIAL TEÓRICO → METODOLOGIA → RESULTADOS E DISCUSSÃO → CONCLUSÃO → REFERÊNCIAS` mantida.
- Referências: não inicia com `1995. Seção 1.`; `BRASIL. Decreto nº 1.590` aparece antes de `1995`; não inicia com `Fonte:`/`Quadro`/`Gráfico`/fragmento de corpo.
- Imagens: 57 mídias detectadas, 11 gráficos acadêmicos do corpo preservados como imagens reais (`w:drawing` + bytes em `word/media`, inclusive `wp:inline` e `wp:anchor`); as 46 restantes (galeria de apêndice sem legenda/fonte individual) geram aviso revisável; o logo da capa não entra em `importedImages` (não conta como gráfico preservado); nenhum marcador técnico (`[Imagem detectada: rId...]`, `[[Imagem importada preservada: ...]]`) aparece no documento final.
- Tabelas: `w:tbl` presente; `Quadro 1`/`Quadro 2` sem duplicação imediata de legenda/fonte; ausência de `[[Tabela importada preservada: ...]]`.
- Sumário: `src/docx-toc-field-patch.ts` não foi alterado; segue como campo atualizável.

Pendências/limitações conhecidas:

- Gráficos/imagens acadêmicas do corpo com legenda e fonte próximas são preservados automaticamente como imagens reais; os demais (ex.: galeria de apêndice sem legenda/fonte individual) ainda exigem revisão manual. O sistema emite aviso revisável para reinserção manual dos elementos ausentes.
- Ficha catalográfica, indicadores de impacto e lista de siglas podem permanecer como aviso revisável quando o DOCX convertido não expõe conteúdo textual confiável.
- A importação de DOCX convertido de PDF continua sendo heurística e não deve ser descrita como perfeita.
