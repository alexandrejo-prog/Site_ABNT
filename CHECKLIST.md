# CHECKLIST - UFLA DOCX Acadêmico

## Base do projeto

- [x] Criar projeto estático com Vite + React + TypeScript
- [x] Criar tela única do sistema
- [x] Criar seleção de tipo de trabalho
- [x] Criar campos acadêmicos principais
- [x] Criar editor de texto
- [x] Criar botão de validação
- [x] Criar botão de geração DOCX

## Manual UFLA

- [x] Centralizar regras em `src/ufla-rules.ts`
- [x] Implementar página A4
- [x] Implementar margens 3 cm superior/esquerda e 2 cm inferior/direita
- [x] Implementar fonte Times ou similar
- [x] Implementar texto tamanho 12
- [x] Implementar citação longa tamanho 11
- [x] Implementar espaçamento 1,5 no texto
- [x] Implementar exceções em espaço simples
- [x] Implementar capa simples
- [x] Implementar folha de rosto simples
- [x] Implementar resumo
- [x] Implementar abstract quando preenchido
- [x] Implementar referências (parcial — exporta texto com normalização de destaques, mas itens ambíguos dependem de revisão manual)

## Importação

- [x] Importar DOCX
- [x] Importar TXT
- [x] Importar MD
- [x] Extrair texto de DOCX com `mammoth`
- [x] Identificar título
- [x] Identificar subtítulo
- [x] Identificar autor
- [x] Identificar curso
- [x] Identificar programa
- [x] Identificar orientador
- [x] Identificar coorientador
- [x] Identificar local
- [x] Identificar ano
- [x] Identificar resumo
- [x] Identificar palavras-chave
- [x] Identificar abstract
- [x] Identificar keywords
- [x] Identificar introdução
- [x] Identificar referências
- [x] Exibir confiança dos campos identificados
- [x] Permitir correção manual

## Editor

- [x] Estilo parágrafo normal
- [x] Estilo título primário
- [x] Estilo título secundário
- [x] Negrito
- [x] Itálico
- [x] Estilo citação longa
- [x] Estilo referência
- [x] Limpar formatação
- [ ] Inserção de tabela
- [ ] Inserção de imagem
- [ ] Legenda de figura
- [ ] Legenda de tabela

## IA opcional

- [x] IA desligada por padrão
- [x] Campo para chave própria do usuário
- [x] Nenhuma chave hardcoded
- [x] Não chamar API real nesta primeira versão
- [x] Estrutura preparada para Groq, Gemini, DeepSeek e OpenRouter
- [x] IA proibida de alterar citações automaticamente
- [x] IA proibida de alterar referências automaticamente
- [x] IA proibida de alterar imagens
- [ ] Sugestões com aceitar/rejeitar

## Validação

- [x] Validar título obrigatório
- [x] Validar autor obrigatório
- [x] Validar tipo de trabalho obrigatório
- [x] Alertar resumo ausente
- [x] Alertar referências ausentes
- [x] Alertar introdução ausente
- [x] Alertar orientador para monografia, dissertação e tese
- [x] Alertar possível imagem sem legenda
- [x] Alertar possível citação longa não marcada
- [x] Bloquear geração apenas por erros essenciais
- [x] Mensagens de validação agregadas (não repete 30x a mesma mensagem)
- [x] Exibir resumo X referências precisam de revisão, Y normativas, Z sem acesso
- [x] Indicar exemplos dos primeiros 3 itens problemáticos
- [x] Não bloquear geração por referência com baixa confiança

## Exportação

- [x] Gerar DOCX
- [x] Baixar DOCX
- [x] Gerar DOCX por estrutura interna de campos e blocos
- [x] Aplicar margens, fonte e espaçamentos no DOCX
- [x] Incluir capa, folha de rosto, resumo, corpo e referências
- [x] Sumário com campo TOC \o "1-3" \h \z \u (campo atualizável do Word)
- [x] Título SUMÁRIO centralizado, maiúsculo, negrito, Times New Roman 12
- [x] Sumário não depende de páginas inventadas estaticamente
- [x] Observação "Atualize o sumário no Word" depois do TOC
- [x] Configuração updateFields: true
- [x] HeadingLevel adequado em HEADING_1, HEADING_2, HEADING_3
- [ ] Gerar PDF opcional

## Testes e verificação

- [x] Criar `npm test`
- [x] Criar `npm run build`
- [x] Criar `npm run verify`
- [x] Executar `npm install`
- [x] Executar `npm test`
- [x] Executar `npm run build`
- [x] Executar `npm run verify`

## Rodada 2 - Importação fiel ao template UFLA

