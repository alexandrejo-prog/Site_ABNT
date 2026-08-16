# Checklist Dinâmico — 15 Melhorias (rodada 29, 16/08/2026)

> **Regra número 1 do site:** o DOCX gerado deve atender **plenamente** ao
> Manual de Normalização da UFLA (6ª ed.) e às normas ABNT vigentes — toda
> melhoria é avaliada primeiro sob esta ótica (A4, margens 3/3/2/2 cm, Times
> New Roman, espaçamento 1,5, recuo 1,25 cm, paginação contínua a partir da
> folha de rosto, pré/pós-textuais, referências ABNT, tabelas/figuras/equações).
> **Como usar:** marque `[x]` conforme implementado; cada item tem critério de
> aceite e o teste/comando de prova. Recomenda-se a ordem da numeração.

---

## Bloco A — Conformidade do DOCX com o Manual UFLA (regra 1)

### A1. w:tblHeader nas tabelas importadas (fechar os warnings `table-header-missing`)
- [ ] **Problema:** o checker OOXML emite 9 `table-header-missing` (warning) no DOCX de referência: tabelas com 2+ linhas cujo cabeçalho não é identificado semanticamente (NBR 17225 / WCAG 1.3.1). O patch pós-Packer marca `w:tblHeader` por heurística, mas tabelas importadas de fontes variadas podem escapar.
- [ ] **Correção:** na importação (`word-structure-extractor`), detectar a 1ª linha como cabeçalho (negrito/centralizada/tipo difere das demais) e propagar a intenção ao exportador; o patch pós-Packer passa a marcar essas tabelas.
- [ ] **Critério de aceite:** `runOoxmlChecks` no DOCX regenerado → 0 `table-header-missing`; round-trip não perde nenhuma tabela (35/35 preservadas).
- [ ] **Teste:** teste de importação com tabela de cabeçalho em negrito → `w:tblHeader` no DOCX final; `npm run ufla:audit` 11/11.

### A2. Física por tipo: capa e folha de rosto (elementos visíveis no PDF)
- [ ] **Problema:** a validação de capa (autor 14 pt, título 16 pt, local/ano, logo 7×2,85 cm) e folha de rosto existe no OOXML/`validate-cover-layout`, mas o gate físico por tipo (`perTypePhysicalGate`) não confere esses elementos no PDF renderizado.
- [ ] **Correção:** estender `analyze-per-type-pdfs.ts` para reconhecer, na página 1 de cada tipo, presença do logo (opList/CTM), textos institucional/autor/título e sua ordem vertical.
- [ ] **Critério de aceite:** cada tipo tem a página de capa com os 4 elementos na ordem (institucional → autor → título → local/ano) no PDF físico.
- [ ] **Teste:** fixture por tipo renderizada → asserções físicas; `ufla:audit` 11/11.

### A3. Paginação física: número visível ausente na folha de rosto (DECISION-010)
- [ ] **Problema:** DECISION-010 exige contagem contínua com número **não visível** na folha de rosto; o OOXML valida o `pgNumType start`, mas a física não confirma que a folha de rosto não exibe número no PDF.
- [ ] **Correção:** no analisador físico, verificar que a página da folha de rosto (2ª página) não contém dígito de número de página na margem superior/rodapé, e que a Introdução exibe o valor contado.
- [ ] **Critério de aceite:** página da folha de rosto sem número visível; Introdução com o número contado (N ≥ 2) no PDF.
- [ ] **Teste:** análise física da página 2 e da 1ª página textual; gate novo ou extensão do `renderedLayoutGate`.

### A4. Citação longa (4 cm, 11 pt, espaço simples) por tipo no DOCX real
- [ ] **Problema:** o checker OOXML valida a presença de citação longa no DOCX de referência, mas não por tipo; um artigo/CPG sem citação longa pode gerar falso-positivo ou gap não coberto.
- [ ] **Correção:** parâmetro por tipo no `runOoxmlChecks` (como o validador da skill faz com `--type`): citação longa exigida apenas quando o conteúdo tem citação direta; recuo/letra/espaço verificados por ocorrência.
- [ ] **Critério de aceite:** DOCX com citação direta longa → `w:left=2268`, `sz=22`, `w:line=240`; sem citação direta → sem falso-positivo.
- [ ] **Teste:** casos por tipo em `tests/ooxml/`; auditoria 11/11.

