# Checklist Dinâmico — 14 Correções Identificadas na Análise Critéria

> **Fonte da análise:** rodada de avaliação criteriosa do sistema (16/08/2026).
> **Estado: ✅ 100% CONCLUÍDO em 16/08/2026** — `npm test` 1731 passed / 10 skipped / 0 failed,
> `npm run lint` 0/0, `npm run e2e` 13/13, `npm run ufla:audit` **11/11 gates**
> (`sourceFingerprint 3bd3c7f7…`, 142s, FULL COMPLIANCE APROVADO).
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
- [x] **Teste:** `tests/regression/omml-token-robustness.test.ts` (A1): decode com base64 inválido retorna `""` + `console.warn`; `parseEditorContent`/`generateDocxBlob` com token corrompido sem throw; round-trip de token válido intacto.

### A2. Importação avisa que formatação de caracteres não é preservada ✅
- [x] **Problema:** `import-normalizer.ts:342-366` reconstrói blocos via `textBlock()` (`:124-133`), perdendo bold/italic/underline/runs de `word-structure-extractor.ts` sem alerta.
- [x] **Correção:** detectar runs com formatação (`bold/italic/underline`) na extração e registrar aviso no resultado de importação (`collectFormattingLossWarning` em `src/import-docx.ts`, padrão do `collectChangeWarnings`).
- [x] **Critério de aceite:** importar DOCX com texto em negrito/itálico gera mensagem informativa no painel de importação ("O rascunho preserva o texto, mas NÃO a formatação de caracteres").
- [x] **Teste:** `tests/regression/import-formatting-placeholder.test.ts` (A2): DOCX com `w:b`/`w:i`/`w:u` → aviso no `buildImportResult`; sem formatação → sem aviso.

### A3. Linha de imagem importada com id inválido não pode sumir ✅
- [x] **Problema:** `importedImageParagraph(undefined)` retorna `[]` (`src/export-docx.ts:949-950`) → linha `[[Imagem importada preservada: X]]` com id inválido/stale some do DOCX.
- [x] **Correção:** emitir placeholder visível `[Imagem importada: dados originais indisponíveis (id: …)]` em vez de nada; manter texto do usuário.
- [x] **Critério de aceite:** linha digitada pelo usuário com marcador inválido aparece como placeholder no DOCX, não desaparece.
- [x] **Teste:** `tests/regression/import-formatting-placeholder.test.ts` (A3): marcador com id inexistente → placeholder no DOCX sem o marcador cru; sem marcador → sem placeholder.

### A4. Registro OMML escopado por documento (corrida em geração paralela) ✅
- [x] **Problema:** `clearRawOmmlRegistry()` em cada `generate*` (`export-docx.ts:2983`) + patch pós-Packer lê `rawOmmlRegistry` após `toBlob` → pool 3 de renders pode limpar antes do patch da 1ª geração.
- [x] **Correção:** IDs de marcador únicos (contador monotônico, sem reset) + entrada DELETADA no consumo pelo patch pós-Packer (`rawOmmlDeleteMarker`) + `clearRawOmmlRegistry()` removido dos 4 exportadores.
- [x] **Critério de aceite:** 2 gerações paralelas com equações OMML → ambos DOCX re-injetam OMML corretamente (sem marcador `\uF000UFLAOMML_` vazando).
- [x] **Teste:** `tests/regression/omml-token-robustness.test.ts` (A4): `Promise.all` de 2 `generateDocxBlob` (OMML distintos + monografia×artigo) → cada DOCX só com o OMML próprio, `rawOmmlRegistrySize() === 0`.

---

## Bloco B — Bugs reais verificados

