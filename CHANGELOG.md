# Changelog

Todas as versoes significativas deste projeto sao documentadas neste arquivo.
O formato e baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e o projeto segue [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-07-17

Primeira verso de release do conversor PDF -> Copia DOCX -> DOCX ABNT.

### Adicionado
- **Cobertura de tipos de trabalho:** Artigo academico simples, Monografia,
  Dissertacao, Tese, Projeto de pesquisa (NBR 15287), Resumo CPG/UFLA,
  Resumo expandido CPG/UFLA, Artigo completo CPG/UFLA e os 8 itens da
  Colecao Producao Academica UFLA.
- **Importacao** de `.docx`, `.txt` e `.md` (mammoth + estrutura OOXML
  complementar).
- **Editor visual** com texto principal e referencias; reparo de titulo
  quebrado e limpeza de sumario importado.
- **Validacao normativa** com erros bloqueantes e alertas nao bloqueantes.
- **DOCX editavel** A4, margens UFLA, Times New Roman, corpo 12,
  citacoes longas 11, capa, folha de rosto, resumo, abstract, corpo,
  referencias e sumario atualizavel.
- **Acessibilidade (WCAG AA em evolucao):** auditoria axe, testes de
  contraste, foco visivel, regioes nomeadas, mensagens com
  `role="status"`/`role="alert"`.
- **Pipeline E2E (Playwright):** Fases 2A (fluxo funcional), 2B
  (validacao Word, Windows), 2C (regressao visual da UI), 2D
  (assinatura estrutural do artefato DOCX).
- **Fluxo de rasterizacao de figuras de PDF** via Chromium embutido
  (backend padrao), com resolvedor que tambem considera MuPDF/Poppler/
  ImageMagick quando disponiveis.

### Corrigido (rodada C1R19 — robustez pre-release)
- **Nao-determinismo da saida (defeito real):** a mesma entrada
  produzia DOCXs diferentes a cada execucao. Causas raiz eliminadas:
  - A barra do visualizador Chromium (nome do arquivo temporario
    aleatorio + "1/1 — 100%") vazava para o `editorText`. Corrigido
    com `#toolbar=0&navpanes=0&view=FitH` na navegacao
    (`src/figure-rasterizer.ts`).
  - O `docx` 8.5.0 nomeava midia/`r:embed` com `uniqueId()`
    aleatorio, congelado no construtor do `Blip`. Criado
    `src/docx-image-stabilizer.ts` (`stabilizeImageRun`) e aplicado em
    `pdf-to-copy-docx.ts`, `export-docx.ts` (figura + logo) e
    `docx-shared.ts` (logo). **Conteudo do DOCX agora deterministico**
    entre execucoes (validado em 3 execucoes x 3 fixtures).
- **Vazamento de processo Chromium em erro (defeito real):** o browser era
  fechado em bloco `try/catch` solto em `extractPdfFigures`. Refatorado
  para `try { ... } finally { closeChromiumBrowser() }`
  (`src/pdf-figure-extractor.ts`).
- **Crash com `fields` undefined (defesa):** `hasText` e `splitParagraphs`
  em `export-docx.ts` tornados null-safe.

### Validado (sem commit/push)
- 17 fixtures PDF extremos (nativo, digitalizado, hibrido, landscape,
  orientacao mista, muitas imagens, so figuras, so tabelas, sem
  figura/tabela, tiny 50x50, escala de cinza, unicode, paginas
  duplicadas, com anexo, transparencia, compactado, sem metadados):
  todos geraram Copia e ABNT validos (0 crashes; `ok=true`,
  `relsBroken=[]`, `reimportOk=true`).
- 6 arquivos corrompidos/inalidos: todos lancam mensagem clara
  ("Nao foi possivel ler o PDF...") sem excecao nao tratada.
- Integridade DOCX via jszip + reimport: 0 invalidos. Unicode raro OK.
- Reprodutibilidade: `contentEqual=true` para todos os fixtures.

### Limitações conhecidas (ver LIMITACOES_CONHECIDAS.md)
- DOCX e a saida canonica; PDF final exige Word/LibreOffice.
- Sumario requer atualizacao manual (F9).
- Imagens: rasterizacao por Chromium; OCR de texto em figuras ausente.
- Pixels da imagem rasterizada podem variar levemente entre execucoes
  (visualmente equivalentes); nome/estrutura estaveis.
- Backends nativos (MuPDF/Poppler/ImageMagick) e abertura em
  Word/LibreOffice nao validaveis neste ambiente Windows.

---

## [0.1.0] — pre-release (historico de desenvolvimento)
- Estado inicial de desenvolvimento antes da verso de release.
- Funcionalidades implementadas de forma incremental e cobertas por testes
  unitarios, integrados e OOXML; validacao final manual pendente.
