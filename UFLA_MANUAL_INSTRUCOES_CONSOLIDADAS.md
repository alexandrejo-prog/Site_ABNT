# INSTRUÇÕES CONSOLIDADAS DO MANUAL DE NORMALIZAÇÃO UFLA PARA O SITE

**Base normativa:** Universidade Federal de Lavras. Biblioteca Universitária. *Manual de normalização e estrutura de trabalhos acadêmicos*. 6. ed. Lavras, MG: UFLA, 2025.

**Finalidade deste arquivo:** transformar o Manual de Normalização da UFLA em uma matriz operacional para desenvolvimento do site gerador de DOCX. Este arquivo não substitui o manual. Ele organiza as regras que o sistema deve aplicar, validar e testar.

**Regra de autoridade:** quando houver conflito entre código, template, preferências anteriores e Manual UFLA, prevalece o Manual UFLA. Quando alguma regra ainda não puder ser implementada tecnicamente, o sistema deve emitir alerta e registrar pendência no checklist.

---

## 1. Princípios gerais do sistema

### 1.1. Prioridade normativa

O site deve obedecer, nesta ordem:

1. Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA, 6ª edição.
2. Template oficial de formato padrão da UFLA em Word.
3. Estrutura detectada no arquivo importado.
4. Edição manual realizada pelo usuário.
5. Regras técnicas internas do gerador DOCX.

A edição manual do usuário prevalece sobre a importação, mas não deve ocultar alertas normativos. Se o usuário mantiver uma estrutura fora do padrão, o sistema deve permitir a decisão, porém deve acusar a inconformidade.

### 1.2. Saída principal

A saída principal do sistema deve ser `.docx`, por ser o formato editável exigido para revisão e ajustes em Word ou editor compatível. PDF pode ser recurso futuro, mas não deve substituir a geração DOCX.

### 1.3. Cor e fonte

Todo texto acadêmico deve ser em **cor preta**, exceto descrições acessíveis específicas do próprio manual quando aplicáveis. O site não deve gerar resumo, abstract, referências, corpo textual ou títulos em azul.

A fonte padrão deve ser **Times New Roman ou similar**. São aceitas fontes similares com aparência serifada equivalente, como Liberation Serif, DejaVu Serif, Nimbus Roman, Droid Serif ou Computer Modern Serif.

---

## 2. Tipos de trabalhos e formatos aceitos

O sistema deve permitir, no mínimo:

1. Artigo.
2. Monografia.
3. Dissertação.
4. Tese.
5. Outro formato acadêmico autorizado.

Para monografias, dissertações e teses, deve ser adotado o formato padrão de trabalho acadêmico, com parte externa, elementos pré-textuais, textuais e pós-textuais. O manual reconhece também outros formatos de trabalho de conclusão de curso, especialmente na pós-graduação profissional, mas o site deve priorizar inicialmente o formato padrão.

---

## 3. Estrutura geral obrigatória do trabalho

A estrutura do trabalho acadêmico deve ser tratada em quatro grupos.

### 3.1. Parte externa

| Elemento | Obrigatoriedade | Regra para o site |
|---|---:|---|
| Capa | Obrigatória | Gerar sempre no formato UFLA. |
| Lombada | Opcional | Não gerar no MVP, mas manter como pendência futura para versão impressa. |

### 3.2. Elementos pré-textuais

| Elemento | Obrigatoriedade | Regra para o site |
|---|---:|---|
| Folha de rosto | Obrigatória | Gerar sempre. |
| Ficha catalográfica | Obrigatória | Inserir bloco reservado ou permitir upload/imagem; não inventar ficha. |
| Errata | Opcional | Gerar apenas se o usuário preencher. |
| Folha de aprovação | Obrigatória | Gerar quando houver dados de banca/aprovação; permitir campo editável. |
| Dedicatória | Opcional | Gerar apenas se preenchida; não possui título. |
| Agradecimentos | Opcional | Gerar se preenchido; título centralizado em maiúsculas e negrito. |
| Epígrafe | Opcional | Gerar se preenchida; sem título; preferencialmente alinhada à direita/inferior; citação em itálico quando aplicável. |
| Resumo em língua vernácula | Obrigatório | Gerar sempre; alertar se ausente. |
| Resumo em língua estrangeira | Obrigatório | Gerar sempre; alertar se ausente. |
| Indicadores de impacto | Obrigatório para pós-graduação Stricto sensu | Exigir/alertar em dissertação e tese. |
| Impact indicators | Obrigatório para pós-graduação Stricto sensu | Versão traduzida dos indicadores. |
| Lista de ilustrações | Opcional, mas necessária se houver muitas ilustrações | Gerar quando houver figuras/gráficos/quadros/mapas/imagens detectados ou quando usuário solicitar. |
| Lista de tabelas | Opcional, mas necessária se houver tabelas | Gerar quando houver tabelas detectadas ou quando usuário solicitar. |
| Lista de abreviaturas | Opcional | Gerar se houver itens preenchidos. |
| Lista de siglas | Opcional | Gerar se houver siglas preenchidas/detectadas. |
| Lista de símbolos | Opcional | Gerar se houver símbolos preenchidos/detectados. |
| Sumário | Obrigatório | Gerar sempre. É o último elemento pré-textual. |

