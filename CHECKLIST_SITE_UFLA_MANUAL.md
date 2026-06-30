# CHECKLIST DE DESENVOLVIMENTO DO SITE CONFORME MANUAL UFLA

**Objetivo:** checklist técnico-normativo para implementar, revisar e testar o site gerador de DOCX conforme o Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA, 6ª edição.

**Regra operacional:** marque `[x]` apenas quando o requisito estiver implementado, testado e funcionando no DOCX gerado. Se estiver parcialmente implementado, mantenha `[ ]` e registre observação.

---

## 1. Arquivos normativos e projeto

- [ ] `PRD.md` existe na raiz do projeto.
- [ ] PDF do Manual de Normalização da UFLA existe na raiz.
- [ ] Template oficial DOCX da UFLA existe na raiz.
- [ ] Nenhum desses arquivos é apagado, movido ou sobrescrito pelo sistema.
- [ ] `UFLA_MANUAL_INSTRUCOES_CONSOLIDADAS.md` existe na raiz.
- [ ] Este checklist existe na raiz.
- [ ] O projeto continua sem backend.
- [ ] O projeto continua sem banco de dados.
- [ ] O projeto continua sem autenticação.
- [ ] O projeto continua sem IA.
- [ ] O projeto continua em tela única.
- [ ] O projeto gera DOCX como saída principal.
- [ ] O projeto não finge conformidade quando houver regra não implementada.

---

## 2. Regras globais de formatação

- [ ] Papel A4 configurado no DOCX.
- [ ] Margem superior de 3 cm.
- [ ] Margem esquerda de 3 cm.
- [ ] Margem inferior de 2 cm.
- [ ] Margem direita de 2 cm.
- [ ] Cabeçalho configurado com 2 cm.
- [ ] Fonte padrão Times New Roman ou similar.
- [ ] Texto acadêmico em cor preta.
- [ ] Texto comum em tamanho 12.
- [ ] Citações longas em tamanho 11.
- [ ] Notas em tamanho 11.
- [ ] Paginação em tamanho 11.
- [ ] Ficha catalográfica em tamanho 11.
- [ ] Fontes de ilustrações/tabelas em tamanho 11.
- [ ] Legendas de ilustrações/tabelas em tamanho 11.
- [ ] Corpo textual com espaçamento 1,5.
- [ ] Títulos de seções com espaçamento 1,5.
- [ ] Citações longas com espaço simples.
- [ ] Notas com espaço simples.
- [ ] Referências com espaço simples.
- [ ] Natureza do trabalho com espaço simples.
- [ ] Resumo com espaço simples.
- [ ] Abstract com espaço simples.
- [ ] Ficha catalográfica com espaço simples.
- [ ] Sem espaçamento antes/depois indevido em parágrafos comuns.
- [ ] Parágrafos comuns justificados.
- [ ] Parágrafos comuns com recuo de primeira linha conforme padrão UFLA/template.
- [ ] Corpo textual comum exportado como corpo do texto, sem nível de tópico.
- [ ] Títulos exportados como títulos, com nível adequado.
- [ ] Referências não são exportadas como títulos.
- [ ] Não há cor azul indevida no resumo.
- [ ] Não há cor azul indevida no abstract.
- [ ] Não há cor azul indevida no corpo textual.
- [ ] Não há cor azul indevida nas referências.

---

## 3. Capa

- [ ] Capa é gerada.
- [ ] Logo da UFLA é inserida no topo.
- [ ] Logo tem aproximadamente 7 cm x 2,85 cm.
- [ ] Autor aparece centralizado.
- [ ] Autor está em letras maiúsculas.
- [ ] Autor está em negrito.
- [ ] Autor está em tamanho 14.
- [ ] Título aparece centralizado.
- [ ] Título está em letras maiúsculas.
- [ ] Título está em negrito.
- [ ] Título está em tamanho 16.
- [ ] Título usa espaçamento 1,5.
- [ ] Subtítulo é separado por dois pontos.
- [ ] Subtítulo não recebe negrito indevido.
- [ ] Local aparece como cidade + UF.
- [ ] Local está em maiúsculas.
- [ ] Local está em negrito.
- [ ] Local está em tamanho 14.
- [ ] Ano aparece ao fim da página.
- [ ] Ano está em negrito.
- [ ] Ano está em tamanho 14.
- [ ] Capa não exibe número de página.
- [ ] Capa não entra na contagem total de páginas.

