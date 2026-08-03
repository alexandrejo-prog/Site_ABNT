# AUDITORIA GERAL DO SITE — Site_ABNT / UFLA

> Registro da auditoria geral concluída em 03/08/2026. Documento de rastreabilidade.
> Nenhuma alteração de lógica, teste, CI ou configuração foi realizada nesta etapa — apenas registro.

---

## 1. Diagnóstico geral

O site é um projeto técnicamente maduro e bem testado: **147 arquivos de teste, 1216 testes, 10 skipped, build OK**, CI duplo (test + build no push/PR), TypeScript estrito, acessibilidade automatizada e validação automática de DOCX.

O principal ponto de atenção não é a ausência de testes, mas **micro-arquitetura fragmentada**: arquivos monolíticos, múltiplas folhas de estilo sobrepostas e alguns processos duplicados. Há também dependência de convenções implícitas (ex.: regras comportamentais do agente registradas fora do código).

Grau de confiança:
- **Alto** para os fatos verificáveis nesta auditoria (contagem de arquivos, tamanho de módulos, configuração, resultado do `npm run verify`).
- **Médio** para inferências de manutenção a longo prazo.

---

## 2. Pontos fortes

- **TypeScript rigoroso**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, `noEmit`.
- **Verificação automática** em CI (`verify.yml`/`ci.yml`): testes + build sem intervenção manual.
- **Cobertura de conformidade**: 7 tipos de trabalho + validador DOCX (`skills/ufla-docx-compliance`, `skill:validate`) + checklist UFLA/ABNT.
- **Separacão por responsabilidade**: um exportador por tipo de trabalho (tese/dissertação/monografia, artigo, CPG, projeto de pesquisa), utilitários de normalização, validação e preview isolados.
- **Acessibilidade testada**: `axe-core`/`jest-axe`.
- **Observabilidade**: módulo `observability`, rastreamento de eventos de preview e geração.
- **Persistência robusta**: `saveDraft` devolve `{ ok, kind }`, tratamento de erro de `localStorage`.
- **Preview fiel ao DOCX** e geração/renderização compartilhando a mesma lógica de normalização.

---

## 3. Riscos e fragilidades

| # | Fragilidade | Evidência | Severidade |
|---|---|---|---|
| F1 | Arquivos monolíticos | `export-docx.ts` (2.172 ln), `field-detector.ts` (1.456 ln), `preview-html.ts` (848 ln), `validators.ts` (555 ln) | Alta |
| F2 | CSS fragmentado e com possível sobreposição de especificidade | 6 folhas importadas em `main.tsx` (`styles.css`, `accessibility.css`, `ux-fixes.css`, `editor-enhancer.css`, `word-toolbar.css`, `preview-styles.css`) somando ~2.500 ln | Média |
| F3 | Sem linter de código | TypeScript cobre tipos, mas não padroniza estilo, importações nem detecta imports não usados de forma confiável | Média |
| F4 | Duplicação de CI | `ci.yml` e `verify.yml` executam praticamente o mesmo fluxo (test + build), com configuração divergente (Node 20 vs 24) | Baixa |
| F5 | Ambiente de teste implícito | `vitest.config` usa `environment: 'node'` global, inclusive para testes `.tsx` de componente; risco de false-positives | Média |
| F6 | Dependência de convenção implícita | Regras de estilo e comportamento do agente mantidas em `context.md`/arquivos de skill, fora do código versionado da app | Média |
| F7 | Artefatos de auditoria fora do repo | `CHECKLIST_SITE_UFLA_MANUAL_v3.md`, `generate-all-validation.ts` e `run-validations.cjs` movidos para `../audit_site_abnt/` (fora do versionamento) | Baixa |

---

## 4. Melhorias priorizadas (impacto × esforço)

| # | Melhoria | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| M1 | Adicionar ESLint + Prettier (config `eslint.config.js`, `react-hooks`, `import`, tipos) integrado ao `verify` | Alto | Médio | Alta |
| M2 | Consolidar folhas de estilo (agrupamento por import ou `@layer`) e reduzir especificidade | Médio | Médio | Alta |
| M3 | Fraguar de `export-docx.ts` em módulos reutilizáveis (capa, folha de rosto, resumo, listas, anexos) | Médio | Alto | Média |
| M4 | Uniformizar a CI: único pipeline, Node fixo, adicionar `npm run lint` | Baixo | Baixo | Alta (rápida) |
| M5 | Fixar explicitamente o ambiente de teste (`jsdom` para testes de componente) | Médio | Baixo | Alta |
| M6 | Criar `CONTRIBUTING.md` documentando `npm run verify`, `npm run skill:validate` e o fluxo de contribuição | Baixo | Baixo | Média |
| M7 | Centralizar regras normativas (evitar duplicação de constantes entre módulos) | Médio | Médio | Média |

---

## 5. Recomendações por prazo

**Curto prazo (baixo esforço, alto retorno):**
- Adicionar ESLint + Prettier, integrado ao `verify`.
- Corrigir a duplicação de CI; fixar Node e incluir `npm run lint`.
- Definir explicitamente o ambiente de teste por tipo (jsdom vs node).

**Médio prazo:**
- Refatorar `export-docx.ts`/`field-detector.ts`, apoiado pela suíte de regressão existente.
- Unificar folhas de estilo e adotar `@layer`.
- Criar `CONTRIBUTING.md`.

**Longo prazo (estrutural):**
- Isolar a lógica normativa em uma biblioteca testável e consumida pelos exportadores.
- Adicionar cobertura de código (ex.: `v8`) e `feature gates` na CI.
- Reduzir a dependência de convenção implícita consolidando as regras em documentação versionada ao lado do código.

---

## 6. Próximo plano de execução

Ordem de baixo para maior risco, mantendo o repositório compilável e com `npm run verify` verde ao fim de cada etapa:

| Etapa | Ação | Risco |
|-------|------|-------|
| **A1** | Registrar esta auditoria em `docs/AUDITORIA_2026.md` (este documento) | Nenhum |
| **A2** | Fixar o ambiente de teste (`jsdom`) para testes de componente | Baixo |
| **A3** | Adicionar ESLint + Prettier (config + devDependencies + scripts) | Baixo–Médio |
| **A4** | Rodar `eslint --fix`/`prettier --write` (apenas formatação, sem lógica) | Médio |
| **A5** | Uniformizar a CI (pipeline único, Node fixo, `npm run lint`) | Médio |
| **A6** | Rodar `npm run verify` final | — |

**Comando de validação da etapa corrente:** `npm run verify` (testes + build) — deve permanecer verde antes de avançar à próxima etapa.

---

*Fim do documento.*