### 3.3. Elementos textuais

| Elemento | Obrigatoriedade | Regra para o site |
|---|---:|---|
| Introdução | Obrigatória | Detectar e gerar como primeira seção textual. |
| Desenvolvimento | Obrigatório | Pode conter referencial teórico, metodologia, resultados e discussão ou outras seções definidas pelo usuário/orientador. |
| Conclusão ou considerações finais | Obrigatória | Detectar e gerar; permitir uma das duas formas conforme o trabalho. |

### 3.4. Elementos pós-textuais

| Elemento | Obrigatoriedade | Regra para o site |
|---|---:|---|
| Referências | Obrigatórias | Gerar sempre; alertar se ausentes. |
| Glossário | Opcional | Gerar se preenchido. |
| Apêndices | Opcional | Gerar se preenchido/detectado. |
| Anexos | Opcional | Gerar se preenchido/detectado. |
| Índice | Opcional | Deixar para versão futura, se necessário. |

---

## 4. Capa

A capa é obrigatória e deve conter, nessa ordem, todos os elementos centralizados.

### 4.1. Elementos da capa

1. Logomarca mais recente da UFLA.
2. Nome do autor.
3. Título.
4. Subtítulo, se houver.
5. Cidade da instituição seguida de hífen e sigla do estado.
6. Ano de depósito/entrega.

### 4.2. Formatação da capa

| Item | Regra |
|---|---|
| Logomarca | 7 cm de largura por 2,85 cm de altura, centralizada. |
| Autor | Letras maiúsculas, Times ou similar, tamanho 14, negrito, centralizado, espaçamento simples. |
| Título | Letras maiúsculas, Times ou similar, tamanho 16, negrito, centralizado, espaçamento 1,5. |
| Subtítulo | Separado do título por dois pontos; sem negrito, salvo se o manual/template indicar outra exigência. |
| Local | Exemplo: LAVRAS – MG; letras maiúsculas, tamanho 14, negrito, centralizado. |
| Ano | Tamanho 14, negrito, centralizado ao fim da página. |
| Distribuição | Elementos distribuídos uniformemente na página. |

### 4.3. Regras de validação da capa

O sistema deve alertar quando:

- autor estiver ausente;
- título estiver ausente;
- local estiver ausente;
- ano estiver ausente;
- logo da UFLA não tiver sido carregada;
- subtítulo estiver misturado ao título sem separador claro;
- título da capa divergir do título da folha de rosto ou da folha de aprovação.

---

## 5. Folha de rosto

A folha de rosto é obrigatória e deve ser redigida em Times ou similar, tamanho 12, com espaçamento simples entre linhas, exceto o título, que usa espaçamento 1,5.

### 5.1. Elementos obrigatórios da folha de rosto

1. Autor.
2. Título.
3. Subtítulo, se houver.
4. Nota descritiva/natureza do trabalho.
5. Orientador.
6. Coorientador, se houver.
7. Cidade e UF.
8. Ano.

### 5.2. Regras de formatação

| Item | Regra |
|---|---|
| Autor | No alto da página, centralizado, letras maiúsculas, negrito. |
| Título | Letras maiúsculas, negrito, centralizado, idêntico ao título registrado. |
| Subtítulo | Separado do título por dois pontos; sem negrito. |
| Nota descritiva | Recuada do meio da página para a margem direita; espaço simples; deve informar natureza, instituição, curso/programa, área de concentração e título pretendido. |
| Orientador/coorientador | Centralizados, com titulação abreviada quando informada. |
| Local e ano | Centralizados ao final. |

### 5.3. Validação

Alertar quando:

- natureza do trabalho estiver ausente;
- orientador estiver ausente em monografia, dissertação ou tese;
- programa/curso estiver ausente;
- área de concentração estiver ausente quando exigida;
- título não coincidir com capa.

---

## 6. Ficha catalográfica

A ficha catalográfica é obrigatória, mas não deve ser inventada pelo sistema.

### 6.1. Regra operacional

O sistema deve:

1. Reservar espaço para a ficha catalográfica.
2. Permitir colar texto ou inserir imagem/PDF da ficha gerada pela Biblioteca.
3. Alertar que a ficha deve ser gerada pelo sistema próprio da Biblioteca Universitária da UFLA, com dados informados pelo autor.
4. Não fabricar dados catalográficos automaticamente.
5. Não incluir a ficha na contagem total de páginas do trabalho.
6. Não exibir número de página na ficha.

---

## 7. Errata

Elemento opcional. Deve ser inserido após a folha de rosto quando houver erros corrigidos após a impressão ou fechamento do trabalho.

O sistema deve permitir uma tabela com:

1. Folha/página.
2. Linha.
3. Onde se lê.
4. Leia-se.

