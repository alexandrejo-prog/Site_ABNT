# DECISION-009: Detecção física real de imagens e tabelas no PDF renderizado

## Contexto

O `fullComplianceGate` dependia de evidência **parcial** da análise física do
PDF (`artifacts/ufla-compliance/pdf-physical-analysis.json`): a cobertura de
`images` e `tables` era declarada como `not-detected` com a limitação
"pdfjs-dist sem análise de layout não delimita regiões de tabela/imagem". Isso
mantinha `renderedLayoutGate` e `fullComplianceGate` em FAILED — não por falha
real de conformidade, mas por **ausência de instrumentação** (a validação
semântica de `w:tblHeader` já existia no nível OOXML).

Para declarar CONFORMIDADE UFLA APROVADA com honestidade era preciso
instrumentar o analisador físico para detectar, no PDF renderizado por Word,
as imagens e as tabelas que o DOCX declara (6 imagens e 35 tabelas no OOXML).

## Problema

`pdfjs-dist` (legacy build) não expõe layout estruturado (regiões de tabela,
bounding box de imagem). As duas fontes de informação disponíveis eram:

1. `page.getOperatorList()` — sequência de operadores de desenho
   (`paintImageXObject`, `paintInlineImageXObject`, `paintImageMaskXObject`,
   `transform`, ...), no espaço de coordenadas do PDF (origem inferior esquerda,
   y cresce para cima);
2. `page.getTextContent()` — itens de texto no espaço da viewport (origem
   superior esquerda), **fragmentados por run de fonte**: uma linha visual de
   corpo de texto vira vários itens com x diferentes.

Armadilhas encontradas na prática (todas causaram falsos positivos/negativos
durante o desenvolvimento):

- **Fragmentação por run de fonte**: usar os itens crus de `getTextContent()`
  como "colunas" faz cada linha de corpo de texto ter 10+ posições x → a
  detecção ou não dispara (colunas não repetem entre linhas) ou dispara em
  qualquer página (posições de palavra repetidas). A solução foi **fundir itens
  da mesma linha em "células"** (clusters com gap ≤ 24 pt) antes de extrair as
  posições de início de coluna.
- **Margem esquerda como coluna universal**: o x da margem (≈84 pt) aparece em
  TODAS as páginas e é sempre "persistente". Sem excluí-la, páginas de
  referências/recuo pendurado (2 colunas: margem + recuo) eram falsas tabelas.
  Solução: excluir a coluna mais frequente (a margem) do requisito de
  persistência.
- **Linhas de sumário (pontilhados + número de página)**: clusters
  puramente numéricos/pontilhados ("... 148", "....") eram contados como
  colunas. Solução: descartar clusters que casam `/^[\d.\s]{1,30}$/`.
- **Coordenadas y invertidas no CTM**: o CTM dos operadores está em espaço PDF
  (y para cima); para comparar com o texto (viewport, y para baixo), converte-se
  `screenY = pageHeight - pdfY`.
- **Espaçamento de linha de tabela**: agrupar linhas consecutivas com tolerância
  de 6 pt descartava tabelas reais (linhas ~14 pt). Tolerância de 20 pt agrupa
  as linhas da mesma tabela sem fundir tabelas vizinhas.

## Opções Consideradas

1. **Operadores de desenho + grade de texto (escolhida)** — imagens via
   `opList` com bbox derivado do CTM (a imagem é pintada no quadrado unitário
   sob o CTM; corners mapeados); tabelas via grade de colunas alinhadas sobre
   células fundidas. Prós: instrumenta o PDF real renderizado por Word; números
   cruzam com o OOXML (6 imagens = 6/6; 37 regiões ≈ 35 tabelas, tabelas que
   quebram página contam 2×). Contras: heurística (páginas de referências podem
   gerar falsos positivos se a margem não for excluída).
