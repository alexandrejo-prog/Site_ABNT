# UFLA DOCX Academico

Ferramenta de apoio a normalizacao academica UFLA/ABNT para gerar documentos .docx editaveis em trabalhos de graduacao, pos-graduacao, projeto de pesquisa e modelos CPG/UFLA.

**Posicionamento:** este sistema estrutura e valida parcialmente o documento, mas a submissao final continua exigindo revisao do usuario no DOCX gerado.

## Como rodar

1. Instale as dependencias com npm install.
2. Rode npm run dev.
3. Abra o endereco exibido pelo Vite.

## Comandos

- npm test
- npm run build
- npm run verify

## Implementado nesta rodada

- Importacao de .docx, .txt e .md.
- Extracao de texto DOCX com mammoth e estrutura OOXML complementar.
- Limpeza de sumario importado e reparo de titulo quebrado, incluindo Objetivos especificos.
- Identificacao provavel de campos academicos com indicacao de confianca.
- Editor visual com texto principal e referencias.
- Validacao normativa com erros bloqueantes e alertas nao bloqueantes.
- Resumo, abstract, palavras-chave, keywords e indicadores de impacto com validacoes dedicadas.
- Regras para ficha catalografica, listas pre-textuais, acessibilidade, performance e governanca.
- DOCX editavel com A4, margens UFLA, Times New Roman, corpo 12, citacoes longas 11, capa, folha de rosto, resumo, abstract, corpo, referencias e sumario atualizavel.
- Cadastro inicial dos 8 formatos da Colecao Producao Academica UFLA: artigo cientifico, patente, revisao sistematica e aprofundada da literatura, estudo de caso ou casos multiplos, desenvolvimento de software e aplicativos, cultivar, relatorio de estagio e proposta de intervencao.
- Fluxo recomendado: gerar DOCX, abrir no Word ou LibreOffice, atualizar sumario/campos quando necessario e exportar para PDF.

## Status normativo

O status real de cobertura, limitacoes conhecidas e pontos que exigem validacao manual esta registrado em STATUS_NORMATIVO.md.

A matriz tecnica da Colecao Producao Academica UFLA esta em docs/colecao-producao-academica-ufla.md.

## Conferencia final

- A ficha catalografica oficial, folha de aprovacao, imagens, legendas, referencias e paginacao final devem ser conferidas no DOCX gerado.
- Os formatos da Colecao Producao Academica UFLA estao cadastrados com suporte inicial; validacao manual continua obrigatoria e exportadores especificos serao incrementais.
- O sumario deve ser atualizado no Word ou LibreOffice com Ctrl+A e F9.
- O PDF final deve ser exportado pelo editor de texto externo.

## Observacoes

O PRD.md e o PDF do Manual da UFLA permanecem preservados na raiz do projeto. A evolucao normativa deve continuar por comparacao com documentos reais e revisao final humana.