### A5. Sumário no PDF: números de página do TOC coerentes com o conteúdo
- [ ] **Problema:** o DOCX usa campo TOC/PAGEREF (o Word recalcula ao abrir); o snapshot `preview-docx-snapshot.json` valida o preview, mas não confere se os números exibidos no sumário do PDF correspondem às páginas reais das seções.
- [ ] **Correção:** no PDF físico (com campos atualizados pelo Word), extrair entradas do sumário (título + número) e cruzar com a página real de cada heading (via índice remissivo textual).
- [ ] **Critério de aceite:** para as seções principais do DOCX de referência, o número do sumário == página real no PDF (tolerância 0).
- [ ] **Teste:** extensão do `coverage-docx-pdf.ts` (pageMap de títulos) + gate `tocPageConsistencyGate`.

### A6. Referências: "Acesso em" obrigatório para tipo `online` por tipo gerado
- [ ] **Problema:** o validador bloqueia `reference-access-missing` para referência online, mas não há teste que garanta que **todo** tipo (monografia, artigo, projeto, CPG) gere DOCX com a exigência ativa.
- [ ] **Correção:** matriz de testes por tipo com referência online sem "Acesso em:" → erro bloqueante; com → OK.
- [ ] **Critério de aceite:** nenhum tipo gera DOCX com referência online sem acesso em; mensagem amigável no painel.
- [ ] **Teste:** `tests/references-*` por tipo (4 exportadores).

### A7. Mojibake zero em TODOS os DOCX por tipo
- [ ] **Problema:** a checagem de mojibake roda no DOCX de referência; DOCX de outros tipos podem escapar de um problema de encoding específico de caminho.
- [ ] **Correção:** estender o gate por tipo (`gates-per-type.json`) para incluir a checagem de mojibake/encoding em cada DOCX gerado.
- [ ] **Critério de aceite:** 15/15 tipos sem mojibake (0 ocorrências de U+FFFD/sequências inválidas).
- [ ] **Teste:** extensão do `perTypeGate`; fixture por tipo.

---

## Bloco B — Robustez da validação e da geração

### B1. Notas de rodapé físicas no PDF (fonte menor, espaço simples)
- [ ] **Problema:** rodapés são validados no OOXML (footnotes.xml, fonte 11 pt simples); a física do PDF não confirma a renderização das notas na margem inferior.
- [ ] **Correção:** no PDF com notas, detectar o bloco de notas na área do rodapé (glifos menores) e comparar texto com `footnotes.xml`.
- [ ] **Critério de aceite:** nota presente no DOCX aparece no PDF com fonte menor que o corpo; 0 notas perdidas.
- [ ] **Teste:** fixture com nota → análise física; `ufla:audit` 11/11.

### B2. Ficha catalográfica no DOCX final: Cutter/CDU obrigatório na versão final
- [ ] **Problema:** `catalog-card-cutter-missing` bloqueia a versão final, mas a ficha pode ser exportada como IMAGEM sem texto de Cutter detectável; o OOXML não valida o conteúdo da imagem.
- [ ] **Correção:** quando a ficha é imagem, exigir que o texto alternativo informe a presença da ficha oficial OU exigir ficha em texto; documentar a regra no checklist do validador.
- [ ] **Critério de aceite:** DOCX final com ficha-imagem não bloqueia sem evidência de ficha oficial (decisão explícita na UI), ou valida o texto alternativo.
- [ ] **Teste:** casos ficha-texto/ficha-imagem na geração de dissertação/tese.

