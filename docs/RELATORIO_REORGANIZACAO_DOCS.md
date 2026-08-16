# Relatório — Reorganização da Documentação + Plano das 14 Correções

**Data:** 2026-08-16
**Branch:** `docs/housekeeping-reorg`
**PR:** #22 (Esta) — reorganização de documentação para reduzir releitura por rodada.

---

## 1. O que foi feito nesta PR

### 1.1 Mapa central da documentação (`docs/README.md`)
Criado `docs/README.md` como **porta de entrada única**: lista, por pergunta/tarefa,
qual arquivo ler (canônico vs histórico). Regra de ouro: `docs/STATUS_ATUAL.md`
(status) e `artifacts/ufla-compliance/report.md` (evidência) são os únicos lugares
com números; `context.md` é a narrativa.

### 1.2 Histórico consolidado em `docs/historico/`
Movidos (git keep history) **23 arquivos** que eram relíquias de rodadas antigas e
misturavam a navegação:
- `docs/auditoria/*` (11 relatórios de 14/08)
- `docs/DECISION_002/003/006/007/008/010*.md` (stubs históricos que já apontam
  para canônicos em `docs/decisions/`)
- `docs/CHECKLIST.md`, `docs/CHECKLIST_UFLA_*.md` (estados 14–15/08, redundantes com STATUS_ATUAL)
- `docs/ISSUE_19_TABELAS_HEADER.md` (issue resolvida)
- `checkpoint/workslop-assessment.*` (estado 14/08)
- `MANUAL_DE_NORMALIZACAO_2024.md` (extração bruta duplicada de `MANUAL_NORMALIZACAO_2024.md`)
- `NBR15287_PROJETO_PESQUISA.md` (referência avulsa fora do Manuais/Regras)

### 1.3 Skills reais no `.agents/skills/`
Criadas as 4 skills que o `context.md` **já referenciava mas não existiam**:
- `site_abnt_ufla/SKILL.md` — visão geral + stack + comandos
- `ufla_docx_rules/SKILL.md` — regras globais de formatação UFLA (núcleo obrigatório)
- `abnt_latest_rules/SKILL.md` — ABNT suplente quando o Manual é omisso
- `ufla_docx_compliance/SKILL.md` — validador CLI/API
E o `.agents/AGENTS.md` (regras gerais do agente).

### 1.4 Referências quebradas corrigidas
- `SKILL.md` (raiz) e `context.md` apontavam para `CHECKLIST_SITE_UFLA_MANUAL.md`
  (inexistente) → agora apontam para o canônico (`docs/STATUS_ATUAL.md` /
  `artifacts/ufla-compliance/report.md`).
- `STATUS_ATUAL.md` referenciava `checkpoint/workslop-assessment.md` → corrigido para
  `docs/historico/checkpoint/`.

### 1.5 Checklist dinâmico dos 14 passos (`docs/checklist-14-correcoes.md`)
Documento com os 14 itens, cada um com critério de aceite e teste/comando de prova,
rastreável por `- [ ]` / `- [x]`. Agrupados em Bloco A (crash/perda), B (bugs
verificados) e C (dívidas/robustez), com comando `npm run verify`/`lint`/`ufla:audit`
para fechamento total.

---

## 2. Análise: há necessidade de um gerenciador gratuito (Obsidian/ClickUp/Trello)?

**Resumo: NÃO é necessário adicionar nenhuma ferramenta externa.** O projeto já tem
uma esteira de rastreabilidade git-nativa e a reorganização desta PR resolve o
problema real (custo de releitura). Análise por ferramenta:

| Ferramenta | Veredito | Motivo |
|---|---|---|
| **Obsidian** | ✗ não necessário | É bom para o HUMANO navegar markdown, mas este repositório já é markdown. Adicionaria outra caixa de verdade (vault fora do git) com risco de divergência — o oposto do anti-stale que o projeto cultiva. |
| **ClickUp** | ✗ não necessário | SaaS externo, plano gratuito com limites. Quebra o princípio "evidência no repo" (números ficariam fora do git) e adiciona login/API. |
| **Trello** | ✗ não necessário | Kanban simples, boa UX, mas sem diffs/versão; duplica o estado que já está em `docs/STATUS_ATUAL.md` + `docs/historico/`. |
| **GitHub Issues/Projects (gratuito)** | ✓ (opcional) | É o único que adiciona valor real: Issues com checklists, labels (`fase-A/B/C`), milestones, ligação automática a PRs/commits. Mesmo assim, **não é obrigatório** — o `docs/checklist-14-correcoes.md` basta para a IA; o Projects seria só para o dono acompanhar visualmente. |

**Alternativa recomendada (sem custo, sem caixa de verdade extra):**
1. Usar `docs/checklist-14-correcoes.md` como fonte canônica do andamento (já feito).
2. Para rastreamento visual opcional, abrir **1 Issue no GitHub** referenciando o
   checklist (ex.: "Implementar as 14 correções da análise criteriosa") com os checkboxes
   espelhados — criado apenas se/quando o dono quiser acompanhar fora do VS Code.
3. Não introduzir Obsidian/ClickUp/Trello. Se um dia o volume de tarefas exigir
   planejamento visual de sprint, migrar para **GitHub Projects (kanban gratuito)**
   — permanece no ambiente do repo, sem ferramenta externa.

---

## 3. Próximos passos sugeridos (após merge desta PR)

### Fase 0 — Fechar o pipeline (fazer já)
1. **Merge da PR #22** → `main`, aguardando `verify` green.
2. Começar a implementação pelos itens **A1 e A4** (crash de export por token OMML
   corrompido e corrida do registry) — são os únicos que podem derrubar o usuário em
   runtime e têm correção pequena e isolada.

### Fase 1 — Salvaguardas de dados/arquivo (B6, C12, C10, A2)
3. `ooxmlGate` computado de verdade (auditoria honesta).
4. Limites de tamanho/compressão na importação (zip bomb/OOM).
5. Upload de ficha valida tipo+tamanho (evita DOCX com reparo no Word).
6. Aviso de perda de formatação na importação.

### Fase 2 — Qualidade de validação (C11, B5, B7, C13, C14, A3)
7. Validação de citação sem falso-positivos; remoção do dead code; tab unificado;
   foco do modal; rascunhos corrompidos visíveis; placeholder de imagem inválida.

### Fase 3 — Dívidas técnicas (C8, C9) — última, porque tocam os 4 exportadores
8. Extrair duplicações para `docx-shared.ts`/`docx-render-core.ts` e consolidar
   constantes em `ufla-rules.ts`, validando saída idêntica via snapshot de paginação.

### Critério de fechamento das 14 correções
- `npm run verify` 100% verde (1688 testes → +novos por item).
- `npm run lint` 0 erros/0 warnings.
- `npm run e2e` 13/13.
- `npm run ufla:audit` 11/11 gates, fingerprint atualizado.
- `docs/checklist-14-correcoes.md` 100% `[x]` e `docs/STATUS_ATUAL.md`/`context.md`
  atualizados com a rodada.

---

## 4. Riscos residuais desta PR (esperado, não bloqueia)

- Mover arquivos mantém o histórico (`git mv`), nenhum conteúdo foi apagado.
- `MANUAL_NORMALIZACAO_2024.md` **ficou na raiz** (é citado como `source:` em
  `src/footer-rules.ts` e verificado em teste) — não foi movido de propósito.
- A linha 206 do `context.md` cita `CHECKLIST_SITE_UFLA_MANUAL_v3.md` como relato
  **histórico** (rodada 03/08); mantida como narrativa, sem impacto funcional.