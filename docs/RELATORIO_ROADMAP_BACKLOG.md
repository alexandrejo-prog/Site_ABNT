# Relatório de fechamento do roadmap — Site_ABNT

> Documento oficial de fechamento do backlog de produto e confiabilidade.
> Data: 03/08/2026.

## 1. Resumo executivo

O backlog de produto e confiabilidade foi entregue em 5 fases (A–E), cada uma fechada com `npm run verify` verde (suíte Vitest + build `tsc -b && vite build`). Nenhum teste pré-existente precisou de ajuste, e a conformidade UFLA/ABNT foi preservada em todo o processo.

Resultado final: **147 arquivos de teste, 1216 testes passando, 10 skipped, build OK** — ante 134/1153 no início. O bundle principal do SPA caiu de **791,72 kB → 732,85 kB** (gzip 215,03 → 198,61 kB), com a biblioteca `docx` (≈434 kB) passando a ser carregada apenas sob demanda.

## 2. Resultado por fase

| Fase | Escopo | Verify (arquivos / testes) | Build |
|---|---|---|---|
| Base | — | 134 / 1153 | OK |
| A | UX-01, UX-02, UX-03, TEC-03 | 138 / 1174 | OK |
| B | UX-04, OP-02, PROD-02 | 141 / 1188 | OK |
| C | PROD-01 | 143 / 1197 | OK |
| D1 | TEC-02 (persistência) | 145 / 1207 | OK |
| D2 | TEC-01 (equivalência editor) | 146 / 1212 | OK |
| E | TEC-04 (lazy-load), OP-01 (observabilidade) | 147 / 1216 | OK |

Cada linha acima corresponde à saída real do comando `npm run verify` executado ao fim de cada fase; os 10 testes skipped são intencionais e pré-existentes.

## 3. Métricas finais

| Métrica | Início | Final | Δ |
|---|---|---|---|
| Arquivos de teste | 134 | 147 | +13 |
| Testes passando | 1153 | 1216 | +63 |
| Testes skipped (intencionais) | 10 | 10 | 0 |
| Build (`tsc -b && vite build`) | OK | OK | — |
| Bundle `index.js` (bruto / gzip) | 791,72 / 215,03 kB | 732,85 / 198,61 kB | −58,87 / −16,42 kB |
| Chunk `docx-libs` (bruto / gzip) | 434,23 / 125,04 kB | 434,23 / 125,04 kB | 0 (agora sob demanda) |

Todas as métricas foram extraídas das saídas de `verify`/`build` desta sessão; nada foi estimado.

## 4. Ganhos principais

**Produto (experiência do usuário)**

- Autosave confiável: falha de `localStorage` deixa de ser silenciosa — o usuário vê status `error` com mensagem específica (quota cheia, armazenamento indisponível ou erro desconhecido).
- O resultado da exportação é rotulado (bloqueada / rascunho editável / versão para revisão), reduzindo ambiguidade sobre o que o DOCX contém.
- Correção guiada: erros essenciais oferecem "Corrigir" que navega e foca o campo, com mapa de progresso em 5 etapas.
- Onboarding de primeiro uso (3 passos, descartável) e botão de exemplo demonstrativo preenchendo formulário + editor.
- Guia rápido colapsável no painel de validação.

**Técnicos (mensuráveis)**

- `saveDraft` agora devolve `{ ok, kind }` com classificador de exceções (`quota-exceeded`, `unavailable`, `unknown`) — corrige o bug em que o status ficava "salvo" mesmo sem gravação.
- Equivalência legacy ↔ Tiptap comprovada por round-trip no corpus essencial (idênticos nos dois motores), mantendo o fallback legado.
- Lazy-load efetivo do preview: quebrada a cadeia estática `PreviewModal → preview-html → export-docx`, reduzindo o bundle inicial.
- Rastreio de eventos (`preview:open`, `docx-generate:start/complete/error`) com `performance.mark`, sem rede.

## 5. Riscos remanescentes

- **Backup local não é duradouro:** o rascunho vive em `localStorage` (TTL 14 dias); limpeza do navegador ou quota zerada perdem dados — apenas sinalizados, não recuperáveis.
- **Quota não tem retry automático:** após a falha, o salvamento só é retentado no próximo evento de digitação; não há fila de pendência.
- **Editor:** transformações documentadas (`et al.` → itálico, compressão de linhas em branco) não são idempotentes no markup; aceitáveis hoje, mas devem ser revistas se novos formatos de bloco forem adicionados.
- **`docx-libs` continua grande (434 kB):** agora sob demanda, mas é o maior custo quando o usuário gera/visualiza.
- **Observabilidade passiva:** rastros são em memória (DEV) e `performance.mark`; não há coleta remota nem alerta.

## 6. Lições aprendidas

1. **`saveDraft` engolia erros:** o hook nunca via a falha e reportava "salvo". A correção de devolver o resultado (ok/tipo de erro) na camada de storage foi a mudança de maior impacto em confiabilidade.
2. **jsdom devolve instância diferente de `localStorage` a cada acesso:** `vi.spyOn(window.localStorage, "setItem")` não interceptou nada; a solução foi `Object.defineProperty` com um `Storage` fake que lança na gravação (ver `tests/draft-autosave-error.test.tsx`).
3. **Lazy-load só move módulo de chunk se não houver import estático:** o warning do Vite sobre `export-docx` mostrou que `preview-html.ts` puxava o pacote; tornar o `PreviewModal` lazy (e não só os geradores) foi o que de fato reduziu o bundle.
4. **`noUnusedLocals` pega sobras no código de UI:** variáveis como `const step` e imports sem uso em componentes novos são capturadas pelo `tsc` dentro do `verify` — sempre rodar o verify antes de fechar fase.

## 7. Próximos passos recomendados

1. **Validação manual em navegador/Word:** conferir onboarding, selo de saída, preview e geração em um fluxo real (edge cases: aba privada sem storage, quota baixa).
2. **Considerar retry/backoff** para `QuotaExceededError` e um aviso de "storage cheio" proativo.
3. **Otimização opcional:** investigar separação maior do `docx` (manualChunks/Vite) ou migração de `Packer` para reduzir o pico de download do chunk sob demanda.
4. **Equivalência ampliada:** estender os round-trips do TEC-01 para listas e indentação assim que o Tiptap for habilitado por padrão.