### B5. Código morto em `detect()` (references-normalizer) ✅
- [x] **Problema:** `src/references-normalizer.ts:550-551` — chamada idêntica a `researchDataMatch` 2× consecutivas; linha 551 inalcançável.
- [x] **Correção:** remover a duplicata; verificado que nenhum `detectedType` pretendido caiu (a 1ª chamada já cobre `dados-pesquisa`; `patente/periodico/correspondencia/…` seguem alcançáveis).
- [x] **Critério de aceite:** sem dead code na busca `detect()`, todos os `detectedType` ainda alcançáveis.
- [x] **Teste:** `tests/references-normalizer.test.ts` verde (sem mudança de comportamento); `npm test` 1731 passed.

### B6. `ooxmlGate` computado de verdade na auditoria ✅
- [x] **Problema:** `regenerate-official-artifacts.ts:491-496` escrevia `ooxmlGate.status="passed"` fixo; nenhum checker era invocado nesse caminho.
- [x] **Correção:** `runOoxmlChecks` invocado no regenerate (`loadDocxPartsFromFile` + `runOoxmlChecks`) e status derivado por `evaluateOoxmlGate` (falha se `openedByRepair=true` ou achado estrutural `error`); `toc-style` reclassificado para warning quando o campo TOC existe (falso positivo do gerador); evidência real com contagens.
- [x] **Critério de aceite:** `openedByRepair=true` ou falha estrutural → `ooxmlGate=failed`; caso contrário passed com evidência computada. `npm run ufla:audit` continua 11/11.
- [x] **Teste:** `tests/ufla-compliance/ooxml-gate.test.ts` (5): openedByRepair→failed; erro estrutural→failed; só warnings→passed; sem achados→passed; separação errors/warnings. Auditoria 11/11 com o gate computado.

### B7. Tab direito unificado (9071 vs 9072 twips) ✅
- [x] **Problema:** `export-docx.ts:2060` usava `position: 9071` (lista ilustrações/tabelas) vs `docx-render-core.ts:539,823,878` `cmToTwip(16)`=9072 (equações).
- [x] **Correção:** `UFLA_RULES.page.tabRightTwip` (=9072) criado e usado nos 4 pontos (sumário/listas com leader de pontos + equações).
- [x] **Critério de aceite:** qualquer tab direito de conteúdo usa a mesma constante (grep 9071 = 0).
- [x] **Teste:** `grep 9071 src/` vazio; `tests/ooxml/ufla-equations.test.ts` (pos 9072) e `tests/unit/lista-ilustracoes.test.ts` verdes.

---

## Bloco C — Dívidas técnicas e robustez

### C8. Deduplicar exportadores (extrair para core/shared) ✅
- [x] **Problema:** `referenceRunToTextRun` 4 cópias, `pageNumberHeader` 2 cópias idênticas locais (export-docx/article), `getAuthorKey` local em export-docx vs ordenação por texto inteiro no research-project, `splitParagraphs` local em export-docx (os outros 3 já usavam o core).
- [x] **Correção:** `referenceRunToTextRun(run, font?, size?)` parametrizado em `docx-shared.ts` (cada exportador passa a fonte/tamanho do seu tipo — saída byte-idêntica); `getAuthorKey`/`dedupeReferences`/`sortReferencesByAuthorKey` compartilhados; `pageNumberHeader` do shared usado no export-docx/article; `splitParagraphs` do core usado no export-docx; research-project passa a ordenar pela chave ABNT (`getAuthorKey`) como o export-docx.
- [x] **Critério de aceite:** `npm run verify` verde; DOCX idêntico (mesmos twips/páginas) — validado via snapshot de paginação e `ufla:audit` 11/11.
- [x] **Teste:** suíte completa 1731 passed; auditoria 142s **11/11** com `previewDiffGate`/`perTypePhysicalGate`/`coverageDocxPdfGate` passed (saída preservada).