---

## 4. Folha de rosto

- [ ] Folha de rosto é gerada.
- [ ] Autor aparece no alto da página.
- [ ] Autor está centralizado, em maiúsculas e negrito.
- [ ] Título aparece centralizado.
- [ ] Título está em maiúsculas e negrito.
- [ ] Subtítulo, se houver, está separado por dois pontos.
- [ ] Subtítulo não está em negrito indevido.
- [ ] Nota descritiva/natureza é gerada.
- [ ] Nota descritiva fica recuada do meio da página para a margem direita.
- [ ] Nota descritiva usa espaço simples.
- [ ] Nota descritiva informa tipo de trabalho.
- [ ] Nota descritiva informa instituição.
- [ ] Nota descritiva informa curso/programa.
- [ ] Nota descritiva informa área de concentração quando aplicável.
- [ ] Nota descritiva informa título pretendido quando aplicável.
- [ ] Orientador é exibido quando obrigatório.
- [ ] Coorientador é exibido quando preenchido.
- [ ] Local é exibido.
- [ ] Ano é exibido.
- [ ] Folha de rosto é contada para paginação.
- [ ] Folha de rosto não exibe número de página.

---

## 5. Ficha catalográfica

- [ ] Sistema reserva espaço para ficha catalográfica.
- [ ] Sistema permite inserir ficha como texto ou imagem.
- [ ] Sistema informa que a ficha deve ser gerada pela Biblioteca Universitária da UFLA.
- [ ] Sistema não inventa ficha catalográfica.
- [ ] Ficha não exibe número de página.
- [ ] Ficha não entra na contagem total de páginas.
- [ ] Validação alerta quando ficha não foi informada.

---

## 6. Errata

- [ ] Errata é opcional.
- [ ] Errata só aparece se preenchida.
- [ ] Errata aparece após folha de rosto.
- [ ] Errata inclui referência do trabalho.
- [ ] Errata inclui tabela com folha/página.
- [ ] Errata inclui linha.
- [ ] Errata inclui “Onde se lê”.
- [ ] Errata inclui “Leia-se”.

---

## 7. Folha de aprovação

- [ ] Folha de aprovação pode ser gerada.
- [ ] Autor aparece centralizado, em maiúsculas e negrito.
- [ ] Título aparece em maiúsculas e negrito.
- [ ] Título em inglês pode ser informado.
- [ ] Nota descritiva é exibida.
- [ ] Data de aprovação pode ser informada.
- [ ] Membros da banca podem ser informados.
- [ ] Instituições dos membros da banca podem ser informadas.
- [ ] Orientador é exibido.
- [ ] Coorientador é exibido quando houver.
- [ ] Local e ano são exibidos.
- [ ] Folha de aprovação não exibe número de página.

---

## 8. Dedicatória

- [ ] Dedicatória é opcional.
- [ ] Dedicatória só aparece se preenchida.
- [ ] Dedicatória aparece em página independente.
- [ ] Dedicatória não possui título.
- [ ] Dedicatória é posicionada na parte inferior.
- [ ] Dedicatória é alinhada do meio da mancha gráfica para a margem direita.

---

## 9. Agradecimentos

- [ ] Agradecimentos são opcionais.
- [ ] Agradecimentos só aparecem se preenchidos.
- [ ] Página de agradecimentos é independente.
- [ ] Título `AGRADECIMENTOS` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Sistema permite mencionar programa de pós-graduação.
- [ ] Sistema alerta para agradecimento obrigatório a órgão de fomento quando o usuário indicar bolsa.

---

## 10. Epígrafe

- [ ] Epígrafe é opcional.
- [ ] Epígrafe só aparece se preenchida.
- [ ] Epígrafe aparece em página independente.
- [ ] Epígrafe não possui título.
- [ ] Epígrafe é alinhada à direita/inferior.
- [ ] Epígrafe preserva itálico quando usado.
- [ ] Sistema permite epígrafe em abertura de seção primária.

