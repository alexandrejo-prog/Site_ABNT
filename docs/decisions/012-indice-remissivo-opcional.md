# DECISION-012: Índice remissivo (elemento opcional) — campo livre, sem campo INDEX automático do Word

## Contexto

O **Manual de normalização e estrutura de trabalhos acadêmicos** (UFLA, 6ª ed., 2025), seção **3.1.2.4.4 – Índices** (p. 66, em referência à **ABNT NBR 6034/2004**), define o índice como elemento **opcional** da parte pós-textual:

> impresso no **final do documento, após o anexo**, em paginação consecutiva;
> ordenado de forma alfabética, contendo assuntos, nomes de pessoas/entidades, nomes geográficos, compostos químicos, citações etc.;
> título **"ÍNDICE"** centralizado, em letras maiúsculas e negrito (demais seções primárias);
> números de página separados por **vírgula** (numeração não consecutiva) ou **hífen** (numeração contínua), ex.: `Aleitamento, 3-8, 12, 14`;
> remissivas no formato **"termo ver termo"** (ex.: `Aviação ver Aeronáutica`);
> as páginas/localização podem ser indicadas por seção ou paginação (escolha do autor).

Até 16/08/2026 o gerador não implementava este elemento. Todos os demais elementos opcionais (errata §3.1.2.1.3, dedicatória §3.1.2.1.5, agradecimentos §3.1.2.1.6, epígrafe §3.1.2.1.7, listas de ilustrações/tabelas/abreviaturas/símbolos §3.1.2.1.11–13, glossário §3.1.2.4.2, apêndices/anexos §3.1.2.4.3, lombada §3.1.1.2 — física, NBR 12225) já estavam cobertos.

## Problema

1. Implementar o índice como **campos de indexação do Word** (`XE` + campo `INDEX`) exigiria uma UX de indexação complexa (marcar termos no texto) que **não existe no editor** e extrapola o escopo do normalizador.
2. As **páginas do documento final só são conhecidas após a renderização pelo Word** (paginação real, DECISION-010). Forçar o gerador a "confirmar" páginas de termos preencheria o campo com números provisórios, fonte de inconsistência.
3. O Manual delega explicitamente ao autor a escolha de localização (seção ou página) e o critério de ordenação: **a responsabilidade sobre as entradas é do autor**.

## Decisão

1. **Campo livre `indice`** — o usuário digita as entradas do índice como texto simples (uma entrada por linha, no formato do Manual, ex.: `Aleitamento, 3-8, 12, 14` / `Sarna ver Escabiose`). O gerador **preserva o texto conforme digitado**.
2. **Posição** — página própria **após o(s) anexo(s)** (ou após os apêndices, se não houver anexo), em paginação consecutiva: `pageBreak()` + `sectionTitle("Índice")` (centralizado, maiúsculas, negrito) + parágrafos simples.
3. **Sumário** — entrada **"ÍNDICE"** adicionada ao fim do sumário (após referências/apêndices/anexos), coerente com os demais pós-textuais.
4. **Sem campo INDEX automático** — **não** geramos `<w:fldSimple INDEX>`/`XE`. As entradas são estáticas e de responsabilidade do autor, idênticas ao modelo do Manual.
5. **Formato não aplicável (artigo/CPG)** — o campo é oculto e **sanitizado** (esvaziado) em `artigo`, `resumo_cpg`, `resumo_expandido_cpg` e `artigo_completo_cpg` (esses formatos não possuem pós-textuais de índice; ver `HIDDEN_PRETEXTUAL` e `sanitizeArticleFields`/`sanitizeCpgFields`).
6. **Preview** — página pós-textual após `Anexos` com numeração consecutiva (`pageNumberHeader`), mesma lógica do DOCX.

## Implementação

- `src/ufla-rules.ts`: campo `indice: string` + default `""` (fora de `ACADEMIC_FIELD_KEYS`/`AcademicFieldKey`, mesmo padrão de `glossario`).
- `src/export-docx.ts`: bloco `pushRun` após anexos + entrada no `collectSummaryEntries`.
- `src/preview-html.ts`: `indice` propagado em `calculateRealPages`/`collectPreviewSummaryEntries`/`summaryHtml` (default `""` para não quebrar artigo/CPG/projeto) + página pós-textual.
- `src/app-constants.ts`: label "Índice remissivo" + `HIDDEN_PRETEXTUAL`.
- `src/field-navigation.ts`: key `indice` em `METADATA_KEYS`.
- `src/work-type-field-normalizer.ts`: sanitização em artigo/CPG.
- `src/validators.ts`: nota do bloco pós-textual atualizada.
- Testes: `tests/unit/indice-remissivo.test.ts` (4) — render DOCX após anexos, vazio não gera, preview pós-anexo, `<w:jc w:val="center">`.

## Impacto

- **Conformidade**: fecha o último elemento **opcional** do Manual UFLA 6ª ed. (§3.1.2.4.4), completando a plenitude da conformidade pós-textual.
- **Sem regressão**: `npm run verify` 210 arquivos / 1688 testes (10 skipped), lint 0/0, build OK; `ufla:audit` 11/11 gates (141s) regenerou `sourceFingerprint` (`4e4c5c3…` → `06090a55…`).
- **Limitação documentada**: as páginas das entradas são as **digitadas pelo autor**; não há recálculo automático (eles mudariam se o documento fosse reeditado). Isso é coerente com o Manual (localização por seção ou página é escolha do autor).