A errata deve conter também a referência do trabalho corrigido.

---

## 8. Folha de aprovação

Elemento obrigatório, especialmente para versão final após defesa.

### 8.1. Conteúdo

1. Autor.
2. Título.
3. Subtítulo, se houver.
4. Título em inglês, quando aplicável a dissertações/teses.
5. Nota descritiva.
6. Data de aprovação.
7. Membros da banca com titulação e instituição.
8. Orientador.
9. Coorientador, se houver.
10. Local.
11. Ano.

### 8.2. Formatação

- Times ou similar, tamanho 12.
- Espaçamento simples.
- Autor e título em letras maiúsculas e negrito.
- Subtítulo sem negrito.
- Dados centralizados conforme template.

---

## 9. Dedicatória

Elemento opcional.

Regras:

1. Deve aparecer em página independente.
2. Não possui título.
3. Recomenda-se alinhamento do meio da mancha gráfica até a margem direita.
4. Recomenda-se posicionamento na parte inferior da página.
5. Deve ser gerada apenas se o usuário preencher.

---

## 10. Agradecimentos

Elemento opcional, mas com exigências quando houver bolsa ou apoio.

Regras:

1. Página independente.
2. Título `AGRADECIMENTOS`.
3. Título em letras maiúsculas, negrito e centralizado.
4. Texto em parágrafos.
5. Mencionar programa de pós-graduação quando aplicável.
6. Se o autor for bolsista, agradecer obrigatoriamente ao órgão de fomento, como CAPES, CNPq, FAPEMIG ou outro.

---

## 11. Epígrafe

Elemento opcional.

Regras:

1. Página independente.
2. Sem título.
3. Texto normalmente em itálico quando for citação.
4. Alinhamento recomendado do meio da mancha gráfica até a margem direita.
5. Posicionamento recomendado na parte inferior.
6. Pode ocorrer também em páginas de abertura de seções primárias.

---

## 12. Resumo em língua vernácula

Elemento obrigatório.

### 12.1. Conteúdo

O resumo deve apresentar os pontos relevantes do trabalho. Deve ser conciso e redigido em parágrafo único, sem enumeração de tópicos. Recomenda-se o uso de verbo na terceira pessoa.

### 12.2. Extensão

| Tipo de documento | Extensão recomendada |
|---|---:|
| Trabalhos acadêmicos e relatórios técnico-científicos | 150 a 500 palavras |
| Artigos de periódicos | 100 a 250 palavras |
| Outros documentos | 50 a 100 palavras |

### 12.3. Palavras-chave

1. Devem aparecer abaixo do resumo.
2. Devem ser precedidas por `Palavras-chave:`.
3. Devem ser separadas por ponto e vírgula.
4. Devem terminar com ponto.
5. Devem iniciar com letra minúscula, exceto substantivos próprios e nomes científicos.

### 12.4. Formatação

1. Página independente.
2. Título `RESUMO`.
3. Título centralizado, maiúsculo e em negrito.
4. Texto justificado.
5. Espaçamento simples.
6. Texto preto.

---

## 13. Resumo em língua estrangeira

Elemento obrigatório.

Regras:

1. Corresponde à versão do resumo em outro idioma.
2. Deve manter as mesmas características do resumo em língua vernácula.
3. Deve ser seguido de palavras-chave no idioma correspondente.
4. Em inglês, usar `Keywords:`.
5. Em espanhol, usar `Palabras clave:`.
6. Em francês, usar `Mots-clés:`.
7. O título, por exemplo `ABSTRACT`, deve ser centralizado, maiúsculo e em negrito.
8. Texto justificado, em espaço simples e preto.
9. Keywords em minúsculas, separadas por ponto e vírgula e finalizadas com ponto.

---

## 14. Indicadores de impacto e Impact Indicators

Obrigatórios para dissertações e teses de pós-graduação Stricto sensu da UFLA.

### 14.1. Conteúdo

O autor deve relatar impactos sociais, tecnológicos, econômicos e/ou culturais, informando:

1. Resultados e impactos, preferencialmente caracterizados e quantificados.
2. Existência ou não de caráter extensionista.
3. Participação de sociedade externa, parceiros e público-alvo.
4. Território e grupos populacionais impactados.
5. Público diretamente beneficiado, se possível.
6. Número de docentes, estudantes e técnicos envolvidos, quando aplicável.
7. Área temática da Política Nacional de Extensão:
   - Comunicação;
   - Cultura;
   - Direitos humanos e justiça;
   - Educação;
   - Meio ambiente;
   - Saúde;
   - Tecnologia e produção;
   - Trabalho.
8. Relação com os 17 Objetivos de Desenvolvimento Sustentável da ONU.

### 14.2. Forma

1. Texto em língua vernácula em uma página.
2. Tradução na página seguinte.
3. Texto conciso, em terceira pessoa.
4. 150 a 500 palavras.
5. Parágrafo único.
6. Sem enumeração de tópicos.
7. Sem ilustrações.
8. Título `INDICADORES DE IMPACTO` e `IMPACT INDICATORS`, centralizados, maiúsculos e em negrito.