---

## 11. Resumo

- [ ] Resumo é obrigatório.
- [ ] Resumo aparece em página independente.
- [ ] Título `RESUMO` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Texto do resumo está justificado.
- [ ] Texto do resumo está em espaço simples.
- [ ] Texto do resumo está em parágrafo único.
- [ ] Resumo não contém tópicos/listas.
- [ ] Resumo usa terceira pessoa, ou alerta quando não for possível validar.
- [ ] Resumo de trabalho acadêmico tem entre 150 e 500 palavras, ou alerta.
- [ ] Resumo de artigo tem entre 100 e 250 palavras, ou alerta.
- [ ] Palavras-chave aparecem abaixo do resumo.
- [ ] Linha começa com `Palavras-chave:`.
- [ ] Palavras-chave são separadas por ponto e vírgula.
- [ ] Palavras-chave terminam com ponto.
- [ ] Palavras-chave estão em minúsculas, salvo nomes próprios/científicos.
- [ ] Resumo não fica azul.

---

## 12. Abstract / resumo em língua estrangeira

- [ ] Abstract é obrigatório.
- [ ] Abstract aparece em página independente.
- [ ] Título `ABSTRACT` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Texto está justificado.
- [ ] Texto está em espaço simples.
- [ ] Keywords aparecem abaixo do abstract.
- [ ] Linha começa com `Keywords:`.
- [ ] Keywords são separadas por ponto e vírgula.
- [ ] Keywords terminam com ponto.
- [ ] Abstract não fica azul.

---

## 13. Indicadores de impacto

- [ ] Indicadores de impacto são exigidos para dissertação.
- [ ] Indicadores de impacto são exigidos para tese.
- [ ] Título `INDICADORES DE IMPACTO` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Texto está em parágrafo único.
- [ ] Texto tem entre 150 e 500 palavras, ou alerta.
- [ ] Texto está em terceira pessoa, ou alerta.
- [ ] Texto caracteriza impactos sociais/tecnológicos/econômicos/culturais.
- [ ] Texto informa território e grupo impactado quando aplicável.
- [ ] Texto menciona caráter extensionista quando houver.
- [ ] Texto menciona área temática de extensão quando aplicável.
- [ ] Texto menciona ODS quando aplicável.
- [ ] `IMPACT INDICATORS` é gerado em página seguinte quando preenchido.
- [ ] Sistema alerta se dissertação/tese não tiver indicadores.

---

## 14. Listas pré-textuais

### 14.1. Lista de ilustrações

- [ ] Sistema detecta figuras.
- [ ] Sistema detecta gráficos.
- [ ] Sistema detecta quadros.
- [ ] Sistema detecta mapas.
- [ ] Sistema detecta fotografias/imagens.
- [ ] Lista de ilustrações pode ser gerada.
- [ ] Título `LISTA DE ILUSTRAÇÕES` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Itens aparecem na ordem do texto.
- [ ] Cada item tem tipo.
- [ ] Cada item tem número.
- [ ] Cada item tem travessão.
- [ ] Cada item tem título.
- [ ] Cada item tem página.
- [ ] Números de página ficam à direita.
- [ ] Títulos longos alinham segunda linha em escada.
- [ ] Texto da lista não invade área do número de página.
- [ ] Sistema permite listas próprias por tipo quando necessário.

### 14.2. Lista de tabelas

- [ ] Sistema detecta tabelas.
- [ ] Lista de tabelas pode ser gerada.
- [ ] Título `LISTA DE TABELAS` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Itens aparecem na ordem do texto.
- [ ] Cada item tem número.
- [ ] Cada item tem travessão.
- [ ] Cada item tem título.
- [ ] Cada item tem página.
- [ ] Números de página ficam à direita.
- [ ] Títulos longos alinham segunda linha em escada.

### 14.3. Abreviaturas, siglas e símbolos