2. Depender apenas do OOXML (`w:tblHeader`, `wp:docPr`) — Contras: não valida o
   PDF renderizado; era o estado anterior que mantinha `not-detected`.
3. Detecção por bordas desenhadas (`OPS.re`/`stroke`) — Contras: tabelas sem
   bordas visíveis (comuns no Manual) não seriam detectadas; mais frágil que a
   grade de texto.

## Decisão

**Opção 1.** `analyze-pdf-physical.ts` passa a emitir, por página:

- `images: PageElement[]` — um por `paintImageXObject`/`paintInlineImageXObject`/
  `paintImageMaskXObject`, com `bbox` = casca dos 4 cantos do quadrado unitário
  mapeados pelo CTM (`Util.transform` encadeado nos `OPS.transform`),
  convertido para coordenadas de viewport (`screenY = ph - pdfY`);
- `tables: PageElement[]` — um por região de grade com ≥ 2 colunas persistentes
  (excluída a margem) e ≥ 3 linhas contendo ≥ 2 dessas colunas, agrupadas por
  proximidade (≤ 20 pt).

A cobertura `images`/`tables` deixa de ser `not-detected` e passa a refletir a
contagem real (`passed` quando ≥ 1 detectado). A validação **semântica** de
tabela (`w:tblHeader`, DECISION-002) e de imagem (`wp:docPr` alt text)
permanece no nível OOXML — a análise física valida a **presença renderizada**.

Regra de integridade: a evidência física e o OOXML devem cruzar (6 imagens =
6/6 do DOCX; 37 regiões ≈ 35 tabelas — a diferença são tabelas que quebram
página, contadas 2×, e a ficha catalográfica renderizada como grade).

## Gates

- `regenerate-official-artifacts.ts` passou a **computar** os status:
  - `renderedLayoutGate`: `failed` se algum item crítico do coverage
    (`footnotes, footers, pageNumbers, tableSources, figureSources, headers,
    images, tables`) estiver `not-detected` ou `failed`; caso contrário
    `passed` — nunca mais hardcodado;
  - `fullComplianceGate`: resultado real de `runFullComplianceGate(docx, pdf)`
    (executa o gate expandido na mesma rodada da regeneração).
- `tests/rendering/physical-analysis-gates.test.ts` atualizado: cobertura
  `images`/`tables` deve ser `passed`; a declaração "CONFORMIDADE UFLA APROVADA"
  no `report.md` fica **amarrada ao status real** do `fullComplianceGate`
  (guarda anti-falso-positivo preservada: só declara se o gate passou).

## Resultado

- Análise física real: **6 imagens** (páginas 27, 81, 103, 112, 114, 115) e
  **37 regiões de tabela** em 236 páginas; 0 overlaps, 0 cutoffs, 0 blank.
- `renderedLayoutGate`: PASSED · `fullComplianceGate`: PASSED ·
  `gates.json overall: passed` · `report.md` declara CONFORMIDADE UFLA APROVADA.
- `npm run verify`: 195 arquivos, 1539 testes, 0 falhas, build OK · lint 0/0.

## Limitações conhecidas

- Tabelas cujas linhas tenham < 2 colunas persistentes em ≥ 3 linhas não são
  detectadas (falsos negativos raros);
- Imagens em máscara (logo de cabeçalho) contam como `image` quando pintadas;
- A análise física não inspeciona rodapés/footers renderizados nem conteúdo
  OMML (validados no nível OOXML) — limitação declarada no artefato.

## Referências

- pdfjs-dist `getOperatorList`/`OPS.paintImageXObject`/`Util.transform`
- ECMA-376 Part 1 (`w:tblHeader`, `wp:docPr`)
- DECISION-002 (semântica de cabeçalho de tabela)

## Status

- [x] Implementado
- [x] Testado (testes de gate + cross-check 6/6 e 37≈35)
- [x] Documentado
- [x] Evidências regeneradas (gates.json, rendered-analysis.json, report.md)