---

## 15. Listas de ilustrações, tabelas, abreviaturas, siglas e símbolos

### 15.1. Lista de ilustrações

Elemento opcional, mas deve ser gerada quando houver ilustrações relevantes.

Inclui:

- figuras;
- gráficos;
- quadros;
- desenhos;
- gravuras;
- mapas;
- fotografias;
- esquemas;
- fluxogramas;
- organogramas;
- imagens.

Regras:

1. Título `LISTA DE ILUSTRAÇÕES` centralizado, maiúsculo e em negrito.
2. Listar na mesma ordem em que aparecem no texto.
3. Cada item deve conter tipo, número, travessão, título e página.
4. Quando necessário, criar listas próprias: `LISTA DE FIGURAS`, `LISTA DE QUADROS`, `LISTA DE GRÁFICOS` etc.
5. Títulos longos devem alinhar a segunda linha abaixo do início do título.
6. O texto da lista não deve invadir a área do número de página.
7. O número da página deve ficar à direita, na linha inicial do item.

### 15.2. Lista de tabelas

Elemento opcional.

Regras:

1. Título `LISTA DE TABELAS` centralizado, maiúsculo e em negrito.
2. Listar tabelas na mesma ordem em que aparecem no texto.
3. Cada item deve conter número, travessão, título e página.
4. Títulos longos seguem a regra de alinhamento em escada.

### 15.3. Lista de abreviaturas e siglas

Elementos opcionais.

Regras:

1. Apresentar em ordem alfabética.
2. Sigla/abreviatura à esquerda.
3. Expressão correspondente por extenso à direita.
4. Ao aparecer pela primeira vez no texto, a sigla deve vir entre parênteses após o nome completo.

### 15.4. Lista de símbolos

Elemento opcional.

Regras:

1. Organizar de acordo com a ordem apresentada no texto.
2. Apresentar símbolo e respectivo significado.
3. Criar lista separada das siglas e abreviaturas.

---

## 16. Sumário

Elemento obrigatório e último elemento pré-textual.

### 16.1. Conteúdo

O sumário deve enumerar as seções e outras partes do trabalho na mesma ordem e conteúdo em que aparecem no texto, acompanhadas da paginação.

### 16.2. O que não entra no sumário

Não devem aparecer no sumário:

1. Capa.
2. Folha de rosto.
3. Folha de aprovação.
4. Dedicatória.
5. Agradecimentos.
6. Epígrafe.
7. Lista de figuras.
8. Lista de tabelas.
9. Lista de abreviaturas.
10. Lista de siglas.
11. Lista de símbolos.
12. Resumo em língua vernácula.
13. Resumo em língua estrangeira.
14. Outros elementos pré-textuais.

### 16.3. O que entra no sumário

Devem aparecer:

1. Seções textuais numeradas.
2. Referências.
3. Glossário, se houver.
4. Apêndices, se houver.
5. Anexos, se houver.
6. Índices, se houver.

Elementos pós-textuais aparecem no sumário, mas não recebem numeração progressiva.

### 16.4. Formatação

1. Título `SUMÁRIO` centralizado, maiúsculo, Times ou similar, tamanho 12 e negrito.
2. Títulos e subtítulos alinhados à margem esquerda.
3. Títulos no sumário devem ser grafados da mesma forma que aparecem no texto.
4. Títulos extensos devem alinhar a segunda linha pela margem do início do título da primeira linha.
5. Deve haver indicação de página à direita.
6. O site deve gerar campo atualizável do Word quando tecnicamente possível; caso contrário, gerar sumário estático e alertar o usuário.

---

## 17. Regras gerais de apresentação

### 17.1. Formato

1. Papel A4: 21,0 cm x 29,7 cm.
2. Texto em cor preta.
3. Fonte Times ou similar.
4. Tamanho 12 para texto comum.
5. Tamanho 11 para:
   - citações diretas com mais de três linhas;
   - notas;
   - paginação;
   - ficha catalográfica;
   - fontes de ilustrações e tabelas;
   - legendas de ilustrações e tabelas.

### 17.2. Margens

1. Superior: 3 cm.
2. Esquerda: 3 cm.
3. Inferior: 2 cm.
4. Direita: 2 cm.
5. Cabeçalho: 2 cm.

### 17.3. Espaçamento

| Elemento | Espaçamento |
|---|---|
| Texto corrido | 1,5 |
| Títulos de seções | 1,5 |
| Citações diretas com mais de três linhas | Simples |
| Notas de rodapé | Simples |
| Referências | Simples |
| Títulos de ilustrações e tabelas | Simples |
| Fontes e legendas de ilustrações e tabelas | Simples |
| Natureza do trabalho | Simples |
| Ficha catalográfica | Simples |
| Resumo/abstract, conforme modelo | Simples |

### 17.4. Parágrafo