- [ ] Sistema permite lista de abreviaturas.
- [ ] Sistema permite lista de siglas.
- [ ] Sistema permite lista de símbolos.
- [ ] Abreviaturas e siglas ficam em ordem alfabética.
- [ ] Nome completo precede sigla na primeira ocorrência do texto.
- [ ] Sigla aparece entre parênteses na primeira ocorrência.
- [ ] Símbolos ficam na ordem de ocorrência no texto.

---

## 15. Sumário

- [ ] Sumário é gerado.
- [ ] Sumário é o último elemento pré-textual.
- [ ] Título `SUMÁRIO` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Sumário lista seções na ordem do texto.
- [ ] Sumário usa mesma grafia dos títulos do corpo.
- [ ] Sumário inclui páginas.
- [ ] Sumário não inclui capa.
- [ ] Sumário não inclui folha de rosto.
- [ ] Sumário não inclui folha de aprovação.
- [ ] Sumário não inclui dedicatória.
- [ ] Sumário não inclui agradecimentos.
- [ ] Sumário não inclui epígrafe.
- [ ] Sumário não inclui resumo.
- [ ] Sumário não inclui abstract.
- [ ] Sumário não inclui listas pré-textuais.
- [ ] Sumário inclui referências.
- [ ] Sumário inclui glossário quando houver.
- [ ] Sumário inclui apêndices quando houver.
- [ ] Sumário inclui anexos quando houver.
- [ ] Pós-textuais aparecem sem numeração progressiva.
- [ ] Títulos longos alinham corretamente.
- [ ] Campo de sumário é atualizável no Word quando possível.
- [ ] Sistema alerta quando o sumário for estático.

---

## 16. Elementos textuais

- [ ] Introdução é obrigatória.
- [ ] Introdução é detectada na importação.
- [ ] Introdução é exportada.
- [ ] Introdução inicia a numeração visível.
- [ ] Desenvolvimento é obrigatório.
- [ ] Sistema permite seções de referencial teórico.
- [ ] Sistema permite metodologia/material e métodos.
- [ ] Sistema permite resultados e discussão.
- [ ] Sistema permite conclusão.
- [ ] Sistema permite considerações finais.
- [ ] Conclusão ou considerações finais são obrigatórias.
- [ ] Títulos primários começam em nova página.
- [ ] Títulos primários estão em negrito.
- [ ] Títulos secundários estão em negrito quando padrão exigir.
- [ ] Títulos não recebem formatação de corpo comum.
- [ ] Corpo comum não recebe formatação de título.

---

## 17. Paginação

- [ ] Capa não é contada.
- [ ] Ficha catalográfica não é contada.
- [ ] Folha de rosto é contada.
- [ ] Pré-textuais são contados.
- [ ] Pré-textuais não mostram número visível.
- [ ] Numeração visível começa na introdução.
- [ ] Número está no canto superior direito.
- [ ] Número usa algarismos arábicos.
- [ ] Apêndices continuam a paginação.
- [ ] Anexos continuam a paginação.
- [ ] DOCX usa campo de página do Word.
- [ ] Sistema não escreve número manual como texto comum.
- [ ] Sistema alerta quando o Word precisar atualizar campos.

---

## 18. Numeração progressiva

- [ ] Sistema usa algarismos arábicos nas seções.
- [ ] Sistema não usa “capítulo” como divisão padrão.
- [ ] Sistema usa seções.
- [ ] Sistema não ultrapassa seção quinária.
- [ ] Título primário tem formato `1 TÍTULO`.
- [ ] Título secundário tem formato `1.1 Título`.
- [ ] Título terciário tem formato `1.1.1 Título`.
- [ ] Número e título são separados por um espaço.
- [ ] Títulos longos alinham a segunda linha sob a primeira letra do título.
- [ ] Títulos sem indicativo são centralizados e em negrito.
- [ ] Capa, folha de rosto, folha de aprovação, dedicatória e epígrafe não têm título.

---

## 19. Citações

### 19.1. Citação direta curta

- [ ] Sistema preserva citações entre aspas duplas.
- [ ] Sistema preserva aspas simples dentro de citação.
- [ ] Sistema valida padrão autor-data-página quando possível.
- [ ] Sistema preserva itálico dentro da citação.
- [ ] Sistema não transforma citação curta em citação longa.