### B3. Importação: mensagem específica para `.doc` antigo renomeado para `.docx`
- [ ] **Problema:** `docxOpenError` cobre o caso, mas não diferencia "arquivo corrompido" de "DOC binário renomeado" (OLE2 magic `D0 CF 11 E0`).
- [ ] **Correção:** detectar magic bytes OLE2 no `importDocumentFile` e emitir mensagem direta ("este é um .doc antigo; salve como .docx").
- [ ] **Critério de aceite:** arquivo .doc renomeado → mensagem específica; .docx corrompido → mensagem atual.
- [ ] **Teste:** `tests/import/import-limits.test.ts` + caso novo.

### B4. Foco e aria em todos os diálogos/overlays (auditoria de acessibilidade ampliada)
- [ ] **Problema:** o modal de preview devolve foco (C13 do checklist-14); o gerenciador de rascunhos e o guia de primeiro uso ainda precisam de verificação de foco/aria-equivalente.
- [ ] **Correção:** aplicar o mesmo padrão (salvar/restaurar foco, `role=dialog`, focus trap) no DraftStatus e FirstUseGuide; adicionar axe nos fluxos.
- [ ] **Critério de aceite:** fechar gerenciador/guia devolve o foco ao gatilho; violações critical/serious = 0 no e2e (axe real).
- [ ] **Teste:** casos jsdom por componente + e2e com axe.

---

## Bloco C — Processo, documentação e governança

### C1. `previewPdfReferenceGate` documentado para o runner self-hosted (Word)
- [ ] **Problema:** o gate depende de Word instalado; sem runner, o workflow `pdf-reference-refresh.yml` falha em 0s e o gate fica sem evidência no CI.
- [ ] **Correção:** documentar o procedimento (docs/RUNNER_WORD.md já existe) e criar um check local: `npm run ufla:pdfref` rodado manualmente antes de fechar rodadas que tocam exportadores.
- [ ] **Critério de aceite:** instrução executável documentada; rodada com mudança de exportador roda `ufla:pdfref` e registra o resultado.
- [ ] **Teste:** comando local documentado e executado na próxima rodada de exportador.

### C2. Rotina de rodada: script único de fechamento (testes → audit → docs)
- [ ] **Problema:** fechar uma rodada exige `npm test` + `npm run ufla:audit` + atualizar STATUS_ATUAL/context à mão — passos manuais sujeitos a esquecimento.
- [ ] **Correção:** criar `npm run round:close` (ou documentação passo a passo no SKILL `site_abnt_ufla`) que valida pré-condições (árvore limpa, lint 0, audit 11/11) e aponta para os arquivos canônicos a atualizar.
- [ ] **Critério de aceite:** um comando/doc executável descreve o fechamento completo; nenhuma rodada fecha sem audit 11/11.
- [ ] **Teste:** execução da rotina em uma rodada-teste (sem Word: `ufla:audit`).

### C3. Revisão semestral do Manual (fonte normativa com data/hash)
- [ ] **Problema:** a fonte é a 6ª ed. (10/03/2025, hash registrado); se a UFLA publicar nova edição, o rastreamento de requisitos fica defasado.
- [ ] **Correção:** registrar no `docs/STATUS_ATUAL.md` a data de vigência da fonte e um lembrete de revisão; documentar o passo de atualização do `manual-ufla-requirements.json`.
- [ ] **Critério de aceite:** STATUS_ATUAL registra vigência + procedimento de atualização da fonte normativa.
- [ ] **Teste:** documental (sem automação).

---

## Como verificar o progresso do bloco

```bash
npm run verify      # testes + build
npm run lint        # 0 erros/0 warnings
npm run e2e         # 13/13
npm run ufla:audit  # 11/11 gates (regra 1: DOCX conforme Manual UFLA)
```

**Rodada de abertura (29):** suíte **1731 passed / 10 skipped / 0 failed** (217 arquivos),
lint 0/0, e2e 13/13, auditoria **11/11 gates** (`sourceFingerprint a0eb33bd…`).
Prioridade sugerida: **A1** (w:tblHeader nas importadas — fecha warnings reais do checker)
e **A3** (física da folha de rosto — fechamento da evidência de DECISION-010).