1. Parágrafos do texto comum devem ser justificados.
2. O template UFLA usa recuo de primeira linha de 1,25 cm.
3. Não deve haver espaço antes/depois de parágrafos comuns, salvo regras específicas de separação de títulos e elementos.
4. O corpo textual comum não deve ser exportado como título, tópico, lista multinível ou outline level.
5. Apenas títulos reais devem receber nível de título/outline.

---

## 18. Numeração progressiva

A numeração progressiva deve organizar o texto em seções hierárquicas.

Regras:

1. Usar algarismos arábicos.
2. Não subdividir excessivamente; não ultrapassar seção quinária.
3. O trabalho deve ser dividido em seções, não em “capítulos”.
4. O indicativo numérico precede o título.
5. O indicativo numérico é alinhado à esquerda.
6. O número e o título são separados por um espaço.
7. Títulos de seções primárias devem iniciar em nova página em trabalhos de anverso.
8. Em trabalhos anverso e verso, seções primárias iniciam em página ímpar.
9. Títulos de seções primárias devem ficar na parte superior da mancha gráfica.
10. Títulos de subseções devem ser separados do texto anterior e posterior por espaço 1,5.
11. Títulos longos devem alinhar a segunda linha abaixo da primeira letra do título.

### 18.1. Títulos sem indicativo numérico

Devem ser centralizados, em maiúsculas e negrito quando aplicável:

- errata;
- agradecimentos;
- lista de ilustrações;
- lista de tabelas;
- lista de abreviaturas;
- lista de siglas;
- lista de símbolos;
- resumo;
- abstract;
- indicadores de impacto;
- sumário;
- referências;
- glossário;
- anexos;
- apêndices;
- índice.

### 18.2. Elementos sem título e sem indicativo numérico

Não devem ter título e não devem ter numeração visível:

- capa;
- folha de rosto;
- folha de aprovação;
- dedicatória;
- epígrafe.

---

## 19. Paginação

Regras obrigatórias:

1. Folhas/páginas pré-textuais são contadas a partir da folha de rosto, mas não são numeradas visualmente.
2. Capa não entra na contagem total.
3. Ficha catalográfica não entra na contagem total e também não é numerada.
4. A numeração visível começa na primeira página do primeiro elemento textual, normalmente `1 INTRODUÇÃO`.
5. A numeração deve ser em algarismos arábicos.
6. O número deve ficar no canto superior direito da folha.
7. Havendo mais de um volume, deve-se manter sequência única de numeração.
8. Apêndices e anexos continuam a paginação do texto principal.
9. O sistema não deve escrever manualmente números como texto comum; deve usar campo de paginação do Word sempre que possível.
10. Se a contagem exata depender de atualização no Word, o sistema deve avisar.

---

## 20. Citações

### 20.1. Citação direta curta

1. Até três linhas.
2. Deve estar entre aspas duplas.
3. Aspas simples são usadas para citação dentro de citação.
4. Deve seguir padrão autor, data e página.
5. O ponto final encerra a frase, não a citação.
6. Deve permitir correlação com a lista de referências ou notas.

### 20.2. Citação direta longa

1. Mais de três linhas.
2. Deve ser destacada do parágrafo.
3. Recuo recomendado: 4 cm da margem esquerda.
4. Fonte tamanho 11.
5. Espaçamento simples.
6. Sem aspas.
7. Deve indicar autor, data e página.
8. Não deve ser confundida com parágrafo comum.

### 20.3. Citação indireta

1. Texto baseado na obra consultada.
2. Segue padrão autor e data.
3. Página ou localização é opcional.
4. Deve permitir correlação com referências ou notas.

### 20.4. Citação de citação

1. Usada quando o autor citado não foi consultado diretamente.
2. Deve indicar autor original, data e página se houver.
3. Deve conter a expressão `apud`.
4. Na lista de referências, incluir apenas a fonte efetivamente consultada.

### 20.5. Regras gerais

1. Indicação de autoria nos parênteses deve usar letras maiúsculas e minúsculas.
2. Pessoa jurídica pode ser indicada por sigla ou nome completo.
3. Autoria governamental deve indicar jurisdição ou órgão superior.
4. Citação com mais de três autores pode usar `et al.`.
5. Localizador digital pode substituir página quando o documento não tiver paginação.
6. Supressões: indicar com colchetes e reticências.
7. Interpolações/acréscimos/comentários: usar colchetes.
8. Ênfases/destaques devem ser indicados por sublinhado, negrito ou itálico, conforme o caso.
9. O site deve preservar itálicos e negritos importados nas citações.
10. O site não deve inventar citações.

---

## 21. Notas

O sistema deve reservar suporte a:

1. Notas de referência.
2. Notas explicativas.

As notas devem usar fonte menor, espaçamento simples e numeração conforme padrão adotado. A implementação completa pode ficar para versão futura, mas o sistema deve preservar notas importadas quando possível e alertar quando não conseguir exportá-las.

---

## 22. Equações e fórmulas