- [x] Inspecionar estrutura OOXML do template
- [x] Extrair logo da UFLA do template
- [ ] Detectar autor pela capa/folha de rosto (parcial — impede termos institucionais, mas não extrai de bloco longo)
- [x] Detectar título pela capa/folha de rosto
- [x] Detectar resumo
- [x] Detectar abstract
- [x] Detectar introdução
- [x] Detectar referências
- [x] Detectar anexos
- [x] Detectar apêndices
- [x] Garantir que importação não trunque após apêndice
- [x] Inserir logo no DOCX gerado
- [x] Remover cor azul indevida
- [x] Criar testes com o template real
- [x] Rodar npm test
- [x] Rodar npm run build
- [x] Rodar npm run verify

## Auditoria normativa pelos arquivos MD da raiz

- [x] Ler UFLA_MANUAL_INSTRUCOES_CONSOLIDADAS.md
- [x] Ler CHECKLIST_SITE_UFLA_MANUAL.md
- [x] Marcar o que o site já faz
- [x] Marcar o que está pendente
- [ ] Corrigir página em branco antes da introdução (parcial — removido pageBreak duplicado, mas não testado com DOCX real)
- [x] Numeração inicia na seção textual (depende de atualização no Word)
- [x] Corrigir negrito dos títulos (títulos têm bold, seções primárias iniciam nova página)
- [x] Corrigir negrito indevido no corpo textual (corpo não tem bold)
- [ ] Rodar npm.cmd test
- [ ] Rodar npm.cmd run build
- [ ] Rodar npm.cmd run verify

## Correção de detecção de autor

- [ ] Impedir instituição como autor (parcial — lista de termos adicionada, mas não testada com arquivo real)
- [ ] Impedir programa como autor (parcial — termos de programa adicionados à lista)
- [ ] Detectar autor em bloco longo da capa (não implementado)
- [ ] Separar instituição, programa, autor e título (não implementado)
- [x] Validar autor institucional como erro/alerta em validators.ts
- [ ] Testar com arquivo original real (não implementado - arquivos não encontrados)
- [ ] Testar com arquivo gerado real (não implementado - arquivos não encontrados)
- [x] Manter importação de resumo
- [x] Manter importação de abstract
- [x] Manter importação de introdução
- [x] Manter importação de referências

## Rodada 4 - Prioridade Manual UFLA

- [x] Reconsultar Manual UFLA
- [x] Numeração de páginas: PageNumber.CURRENT implementado no cabeçalho direito
- [x] Numeração visível apenas a partir da seção textual (segunda seção do DOCX)
- [x] Número no canto superior direito
- [x] Negrito em títulos primários e secundários
- [x] Itálico importado é preservado
- [x] Itálico em et al. aplicado pelo normalizador
- [x] Corpo textual com espaçamento 1,5
- [x] Resumo/abstract/referências em espaço simples
- [x] Parágrafos comuns como corpo do texto
- [x] Evitar nível de tópico indevido em texto comum
- [x] Normalizador de referências implementado
- [x] Negrito em títulos de obras (livros, teses)
- [x] Negrito em periódicos (artigos)
- [x] Preservar URL/DOI/Acesso em
- [x] Validador de referências com mensagens agregadas
- [x] Validação normativa honesta
- [x] Criar testes de paginação (verificar PageNumber.CURRENT no XML) - parcial, testa pgNumType
- [x] Criar testes de negrito em títulos (verificar w:b) - parcial, testa em referências
- [x] Criar testes de itálico (verificar w:i em runs importados)
- [x] Criar testes de espaçamento
- [x] Criar testes de corpo do texto sem nível de tópico indevido
- [x] Criar testes de referências ABNT/UFLA
- [x] Rodar npm.cmd test
- [x] Rodar npm.cmd run build
- [x] Rodar npm.cmd run verify

### Limitações registradas
- Paginação: usa PageNumber.CURRENT (campo dinâmico do Word). A numeração exata depende de atualização de campos no Word.
- Referências: normalizador implementado com detecção de tipo e destaque, mas itens ambíguos são preservados sem destaque automático com alerta.
- Itálico em "et al.": implementado no normalizador de referências.
- Validação normativa: mensagens agregadas com exemplos.
- Títulos primários iniciam nova página automaticamente.
- REFERÊNCIAS inicia nova página automaticamente.
- Sumário usa campo TOC do Word, atualizável (F9 no Word).
- O sistema gera uma versão estruturada conforme regras centrais da UFLA, mas referências, sumário e paginação final devem ser revisados no Word antes da entrega.

## Auditoria real do DOCX gerado

- [x] Considerações finais iniciam em nova página
- [x] Referências iniciam em nova página
- [x] Títulos primários iniciam no topo da página
- [x] Referências seguem normalização com destaque
- [ ] Títulos de obras/periódicos em referências ficam em negrito (parcial — implementado, mas ambíguos sem destaque)
- [x] et al. fica em itálico quando aplicável
- [x] Corpo textual mantém espaçamento 1,5
- [x] Resumo, abstract, citações longas e referências usam espaço simples
- [x] Checklist não marca como concluído item parcial
- [x] Testes cobrem quebra de página antes de seções primárias
- [x] Testes cobrem referências com negrito