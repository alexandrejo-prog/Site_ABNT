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
- [ ] Implementar referências (parcial — exporta texto, mas não normaliza ABNT/UFLA com negrito em títulos)

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
- [ ] Aplicar margens, fonte e espaçamentos no DOCX (parcial — aplica, mas títulos primários não iniciam nova página)
- [ ] Incluir capa, folha de rosto, resumo, corpo e referências (parcial — referências sem normalização ABNT/UFLA)
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
- [ ] Corrigir numeração iniciando indevidamente em 8 (pendente - depende de atualização no Word)
- [ ] Corrigir negrito dos títulos (parcial — títulos têm bold, mas seções primárias não iniciam nova página)
- [x] Corrigir negrito indevido no corpo textual (corpo não tem bold)
- [x] Rodar npm.cmd test (19 testes passando)
- [x] Rodar npm.cmd run build (sucesso)
- [x] Rodar npm.cmd run verify (sucesso)

## Correção de detecção de autor

- [ ] Impedir instituição como autor (parcial — lista de termos adicionada, mas não testada com arquivo real)
- [ ] Impedir programa como autor (parcial — termos de programa adicionados à lista)
- [ ] Detectar autor em bloco longo da capa (não implementado)
- [ ] Separar instituição, programa, autor e título (não implementado)
- [ ] Validar autor institucional como erro/alerta (não implementado em validators.ts)
- [ ] Testar com arquivo original real (não implementado - arquivos não encontrados)
- [ ] Testar com arquivo gerado real (não implementado - arquivos não encontrados)
- [x] Manter importação de resumo
- [x] Manter importação de abstract
- [x] Manter importação de introdução
- [x] Manter importação de referências
- [x] Rodar npm.cmd test (19 testes passando)
- [x] Rodar npm.cmd run build (sucesso)
- [x] Rodar npm.cmd run verify (sucesso)

## Rodada 4 - Prioridade Manual UFLA

- [ ] Reconsultar Manual UFLA
- [ ] Corrigir numeração de páginas (parcial — PageNumber.CURRENT implementado, mas não testado se inicia corretamente)
- [ ] Garantir numeração visível apenas a partir da introdução (não testado)
- [x] Colocar número no canto superior direito
- [ ] Aplicar negrito em títulos (parcial — títulos têm bold, mas seções primárias não iniciam nova página)
- [x] Preservar itálico importado
- [ ] Aplicar itálico em et al. quando aplicável (pendente normalizador de referências)
- [x] Garantir corpo textual com espaçamento 1,5
- [x] Garantir resumo/abstract/referências em espaço simples
- [x] Garantir parágrafos comuns como corpo do texto
- [x] Evitar nível de tópico indevido em texto comum
- [ ] Corrigir referências ABNT/UFLA (pendente normalizador)
- [ ] Aplicar negrito nos títulos de obras/periódicos das referências (pendente)
- [ ] Preservar URL/DOI/Acesso em (parcialmente preservado, sem normalização)
- [ ] Criar/ajustar normalizador de referências
- [ ] Criar/ajustar validador de referências
- [ ] Atualizar validação normativa
- [ ] Criar testes de paginação (verificar PageNumber.CURRENT no XML)
- [ ] Criar testes de negrito em títulos (verificar w:b)
- [ ] Criar testes de itálico (verificar w:i em runs importados)
- [ ] Criar testes de espaçamento (verificar line twips)
- [ ] Criar testes de corpo do texto sem nível de tópico indevido
- [ ] Criar testes de referências ABNT/UFLA
- [x] Rodar npm.cmd test (19 testes passando)
- [x] Rodar npm.cmd run build (sucesso)
- [x] Rodar npm.cmd run verify (sucesso)

### Limitações registradas
- Paginação: usa PageNumber.CURRENT (campo dinâmico do Word). A numeração exata depende de atualização no Word.
- Referências: sem normalizador ABNT/UFLA implementado. Texto exportado como está.
- Itálico em "et al.": não implementado por falta de normalizador de referências.
- Validação normativa: não atualizada para verificar formatação de referências, paginação, etc.
- Títulos primários não iniciam nova página automaticamente.
- REFERÊNCIAS não inicia nova página automaticamente.
- Negrito em títulos funciona, mas seções primárias não têm pageBreakBefore.

## Auditoria real do DOCX gerado

- [ ] Considerações finais iniciam em nova página
- [ ] Referências iniciam em nova página
- [ ] Títulos primários iniciam no topo da página
- [ ] Referências seguem ABNT/UFLA
- [ ] Títulos de obras/periódicos em referências ficam em negrito
- [ ] et al. fica em itálico quando aplicável
- [ ] Corpo textual mantém espaçamento 1,5
- [ ] Resumo, abstract, citações longas e referências usam espaço simples
- [ ] Checklist não marca como concluído item parcial
- [ ] Testes cobrem quebra de página antes de seções primárias
- [ ] Testes cobrem referências com negrito