### 19.2. Citação direta longa

- [ ] Sistema detecta citação longa quando marcada.
- [ ] Citação longa tem recuo de 4 cm.
- [ ] Citação longa usa fonte 11.
- [ ] Citação longa usa espaço simples.
- [ ] Citação longa não usa aspas.
- [ ] Citação longa não recebe recuo de parágrafo comum.
- [ ] Sistema alerta possível citação longa não marcada.

### 19.3. Citação indireta e citação de citação

- [ ] Sistema preserva citações autor-data.
- [ ] Sistema preserva `apud`.
- [ ] Sistema não inventa fonte original.
- [ ] Sistema alerta citação sem referência provável.
- [ ] Sistema alerta referência sem citação provável.

### 19.4. Expressões e destaques

- [ ] `et al.` é preservado.
- [ ] `et al.` fica em itálico quando aplicável.
- [ ] Negrito em ênfase é preservado.
- [ ] Itálico em ênfase é preservado.
- [ ] Supressões com colchetes são preservadas.

---

## 20. Ilustrações

- [ ] Sistema detecta ilustração importada.
- [ ] Sistema detecta legenda acima da ilustração.
- [ ] Legenda segue formato tipo + número + travessão + título.
- [ ] Legenda usa fonte 12.
- [ ] Legenda usa espaço simples.
- [ ] Fonte fica abaixo da ilustração.
- [ ] Fonte usa tamanho 11.
- [ ] Fonte usa espaço simples.
- [ ] Imagem é centralizada.
- [ ] Imagem é dimensionada para caber nas margens.
- [ ] Imagem é exportada no DOCX.
- [ ] Sistema alerta imagem sem legenda.
- [ ] Sistema alerta imagem sem fonte.
- [ ] Sistema preserva legenda e fonte mesmo se imagem falhar.
- [ ] Sistema trata quadro como ilustração, não como tabela.
- [ ] Ilustração em mais de uma página recebe indicação de continua/continuação/conclusão quando suportado.

---

## 21. Tabelas

- [ ] Sistema detecta tabela importada.
- [ ] Sistema preserva linhas.
- [ ] Sistema preserva colunas.
- [ ] Sistema preserva conteúdo das células.
- [ ] Sistema exporta tabela nativa do Word.
- [ ] Título fica acima da tabela.
- [ ] Título usa `Tabela` + número + travessão + título.
- [ ] Título usa fonte 12.
- [ ] Título usa espaço simples.
- [ ] Fonte fica abaixo da tabela.
- [ ] Fonte usa tamanho 11.
- [ ] Fonte usa espaço simples.
- [ ] Tabela fica dentro das margens.
- [ ] Sistema alerta tabela sem título.
- [ ] Sistema alerta tabela sem fonte.

---

## 22. Referências

### 22.1. Bloco de referências

- [ ] Referências são obrigatórias.
- [ ] Título `REFERÊNCIAS` é centralizado.
- [ ] Título está em maiúsculas.
- [ ] Título está em negrito.
- [ ] Referências estão alinhadas à esquerda.
- [ ] Referências usam fonte Times ou similar.
- [ ] Referências usam tamanho 12.
- [ ] Referências usam espaço simples.
- [ ] Há espaço simples em branco entre referências.
- [ ] Referências estão em texto preto.

### 22.2. Preservação

- [ ] Autores são preservados.
- [ ] Títulos são preservados.
- [ ] Subtítulos são preservados.
- [ ] Edição é preservada.
- [ ] Local é preservado.
- [ ] Editora é preservada.
- [ ] Ano é preservado.
- [ ] Número de páginas é preservado.
- [ ] DOI é preservado.
- [ ] URL é preservada.
- [ ] `Disponível em:` é preservado.
- [ ] `Acesso em:` é preservado.
- [ ] Data de acesso é preservada.
- [ ] Sistema não inventa dados ausentes.

### 22.3. Destaque e autoria

