# v2.10.0 — Importação assistida por PDF

## Objetivo

Preparar o Site_ABNT para aceitar arquivos PDF como fonte de entrada, além de DOCX, deixando o site decidir automaticamente o melhor tratamento dos dados importados.

A regra central da v2.10.0 é:

```text
O usuário envia DOCX ou PDF.
O site identifica a estrutura real do arquivo.
O site extrai, normaliza e decide o melhor tratamento por bloco.
O usuário recebe o DOCX final e os diagnósticos de revisão.
```

O usuário não deve escolher manualmente o pipeline de importação.

## Escopo inicial

### Incluído

- Adicionar `pdfjs-dist` como dependência.
- Criar módulo de leitura PDF no navegador.
- Extrair texto com posição por página.
- Renderizar página/região de PDF em imagem quando necessário.
- Criar modelo interno para blocos PDF:
  - página;
  - texto;
  - posição;
  - provável legenda;
  - provável fonte;
  - provável quadro/tabela;
  - provável gráfico/imagem.
- Integrar PDF ao diagnóstico de importação.
- Permitir que o site decida, por bloco:
  - texto editável;
  - tabela reconstruída;
  - texto estruturado;
  - recorte visual como imagem;
  - revisão manual.

### Não incluído nesta etapa inicial

- Prometer extração perfeita de tabela PDF.
- Usar backend Python/Java.
- Usar OCR pesado.
- Substituir o pipeline DOCX já existente.
- Declarar a importação de PDF como 100% finalizada.

## Estratégia técnica

### DOCX

O pipeline DOCX continua usando a estrutura OOXML existente:

- texto e campos acadêmicos;
- pré-textuais;
- corpo;
- referências;
- imagens ancoradas confiáveis;
- tabelas editáveis ou reconstruídas semanticamente.

### PDF

O pipeline PDF deve começar com `pdfjs-dist`:

- carregar PDF no navegador;
- ler páginas;
- extrair textContent com coordenadas;
- renderizar páginas em canvas;
- permitir recorte visual de regiões;
- gerar blocos internos para posterior normalização.

### Decisão automática

O site deve avaliar a confiança de cada bloco:

- alta confiança: importar como texto/tabela/imagem;
- média confiança: importar com aviso revisável;
- baixa confiança: usar texto estruturado, recorte visual ou revisão manual.

## Resultado esperado da primeira rodada

Ao final da primeira implementação da v2.10.0, o projeto deve ter:

- dependência `pdfjs-dist` instalada;
- módulo `src/import-pdf.ts` ou equivalente;
- testes básicos de detecção de PDF;
- testes básicos de extração de texto por página;
- testes de diagnóstico de baixa confiança;
- documentação atualizada;
- build e testes passando.

## Relação com a v2.9.1

A v2.9.1 melhorou a importação de DOCX convertido de PDF, mas manteve limitações documentadas para tabelas, quadros e imagens quando a estrutura da conversão não é confiável.

A v2.10.0 deve complementar essa base, permitindo que o site trate PDF diretamente quando ele for a fonte enviada pelo usuário.

## Critério de qualidade

A v2.10.0 deve ser tratada como evolução incremental. Não declarar 100% de importação PDF. O foco inicial é criar uma base testável e segura para leitura visual/textual de PDF.

## Implementação inicial (primeira rodada)

### O que foi feito

- **Dependência instalada:** `pdfjs-dist` (v6.1.200). Foram alterados `package.json` e `package-lock.json`. Nenhuma outra dependência foi adicionada.
- **Tipos internos:** `src/imported-pdf.ts` define `PdfImportSource`, `PdfTextItem`, `PdfPageText`, `PdfBlockKind`, `PdfDocumentBlock`, `PdfImportDiagnostic` e `ImportedPdfDocument`.
- **Leitura PDF:** `src/import-pdf.ts` implementa `importPdfDocument(file, fileName?)`:
  - usa `pdfjs-dist` carregado dinamicamente (lazy) para não onerar testes de funções puras;
  - o worker do PDF.js é configurado via `import("pdfjs-dist/build/pdf.worker.min.mjs?url")` (padrão Vite, resolvido em tempo de build);
  - carrega o PDF, detecta `pageCount` e `fingerprint`;
  - extrai `textContent` por página com posição aproximada (`x`, `y`, `width`, `height`, `fontName`);
  - normaliza o texto por página (`normalizedText`);
  - gera `diagnostics` e o resumo de `quality` (textConfidence/layoutConfidence/requiresManualReview).