### C9. Constantes de layout consolidadas em `ufla-rules.ts` ✅
- [x] **Problema:** `PORTRAIT_CONTENT_TWIP` usava 1701/1134 literais (`export-docx.ts:1416`), tamanhos 32/28 da capa do artigo hardcoded (`export-article-docx.ts:320-322`), `cmToTwip(1.25)` no artigo e hanging 0,5 em 3 exportadores.
- [x] **Correção:** `UFLA_RULES.spacing.referenceHangingCm/Twip` (0,5 cm, NBR 6023) usado nos 4 pontos de hanging; `PORTRAIT_CONTENT_TWIP` usa `margins.leftTwip/rightTwip`; capa do artigo usa `coverTitleFontSizePt/coverAuthorFontSizePt`; `paragraphFirstLineTwip` no artigo.
- [x] **Critério de aceite:** nenhum valor de layout literal nos 4 exportadores onde existir constante UFLA_RULES.
- [x] **Teste:** testes de OOXML (twips/margens/capa) verdes (`export-docx`, `export-article-cleaner`, `worktype-format-matrix`, `cover-literal`); auditoria 11/11.

### C10. Upload de ficha valida tipo e tamanho (sem DOCX com reparo) ✅
- [x] **Problema:** `MetadataFields.tsx:175` aceitava qualquer arquivo; `export-docx.ts:2598` só checava `byteLength>0` → PDF/scan gigante vira `ImageRun` com risco de reparo no Word.
- [x] **Correção:** `src/image-asset-utils.ts` (novo): `isValidImageBytes` (magic bytes PNG/JPEG/WebP), `readImageDimensions` (PNG IHDR / JPEG SOF — fallback sem distorção quando `createImageBitmap` falha), `MAX_FICHA_IMAGE_BYTES` (10 MB). Upload recusa não-imagem e imagem > 10 MB com erro amigável (`role="alert"`); export cai para texto quando os bytes não são imagem válida.
- [x] **Critério de aceite:** upload de arquivo não-imagem é recusado com mensagem; imagem gigante é recusada; ImageRun só recebe imagem válida.
- [x] **Teste:** `tests/unit/image-asset-utils.test.ts` (6: magic bytes, PNG/JPEG dims, limite, export inválido sem `<w:drawing>`, PNG válido com drawing) + `tests/unit/ficha-upload-validation.test.tsx` (3: pdf recusado, >10 MB recusado, PNG aceito com dims do header).

### C11. Validação de citação sem falso-positivos ✅
- [x] **Problema:** `validateShortCitation` (`src/validators.ts:344-384`) tratava qualquer parêntese `(IBGE)`, `(Tabela 2)`, `(2020)` como citação sem ano; `SILVA (2024)` gerava `citation-author-missing`.
- [x] **Correção:** só trata como citação parêntese com padrão autor-ano plausível (ano presente OU indicador de página); ano puro sem autor dentro/fora é ignorado; autor fora na forma correta (`SILVA (2024)`) não gera `citation-author-missing`.
- [x] **Critério de aceite:** `(IBGE)`, `(Tabela 2)` e `(2020)` sozinhos NÃO emitem warnings; `SILVA (2024)` não emite `citation-author-missing`; `(SILVA, 2024)` correto aceito; `(SILVA, p. 15)` ainda acusa ano ausente.
- [x] **Teste:** `tests/unit/citation-locator.test.ts` (13, +6 casos C11): negativos `(IBGE)`/`(Tabela 2)`/`(2020)`, `SILVA (2024)` sem author-missing, `(SILVA, 2024)` aceito, `(SILVA, p. 15)` → year-missing.

### C12. Limites de tamanho/compressão na importação ✅
- [x] **Problema:** `import-docx.ts:886` lia arquivo inteiro; `word-structure-extractor.ts:916` JSZip sem teto de descompressão; `includeMediaData:true` lia todas as mídias → zip bomb/OOM.
- [x] **Correção:** `MAX_IMPORT_FILE_BYTES` (60 MB) no `importDocumentFile` com erro amigável; `assertReasonableUncompressedSize` (`MAX_UNCOMPRESSED_IMPORT_BYTES` = 500 MB) mede o diretório central SEM descomprimir (antes do mammoth e dentro do `extractDocxStructure`) e recusa com mensagem.
- [x] **Critério de aceite:** arquivo > limite ou entrada descomprimida excessiva é recusado com mensagem; importação normal permanece funcional.
- [x] **Teste:** `tests/import/import-limits.test.ts` (5): zip normal aceito; `uncompressedSize` patcheado > teto → throw (sem alocar 500 MB); `extractDocxStructure` normal funciona; `importDocumentFile` com `size` > 60 MB → "muito grande"; importação normal intacta. Suíte de importação 17 arquivos/123 passed.

