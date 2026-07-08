# Status da auditoria — baseline funcional

Este documento registra o ponto do projeto considerado **testado e funcional** antes das próximas rodadas da auditoria.

## Baseline aprovado

- **Commit validado:** `f1f80cd57f88b4d1ac834b877aaae9a6397f85ae`
- **Mensagem do commit:** `chore: limpar logs e melhorar testes estruturais`
- **Arquivos alterados no commit validado:**
  - `tests/accessibility-basic.test.ts`
  - `tests/logo-asset.test.ts`

## Validação informada

A validação local informada para este baseline foi:

- `npm test`: passou — 74 arquivos / 564 testes
- `npm run build`: passou
- `npm run verify`: passou

## Itens considerados funcionais neste ponto

- O teste de skip-link passou a verificar o DOM renderizado, não apenas string estática no código.
- O DOM deve conter exatamente um `.skip-link` apontando para `#workspace`.
- O elemento `main#workspace` deve existir.
- O teste do logo UFLA em ambiente Node/Vitest garante que `loadDefaultLogoAsset()` retorna `undefined` sem tentar buscar URL relativa e sem emitir `console.error`.
- As regras normativas de CPG, dissertação, tese e PPGECA não foram alteradas nesta rodada.

## Escopo encerrado nesta baseline

Os itens abaixo ficam marcados como **testados/funcionais** para fins de continuidade:

- RNC-LOG-001 — ruído do logo UFLA em testes: coberto por teste dedicado.
- RNC-UX-001 — skip-link: coberto por teste comportamental de DOM.
- RNC-TEST-001 — início da redução de fragilidade de testes: teste de acessibilidade saiu de leitura frágil por substring e passou para renderização real do app.

## Pontos que não devem ser reabertos sem regressão comprovada

Não reabrir nas próximas rodadas sem evidência objetiva:

- filtro CPG de seções proibidas;
- aviso `cpg-auto-filtered-structures`;
- validação `program-degree-incompatible` para tese com PPGECA;
- aceitação de dissertação com PPGECA;
- indicadores de impacto em parágrafo único;
- normalização da referência UFLA 2025;
- ponto final em Palavras-chave/Keywords;
- ausência de `Curso:` em dissertação/tese;
- presença de `Curso:` na monografia;
- campo TOC atualizável;
- bloqueio de placeholders `[PREENCHER:]`;
- regra de que o DOCX é rascunho técnico e o PDF final deve ser exportado pelo Word/LibreOffice.

## Próximas rodadas autorizadas

A partir deste baseline, as próximas rodadas devem começar pela auditoria P2, sem alterar o que foi consolidado aqui:

1. Segurança de deploy e sanitização do editor.
2. Campo de e-mail no CPG e revisão de mensagens visíveis.
3. Privacidade do rascunho local.
4. Restrição de `Curso:` aos tipos adequados.
5. Performance/code splitting.
6. Documentação da estimativa de páginas CPG.

## Critério para alterar este status

Este baseline só deve ser alterado se houver uma das situações abaixo:

- `npm test`, `npm run build` ou `npm run verify` voltarem a falhar;
- o site renderizar mais de um `.skip-link`;
- `loadDefaultLogoAsset()` voltar a emitir erro em ambiente Node/Vitest;
- uma mudança posterior alterar indevidamente regras normativas já validadas.
