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

## Decisões técnicas recentes

- Autosave local implementado via `src/draft-storage.ts` com chave `site-abnt:draft:v1`.
- Rascunho é salvo no `localStorage` após 800ms de inatividade e não é enviado para servidor.
- Restauração automática ocorre apenas se o estado inicial do formulário estiver vazio.
- Indicador discreto de status do rascunho adicionado no header.
- Botão "Limpar rascunho" adicionado no header quando há rascunho armazenado.
- App.tsx permanece parcialmente monolítico; refatoração completa continua futura.

## Pendências futuras da auditoria

- [ ] Refatorar `App.tsx` monolítico
- [ ] Ampliar cobertura de testes de UI
- [x] Isolar `document.execCommand` em adapter (`src/editor-command-adapter.ts`) — migração para editor moderno permanece futura
- [x] Implementar autosave/persistência local (`src/draft-storage.ts`)
- [ ] Criar rotina de atualização do snapshot de PPGs
- [ ] Validar saída DOCX visualmente no Word/LibreOffice