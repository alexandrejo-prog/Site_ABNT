# CHECKLIST DE DESENVOLVIMENTO DO SITE CONFORME MANUAL UFLA

**Objetivo:** checklist técnico-normativo para implementar, revisar e testar o site gerador de DOCX conforme o Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA, 6ª edição.

**Regra operacional:** marque `[x]` apenas quando o requisito estiver implementado, testado e funcionando no DOCX gerado. Se estiver parcialmente implementado, mantenha `[ ]` e registre observação.

**Referências normativas:**
1. **Manual UFLA 6ª ed.** — Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA, 6ª ed., 2025
2. **NBR 14724:2024** — Apresentação de trabalhos acadêmicos
3. **NBR 6023:2020** — Referências
4. **NBR 10520:2023** — Citações
5. **NBR 6028:2021** — Resumos
6. **NBR 6027:2012** — Sumário
7. **NBR 6024:2012** — Numeração progressiva
8. **NBR 6033:2022** — Ordem alfabética
9. **NBR 6022:2018** — Artigo em periódico
10. **NBR 15287:2025** — Projeto de pesquisa

**Regra de prioridade:** Manual UFLA (1º) → ABNT (2º, quando UFLA omite).

**Última verificação:** 01/08/2026
**Status geral:** 🟢
**Testes:** 122/122 — 1033/1033 — 0 TS errors (10 skipped)

### Status por Tipo de Trabalho

| Tipo | Conforme | Não Conforme | GRAVES | Status |
|------|---------|-------------|--------|--------|
| Dissertação | 48 | 2 | 0 | 🟢 |
| Tese | 48 | 2 | 0 | 🟢 |
| TCC/Monografia | 47 | 2 | 0 | 🟢 |
| Artigo | 40 | 0 | 0 | 🟢 |
| Resumo CPG | 35 | 0 | 0 | 🟢 |
| Resumo Expandido CPG | 38 | 0 | 0 | 🟢 |
| Artigo Completo CPG | 38 | 0 | 0 | 🟢 |
| Projeto Pesquisa | 42 | 1 | 0 | 🟢 |

### Pendências Conhecidas

| # | Item | Prioridade | Local | Norma |
|---|------|-----------|-------|-------|
| P1 | Tabela traço duplo superior/inferior (atualmente SINGLE) | BAIXO | `docx-render-core.ts`, `export-docx.ts` | Manual UFLA 3.2.10, p.80; NBR 14724:2024 |
| P2 | Apêndices/anexos continuam paginação | BAIXO | `export-docx.ts` | Manual UFLA 3.2.7, p.73; NBR 14724:2024 |
| P3 | Título em inglês na folha de aprovação | BAIXO | `export-docx.ts` | Manual UFLA 3.1.2.1.4, p.44 |
| P4 | Coorientador na folha de aprovação | BAIXO | `export-docx.ts` | Manual UFLA 3.1.2.1.4, p.44 |
| P5 | 4+ autores: et al. em itálico nas referências | BAIXO | `export-docx.ts` | NBR 6023:2020, Seção 8.1.3 |
| P6 | Citação direta: validação autor-data-página | BAIXO | `docx-render-core.ts` | NBR 10520:2023, Seção 6.2 |
| P7 | Validação de extensão resumo (150-500 palavras) | BAIXO | `export-docx.ts` | NBR 6028:2021, Seção 4

---

## 1. Arquivos normativos e projeto

- [x] `PRD.md` existe na raiz.
- [x] PDF do Manual de Normalização UFLA 6ª ed. existe na raiz.
- [x] Template oficial DOCX da UFLA existe na raiz.
- [x] Este checklist existe na raiz.
- [x] Projeto sem backend, banco, autenticação, IA.
- [x] Projeto em tela única, gera DOCX como saída principal.

---

## 2. Regras globais de formatação

Fonte: Manual UFLA 6ª ed., Seção 3.2.1-3.2.3, p.68-69; NBR 14724:2024, Seção 5.1-5.2