- **Normalização de texto (puro, sem pdfjs):** `src/import-pdf-text.ts` com `normalizePdfTextItems`, `groupPdfTextIntoLines`, `buildPageNormalizedText`, `classifyPdfLine` e `detectPdfBlockCandidates`.
- **Roteador por arquivo:** `src/import-file-router.ts` com `detectImportableFileKind` e `importAcademicFile`. O site decide o pipeline: `.docx/.txt/.md`/`MIME Word` → pipeline DOCX existente; `.pdf`/`application/pdf` → `importPdfDocument`; outro → `unknown`.
- **UI mínima:** `src/components/ImportBlock.tsx` aceita `.pdf` e, ao receber PDF, chama o roteador e exibe um painel de diagnóstico (nome, páginas, confiança, avisos e texto extraído em `<details>`). O fluxo DOCX existente não foi alterado: PDF nesta rodada **não** gera DOCX final nem substitui os campos do editor.
- **Testes:** `tests/import-file-router.test.ts` (detecção docx/pdf/unknown) e `tests/import-pdf.test.ts` (funções puras: ordenação por linha, junção de linha, caption/source/heading, table-candidate, image-candidate, sinal de revisão manual).

### O que já funciona

- Ler PDF no navegador e extrair texto por página com posição.
- Detectar blocos prováveis: `heading` (caixa alta curta), `caption` (Quadro/Tabela), `source` (Fonte:), `table-candidate` (padrão de colunas), `image-candidate` (Figura/Gráfico).
- Produzir diagnóstico honesto de que a importação PDF é experimental e pode exigir revisão manual.
- O usuário envia DOCX **ou** PDF; o site identifica e decide o tratamento (o usuário não escolhe o pipeline).

### O que ainda é experimental / não incluído nesta rodada

- **Sem OCR.** O texto vem de `textContent` do PDF; PDFs só-imagem não terão texto nem regiões visuais.
- **Tabelas PDF não são prometidas como editáveis perfeitas.** Quando há padrão tabular, o bloco vira `table-candidate` com aviso de revisão manual; a reconstrução semântica das tabelas PDF (reuso do reconstrutor de `src/academic-table-reconstructor.ts`) fica para rodada posterior.
- **PDF ainda não gera DOCX final automaticamente** pelo botão de importação; ele entrega diagnóstico, texto extraído e recortes visuais. A geração DOCX a partir de PDF é complemento futuro.
- A importação de PDF **não é 100%** e não deve ser declarada como tal.

## Implementação (segunda rodada — recorte visual de regiões)

### O que foi feito

- **Tipos de região:** `src/imported-pdf.ts` agora define `PdfRegionKind` (`table-visual` | `chart-visual` | `figure-visual`), `PdfRegion`, `RenderedPdfRegion` e `PdfRegionCropRect`.
- **Detecção de regiões visuais (puro, sem pdfjs):** `src/pdf-region-renderer.ts` implementa `detectPdfVisualRegionCandidates(document)`:
  - para cada legenda (`caption`/`image-candidate`) por página, procura a `Fonte:` mais próxima abaixo dela (no espaço PDF, y menor) e monta uma região retangular entre a legenda e a fonte, com margem de `10pt`;
  - classifica o tipo a partir da legenda: `Quadro`/`Tabela` → `table-visual`; `Gráfico` → `chart-visual`; `Figura` → `figure-visual`;
  - limita a região aos limites da página e emite `warnings` quando a região é muito grande (>`80%` da altura), muito pequena (`<20pt`) ou quando não há fonte abaixo;
  - a confiança cai para `medium` sem fonte e para `low` em regiões fora do intervalo esperado.
- **Cálculo puro de recorte:** `computeRegionCropRect(region, pageWidthPts, pageHeightPts, scale)` converte a região (em pontos, y medido do topo) em coordenadas de dispositivo para o canvas, sem depender de `document`/`canvas` (testável no Node).
- **Renderização no navegador:** `renderPdfRegionToPng({ file, region, scale? })`:
  - reusa o loader pdfjs já existente em `src/import-pdf.ts` (`loadPdfJs`, worker via `?url`);
  - renderiza a página inteira num canvas e recorta a região com `drawImage`, devolvendo um `dataUrl` PNG (`RenderedPdfRegion`).
- **UI:** `src/components/ImportBlock.tsx` lista as regiões detectadas no painel de diagnóstico (tipo, página, legenda, fonte, confiança, avisos) e oferece botão "Visualizar recorte" que chama `renderPdfRegionToPng` e mostra a imagem (`<img>`).
- **Testes:** `tests/pdf-region-renderer.test.ts` (10 casos: Quadro→table-visual, Gráfico→chart-visual, Figura→figure-visual, margem/limites, região grande→low, sem fonte→medium, sem legenda, página vazia, `computeRegionCropRect`) e novos casos em `tests/import-pdf.test.ts` ligando `detectPdfBlockCandidates` → `detectPdfVisualRegionCandidates`.