- [ ] Título da obra recebe negrito quando detectável.
- [ ] Nome do periódico recebe negrito quando detectável.
- [ ] Até três autores são preservados.
- [ ] Quatro ou mais autores usam primeiro autor + `et al.` quando normalizado.
- [ ] `et al.` fica em itálico.
- [ ] Autoria desconhecida entra pelo título.
- [ ] Sistema não usa “Anônimo”.
- [ ] Pessoa jurídica é preservada conforme documento.
- [ ] Instituição governamental tem jurisdição/órgão superior quando detectável.

### 22.4. Pontuação ABNT/UFLA

- [ ] Ponto após autor.
- [ ] Ponto após título.
- [ ] Ponto após edição.
- [ ] Dois pontos entre local e editora.
- [ ] Dois pontos entre título e subtítulo.
- [ ] Vírgula entre editora e ano.
- [ ] Ponto e vírgula entre autores.
- [ ] Hífen entre páginas inicial-final.
- [ ] Colchetes para ausência ou inferência.
- [ ] `[S. l.]` usado quando local ausente.
- [ ] `[s. n.]` usado quando editora ausente.
- [ ] `[S. l.: s. n.]` usado quando local e editora ausentes.

### 22.5. Validação de referências

- [ ] Alerta referência sem autor provável.
- [ ] Alerta referência sem ano provável.
- [ ] Alerta referência online sem acesso.
- [ ] Alerta referência com DOI mal posicionado.
- [ ] Alerta item muito curto.
- [ ] Alerta referência quebrada indevidamente.
- [ ] Alerta ausência de negrito em título detectável.
- [ ] Referência incerta é preservada sem normalização destrutiva.

### 22.6. Tipos reconhecidos

- [ ] Livro/monografia no todo.
- [ ] Livro/monografia em meio eletrônico.
- [ ] Parte de monografia.
- [ ] Trabalho acadêmico.
- [ ] Artigo de periódico.
- [ ] Artigo online.
- [ ] Matéria de jornal.
- [ ] Evento.
- [ ] Documento jurídico.
- [ ] Patente.
- [ ] Documento audiovisual.
- [ ] Documento sonoro.
- [ ] Documento iconográfico.
- [ ] Documento cartográfico.
- [ ] Dados de pesquisa.
- [ ] Documento de acesso exclusivo eletrônico.

---

## 23. Glossário, apêndices, anexos e índice

- [ ] Glossário é opcional.
- [ ] Glossário aparece em ordem alfabética.
- [ ] Título `GLOSSÁRIO` é centralizado e em negrito.
- [ ] Apêndices são opcionais.
- [ ] Anexos são opcionais.
- [ ] Apêndice é identificado por letra maiúscula consecutiva.
- [ ] Anexo é identificado por letra maiúscula consecutiva.
- [ ] Apêndice usa travessão e título.
- [ ] Anexo usa travessão e título.
- [ ] Apêndice aparece no sumário sem numeração progressiva.
- [ ] Anexo aparece no sumário sem numeração progressiva.
- [ ] Apêndices continuam paginação.
- [ ] Anexos continuam paginação.
- [ ] Referências de anexos são tratadas no próprio anexo ou lista específica.
- [ ] Índice é tratado como pendência futura ou implementado se necessário.

---

## 24. Importação DOCX

- [ ] Importador lê `word/document.xml`.
- [ ] Importador lê `word/styles.xml`.
- [ ] Importador lê relações.
- [ ] Importador lê mídia.
- [ ] Importador lê tabelas.
- [ ] Importador lê quebras de página.
- [ ] Importador lê runs.
- [ ] Importador preserva negrito.
- [ ] Importador preserva itálico.
- [ ] Importador preserva sublinhado quando possível.
- [ ] Importador detecta autor.
- [ ] Importador detecta título.
- [ ] Importador detecta resumo.
- [ ] Importador detecta abstract.
- [ ] Importador detecta introdução.
- [ ] Importador detecta referências.
- [ ] Importador detecta anexos.
- [ ] Importador detecta apêndices.
- [ ] Importador não para em referências.
- [ ] Importador não para em anexos.
- [ ] Importador não para em apêndices.
- [ ] Importador preserva conteúdo até o fim do documento.

---