- [x] Papel A4 (21,0 × 29,7 cm) configurado no DOCX.
- [x] Margens: superior 3 cm, inferior 2 cm, esquerda 3 cm, direita 2 cm.
- [x] Cabeçalho a 2 cm do topo.
- [x] Fonte padrão Times New Roman.
- [x] Cor preta para todo texto acadêmico.
- [x] Tamanho 12 para texto corrido.
- [x] Tamanho 11 para: citações longas, fontes/legendas de ilustrações e tabelas, nota descritiva (natureza).
- [x] Tamanho 10 para paginação.
- [x] Espaçamento 1,5 para texto corrido e títulos de seções.
- [x] Espaço simples para: citações longas, referências, natureza, resumo, abstract, ficha catalográfica, legendas, fontes.
- [x] Sem espaçamento antes/depois entre parágrafos (after: 0).
- [x] Parágrafos justificados.
- [x] Recuo de primeira linha: 1,25 cm.
- [x] Títulos exportados com nível adequado (Heading1/2/3).
- [x] Referências exportadas como parágrafo, não como título.
- [x] Sem cor azul indevida em resumo, abstract, corpo ou referências.

---

## 3. Capa

- [x] Capa é gerada.
- [x] Logo da UFLA é inserida no topo.
- [x] Logo tem aproximadamente 7 cm x 2,85 cm.
- [x] Autor aparece centralizado em maiúsculas, negrito, 14pt.
- [x] Título aparece centralizado em maiúsculas, negrito, 16pt, espaçamento 1,5.
- [x] Subtítulo: separado por dois pontos, sem negrito, preserva caixa original.
- [x] Local como "LAVRAS - MG": maiúsculas, negrito, 14pt.
- [x] Ano em negrito, 14pt, ao fim da página.
- [x] Capa não exibe número de página.
- [x] Capa não entra na contagem total de páginas.

---

## 4. Folha de rosto

- [x] Folha de rosto é gerada.
- [x] Autor aparece no alto da página.
- [x] Autor no alto: centralizado, maiúsculas, negrito (12pt).
- [x] Título centralizado, maiúsculas, negrito (12pt, espaçamento 1,5).
- [x] Subtítulo separado por dois pontos, sem negrito, preserva caixa original.
- [x] Nota descritiva/natureza gerada com recuo 8cm e espaço simples.
- [x] Nota descritiva informa: tipo, instituição, curso/programa, orientador.
- [ ] Nota descritiva informa área de concentração e título pretendido quando aplicável.
- [ ] Coorientador é exibido quando preenchido.
- [x] Local (cidade-UF): maiúsculas, negrito.
- [x] Ano: negrito.
- [x] Folha de rosto é contada para paginação, não exibe número.

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

- [x] Folha de aprovação é gerada.
- [x] Autor: centralizado, maiúsculas, negrito (12pt).
- [x] Título: maiúsculas, negrito.
- [x] Nota descritiva exibida.
- [x] Orientador exibido.
- [x] Local e ano exibidos.
- [x] Folha de aprovação não exibe número de página.
- [ ] Título em inglês (pendente — segunda fase).
- [ ] Data de aprovação no formulário (⚠️ médio — campo existe nos types, falta no form).
- [ ] Membros da banca no formulário (⚠️ médio — idem).
- [ ] Instituições dos membros (⚠️ médio — idem).

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

- [x] Título `RESUMO`: centralizado, maiúsculas, negrito.
- [x] Texto justificado, espaço simples, parágrafo único.
- [x] Palavras-chave abaixo: `Palavras-chave:` (negrito), separadas por `;`, finalizadas por `.`.
- [ ] Validação de extensão (150-500 palavras TCC, 100-250 artigo).
- [ ] Verbo na terceira pessoa (não validado).
- [x] Resumo não fica azul.

---

## 12. Abstract / resumo em língua estrangeira

- [x] Título `ABSTRACT`: centralizado, maiúsculas, negrito.
- [x] Texto justificado, espaço simples.
- [x] Keywords abaixo: `Keywords:` (negrito), separadas por `;`, finalizadas por `.`.
- [x] Abstract não fica azul.

---

## 13. Indicadores de impacto

- [x] Indicadores exigidos para tese/dissertação.
- [x] Título `INDICADORES DE IMPACTO`: centralizado, maiúsculas, negrito.
- [x] `IMPACT INDICATORS` gerado em página seguinte.
- [x] Texto em parágrafo único, terceira pessoa.
- [x] Sistema alerta se dissertação/tese não tiver indicadores.
- [ ] Validação de extensão (150-500 palavras).
- [ ] Validação de conteúdo (caráter extensionista, ODS, etc.).

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

Fonte: Manual UFLA 6ª ed., Seção 3.1.2.1.14, p.57-60; NBR 6027:2012

