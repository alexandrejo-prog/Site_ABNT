# Status da auditoria — baseline funcional

Este documento registra os pontos do projeto considerados **testados e funcionais** durante as rodadas de auditoria.

## Baseline aprovado inicial

- **Commit validado:** `f1f80cd57f88b4d1ac834b877aaae9a6397f85ae`
- **Mensagem do commit:** `chore: limpar logs e melhorar testes estruturais`
- **Arquivos alterados no commit validado:**
  - `tests/accessibility-basic.test.ts`
  - `tests/logo-asset.test.ts`

## Validação informada para o baseline inicial

- `npm test`: passou — 74 arquivos / 564 testes
- `npm run build`: passou
- `npm run verify`: passou

## Rodadas posteriores validadas

### P0 — Projeto de pesquisa

Funcionalidades consolidadas:

- remoção de ruídos importados como `TITLE 1`, `TITLE 2`, `TITLE 3`;
- remoção de artefatos `TocXXXX`;
- remoção de sumário importado duplicado no corpo;
- normalização de títulos como `REFERENCIAL TERICO` para `REFERENCIAL TEÓRICO`;
- bloqueio de placeholder natural como `nome do orientador`;
- normalização de palavras-chave em sentença pontuada;
- conversão de blocos tabulados/quadros do projeto em tabelas DOCX reais;
- normalização da citação do Manual UFLA de 2024 para a referência/citação de 2025 quando aplicável.

### P0/P1 — Referências ABNT/UFLA

Funcionalidades consolidadas:

- normalização de DOI informado como URL (`DOI: https://doi.org/10...` -> `DOI: 10...`);
- normalização de URL em markdown ou entre `< >` para `Disponível em: ...`;
- normalização de `Disponivel em:` para `Disponível em:`;
- detecção de tipos de referência: artigo, livro, capítulo, tese/dissertação, documento institucional, legislação, site e desconhecido;
- destaque automático em negrito para título/elemento detectável, preservando marcação manual quando informada;
- itálico automático em `et al.`;
- separador de tese/dissertação normalizado para travessão;
- alertas de revisão para paginação ausente em trabalhos acadêmicos, órgão/editor ausente em documentos jurídicos/institucionais, DOI/URL normalizados e grafia de autor que exige conferência bibliográfica.

### P2 — Rascunho local e privacidade

Funcionalidades consolidadas:

- rascunho salvo apenas no navegador do usuário;
- aviso visual de que o rascunho restaurado não foi enviado ao servidor;
- botão para limpar rascunho local;
- expiração automática do rascunho após 14 dias;
- limpeza de chaves legadas `site-abnt:draft:v1` e `site-abnt:draft:v2`.

## Validação local mais recente informada

- `git pull origin main`: repositório atualizado / já atualizado
- `npm test`: passou — 77 arquivos / 595 testes
- `npm run build`: passou

Observação: `npm run verify` apenas repete `npm test -- --run && npm run build`. Quando `npm test` e `npm run build` já forem executados separadamente, não é necessário solicitar `npm run verify` novamente.

## Itens considerados funcionais neste ponto

- O teste de skip-link verifica o DOM renderizado, não apenas string estática no código.
- O DOM contém exatamente um `.skip-link` apontando para `#workspace`.
- O elemento `main#workspace` existe.
- `loadDefaultLogoAsset()` retorna `undefined` em ambiente Node/Vitest sem tentar buscar URL relativa e sem emitir `console.error`.
- As regras normativas de CPG, dissertação, tese e PPGECA permanecem preservadas.
- A geração de projeto de pesquisa não deve exportar ruídos técnicos de importação (`TITLE`, `Toc`, sumário importado duplicado).
- Referências recebem normalização objetiva e alertas para pontos que exigem conferência humana.
- O rascunho local tem retenção limitada e mensagem explícita de privacidade.

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
- regra de que o DOCX é rascunho técnico e o PDF final deve ser exportado pelo Word/LibreOffice;
- expiração do rascunho local em 14 dias;
- normalização segura de DOI/URL em referências;
- alertas bibliográficos em vez de alteração automática de nomes próprios.

## Próximas rodadas autorizadas

As próximas rodadas devem ser pequenas e incrementais, sem reabrir regras consolidadas:

1. Campo de e-mail no CPG e revisão de mensagens visíveis.
2. Restrição de `Curso:` aos tipos adequados.
3. Performance/code splitting.
4. Documentação da estimativa de páginas CPG.
5. Revisão visual guiada do DOCX gerado em Word/LibreOffice.

## Critério para alterar este status

Este status só deve ser alterado se houver uma das situações abaixo:

- `npm test` ou `npm run build` voltarem a falhar;
- o site renderizar mais de um `.skip-link`;
- `loadDefaultLogoAsset()` voltar a emitir erro em ambiente Node/Vitest;
- uma mudança posterior alterar indevidamente regras normativas já validadas;
- uma regressão visual for comprovada em DOCX gerado e aberto no Word/LibreOffice.
