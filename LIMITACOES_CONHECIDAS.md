# Limitacoes conhecidas — UFLA DOCX Academico (v1.0.0)

Este documento consolida os comportamentos assumidamente incompletos ou que
exigem validacao manual. Ele e a fonte honesta de verdades sobre o que o
sistema **nao** faz sozinho. Mantenha-o como referencia antes de uso
institucional.

> **Resumo de verso:** v1.0.0 e a primeira verso de release. O sistema
> estrutura e valida parcialmente o documento, mas a submissao final
> continua exigindo revisao do usuario no DOCX gerado (Word/LibreOffice).

---

## 1. DOCX e PDF

- **O DOCX e a saida canonica.** O PDF final deve ser exportado pelo
  Word ou LibreOffice. O sistema **nao gera PDF diretamente** pelo
  navegador.
- **Revisao final humana e obrigatoria.** Ficha catalografica, folha
  de aprovacao, imagens, legendas, referencias e paginacao final devem
  ser conferidas no DOCX gerado.

## 2. Sumario

- O sumario e gerado como campo do Word e **deve ser atualizado manualmente**
  (`Ctrl+A` e `F9`, ou botao "Atualizar campos") apos gerar o documento
  e apos quaisquer edicoes estruturais.

## 3. Imagens e figuras (fluxo PDF -> Copia DOCX)

- **Deteccao x preservacao visual:** regioes candidatas a figura sao
  detectadas, mas nem todas sao preservadas como imagem. Figuras
  confirmadas sao rasterizadas (ver secao 7); as demais ficam como
  marcadores (`[Imagem detectada: ...]`).
- **Qualidade e posicao:** legendas, qualidade e posicao das imagens
  rasterizadas exigem revisao manual no editor de texto.
- **OCR ausente:** PDFs digitalizados (sem camada de texto) têm apenas a
  imagem da pagina; o texto contido nas figuras **nao e transcrito**
  automaticamente (nao ha OCR embutido no fluxo canonico).

## 4. Importacao DOCX

- Depende de heuristicas de deteccao (mammoth + OOXML). Documentos
  fora do padrao UFLA/ABNT podem requerer ajustes manuais.
- Reparo de titulo quebrado e limpeza de sumario importado estao embutidos,
  mas a revisao manual continua recomendada.

## 5. Formatacao ABNT

- Os testes OOXML cobrem parte da estrutura (A4, margens UFLA, Times
  New Roman, corpo 12, citacoes longas 11, capa, folha de rosto,
  resumo, abstract, corpo, referencias, sumario atualizavel).
- **Isso nao substitui inspecao visual** no Word ou LibreOffice.

## 6. Colecao Producao Academica UFLA

- Os oito formatos estao cadastrados com suporte **inicial** (catalogo
  tecnico, validacao minima, exportador generico).
- Validacao manual continua obrigatoria; exportadores especificos serao
  incrementais em verses futuras.

## 7. Rasterizacao de figuras (backend Chromium)

- A rasterizacao de figuras de PDF usa o **Chromium embutido do Playwright**
  por padrao. Se o navegador nao estiver disponivel, use
  `PDF_FIGURE_RASTERIZE=0` para pular a rasterizacao (as figuras ficam
  como marcadores, sem imagem).
- **Backends nativos (MuPDF / Poppler / ImageMagick) naon estao disponiveis
  neste ambiente** e nao sao usados automaticamente. Quando presentes no
  PATH, podem ser selecionados pelo resolvedor de backends, mas isso nao
  foi validado nesta verso.
- **Tesseract.js** esta listado como dependencia, mas o OCR de texto de
  figuras nao e parte do fluxo canonico de release.

## 8. Determinismo da saida

- **Conteudo do DOCX e deterministico** entre execucoes (apos as correcoes
  da rodada C1R19): msmas entradas produzem msmas partes OOXML
  (`document.xml`, `styles.xml`, rels, midia referenciada).
- **Timestamps em `docProps`** (`core.xml`, `app.xml`) variam por design
  do OOXML/Packer — isso e esperado e benigno (Word/LibreOffice tambem
  variam aí).
- **Pixels da imagem rasterizada podem variar levemente** entre execucoes
  devido a renderizacao do Chromium (anti-aliasing/subpixel). O nome do
  arquivo e a estrutura sao estaveis; as imagens sao visualmente
  equivalentes. Isso nao afeta a reprodutibilidade do documento, apenas a
  igualdade byte-a-byte da imagem em si.
- **PDFs com as seguintes caracteristicas nao foram reproduziveis neste
  ambiente** (exigem amostras reais ou backends nativos): protegido por
  senha, JBIG2, JPEG2000, SVG vetorial puro, e >1000 paginas.

## 9. Ambientes e CI

- Validacao de abertura do DOCX em **Word/LibreOffice nao e feita por
  codigo** neste ambiente (esses programas nao estao instalados); a
  integridade e verificada por codigo (jszip + reimport) e, em CI Windows,
  pelo pipeline de aceitacao Word quando o Microsoft Word estiver presente.
- O job de **regressao visual de pixels do PDF final exportado** (Fase 2E)
  ainda nao foi habilitado; o hook `rasterizePdfPages` ja existe no
  helper da Fase 2D, aguardando `pdftoppm` disponivel.

## 10. PWA / cache

- PWA nao implementado. Cache de verso pode ser problema futuro, mas nao
  e prioritario para v1.0.0.

---

## Status honesto de cobertura normativa

Consulte [`STATUS_NORMATIVO.md`](./STATUS_NORMATIVO.md) para a matriz
completa de estados (Concluido tecnicamente / Parcial / Requer validacao
manual / Limitacao conhecida) por categoria.