- [x] Título `SUMÁRIO`: centralizado, maiúsculas, negrito.
- [x] Último elemento pré-textual.
- [x] Lista seções na ordem do texto, mesma grafia dos títulos.
- [x] Não inclui pré-textuais (capa, folha de rosto, aprovação, resumo, abstract, listas).
- [x] Inclui referências, apêndices, anexos (sem numeração).
- [x] Pós-textuais sem numeração progressiva.
- [x] Campo TOC atualizável no Word (\o "1-3" \h \z \u).
- [x] CPG/Artigo não geram SUMÁRIO (formato do congresso; proibido em CPG).
- [x] Monografia/Dissertação/Tese/Projeto mantêm quebra de página antes de ABSTRACT.
- [x] Artigo/CPG mantêm Resumo/Palavras-chave/Abstract na mesma página (formato do congresso).
- [x] Matriz por tipo de trabalho coberta por teste (`tests/worktype-format-matrix.test.ts`).
- [ ] Páginas visíveis apenas após atualizar TOC no Word.
- [ ] Glossário no sumário (não implementado).

---

## 16. Elementos textuais

Fonte: Manual UFLA 6ª ed., Seção 3.1.2.2, p.60-61; NBR 14724:2024, Seção 4.2.2

- [x] Introdução detectada, exportada e inicia numeração visível.
- [x] Sistema permite: referencial teórico, metodologia, resultados, conclusão/considerações finais.
- [x] Títulos primários em nova página (pageBreak), negrito.
- [x] Títulos secundários em negrito.
- [x] Títulos terciários em negrito (Tese/Dissertação/TCC), sem negrito (CPG/Artigo/Projeto).
- [x] Corpo comum não recebe formatação de título.

---

## 17. Paginação

Fonte: Manual UFLA 6ª ed., Seção 3.2.7, p.73; NBR 14724:2024, Seção 5.5

- [x] Capa e ficha catalográfica NÃO contadas.
- [x] Folha de rosto é contada (primeira contada).
- [x] Pré-textuais contados mas SEM número visível.
- [x] Numeração visível começa na introdução (start: 1), arábicos.
- [x] Número no canto superior direito, 10pt.
- [ ] Apêndices e anexos continuam paginação.
- [x] DOCX usa campo PageNumber.CURRENT do Word (não texto fixo).
- [x] Sistema alerta quando Word precisar atualizar campos.

---

## 18. Numeração progressiva

Fonte: Manual UFLA 6ª ed., Seção 3.2.4, p.70-72; NBR 6024:2012

- [x] Algarismos arábicos, seções (não capítulos), máx. 5 níveis.
- [x] Título primário: `1 TÍTULO` (negrito, uppercase, LEFT).
- [x] Título secundário: `1.1 Título` (negrito, LEFT).
- [x] Título terciário: `1.1.1 Título` (negrito/regular conforme tipo).
- [x] Número e título separados por espaço, sem pontuação.
- [x] Títulos longos alinhados sob primeira letra.
- [x] Títulos sem indicativo numérico: centralizados, maiúsculas, negrito.

---

## 19. Citações

Fonte: Manual UFLA 6ª ed., Seção 4, p.81-83; NBR 10520:2023

### 19.1. Citação direta curta (NBR 10520:2023, Seção 6.1)

- [x] Sistema preserva citações entre aspas duplas (passa pelo markup).
- [x] Sistema preserva itálico/negrito dentro da citação (markup runs).
- [ ] Sistema valida padrão autor-data-página.
- [ ] Sistema não transforma citação curta em citação longa.

### 19.2. Citação direta longa (Manual UFLA 3.2.1, p.68; NBR 10520:2023, Seção 6.2)

- [x] Sistema detecta citação longa quando marcada (via `> ` prefixo).
- [x] Citação longa: recuo 4 cm, fonte 11, espaço simples, sem aspas.
- [x] Citação longa não recebe recuo de parágrafo comum.
- [ ] Sistema alerta possível citação longa não marcada.

### 19.3. Citação indireta e citação de citação (NBR 10520:2023, Seção 6.3-6.4)

- [ ] Sistema preserva citações autor-data.
- [ ] Sistema preserva `apud`.
- [ ] Sistema não inventa fonte original.
- [ ] Sistema alerta citação sem referência provável.
- [ ] Sistema alerta referência sem citação provável.

### 19.4. Expressões e destaques (NBR 10520:2023, Seção 6.7)

- [x] Negrito e itálico em ênfase preservados.
- [x] `et al.` preservado.
- [ ] `et al.` em itálico (NBR 10520:2023).
- [ ] Supressões com colchetes preservadas.

---

## 20. Ilustrações

