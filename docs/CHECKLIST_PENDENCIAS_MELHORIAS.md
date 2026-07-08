# Checklist honesto de pendências e melhorias — Site_ABNT

Este checklist substitui a leitura simplista de "100% concluído" por uma visão objetiva: o sistema está funcional como gerador de rascunho DOCX editável, mas ainda há pontos de robustez, qualidade normativa e validação visual que devem continuar sendo tratados.

## Correções aplicadas após a homologação

- [x] Corrigir natureza genérica importada em tese/dissertação/monografia.
  - Caso observado: `Natureza do trabalho: Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.` saiu no DOCX de tese.
  - Correção: o normalizador agora reconhece esse texto genérico, inclusive com o rótulo `Natureza do trabalho:`, e substitui pela natureza correspondente ao tipo selecionado.
- [x] Adicionar teste para tese com natureza genérica importada.
- [x] Atualizar a UI para recalcular a natureza do trabalho quando o usuário altera `Programa` ou `Curso` após selecionar o tipo de trabalho.
- [x] Adicionar teste de fluxo de tela para natureza de tese atualizada após alteração do programa.

## Pendências que ainda exigem validação local obrigatória

- [ ] Rodar `npm run verify` após as correções remotas mais recentes.
- [ ] Gerar novo DOCX de tese com programa compatível com doutorado, por exemplo `Administração`, e verificar folha de rosto e folha de aprovação.
- [ ] Confirmar que o campo `Natureza do trabalho` muda na tela assim que o programa é alterado em tese/dissertação.
- [ ] Confirmar que o Vercel publicou o commit mais recente da `main`.

## Pontos normativos que continuam exigindo revisão humana

- [ ] Sumário final com paginação e pontilhado deve ser atualizado/conferido no Word ou LibreOffice.
- [ ] Ficha catalográfica oficial deve ser gerada pela Biblioteca Universitária da UFLA.
- [ ] PDF final deve ser exportado no Word ou LibreOffice, não tomado como garantia pelo navegador.
- [ ] Quebras de página, paginação final e eventuais ajustes finos de layout devem ser conferidos visualmente.
- [ ] Resumo, abstract, palavras-chave e keywords exigem revisão humana de conteúdo e extensão.
- [ ] Referências ABNT complexas ainda exigem conferência manual.

## Melhorias técnicas recomendadas

### Alta prioridade

- [ ] Criar teste automatizado que simule importação do arquivo `documento_ideal_teste_tipos_trabalho_ufla_abnt.docx` e geração por todos os tipos principais.
- [ ] Criar teste específico para garantir que DOCX de tese nunca contenha `Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis` quando houver tipo e programa suficientes.
- [ ] Criar teste visual/manual documentado para DOCX real aberto no Word/LibreOffice.
- [ ] Revisar o exportador geral para evitar qualquer marcador `[PREENCHER: ...]` em DOCX gerado como rascunho quando o campo puder ser omitido com segurança.
- [ ] Separar explicitamente no diagnóstico os erros bloqueantes absolutos dos erros acadêmicos que podem gerar apenas rascunho técnico.

### Média prioridade

- [ ] Melhorar o tratamento da versão em inglês dos indicadores de impacto: quando vazia, o sistema deve alertar sem poluir o DOCX com marcador indevido.
- [ ] Melhorar a lista local de programas da PRPG/UFLA e marcar claramente quais possuem mestrado/doutorado.
- [ ] Exibir na interface aviso mais claro quando um programa não é compatível com tese.
- [ ] Criar modo de teste/homologação com amostras internas para Artigo, Monografia, Dissertação, Tese, Projeto e CPG.
- [ ] Melhorar o nome do arquivo gerado para incluir tipo de trabalho, por exemplo `tese-<titulo>.docx`, reduzindo confusão com cache/download antigo.

### Baixa prioridade

- [ ] Otimizar chunks grandes indicados pelo Vite com `manualChunks` ou lazy loading adicional.
- [ ] Evoluir o editor baseado em `execCommand` para editor moderno, se o projeto crescer.
- [ ] Melhorar visualmente a tela de campos longos e metadados.
- [ ] Criar opção de limpar cache/rascunho mais visível após importação.

## Critério honesto de status

O status correto é:

> Funcional como ferramenta web de apoio à estruturação, validação preliminar e geração de rascunho DOCX editável UFLA/ABNT/CPG, com testes automatizados e build aprovados após validação local.

Não declarar como:

> Substituto de revisão normativa oficial, Biblioteca, orientador, Word/LibreOffice ou validação final de submissão.

## Próxima validação mínima

Rodar localmente:

```powershell
cd "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT"

git pull origin main
npm run verify
```

Depois, no navegador:

1. Limpar rascunho.
2. Reimportar o DOCX de teste.
3. Selecionar `Tese`.
4. Informar programa compatível com doutorado, como `Administração`.
5. Gerar DOCX.
6. Conferir se a folha de rosto contém `Tese apresentada à Universidade Federal de Lavras`.
7. Conferir se não aparece o texto genérico de natureza do trabalho.
