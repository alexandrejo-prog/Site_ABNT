# Task Progress - Rodada de Melhorias UFLA DOCX

- [x] Read and understand all source files
- [ ] **PARTE 1** - Sumário com campo do Word (export-docx.ts)
- [ ] **PARTE 2** - Referências editáveis (App.tsx)
- [ ] **PARTE 3** - Normalizador robusto (references-normalizer.ts)
- [ ] **PARTE 4** - Validação mais útil (references-validator.ts, validators.ts)
- [ ] **PARTE 5** - Checklists honestos (CHECKLIST.md, CHECKLIST_SITE_UFLA_MANUAL.md)
- [ ] **PARTE 6** - Testes (all test files)
- [ ] Run npm.cmd test
- [ ] Run npm.cmd run build
- [ ] Run npm.cmd run verify

## Governança local

- Os arquivos `Regras/` e `colecao_producao_academica_ufla_modelo.md` são arquivos locais de apoio.
- Eles estão listados em `.gitignore` para não serem versionados acidentalmente.
- O conteúdo desses arquivos não faz parte do app versionado e não deve ser adicionado ao Git.

## Decisões técnicas recentes

- Autosave local implementado via `src/draft-storage.ts` com chave `site-abnt:draft:v1`.
- Rascunho é salvo no `localStorage` após 800ms de inatividade e não é enviado para servidor.
- Restauração automática ocorre apenas se o estado inicial do formulário estiver vazio.
- Indicador discreto de status do rascunho adicionado no header.
- Botão "Limpar rascunho" adicionado no header quando há rascunho armazenado.
- App.tsx foi parcialmente refatorado em `src/components/DraftStatus.tsx` e `src/components/ToolButton.tsx`.
- Testes de UI reforçados: autosave, restauração, limpeza de rascunho e bloqueio de placeholder natural.
- Migração para editor moderno (Tiptap/ProseMirror/Lexical) continua futura.
- Validação visual no Word/LibreOffice continua sendo etapa manual obrigatória antes da submissão final.

## Manutenção do snapshot de PPGs

- A lista de programas está em `src/ufla-ppg-programs.ts`.
- Atualizar periodicamente ou quando a PRPG/UFLA alterar os programas de pós-graduação.
- Após alterar o snapshot, rodar:
  ```bash
  npm test
  npm run build
  npm run verify
  ```
- Não há fonte externa automática de PPGs nesta rodada; a atualização continua manual.

## Pendências futuras da auditoria

- [x] Isolar `document.execCommand` em adapter (`src/editor-command-adapter.ts`) — migração para editor moderno permanece futura
- [x] Implementar autosave/persistência local (`src/draft-storage.ts`)
- [x] Reforçar testes de UI do fluxo de autosave/restauração/bloqueio
- [ ] Criar rotina de atualização do snapshot de PPGs
- [ ] Validar saída DOCX visualmente no Word/LibreOffice

## Checklist de validação manual

### Navegador local (`npm run dev`)
- [ ] Abrir site e preencher trabalho completo
- [ ] Aguardar >800ms e confirmar status "Rascunho salvo localmente"
- [ ] Recarregar página e confirmar restauração dos campos
- [ ] Limpar rascunho e confirmar mensagem/remoção do botão
- [ ] Importar arquivo `.docx`/`.txt`/`.md` e confirmar que não há sobrescrita por rascunho antigo
- [ ] Gerar DOCX e confirmar download

### DOCX (Word/LibreOffice)
- [ ] Abrir DOCX gerado
- [ ] Conferir capa, folha de rosto, resumo/abstract
- [ ] Conferir sumário e seções
- [ ] Conferir referências e legendas
- [ ] Confirmar ausência de placeholders `[PREENCHER: ...]` ou texto provisório
- [ ] Atualizar sumário (Ctrl+A, F9) e exportar PDF para submissão

### Publicação (Vercel)
- [ ] Acessar site publicado no Chrome e Firefox
- [ ] Testar responsivo (celular/tablet)
- [ ] Confirmar que importar e gerar DOCX funcionam
- [ ] Confirmar ausência de erros no console

### Decisão final
- [ ] `npm test`, `npm run build` e `npm run verify` passam
- [ ] Validação visual mínima concluída
- [ ] Apenas então publicar/mergear