1. Devem ser destacadas no texto para facilitar a leitura.
2. Podem ser numeradas em algarismos arábicos entre parênteses.
3. A numeração deve ficar alinhada à direita.
4. Deve ser permitido espaçamento maior quando a fórmula tiver expoentes, índices ou elementos que exigem altura adicional.
5. O site deve preservar texto de fórmulas quando possível e alertar quando não conseguir recriar equação nativa.

---

## 23. Ilustrações

São ilustrações:

- desenho;
- esquema;
- fluxograma;
- fotografia;
- gráfico;
- mapa;
- organograma;
- planta;
- quadro;
- retrato;
- figura;
- imagem;
- outros elementos visuais.

### 23.1. Título de ilustração

1. Deve ficar na parte superior da ilustração.
2. Formato: tipo da ilustração + número de ordem + travessão + título.
3. Apenas a primeira letra do tipo deve ser maiúscula.
4. Numeração em algarismos arábicos, sequencial ou por seção.
5. Fonte tamanho 12.
6. Espaçamento simples.
7. Se o título ocupar mais de uma linha, a segunda linha deve alinhar sob a primeira letra da primeira palavra do título.

### 23.2. Fonte da ilustração

1. Deve ficar abaixo da ilustração.
2. Fonte tamanho 11.
3. Espaçamento simples.
4. Deve ser redigida de forma sintética.
5. Se for produção do autor, usar forma compatível, como `Fonte: Do autor (ano).`
6. O site não deve apagar fonte detectada.

### 23.3. Ilustração em mais de uma página

Se a ilustração ocupar mais de uma página:

1. Repetir título nas páginas seguintes.
2. Usar indicações entre parênteses:
   - continua;
   - continuação;
   - conclusão.

### 23.4. Exportação no site

O site deve:

1. Detectar imagens no DOCX.
2. Preservar posição aproximada.
3. Detectar legenda acima.
4. Detectar fonte abaixo.
5. Inserir imagem no DOCX exportado quando possível.
6. Centralizar e dimensionar imagem para caber nas margens.
7. Alertar quando não conseguir preservar imagem.

---

## 24. Tabelas

### 24.1. Conceito e tratamento

Tabelas organizam dados de modo estruturado. O site deve tratá-las como tabelas nativas do Word sempre que possível.

### 24.2. Título

1. Deve ficar acima da tabela.
2. Formato: `Tabela` + número + travessão + título.
3. Fonte tamanho 12.
4. Espaçamento simples.

### 24.3. Fonte

1. Deve ficar abaixo da tabela.
2. Fonte tamanho 11.
3. Espaçamento simples.
4. Deve ser preservada.

### 24.4. Exportação no site

O site deve:

1. Detectar linhas e células.
2. Exportar como tabela nativa do Word.
3. Preservar conteúdo textual.
4. Preservar legenda.
5. Preservar fonte.
6. Manter dentro das margens.

---

## 25. Referências

As referências são obrigatórias e devem seguir o padrão ABNT/UFLA.

### 25.1. Título e disposição

1. Título `REFERÊNCIAS`.
2. Título centralizado, maiúsculo e em negrito.
3. Referências alinhadas à esquerda.
4. Fonte Times ou similar, tamanho 12.
5. Espaçamento simples.
6. Separação entre referências por espaço simples em branco.
7. Texto preto.

### 25.2. Pontuação

O sistema deve respeitar a pontuação uniforme:

1. Ponto após autor, título, edição, imprenta, número de páginas/volumes.
2. Ponto e vírgula entre autores.
3. Vírgula para separar sobrenome e prenome, editora e data, volume e página.
4. Dois pontos entre título e subtítulo e entre local e editora.
5. Hífen para página inicial-final.
6. Barra para períodos de fascículo quando necessário.
7. Colchetes para elementos não extraídos da obra ou ausentes.
8. Reticências entre colchetes para supressão de parte de título.

### 25.3. Destaque tipográfico

A UFLA padroniza **negrito** para os títulos em destaque nas referências. O site deve aplicar negrito nos títulos de obras, periódicos ou elementos destacados quando detectável.

### 25.4. Autoria pessoa física

1. Entrada pelo último sobrenome em maiúsculas.
2. Prenomes podem ser abreviados ou não, conforme constam no documento.
3. Autores separados por ponto e vírgula.
4. Até três autores: indicar todos.
5. Quatro ou mais autores: indicar o primeiro e usar `et al.`.
6. `et al.` deve ficar em itálico quando aplicado.
7. Não inventar autores ausentes.

### 25.5. Pessoa jurídica

1. Entrada pela forma conhecida ou destacada no documento.
2. Pode ser por extenso ou abreviada, conforme o documento.
3. Instituição governamental direta deve ser precedida pelo órgão superior ou jurisdição.
4. Padronizar nomes da mesma instituição quando aparecem de formas diferentes, mas sem inventar dados.

### 25.6. Autoria desconhecida

