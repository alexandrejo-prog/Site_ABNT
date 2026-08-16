# Checklist Dinâmico — 14 Correções Identificadas na Análise Critéria

> **Fonte da análise:** rodada de avaliação criteriosa do sistema (16/08/2026).
> **Como usar:** marque cada item `[x]` conforme implementado; cada item tem
> **critério de aceite** e o **teste/comando** que prova a conclusão.
> Estado de cada passo = `- [ ]` (pendente) / `- [x]` (feito) — substituindo `[x]`.
> Os passos são independentes entre si (podem ser implementados em qualquer ordem),
> mas recomenda-se a ordem da numeração.

---

## Bloco A — Riscos de crash e perda de dados

### A1. Token OMML editável não pode derrubar export/preview ✅
- [x] **Problema:** `ommlContentTokenDecode` (`src/docx-render-core.ts:901-905`) chama `atob()` sem try/catch; token `\uF001OMML:<base64>\uF001` editável pelo usuário → `export-docx.ts:320` (usado por 4 exportadores + preview) falha.
- [x] **Correção:** envolver decode em try/catch; em falha, degradar para texto achatado e emitir alerta (não crashar).
- [x] **Critério de aceite:** token base64 truncado/inválido no rascunho NÃO lança erro; DOCX gerado com texto achatado + aviso.
- [x] **Teste:** `tests/regression/omml-token-robustness.test.ts` (A1): decode com base64 inválido retorna `""` + `console.warn`; `parseEditorContent`/`generateDocxBlob` com token corrompido sem throw; round-trip de token válido intacto. `npm test` verde (1695).

### A2. Importação avisa que formatação de caracteres não é preservada
- [ ] **Problema:** `import-normalizer.ts:342-366` reconstrói blocos via `textBlock()` (`:124-133`), perdendo bold/italic/underline/runs de `word-structure-extractor.ts` sem alerta.
- [ ] **Correção:** detectar runs com formatação (`bold/italic/underline`) na extração e registrar aviso no resultado de importação ("formatação de destaque não é preservada no rascunho").
- [ ] **Critério de aceite:** importar DOCX com texto em negrito/itálico gera mensagem informativa no painel de importação.
- [ ] **Teste:** teste novo no fluxo de importação com DOCX contendo run com `w:b`/`w:i`, verificando `buildImportResult` com o aviso.

### A3. Linha de imagem importada com id inválido não pode sumir
- [ ] **Problema:** `importedImageParagraph(undefined)` retorna `[]` (`src/export-docx.ts:949-950`) → linha `[[Imagem importada preservada: X]]` com id inválido/stale some do DOCX.
- [ ] **Correção:** emitir placeholder visível (ex.: `[Imagem não localizada]`) em vez de nada; manter texto do usuário.
- [ ] **Critério de aceite:** linha digitada pelo usuário com marcador inválido aparece como placeholder no DOCX, não desaparece.
- [ ] **Teste:** teste de geração com `[[Imagem importada preservada: inexistente]]` → assert do parágrafo placeholder.

### A4. Registro OMML escopado por documento (corrida em geração paralela) ✅
- [x] **Problema:** `clearRawOmmlRegistry()` em cada `generate*` (`export-docx.ts:2983`) + patch pós-Packer lê `rawOmmlRegistry` após `toBlob` → pool 3 de renders pode limpar antes do patch da 1ª geração.
- [x] **Correção:** IDs de marcador únicos (contador monotônico, sem reset) + entrada DELETADA no consumo pelo patch pós-Packer (`rawOmmlDeleteMarker`) + `clearRawOmmlRegistry()` removido dos 4 exportadores (limpar no início apagaria os registros de outra geração em voo).
- [x] **Critério de aceite:** 2 gerações paralelas com equações OMML → ambos DOCX re-injetam OMML corretamente (sem marcador `\uF000UFLAOMML_` vazando).
- [x] **Teste:** `tests/regression/omml-token-robustness.test.ts` (A4): `Promise.all` de 2 `generateDocxBlob` (OMML distintos a/b vs c/d + monografia×artigo) → cada DOCX só com o OMML próprio, sem marcador vazando, `rawOmmlRegistrySize() === 0`.

---

## Bloco B — Bugs reais verificados

