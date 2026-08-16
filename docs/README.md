# docs/ — Mapa da Documentação do Site_ABNT

> **Leia este Mapa primeiro.** Ele informa exatamente o que ler para cada tarefa,
> evitando reler todo o sistema a cada rodada. Números/status vivem apenas no canônico.

## Regra de Ouro (fonte única)

| O que você quer saber? | Leia |
|---|---|
| **Estado atual completo** (contagens, gates, pendências) | `docs/STATUS_ATUAL.md` (canônico) |
| **Evidência da mesma rodada** (report de conformidade, gates) | `artifacts/ufla-compliance/report.md` |
| **Narrativa do projeto / histórico de implementação** | `context.md` (manual de bordo do agente) |
| **Regras de formatação UFLA/ABNT** | skill `ufla_docx_rules` + `abnt_latest_rules` (`.agents/skills/`) |
| **Como validar um DOCX / rodar a auditoria** | skill `ufla_docx_compliance` |
| **Decisões normativas/técnicas** | `docs/decisions/NNN-*.md` (001–012) |
| **Operação do runner Word self-hosted** | `docs/RUNNER_WORD.md` |

## Estrutura

```
docs/
├── README.md                 ← este mapa (LEIA SEMPRE)
├── STATUS_ATUAL.md           ← canônico (números/gates/estado da rodada)
├── RUNNER_WORD.md            ← operação do runner self-hosted com Word
├── decisions/                ← decisões canônicas NNN-*.md (001–012)
└── historico/                ← estado antigo, NÃO é fonte (seções restantes)
    ├── auditoria/            ← relatórios de auditorias anteriores (14/08)
    ├── checkpoint/           ← workslop-assessment (estado 14/08)
    ├── manuais/              ← MANUAL_DE_NORMALIZACAO_2024.md (extração bruta),
    │                           NBR15287_PROJETO_PESQUISA.md (referência avulsa)
    ├── CHECKLIST.md          ← status das fatias 15/08 (HISTÓRICO)
    ├── CHECKLIST_UFLA_*.md   ← checklists antigos (redundantes com STATUS_ATUAL)
    ├── DECISION_00*.md       ← stubs históricos (apontam para decisions/)
    └── ISSUE_19_TABELAS_HEADER.md ← issue resolvida
```

## Árvore de referência principal (raiz)

| Arquivo | Papel |
|---|---|
| `context.md` | Manual de bordo do agente (leituras obrigatórias, regras, 6a–6t). **CONTEXT.md** é o mesmo arquivo (case-insensitive no Windows). |
| `.agents/AGENTS.md` | Regras gerais do agente (idioma, anti-stale). |
| `.agents/skills/*/SKILL.md` | Skills: `site_abnt_ufla` (visão), `ufla_docx_rules` (formatação), `abnt_latest_rules` (ABNT), `ufla_docx_compliance` (validador). Mais 3 skill-files avulsos de contexto. |
| `skills/ufla-docx-compliance/` | Validador CLI/API (`npm run skill:validate`). |
| `MANUAL_NORMALIZACAO_2024.md` | Extração oficial do Manual UFLA 6ª ed. (string de fonte vista no código); ver também `artifacts/ufla-audit/manual/` |
| `TEMPLATE_Manual - Formato padrao.docx` | Template oficial do Word (UFLA). |

## Artefatos (`artifacts/`, git-ignored, regenerados por `npm run ufla:audit`)

- `artifacts/ufla-compliance/report.md` — report canônico da rodada.
- `artifacts/ufla-audit/gates.json` — gates 11/11 da rodada.
- `artifacts/ufla-audit/manual/` — fonte normativa registrada (PDF + requisitos).
- `artifacts/ufla-compliance/rendered/` — PDFs/DOCX de referência renderizados.
- **Regra anti-stale:** nunca edite números à mão; a auditoria regenera tudo na
  mesma rodada (fonte normativa em `context.md` §7).

## Como reduzir a releitura por rodada

1. **Tarefa de formatação/layout** → `ufla_docx_rules` + arquivo exportador afetado.
2. **Bug de validação** → `ufla_docx_compliance` + `src/validators.ts`/`references-*`.
3. **Nova feature de exportação** → `site_abnt_ufla` + exporter + tests existentes.
4. **Rodar/auditar** → seguir `context.md` §5/skills; números só no canônico.
5. **Mudança de regra normativa** → ler `docs/decisions/` + skill normativa,
   registrar decisão em `docs/decisions/NNN-*.md`.