1. Entrada pelo título.
2. Primeira palavra do título em maiúsculas.
3. Não usar “Anônimo” nem “Autor desconhecido”.

### 25.7. Título e subtítulo

1. Reproduzir como aparecem no documento.
2. Separar título e subtítulo por dois pontos.
3. Em título muito longo, pode haver supressão final sem alterar o sentido, indicada por reticências entre colchetes.

### 25.8. Edição

1. Transcrever se constar no documento.
2. Usar abreviaturas do numeral ordinal e da palavra edição no idioma do documento.
3. Exemplos: `2. ed.`, `2nd ed.`, `3rd ed.`.
4. Indicar revisões/emendas/acréscimos como constarem no documento.
5. Versão de documento eletrônico equivale ao elemento edição.

### 25.9. Local

1. Indicar cidade como consta no documento.
2. Se houver homônimos, acrescentar estado ou país.
3. Havendo mais de um local, transcrever o primeiro ou o destacado.
4. Se local for identificado por inferência documental, usar colchetes.
5. Se impossível determinar, usar `[S. l.]` quando for o primeiro elemento do campo, ou `[s. l.]` conforme posição.

### 25.10. Editora

1. Transcrever como aparece no documento, suprimindo designações jurídicas/comerciais.
2. Duas editoras em locais diferentes: indicar ambas com respectivos locais.
3. Duas editoras no mesmo local: separar por dois pontos.
4. Se editora for também autora, pode-se usar forma abreviada/sigla se constar no documento.
5. Ausência de editora: usar `[s. n.]`.
6. Ausência de local e editora: usar `[S. l.: s. n.]`.

### 25.11. Data

1. Ano em algarismos arábicos.
2. Se não houver ano de publicação, indicar copyright, distribuição, impressão ou outro ano encontrado.
3. Ano provável deve vir entre colchetes com interrogação quando aplicável.
4. Não inventar ano.

### 25.12. Descrição física

O sistema deve preservar, quando houver:

- número de páginas;
- volumes;
- ilustrações;
- dimensões;
- série/coleção;
- notas.

### 25.13. Disponibilidade e acesso

Em documentos online:

1. Inserir `Disponível em:`.
2. Inserir URL.
3. Inserir `Acesso em:`.
4. Informar data de acesso.
5. DOI deve ser preservado quando houver.
6. Horário de acesso pode ser incluído quando necessário.
7. O site não deve apagar links ou DOI.

### 25.14. Modelos mínimos que o site deve reconhecer

1. Livro/monografia no todo.
2. Livro/monografia em meio eletrônico.
3. Parte de monografia/capítulo.
4. Trabalho acadêmico: TCC, monografia, dissertação, tese.
5. Correspondência.
6. Publicação periódica.
7. Artigo de periódico.
8. Artigo de periódico online.
9. Matéria de jornal.
10. Evento.
11. Patente.
12. Documento jurídico.
13. Documento audiovisual.
14. Documento sonoro.
15. Partitura.
16. Documento iconográfico.
17. Documento cartográfico.
18. Documento tridimensional.
19. Documento de acesso exclusivo eletrônico.
20. Dados de pesquisa e conjunto de dados.

### 25.15. Regra de segurança para normalização

O site pode normalizar de forma determinística, mas não pode inventar:

- autor;
- título;
- editora;
- local;
- ano;
- DOI;
- URL;
- data de acesso;
- páginas;
- periódico;
- edição.

Quando não conseguir normalizar com segurança, deve preservar o texto original e emitir alerta.

---

## 26. Apêndices e anexos

Elementos opcionais.

### 26.1. Diferença

1. Apêndice: texto ou documento elaborado pelo próprio autor.
2. Anexo: texto ou documento de autoria diferente.

### 26.2. Identificação

1. Letras maiúsculas consecutivas.
2. Travessão.
3. Título.
4. Exemplo: `APÊNDICE A – TÍTULO`.
5. Exemplo: `ANEXO A – TÍTULO`.

### 26.3. Formatação

1. Destaque tipográfico igual ao de seção primária.
2. Aparecem no sumário, mas não são numerados como seção textual.
3. Páginas devem continuar a paginação do texto principal.
4. Referências de anexo, se houver, devem constar no próprio elemento em nota de rodapé ou lista específica.

---

## 27. Regras de validação normativa do site

O site deve validar, no mínimo:

