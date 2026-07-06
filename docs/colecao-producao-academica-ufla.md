# Colecao Producao Academica UFLA

Referencia tecnica interna para cadastro inicial dos formatos da Colecao Producao Academica UFLA no Site_ABNT.

Fonte normativa de partida: pagina da Colecao Producao Academica UFLA e guias locais preservados no repositorio. Em 2026-07-06, a pagina `https://tcc.ufla.br/index.php/colecao` foi consultada, mas respondeu com erro temporario. Esta matriz deve ser revisada manualmente contra a pagina oficial e os guias antes de qualquer declaracao de conformidade plena.

Premissas do sistema:

- A SPA nao usa backend, autenticacao, banco de dados ou API externa de IA no fluxo principal.
- O DOCX gerado pelo sistema e a saida canonica.
- O PDF final deve ser exportado pelo Word ou LibreOffice depois de atualizar campos, sumario e paginacao.
- Os formatos abaixo entram com suporte inicial e exportador generico ate existirem exportadores especificos.

## 1. Artigo cientifico

- Nome do tipo: Artigo cientifico.
- ID sugerido no sistema: `artigo_cientifico_ufla`.
- Definicao operacional: producao academica organizada como artigo cientifico, com resumo, palavras-chave, corpo textual, referencias e elementos exigidos pelo guia da Colecao.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; abstract; keywords; introducao; material e metodos ou metodologia; resultados e discussao; conclusao; referencias.
- Campos sugeridos: autor, titulo, subtitulo, curso/programa, orientador, resumo, palavras-chave, abstract, keywords, introducao, metodologia, conclusao, referencias, anexos/apendices quando houver.
- Aliases de deteccao: artigo cientifico; artigo; paper; manuscrito.
- Observacoes para implementacao: pode usar exportador generico nesta fase; nao deve substituir o tipo `artigo` simples ja existente.
- Limitacoes: aderencia a periodico, extensao, ordem de secoes e detalhes editoriais ainda nao sao validados automaticamente.
- Validacao manual necessaria: conferir guia especifico, resumo, citacoes, figuras, tabelas, referencias, sumario e paginacao no DOCX final.

## 2. Patente

- Nome do tipo: Patente.
- ID sugerido no sistema: `patente_ufla`.
- Definicao operacional: producao academica em formato de patente, com descricao tecnica, estado da tecnica e reivindicacoes.
- Estrutura geral: titulo; autoria; resumo; campo da invencao; estado da tecnica; descricao da invencao; reivindicacoes; desenhos ou anexos quando houver; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, introducao, referencial teorico/estado da tecnica, metodologia/descricao tecnica, referencias, anexos.
- Aliases de deteccao: patente; pedido de patente; propriedade intelectual; reivindicacoes.
- Observacoes para implementacao: usar exportador generico e avisar que o conteudo tecnico-juridico exige revisao especializada.
- Limitacoes: o sistema nao valida titularidade, sigilo, novidade, atividade inventiva, suficiencia descritiva ou forma legal de reivindicacoes.
- Validacao manual necessaria: conferir com orientacao institucional de propriedade intelectual e revisar desenhos, reivindicacoes e descricao tecnica.

## 3. Revisao sistematica e aprofundada da literatura

- Nome do tipo: Revisao sistematica e aprofundada da literatura.
- ID sugerido no sistema: `revisao_sistematica_ufla`.
- Definicao operacional: producao academica baseada em revisao sistematica, integrativa ou aprofundada da literatura, com metodo de busca e sintese das evidencias.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; introducao; objetivos; metodologia de busca; resultados; discussao; conclusao; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, abstract, keywords, objetivo geral, objetivos especificos, metodologia, referencial teorico, conclusao, referencias.
- Aliases de deteccao: revisao sistematica; revisao da literatura; revisao aprofundada; protocolo de revisao.
- Observacoes para implementacao: aliases devem reconhecer metodologia, revisao da literatura, resultados e referencias.
- Limitacoes: o sistema nao valida bases consultadas, estrategia de busca, strings, fluxograma, criterios de inclusao/exclusao ou avaliacao de qualidade.
- Validacao manual necessaria: conferir protocolo, rastreabilidade dos estudos, quadros de extracao e sintese final.

## 4. Estudo de caso ou casos multiplos