### C13. Modal devolve foco ao fechar (WCAG 2.4.3) ✅
- [x] **Problema:** `PreviewModal.tsx` movia o foco ao diálogo e tinha focus trap, mas `onClose` não devolvia ao botão "Visualizar".
- [x] **Correção:** o efeito de montagem guarda `document.activeElement` e o cleanup devolve `focus()` ao elemento que abriu o modal.
- [x] **Critério de aceite:** após fechar via Escape/X, o foco retorna ao elemento que abriu o modal (teste jsdom verifica `document.activeElement`).
- [x] **Teste:** `tests/rendering/preview-modal.test.tsx` novo caso "devolve o foco ao elemento que abriu o modal ao fechar (C13 / WCAG 2.4.3)": foco no gatilho → foco entra no diálogo (createPortal) → unmount → `document.activeElement` volta ao gatilho.

### C14. Rascunhos corrompidos viram aviso (nunca desaparecem em silêncio) ✅
- [x] **Problema:** `draft-storage.ts` (`readDraftsIndex`/`loadDraft`) retornavam `[]`/`null` silenciosamente e não removiam o JSON inválido; dado sumia da listagem sem aviso.
- [x] **Correção:** `draftCorruptionIssues(storage)` detecta JSON inválido/shape errado/entradas inválidas SEM apagar nada; `discardCorruptedDraftData(storage)` remove APENAS por decisão explícita; banner `role="alert"` no gerenciador de rascunhos (DraftStatus) com botão "Descartar dados corrompidos"; App carrega e expõe o estado.
- [x] **Critério de aceite:** localStorage com JSON inválido → usuário vê aviso e pode decidir; dado original não é sobrescrito até decisão explícita.
- [x] **Teste:** `tests/editor/draft-corruption.test.ts` (6): índice corrompido → aviso + raw preservado; shape não-array → aviso; entradas inválidas → contagem + válidos listados; autosave corrompido → loadDraft null + raw preservado + aviso; discard remove só o corrompido; storage limpo → sem avisos.

---

## Como verificar o progresso do bloco

```bash
npm run verify    # testes + build obrigatório após cada passo
npm run lint      # 0 erros/0 warnings
npm run ufla:audit  # 11/11 gates ao final de mudanças em exportadores/validador
```

**Rodada final (16/08/2026):** `npm test` **1731 passed / 10 skipped / 0 failed** (217 arquivos),
`npm run lint` 0/0, `npm run e2e` **13/13**, `npm run ufla:audit` **11/11 gates** (142s,
`sourceFingerprint 3bd3c7f7…`, FULL COMPLIANCE APROVADO). `docs/STATUS_ATUAL.md` e `context.md`
atualizados com a rodada (números da auditoria — nunca à mão).

---

## Fora de escopo (cancelado) — outros tamanhos de folha além de A4

- [ ] **Decisão (16/08/2026):** NÃO implementar suporte a outros tamanhos de folha
  (carta, ofício, etc.) por ora — **A4 é o padrão brasileiro e o default do gerador**
  (11906×16838 twips retrato via `UFLA_RULES.page`; paisagem apenas para tabelas
  largas, DECISION-009). Se um dia for necessário, revisitar como **pendência
  opcional futura** (não bloqueia conformidade: a diretiva é o DOCX atender
  plenamente ao Manual UFLA, e o Manual pressupõe A4).