1. Autor ausente.
2. Título ausente.
3. Tipo de trabalho ausente.
4. Orientador ausente quando obrigatório.
5. Capa incompleta.
6. Folha de rosto incompleta.
7. Ficha catalográfica ausente ou não informada.
8. Folha de aprovação ausente quando exigida.
9. Resumo ausente.
10. Resumo com tópicos/listas.
11. Resumo fora da extensão recomendada.
12. Palavras-chave ausentes.
13. Abstract ausente.
14. Keywords ausentes.
15. Indicadores ausentes em dissertação/tese.
16. Sumário ausente.
17. Sumário contendo elemento pré-textual indevido.
18. Sumário sem referências.
19. Introdução ausente.
20. Conclusão/considerações finais ausente.
21. Referências ausentes.
22. Referência sem autor provável.
23. Referência sem ano provável.
24. Referência online sem acesso.
25. Referência sem destaque em negrito quando detectável.
26. `et al.` sem itálico.
27. Citação curta sem aspas.
28. Citação longa com aspas.
29. Citação longa sem recuo de 4 cm.
30. Citação longa sem fonte 11.
31. Citação longa sem espaço simples.
32. Corpo textual sem espaçamento 1,5.
33. Resumo/abstract/referências sem espaço simples.
34. Texto comum exportado como título ou outline indevido.
35. Títulos sem negrito.
36. Título primário sem nova página.
37. Paginação ausente.
38. Paginação visível antes da introdução.
39. Número de página fora do canto superior direito.
40. Imagem sem legenda.
41. Imagem sem fonte.
42. Tabela sem título.
43. Tabela sem fonte.
44. Lista de ilustrações ausente quando houver muitas ilustrações ou quando solicitada.
45. Lista de tabelas ausente quando houver tabelas ou quando solicitada.
46. Cor azul indevida no texto acadêmico.
47. Margens incorretas.
48. Fonte diferente de Times ou similar.
49. Tamanho de fonte incorreto.
50. Apêndices/anexos detectados mas não exportados.

---

## 28. Regras de implementação para o DOCX

### 28.1. Estilos internos obrigatórios

O projeto deve ter estilos centralizados:

- `ufla_capa_autor`
- `ufla_capa_titulo`
- `ufla_capa_subtitulo`
- `ufla_capa_local_ano`
- `ufla_folha_rosto_autor`
- `ufla_folha_rosto_titulo`
- `ufla_natureza`
- `ufla_titulo_sem_indicativo`
- `ufla_titulo_primario`
- `ufla_titulo_secundario`
- `ufla_titulo_terciario`
- `ufla_corpo_texto`
- `ufla_citacao_curta`
- `ufla_citacao_longa`
- `ufla_resumo`
- `ufla_palavras_chave`
- `ufla_abstract`
- `ufla_keywords`
- `ufla_referencia`
- `ufla_legenda_ilustracao`
- `ufla_fonte_ilustracao`
- `ufla_legenda_tabela`
- `ufla_fonte_tabela`
- `ufla_sumario_item`
- `ufla_lista_item`
- `ufla_anexo_titulo`
- `ufla_apendice_titulo`

### 28.2. Campos automáticos

Sempre que possível, usar campos automáticos do Word para:

1. Número de página.
2. Sumário.
3. Lista de ilustrações.
4. Lista de tabelas.

Quando não for tecnicamente possível, gerar versão estática e avisar o usuário.

### 28.3. Estrutura de seções DOCX

O exportador deve separar:

1. Pré-textuais sem número visível.
2. Textuais e pós-textuais com número visível no canto superior direito.

### 28.4. Preservação de conteúdo importado

O importador deve preservar:

1. Texto.
2. Runs com negrito.
3. Runs com itálico.
4. Sublinhado quando houver.
5. Títulos.
6. Parágrafos comuns.
7. Citações longas.
8. Tabelas.
9. Imagens.
10. Legendas.
11. Fontes.
12. Referências.
13. Anexos.
14. Apêndices.
15. Quebras de página.

---

## 29. Testes mínimos obrigatórios do site

O projeto deve ter testes automatizados para confirmar:

1. Margens UFLA.
2. Papel A4.
3. Fonte Times ou similar.
4. Texto comum tamanho 12.
5. Elementos especiais tamanho 11.
6. Corpo textual com espaçamento 1,5.
7. Resumo com espaço simples.
8. Abstract com espaço simples.
9. Referências com espaço simples.
10. Título primário em negrito.
11. Título sem indicativo em negrito.
12. Parágrafo comum sem outline level.
13. Título com outline level correto.
14. Paginação com campo de página.
15. Paginação visível só na seção textual.
16. Número de página no cabeçalho superior direito.
17. Sumário gerado.
18. Sumário não inclui pré-textuais.
19. Sumário inclui referências.
20. Sumário inclui anexos/apêndices.
21. Resumo detectado.
22. Abstract detectado.
23. Introdução detectada.
24. Referências detectadas.
25. Autor detectado.
26. Título detectado.
27. Imagem detectada.
28. Tabela detectada.
29. Referência com URL preservada.
30. Referência com DOI preservado.
31. `Acesso em:` preservado.
32. Título de obra em referência com negrito quando detectável.
33. `et al.` em itálico.
34. Normalizador não inventa dados.
35. Cor azul indevida ausente.
36. Build passa.
37. Verify passa.

---

## 30. Diretriz final

A meta do site não é gerar um documento “parecido” com o padrão UFLA. A meta é gerar um DOCX tecnicamente estruturado, validável e o mais fiel possível ao Manual de Normalização da UFLA. Tudo que não estiver implementado deve aparecer como pendência objetiva, não como conformidade presumida.