### B5. Código morto em `detect()` (references-normalizer)
- [ ] **Problema:** `src/references-normalizer.ts:550-551` — chamada idêntica a `researchDataMatch` 2× consecutivas; linha 551 inalcançável.
- [ ] **Correção:** remover a duplicata; conferir se algum `detectedType` pretendido caiu no processo (verificar vizinhança dos match de `patente`/`periodico` etc.).
- [ ] **Critério de aceite:** sem dead code na busca `detect()`, todos os `detectedType` ainda alcançáveis.
- [ ] **Teste:** `tests/references-normalizer.test.ts` deve continuar verde (fácil); adicionar assert de cobertura para tipo afetado se identificado.

### B6. `ooxmlGate` computado de verdade na auditoria
- [ ] **Problema:** `regenerate-official-artifacts.ts:491-496` escreve `ooxmlGate.status="passed"` fixo; nenhum checker é invocado nesse caminho.
- [ ] **Correção:** invocar `runOoxmlChecks` (de `scripts/ufla-compliance/ooxml-checks.ts`) dentro do regenerate e derivar o status; tratar `openedByRepair` como falha.
- [ ] **Critério de aceite:** se `manifest.openedByRepair=true` ou checker detectar falha estrutural, `ooxmlGate` = failed; caso contrário passed com evidência real.
- [ ] **Teste:** teste do regenerate (ou unit) com manifest `openedByRepair=true` → gate failed; `npm run ufla:audit` continua 11/11 com o gate agora computado.

### B7. Tab direito unificado (9071 vs 9072 twips)
- [ ] **Problema:** `export-docx.ts:2060` usa `position: 9071` (lista ilustrações/tabelas) vs `docx-render-core.ts:539,823,878` `cmToTwip(16)`=9072 (equações).
- [ ] **Correção:** criar `UFLA_RULES.page.tabRightTwip` (=9072) e usar em todos os pontos.
- [ ] **Critério de aceite:** qualquer tab direito de conteúdo usa a mesma constante (grep não mostra 9071).
- [ ] **Teste:** testes existentes de OOXML de sumário/equações permanecem verdes; grep 9071 = 0.

---

## Bloco C — Dívidas técnicas e robustez

### C8. Deduplicar exportadores (extrair para core/shared)
- [ ] **Problema:** `pageNumberHeader` 4 cópias, `centeredParagraph` 5 variantes, `referenceRunToTextRun` 4 cópias, dedup/ordenação de referências 4× com chaves divergentes (`export-research-project-docx.ts:404` ordena texto inteiro vs `getAuthorKey` em export-docx).
- [ ] **Correção (faseada, sem alterar saída):** (1) extrair `pageNumberHeader`, `centeredParagraph`, `referenceRunToTextRun`, `schema de referências (dedup+sort)` para `docx-shared.ts`; (2) unificar chave de ordenação via `getAuthorKey` movida para shared; (3) `export-docx.ts:1611 splitParagraphs` passa a usar o core.
- [ ] **Critério de aceite:** `npm run verify` verde; DOCX gerado idêntico (mesmos twips/páginas) — validar via snapshot `preview-docx-snapshot.json` e `ufla:audit` 11/11.
- [ ] **Teste:** suíte existente (1688 testes) verde; snapshot de paginação sem mudança de digest.

### C9. Constantes de layout consolidadas em `ufla-rules.ts`
- [ ] **Problema:** margens `1701/1134` twips em `export-docx.ts:1404`, `TITLE_SIZE/AUTHOR_SIZE` hardcoded no artigo (`export-article-docx.ts:320-322`), `cmToTwip(1.25)` no artigo (`:189`), hanging 0,5 em 3 lugares.
- [ ] **Correção:** usar `UFLA_RULES.margins.leftTwip/rightTwip`, `UFLA_RULES.typography.*`, `UFLA_RULES.spacing.referenceHangingCm` em todos os exportadores.
- [ ] **Critério de aceite:** nenhum valor de layout literal nos 4 exportadores onde existir constante UFLA_RULES.
- [ ] **Teste:** testes de OOXML (twips/margens) seguem verdes; auditoria 11/11.

