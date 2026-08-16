# AGENTS.md — Regras do Agente para Site_ABNT

> Ponto de entrada enxuto do agente. **Antes de qualquer alteração**, leia
> `context.md` (manual de bordo completo) e carregue a skill relevante:
> `ufla_docx_rules` (formatação) antes de tocar em qualquer gerador.

## Regras Gerais

1. **Idioma:** Interaja sempre em português (Brasil).
2. **Manual de bordo:** `context.md` é a fonte narrativa de status/estado.
3. **Canônico:** `docs/STATUS_ATUAL.md` (status) e `artifacts/ufla-compliance/report.md`
   (evidência) são únicos — nunca duplique números em outro lugar sem marcar histórico.
4. **Decisões:** toda decisão normativa/técnica vai em `docs/decisions/NNN-*.md`
   (os `docs/historico/DECISION_*` antigos apontam para lá).
5. **Evidência:** não edite números de evidência à mão — rode `npm run ufla:audit`.
6. **Fique curto:** a cada rodada NÃO é preciso reler todo o sistema; use o mapa
   em `docs/README.md` para saber apenas o que ler conforme a tarefa.
7. **Diretiva principal:** o DOCX gerado deve atender PLENAMENTE ao Manual de
   Normalização da UFLA — página sempre **A4** (11906×16838 twips retrato;
   paisagem só para tabelas largas, DECISION-009). Confira `UFLA_RULES.page` a
   cada mudança nos exportadores e valide com `npm run ufla:audit`.