Fonte: Manual UFLA 6ª ed., Seção 3.2.9, p.74-77; NBR 14724:2024, Seção 5.8

- [x] Sistema detecta ilustração importada.
- [x] Título acima: tipo (1ª maiúscula) + número + travessão + título.
- [x] Título: 12pt, espaço simples, centralizado.
- [x] Fonte abaixo: 11pt, espaço simples, itálico, alinhado à direita.
- [x] Imagem centralizada horizontalmente.
- [ ] Imagem dimensionada para caber nas margens.
- [x] Imagem exportada no DOCX com dados binários preservados.
- [x] Sistema alerta imagem sem legenda e sem fonte.
- [x] Quadro tratado como ilustração, não como tabela.

---

## 21. Tabelas

Fonte: Manual UFLA 6ª ed., Seção 3.2.10, p.78-80; NBR 14724:2024, Seção 5.9

- [x] Sistema exporta tabela nativa do Word.
- [x] Título acima: "Tabela" + número + travessão + título, 12pt, espaço simples.
- [x] Fonte abaixo: 11pt, espaço simples.
- [x] Tabela NÃO fechada lateralmente (sem traço esquerdo/direito).
- [ ] Tabela usa traço duplo horizontal superior/inferior (atualmente SINGLE).
- [x] Tabela dentro das margens.
- [ ] Sistema alerta tabela sem título.
- [ ] Sistema alerta tabela sem fonte.

---

## 22. Referências

Fonte: Manual UFLA 6ª ed., Seção 5, p.90-92; NBR 6023:2020

### 22.1. Bloco de referências (NBR 6023:2020, Seção 6.1)

- [x] Título `REFERÊNCIAS`: centralizado, maiúsculas, negrito (Manual UFLA).
- [x] Referências alinhadas à esquerda, Times 12, espaço simples.
- [x] Espaço simples em branco entre referências.
- [x] Ordem alfabética (NBR 6033:2022).
- [x] Título da obra em negrito (Manual UFLA 5.2, p.92 — padroniza negrito).
- [ ] 4+ autores: et al. em itálico (NBR 6023:2020, Seção 8.1.3).
- [ ] Anônimo/pessoa jurídica não tratado.

### 22.2. Preservação (NBR 6023:2020)

- [x] Autores, títulos, subtítulos, edição, local, editora, ano preservados.
- [x] DOI, URL, "Disponível em:", "Acesso em:" preservados.
- [x] Sistema não inventa dados ausentes.

### 22.3. Destaque e autoria (NBR 6023:2020, Seção 8.1)

- [x] Título da obra em negrito quando detectável (Manual UFLA).
- [x] Até 3 autores preservados.
- [ ] 4+ autores: primeiro + et al. (itálico).
- [ ] Autoria desconhecida: entrada pelo título.
- [ ] Pessoa jurídica preservada.

### 22.4. Pontuação (NBR 6023:2020, Seção 7)

- [x] Ponto após autor, após título, após edição.
- [x] Dois-pontos entre local e editora, entre título e subtítulo.
- [x] Vírgula entre editora e ano.
- [x] Ponto e vírgula entre autores.
- [x] Hífen entre páginas inicial-final.
- [ ] `[S. l.]`, `[s. n.]`, `[S. l.: s. n.]` para ausências.

### 22.5. Validação (NBR 6023:2020)

- [ ] Alerta referência sem autor provável.
- [ ] Alerta referência sem ano provável.
- [ ] Alerta referência online sem acesso.
- [ ] Alerta item muito curto.
- [ ] Referência incerta preservada sem normalização destrutiva.

### 22.6. Tipos (NBR 6023:2020)

- [x] Conteúdo das referências preservado conforme editoração do usuário.
- [ ] Tipos específicos reconhecidos e formatados automaticamente.
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
- [x] Remover scripts temporários usados só para patch (14 arquivos removidos: debug-analyzer*.ts, debug-page-field*.ts, gerar-*.ts, rodar-skill.ts, verificar-*.ts, tests/generate-real-docx.ts, tests/analyze-references.ts).
- [ ] Confirmar que `PRD.md` está atualizado.
- [ ] Confirmar que os dois arquivos `.md` normativos foram adicionados.
- [ ] Confirmar que `CHECKLIST.md` principal está atualizado.
- [ ] Conferir `git status`.
- [ ] Se o repositório Git estiver apontando para pasta errada, corrigir antes de commit.
- [ ] Criar commit com mensagem clara.
- [ ] Enviar ao GitHub.
- [ ] Clonar/puxar no outro computador à tarde.
