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
- [x] Implementar referências

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

## Exportação

- [x] Gerar DOCX
- [x] Baixar DOCX
- [x] Gerar DOCX por estrutura interna de campos e blocos
- [x] Aplicar margens, fonte e espaçamentos no DOCX
- [x] Incluir capa, folha de rosto, resumo, corpo e referências
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
- [x] Detectar autor pela capa/folha de rosto
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

## Rodada 4 - Prioridade Manual UFLA

- [ ] Reconsultar Manual UFLA
- [x] Corrigir numeração de páginas
- [x] Garantir numeração visível apenas a partir da introdução
- [x] Colocar número no canto superior direito
- [x] Aplicar negrito em títulos
- [x] Preservar itálico importado
- [ ] Aplicar itálico em et al. quando aplicável
- [x] Garantir corpo textual com espaçamento 1,5
- [x] Garantir resumo/abstract/referências em espaço simples
- [x] Garantir parágrafos comuns como corpo do texto
- [x] Evitar nível de tópico indevido em texto comum
- [ ] Corrigir referências ABNT/UFLA
- [ ] Aplicar negrito nos títulos de obras/periódicos das referências
- [ ] Preservar URL/DOI/Acesso em
- [ ] Criar/ajustar normalizador de referências
- [ ] Criar/ajustar validador de referências
- [ ] Atualizar validação normativa
- [ ] Criar testes de paginação
- [ ] Criar testes de negrito em títulos
- [ ] Criar testes de itálico
- [ ] Criar testes de espaçamento
- [ ] Criar testes de corpo do texto sem nível de tópico indevido
- [ ] Criar testes de referências ABNT/UFLA
- [x] Rodar npm.cmd test
- [x] Rodar npm.cmd run build
- [x] Rodar npm.cmd run verify