- Nome do tipo: Estudo de caso ou casos multiplos.
- ID sugerido no sistema: `estudo_caso_ufla`.
- Definicao operacional: producao academica estruturada como estudo de caso unico ou comparacao de casos multiplos.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; introducao; referencial teorico; metodologia; caracterizacao do caso; resultados e discussao; conclusao; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, introducao, referencial teorico, metodologia, conclusao, referencias, anexos/apendices.
- Aliases de deteccao: estudo de caso; estudo de casos multiplos; casos multiplos; relato de caso.
- Observacoes para implementacao: exportador generico deve preservar secoes e permitir anexos/apendices.
- Limitacoes: o sistema nao verifica triangulacao de evidencias, protocolo de caso, autorizacoes ou aspectos eticos.
- Validacao manual necessaria: conferir delimitacao, contexto, evidencias, comparacoes e anexos.

## 5. Desenvolvimento de software e aplicativos

- Nome do tipo: Desenvolvimento de software e aplicativos.
- ID sugerido no sistema: `software_aplicativo_ufla`.
- Definicao operacional: producao academica cujo produto principal e software, aplicativo ou artefato computacional acompanhado de documentacao academica.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; introducao; objetivos; requisitos; metodologia; desenvolvimento; resultados; manual ou instrucoes de uso; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, metodologia, objetivos, resultados esperados, referencias, anexos/apendices.
- Aliases de deteccao: software; aplicativo; aplicacao; sistema computacional; desenvolvimento de software.
- Observacoes para implementacao: manter exportador generico; telas, links, repositorios e licencas devem ser registrados como texto ou anexos.
- Limitacoes: o sistema nao executa, testa ou audita codigo-fonte, seguranca, licenca ou acessibilidade do software.
- Validacao manual necessaria: conferir requisitos, arquitetura, testes, telas, repositorio, instalacao e manual de uso.

## 6. Cultivar

- Nome do tipo: Cultivar.
- ID sugerido no sistema: `cultivar_ufla`.
- Definicao operacional: producao academica sobre cultivar, melhoramento, caracterizacao ou desempenho agronomico.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; introducao; origem e desenvolvimento; caracteristicas; desempenho agronomico; recomendacoes; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, metodologia, resultados esperados, conclusao, referencias, anexos.
- Aliases de deteccao: cultivar; nova cultivar; melhoramento genetico; descritores agronomicos.
- Observacoes para implementacao: tabelas e imagens de desempenho devem ser tratadas como conteudo que exige revisao visual.
- Limitacoes: o sistema nao valida descritores oficiais, registro, protecao, ensaios, ambientes ou recomendacoes tecnicas.
- Validacao manual necessaria: conferir dados agronomicos, tabelas, imagens, registros e requisitos institucionais.

## 7. Relatorio de estagio

- Nome do tipo: Relatorio de estagio.
- ID sugerido no sistema: `relatorio_estagio_ufla`.
- Definicao operacional: documento academico que relata atividades de estagio, local, periodo, supervisao e analise das atividades desenvolvidas.
- Estrutura geral: titulo; autoria; curso; orientador/supervisor; introducao; caracterizacao do local; atividades desenvolvidas; discussao; conclusao; referencias; anexos quando houver.
- Campos sugeridos: autor, titulo, curso, orientador, introducao, metodologia/atividades desenvolvidas, conclusao, referencias, anexos.
- Aliases de deteccao: relatorio de estagio; estagio supervisionado; estagio obrigatorio; atividades de estagio.
- Observacoes para implementacao: resumo e palavras-chave podem ser opcionais conforme guia/curso; manter aviso de validacao manual.
- Limitacoes: o sistema nao valida carga horaria, assinaturas, supervisor, periodo ou documentos comprobatorios.
- Validacao manual necessaria: conferir regras do curso, dados do local, atividades, carga horaria, assinaturas e anexos.

## 8. Proposta de intervencao em procedimentos clinicos ou de servico pertinente

- Nome do tipo: Proposta de intervencao em procedimentos clinicos ou de servico pertinente.
- ID sugerido no sistema: `proposta_intervencao_ufla`.
- Definicao operacional: producao academica voltada a diagnostico, planejamento e proposta de intervencao em contexto clinico ou de servico.
- Estrutura geral: titulo; autoria; resumo; palavras-chave; introducao; diagnostico situacional; justificativa; objetivos; proposta de intervencao; plano de execucao; resultados esperados; referencias.
- Campos sugeridos: autor, titulo, resumo, palavras-chave, justificativa, objetivo geral, objetivos especificos, metodologia, cronograma, resultados esperados, referencias.
- Aliases de deteccao: proposta de intervencao; intervencao clinica; procedimentos clinicos; intervencao em servico.
- Observacoes para implementacao: exportador generico deve preservar plano de execucao, objetivos e resultados esperados.
- Limitacoes: o sistema nao valida riscos, autorizacoes, etica, viabilidade, indicadores clinicos ou impacto do servico.
- Validacao manual necessaria: conferir pertinencia clinica/servico, aspectos eticos, cronograma, indicadores e autorizacoes.