### Validação com PDF real (local, não commitado)

Foi usado `Andrade_2025.pdf` (`_diagnostico/andrade-2025/`, 3,6 MB, 139 páginas) apenas para validação local. Resultado da extração: **10.673 itens de texto**, **36 legendas de Quadro**, **22 legendas de Figura/Gráfico** e **26 fontes ("Fonte:")** detectadas. A extração e a detecção de blocos funcionam ponta a ponta. O worker do pdfjs não pôde ser exercido em navegador headless neste ambiente; o padrão `?url` do Vite usado em `src/import-pdf.ts` é o recomendado e deve ser confirmado manualmente no navegador via `npm run dev`.

### Verificação de runtime no servidor de desenvolvimento (automática)

Como este ambiente não tem driver de navegador (Playwright/Puppeteer não instalados e a instalação é proibida pelas regras do projeto), o fluxo interativo de clique (enviar PDF e acionar "Visualizar recorte") não pôde ser executado pelo agente. Foi feita, porém, uma verificação automática de runtime:

- `npm run dev` (Vite) sobe e serve a página (`200`, `#root` presente).
- Os módulos `src/import-pdf.ts`, `src/pdf-region-renderer.ts` e `src/components/ImportBlock.tsx` são transformados pelo Vite sem erro (`200`).
- O import do worker `pdfjs-dist/build/pdf.worker.min.mjs?url` é resolvido em tempo de transforma para `/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url`, e o próprio arquivo do worker é servido pelo Vite (`200`, ~6,7 MB). Isso confirma que o `GlobalWorkerOptions.workerSrc` será resolvido no navegador.

O que falta de validação estritamente manual (a ser feito pelo usuário com `npm run dev`):

1. Enviar `Andrade_2025.pdf` e confirmar que o painel mostra nome, páginas (139), confiança, diagnósticos e texto extraído.
2. Confirmar que a lista de regiões visuais aparece (~36 Quadro, ~22 Figura/Gráfico como candidatos) e que o botão "Visualizar recorte" gera a imagem PNG sem ficar em branco.
3. Conferir o console do navegador para garantir que não há erro de worker/canvas.

### Integração de rascunho textual DOCX (terceira rodada)

**Problema reportado:** o PDF era lido e o painel de diagnóstico aparecia, mas ao marcar "Gerar rascunho mesmo com pendências" o site não gerava DOCX. O motivo era que a importação de PDF só populava o painel de diagnóstico e **nunca** alimentava o pipeline de rascunho (`onImport`), deixando o `editorText` vazio.

**Correção:** ao importar um PDF, o `ImportBlock` agora chama `onImport` com um rascunho textual construído por `buildPdfDraftInput` (`src/pdf-to-imported-blocks.ts`):

- `editorText` = aviso de revisão + texto extraído normalizado de todas as páginas;
- `fields` = campos acadêmicos vazios, preservando o **tipo de trabalho selecionado** na interface (sem inventar metadados);
- `messages` = aviso de que o rascunho veio de PDF e exige revisão manual.

O usuário pode então marcar "Gerar rascunho mesmo com pendências" e gerar um DOCX textual experimental. O aviso de revisão é incluído no próprio DOCX (no início do corpo) e no diagnóstico.

**Validação manual confirmada pelo usuário:** o PDF `Andrade_2025.pdf` abriu no site, o painel apareceu, o texto foi extraído (139 páginas) e ~58 regiões visuais foram detectadas. Após a correção, o "Gerar rascunho mesmo com pendências" passa a gerar o DOCX.

### O que funciona agora

- Detectar e listar regiões visuais (quadro/tabela, gráfico, figura) entre legenda e fonte.
- Recortar e pré-visualizar a região como PNG no navegador, sob demanda.
- Gerar um **rascunho DOCX textual experimental** a partir do PDF importado, mesmo com pendências, quando o usuário marca "Gerar rascunho mesmo com pendências".

### O que continua fora desta rodada

- Inserção automática dos recortes visuais (PNG) no DOCX: as regiões detectadas seguem apenas como diagnóstico/pré-visualização. A inserção de recortes selecionados como fallback controlado é o próximo passo.
- Reconstrução semântica das tabelas PDF.
- Confirmação visual do worker pdfjs em navegador real (pendente de teste manual do usuário).

### Conserto da experiência de PDF (quarta rodada)