## 25. Exportação DOCX

- [ ] Exportador usa estilos centralizados.
- [ ] Exportador gera capa.
- [ ] Exportador gera folha de rosto.
- [ ] Exportador gera ficha/reserva de ficha.
- [ ] Exportador gera folha de aprovação quando preenchida.
- [ ] Exportador gera dedicatória quando preenchida.
- [ ] Exportador gera agradecimentos quando preenchido.
- [ ] Exportador gera epígrafe quando preenchida.
- [ ] Exportador gera resumo.
- [ ] Exportador gera abstract.
- [ ] Exportador gera indicadores.
- [ ] Exportador gera listas.
- [ ] Exportador gera sumário.
- [ ] Exportador gera corpo textual.
- [ ] Exportador gera referências.
- [ ] Exportador gera anexos.
- [ ] Exportador gera apêndices.
- [ ] Exportador insere número de página com campo Word.
- [ ] Exportador preserva negrito.
- [ ] Exportador preserva itálico.
- [ ] Exportador não transforma corpo em título.
- [ ] Exportador não coloca número na capa.
- [ ] Exportador não coloca número nos pré-textuais.
- [ ] Exportador coloca número a partir da introdução.

---

## 26. Interface da tela única

- [ ] Tela permite escolher tipo de trabalho.
- [ ] Tela permite importar DOCX.
- [ ] Tela permite importar TXT.
- [ ] Tela permite importar MD.
- [ ] Tela exibe campos detectados.
- [ ] Tela exibe confiança de detecção.
- [ ] Tela permite editar todos os campos.
- [ ] Tela permite editar resumo.
- [ ] Tela permite editar abstract.
- [ ] Tela permite editar indicadores.
- [ ] Tela permite revisar listas.
- [ ] Tela permite revisar referências.
- [ ] Tela permite revisar anexos.
- [ ] Tela permite revisar apêndices.
- [ ] Tela exibe alertas normativos.
- [ ] Tela possui botão `Validar normas UFLA`.
- [ ] Tela possui botão `Gerar DOCX UFLA`.
- [ ] Tela não possui painel de IA.
- [ ] Tela não chama serviço externo.

---

## 27. Testes automatizados

- [ ] Testa existência do Manual na raiz.
- [ ] Testa existência do template na raiz.
- [ ] Testa existência do PRD.
- [ ] Testa importação do template real.
- [ ] Testa detecção de autor.
- [ ] Testa detecção de título.
- [ ] Testa detecção de resumo.
- [ ] Testa detecção de abstract.
- [ ] Testa detecção de introdução.
- [ ] Testa detecção de referências.
- [ ] Testa detecção de anexos.
- [ ] Testa detecção de apêndices.
- [ ] Testa preservação de runs.
- [ ] Testa negrito.
- [ ] Testa itálico.
- [ ] Testa geração de DOCX.
- [ ] Testa margens.
- [ ] Testa A4.
- [ ] Testa paginação.
- [ ] Testa sumário.
- [ ] Testa listas.
- [ ] Testa referências.
- [ ] Testa ausência de azul indevido.
- [ ] Testa ausência de IA/chave externa.
- [ ] `npm.cmd test` passa.
- [ ] `npm.cmd run build` passa.
- [ ] `npm.cmd run verify` passa.

---

## 28. GitHub antes de trocar de computador

- [ ] Rodar `npm.cmd test`.
- [ ] Rodar `npm.cmd run build`.
- [ ] Rodar `npm.cmd run verify`.
- [ ] Verificar arquivos temporários `.bak-runs`.
- [ ] Remover scripts temporários usados só para patch, se não forem necessários.
- [ ] Confirmar que `PRD.md` está atualizado.
- [ ] Confirmar que os dois arquivos `.md` normativos foram adicionados.
- [ ] Confirmar que `CHECKLIST.md` principal está atualizado.
- [ ] Conferir `git status`.
- [ ] Se o repositório Git estiver apontando para pasta errada, corrigir antes de commit.
- [ ] Criar commit com mensagem clara.
- [ ] Enviar ao GitHub.
- [ ] Clonar/puxar no outro computador à tarde.