### C10. Upload de ficha valida tipo e tamanho (sem DOCX com reparo)
- [ ] **Problema:** `MetadataFields.tsx:175` aceita qualquer arquivo; `export-docx.ts:2598` só checa `byteLength>0` → PDF/scan gigante vira `ImageRun` com risco de reparo no Word.
- [ ] **Correção:** validar `file.type`/magic bytes (png/jpeg/webp) + limite (ex.: ≤ 10 MB) no handler; fallback de dimensões sem distorção quando `createImageBitmap` falhar.
- [ ] **Critério de aceite:** upload de arquivo não-imagem é recusado com mensagem; imagem gigante é recusada; ImageRun só recebe imagem válida.
- [ ] **Teste:** teste do componente (jsdom) com file fake do tipo errado → erro amigável; e teste do export com ArrayBuffer inválido → sem ImageRun.

### C11. Validação de citação sem falso-positivos
- [ ] **Problema:** `validateShortCitation` (`src/validators.ts:344-384`) trata qualquer parêntese `(IBGE)`, `(Tabela 2)`, `(2020)` como citação sem ano; `SILVA (2024)` gera `citation-author-missing`.
- [ ] **Correção:** só considerar parêntese como citação quando há padrão autor-ano plausível (autor+ano ou `(Autor, ano)`); quando autor está fora (ex.: `SILVA (2024)`), não emitir `citation-author-missing` (considerar a forma correta).
- [ ] **Critério de aceite:** `(IBGE)`, `(Tabela 2)` e `(2020)` sozinhos NÃO emitem warnings; `SILVA (2024)` não emite `citation-author-missing`; `(SILVA, 2024)` correto aceito.
- [ ] **Teste:** ajustar `tests/` de citação; adicionar casos negativos/positivos descritos acima.

### C12. Limites de tamanho/compressão na importação
- [ ] **Problema:** `import-docx.ts:886` lê arquivo inteiro; `word-structure-extractor.ts:916` JSZip sem teto de descompressão; `includeMediaData:true` lê todas as mídias → zip bomb/OOM.
- [ ] **Correção:** checar tamanho do arquivo antes (`file.size`, ex. ≤ 60 MB) e razão descomprimido/entrada (limite); erro amigável de importação.
- [ ] **Critério de aceite:** arquivo > limite ou entrada descomprimida excessiva é recusado com mensagem; importação normal permanece funcional (e2e de importação verde).
- [ ] **Teste:** teste de importação com DOCX grande (mock) → erro amigável; e2e de importação continua 13/13.

### C13. Modal devolve foco ao fechar (WCAG 2.4.3)
- [ ] **Problema:** `PreviewModal.tsx` move foco ao diálogo e tem focus trap, mas `onClose` não devolve ao botão "Visualizar".
- [ ] **Correção:** guardar `document.activeElement` antes de abrir e `focus()` ao fechar; fallback para o botão pelo `data-cy`/ref.
- [ ] **Critério de aceite:** após fechar via Escape/X, o foco retorna ao elemento que abriu o modal (teste jsdom verifica `document.activeElement`).
- [ ] **Teste:** `tests/preview-modal.test.tsx` novo caso "fecha e devolve foco".

### C14. Rascunhos corrompidos viram aviso (nunca desaparecem em silêncio)
- [ ] **Problema:** `draft-storage.ts:169-180` (`readDraftsIndex`) retorna `[]` silenciosamente e não remove o JSON inválido; `loadDraft` (`:63-79`) engole com log só DEV.
- [ ] **Correção:** detectar corrupção, criar aviso (draft "corrompido" visível na UI com opção de descartar/ignorar), NÃO apagar o bloco; não silenciar.
- [ ] **Critério de aceite:** localStorage com JSON inválido → usuário vê aviso e pode decidir; dado original não é sobrescrito até decisão explícita.
- [ ] **Teste:** teste do `draft-storage` com payload corrompido → retorno com flag/aviso e preservação; UI mostra o estado.

---

## Como verificar o progresso do bloco

```bash
npm run verify    # testes + build obrigatório após cada passo
npm run lint      # 0 erros/0 warnings
npm run ufla:audit  # 11/11 gates ao final de mudanças em exportadores/validador
```

Após todos os 14: rodar `npm run verify`, `npm run lint`, `npm run e2e` e
`npm run ufla:audit`; atualizar `docs/STATUS_ATUAL.md` e `context.md` (seções 6* ) com
a rodada (números da auditoria — nunca à mão).