**Problemas reportados:** o DOCX gerado ficava ruim — capa com "AUTOR / TÍTULO DO TRABALHO" genéricos, ordem do texto das primeiras páginas embaralhada (capa/folha de rosto), mensagens técnicas na interface, a lista de regiões visuais misturava entradas de "Lista de Quadros/Gráficos/Sumário" com regiões reais e os recortes apareciam com tamanho estranho.

**Correções:**

- **Ordenação do texto (capa/folha de rosto não saem invertidas):** o eixo Y do PDF é medido de baixo para cima, então `groupPdfTextIntoLines` (`src/import-pdf-text.ts`) agora ordena por **Y decrescente** (topo → base) e, na mesma linha, por **X crescente** (esquerda → direita). Também foi adicionado dedupe de fragmentos de texto idênticos e sobrepostos. `buildPageNormalizedText` herda a correção.
- **Filtro de regiões visuais falsas:** `detectPdfVisualRegionCandidates` (`src/pdf-region-renderer.ts`) agora ignora páginas de **Lista de Quadros/Figuras/Gráficos/Sumário/Índice** e entradas que são apenas itens de índice (ex.: `Quadro 1 – ... ................................ 98`, com líderes de ponto e número de página). Assim a lista não mistura o índice com figuras/quadros reais.
- **Modo B — rascunho textual experimental separado do template da UFLA:** o `editorText` produzido por `buildPdfDraftInput` (`src/pdf-to-imported-blocks.ts`) começa com `PDF_DRAFT_WARNING` e traz título sugerido (extraído da primeira heading/cap) + aviso de revisão + texto extraído + inventário dos elementos visuais detectados (página, legenda, fonte). `generateDocxBlob` (`src/export-docx.ts`) desvia esse caso para `generatePdfDraftDocxBlob`, que gera um DOCX **sem capa** (portanto sem os placeholders `AUTOR`/`TÍTULO DO TRABALHO`) contendo apenas o texto extraído, o aviso e o inventário. Nada é inventado nos metadados.
- **UI simplificada (`src/components/ImportBlock.tsx`):** mensagens amigáveis ("PDF lido (N páginas). Um rascunho foi gerado abaixo — revise antes de usar."); painel renomeado para "Leitura do PDF (experimental)"; lista de figuras/quadros **agrupada por página/tipo, limitada a 10** com botão "Mostrar todas"; regiões de **baixa confiança ocultas** por padrão; preview de imagem dimensionado via CSS (`max-width:100%`, `max-height:420px`, `object-fit:contain`).
- **Testes:** novos casos em `tests/import-pdf.test.ts` (ordem topo→base, X na linha, dedupe, capa não invertida), `tests/pdf-region-renderer.test.ts` (lista/sumário e entradas com líder de ponto ignoradas; legenda real preservada), `tests/pdf-to-imported-blocks.test.ts` e `tests/export-docx-pdf-draft.test.ts` (Modo B sem capa/dialog e sem `<w:drawing>`), além de `tests/app-pdf-draft-flow.test.tsx`.

### O que funciona agora

- Detectar e listar regiões visuais reais (quadro/tabela, gráfico, figura) entre legenda e fonte, sem confundir com itens de Lista/Sumário.
- Recortar e pré-visualizar a região como PNG no navegador, sob demanda, com tamanho controlado.
- Gerar um **rascunho DOCX textual experimental** a partir do PDF, **sem capa** (Modo B), mesmo com pendências, quando o usuário marca "Gerar rascunho mesmo com pendências".
- Texto das primeiras páginas na ordem visual correta (topo → base).

### O que continua fora desta rodada

- Inserção automática dos recortes visuais (PNG) no DOCX: as regiões detectadas seguem apenas como diagnóstico/pré-visualização e como inventário textual no rascunho. A inserção de recortes selecionados como fallback controlado é o próximo passo.
- Reconstrução semântica das tabelas PDF.
- Confirmação visual do worker pdfjs em navegador real (pendente de teste manual do usuário).

### Próximos passos

1. Inserir recortes visuais PDF selecionados no DOCX como fallback controlado (legenda, imagem PNG, fonte, aviso), limitando a quantidade inicial de recortes para não gerar documento gigante.
2. Conectar blocos `table-candidate` ao reconstrutor semântico de tabelas da v2.9.1.
3. Melhorar a confiança de layout e reduzir falsos positivos de `table-candidate`.
4. Tratar PDFs só-imagem com aviso honesto (sem OCR nesta versão).
5. Confirmar manualmente o worker do pdfjs no navegador (`npm run dev`).
