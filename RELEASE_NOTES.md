# Release Notes — v1.0.0

**Data:** 2026-07-17
**Projeto:** UFLA DOCX Academico (Site_ABNT)
**Branch de release:** `feat/playwright-docx-acceptance`

Esta e a **primeira verso de release** da ferramenta de apoio a
normalizacao academica UFLA/ABNT. Ela estrutura e valida
parcialmente o documento e gera um **DOCX editavel**; a submissao
final continua exigindo revisao do usuario no Word ou LibreOffice.

---

## O que esta verso entrega

- **8+ formatos academicos** suportados: Artigo academico, Monografia,
  Dissertacao, Tese, Projeto de pesquisa (NBR 15287), Resumo CPG/UFLA,
  Resumo expandido CPG/UFLA, Artigo completo CPG/UFLA e os 8 itens da
  Colecao Producao Academica UFLA.
- **Importacao** de `.docx`, `.txt` e `.md` com extracao de texto
  (mammoth) e estrutura OOXML complementar.
- **Editor visual** com texto principal e referencias, reparo de titulo
  quebrado e limpeza de sumario importado.
- **Validacao normativa** com erros bloqueantes e alertas nao
  bloqueantes.
- **DOCX editavel** com A4, margens UFLA, Times New Roman, corpo 12,
  citacoes longas 11, capa, folha de rosto, resumo, abstract, corpo,
  referencias e sumario atualizavel.
- **Fluxo PDF -> Copia DOCX -> DOCX ABNT** com rasterizacao de
  figuras via Chromium embutido.
- **Acessibilidade (WCAG AA em evolucao):** auditoria axe, testes de
  contraste, foco visivel, regioes nomeadas e mensagens com
  `role="status"`/`role="alert"`.
- **Pipeline E2E (Playwright):** Fases 2A (fluxo funcional), 2B
  (validacao Word, Windows), 2C (regressao visual da UI), 2D
  (assinatura estrutural do artefato DOCX).

---

## Correcoes de robustez desta verso (rodada C1R19)

- **Nao-determinismo da saida — ELIMINADO.** A mesma entrada agora
  produz DOCXs com conteudo identico entre execucoes (validado em 3
  execucoes x 3 fixtures). Duas causas raiz foram corrigidas: vazamento
  da barra do visualizador Chromium no texto extraido, e nomeacao
  aleatoria de midia/`r:embed` pela biblioteca `docx`.
- **Vazamento de processo Chromium em erro — CORRIGIDO.** O browser e
  agora fechado em `finally`, garantindo encerramento em sucesso e erro.
- **Resiliencia a campos `undefined` — CORRIGIDA.** `hasText` e
  `splitParagraphs` agora sao null-safe.

---

## Antes de usar (leitura obrigatoria)

1. **Documentacao do usuario:** [`docs/GUIA_USUARIO.md`](./docs/GUIA_USUARIO.md).
2. **Limitacoes conhecidas:** [`LIMITACOES_CONHECIDAS.md`](./LIMITACOES_CONHECIDAS.md).
3. **Status normativo:** [`STATUS_NORMATIVO.md`](./STATUS_NORMATIVO.md).

### O que voce PRECISA fazer manualmente
- Abrir o DOCX no **Word ou LibreOffice** e **atualizar o sumario**
  (`Ctrl+A` + `F9`, ou botao "Atualizar campos").
- **Conferir** ficha catalografica, folha de aprovacao, imagens,
  legendas, referencias e paginacao final.
- **Exportar o PDF final** pelo editor de texto externo (o sistema nao
  gera PDF diretamente).

---

## Como instalar e rodar

```bash
npm install
npm run dev
```

Para os testes E2E e a rasterizacao de figuras de PDF, instale o
Chromium do Playwright (uma unica vez):

```bash
npx playwright install --with-deps chromium
```

Comandos uteis:

```bash
npm test            # testes unitarios/integrados (Vitest)
npm run build      # build de producao
npm run verify     # test + build
npm run test:e2e  # testes end-to-end (Playwright)
```

Requer **Node.js 20+** (testado em Node 24) e **npm 10+**.

---

## Compatibilidade e requisitos

| Requisito | Estado em v1.0.0 |
| --- | --- |
| Navegador para uso | Chrome/Edge/Firefox moderno |
| Node.js | 20+ (CI usa 24) |
| Chromium (E2E / rasterizacao) | Instalavel via `npx playwright install` |
| Microsoft Word (validacao Fase 2B) | Opcional; CI Windows valida quando presente |
| LibreOffice | Recomendado para revisao/exportacao |
| Backends nativos (MuPDF/Poppler/ImageMagick) | Nao usados por padrao; OCR ausente no fluxo canonico |

---

## Integridade e qualidade

- `npm run verify` passa (testes + build).
- 17 fixtures PDF extremos processados sem crash; 6 arquivos
  corrompidos rejeitados com mensagem clara; DOCXs validados por
  jszip + reimportacao.
- Historico completo em [`CHANGELOG.md`](./CHANGELOG.md).

## Status de release

**APTO PARA RELEASE** com as ressalvas documentadas em
[`LIMITACOES_CONHECIDAS.md`](./LIMITACOES_CONHECIDAS.md). Recomenda-se,
antes do uso institucional amplo: (1) rodar a Fase 2E (regressao
visual de pixels do PDF final) em ambiente com `pdftoppm`; (2) validacao
manual em Word/LibreOffice de 1-2 DOCXs de saida; (3) obter amostras
reais de PDF protegido/JBIG2/JPEG2000 para teste adicional.
