# UFLA DOCX Academico

Ferramenta de apoio a normalizacao academica UFLA/ABNT para gerar documentos `.docx` editaveis em trabalhos de graduacao, pos-graduacao, projeto de pesquisa e modelos CPG/UFLA.

**Posicionamento:** este sistema estrutura e valida parcialmente o documento, mas a submissao final continua exigindo revisao do usuario no DOCX gerado.

## Como rodar

Requer **Node.js 20+** (testado em Node 24) e **npm 10+**.

```bash
npm install
npm run dev
```

Depois abra o endereco exibido pelo Vite (`http://127.0.0.1:<porta>`).

## Instalacao do Playwright / Chromium (testes E2E e rasterizacao)

O projeto usa **Playwright** para os testes end-to-end e como backend de rasterizacao de figuras de PDF no fluxo Cópia DOCX. O Chromium e suas dependencias devem ser instalados uma unica vez apos o `npm install`:

```bash
# Chromium + dependencias do sistema (recomendado)
npx playwright install --with-deps chromium

# Ou, somente o binario do Chromium (sem deps do SO):
npx playwright install chromium
```

- Em **Linux (CI ou servidor sem GUI)** use `--with-deps` para instalar as bibliotecas do sistema (ex.: `libnss3`, `libatk-bridge2.0`, `libgbm`, `libasound2`). O job de CI ja faz isso.
- Em **Windows** o `--with-deps` e ignorado (as deps do SO nao se aplicam); basta `npx playwright install chromium`.
- A variavel de ambiente `PDF_FIGURE_RASTERIZE=0` desativa a rasterizacao por Chromium (as figuras ficam como marcadores, sem imagem).

Para validar a instalacao:

```bash
npx playwright test --version
npx playwright install chromium
```

## Comandos

```bash
npm test
npm run build
npm run verify
```

## Status funcional

- **Como rodar:** `npm install` e `npm run dev`.
- **Como testar:** `npm test` ou `npm run verify`.
- **Como gerar:** preencha os campos no navegador e clique em **Gerar DOCX**.
- **Tipos suportados:** Artigo acadêmico simples, Monografia, Dissertação, Tese, Projeto de pesquisa (NBR 15287), Resumo CPG/UFLA, Resumo expandido CPG/UFLA, Artigo completo CPG/UFLA e itens da Coleção Produção Acadêmica UFLA.
- **Aviso:** a revisão final, ficha catalográfica, paginação e PDF continuam como etapas humanas no Word/LibreOffice, conforme o fluxo institucional.
- **Comando único de verificação:** `npm run verify`.

## Implementado nesta rodada

- Importacao de `.docx`, `.txt` e `.md`.
- Extracao de texto DOCX com `mammoth` e estrutura OOXML complementar.
- Limpeza de sumario importado e reparo de titulo quebrado, incluindo `Objetivos especificos`.
- Identificacao provavel de campos academicos com indicacao de confianca.
- Editor visual com texto principal e referencias.
- Validacao normativa com erros bloqueantes e alertas nao bloqueantes.
- Resumo, abstract, palavras-chave, keywords e indicadores de impacto com validacoes dedicadas.
- Regras para ficha catalografica, listas pre-textuais, acessibilidade, performance e governanca.
- DOCX editavel com A4, margens UFLA, Times New Roman, corpo 12, citacoes longas 11, capa, folha de rosto, resumo, abstract, corpo, referencias e sumario atualizavel.
- Cadastro inicial dos 8 formatos da Colecao Producao Academica UFLA: artigo cientifico, patente, revisao sistematica e aprofundada da literatura, estudo de caso ou casos multiplos, desenvolvimento de software e aplicativos, cultivar, relatorio de estagio e proposta de intervencao.
- Fluxo recomendado: gerar DOCX, abrir no Word ou LibreOffice, atualizar sumario/campos quando necessario e exportar para PDF.

## Status normativo

O status real de cobertura, limitacoes conhecidas e pontos que exigem validacao manual esta registrado em `STATUS_NORMATIVO.md`.

## Limitacoes conhecidas

As limitacoes reconhecidas (PDF, imagens, sumario, Word/LibreOffice, rasterizacao por Chromium, ambientes sem navegador/CLI, determinismo de pixels) estao consolidadas em [`LIMITACOES_CONHECIDAS.md`](./LIMITACOES_CONHECIDAS.md). Leia antes de uso institucional.

## Documentacao

- **Guia do usuario:** [`docs/GUIA_USUARIO.md`](./docs/GUIA_USUARIO.md) — fluxo passo a passo para gerar o DOCX.
- **Status normativo:** [`STATUS_NORMATIVO.md`](./STATUS_NORMATIVO.md).
- **Limitacoes:** [`LIMITACOES_CONHECIDAS.md`](./LIMITACOES_CONHECIDAS.md).
- **Notas de verso:** [`RELEASE_NOTES.md`](./RELEASE_NOTES.md).
- **Historico de mudancas:** [`CHANGELOG.md`](./CHANGELOG.md).

## Acessibilidade

A v2.9.0 adiciona melhorias de acessibilidade com guardrails automatizados:

- Auditoria automatizada de acessibilidade com axe.
- Teste axe do App principal.
- Testes de contraste WCAG (tokens da interface validados contra 4.5:1 para texto normal e 3:1 para foco/texto grande).
- Skip link para o conteudo principal (`#main-content`).
- Foco visivel reforcado em controles interativos.
- Mensagens de erro, status e aviso com semantica acessivel (`role="status"`, `role="alert"` e `aria-live` aplicados de forma controlada).
- Regioes nomeadas (banner, main, complementary e regioes de erros/avisos).

**Status honesto:** compatibilidade WCAG AA em evolucao, com guardrails automatizados para axe, contraste, foco e mensagens acessiveis. Revisao manual ainda recomendada antes de uso institucional amplo. O projeto nao declara conformidade WCAG total.

## Pipeline E2E

Os testes end-to-end ficam em `tests/e2e/` e usam Playwright (`npm run test:e2e`). Eles validam apenas funcionalidades existentes no aplicativo. O pipeline de aceitação é dividido em fases:

- **Fase 2A — fluxo E2E funcional do app** (`smoke.spec.ts`, `import-docx.spec.ts`, `reject-pdf.spec.ts`): abre o aplicativo, verifica o carregamento e a ausência de erros fatais, importa um DOCX válido e confirma que o conteúdo aparece na interface, e confirma que selecionar um PDF exibe "Formato nao suportado. Use .docx, .txt ou .md." (a importação direta de PDF não existe na main).
- **Fase 2B — validação Word do DOCX gerado** (`word-validation.spec.ts` + helper `run-word-validation.ts`): importa um DOCX, gera o DOCX pela interface, baixa-o e executa `scripts/acceptance/run-docx-acceptance.ps1` via PowerShell, validando os sinais `approved`, `pdfExported`, `pages` e `wordOpened`. Requer Windows com Microsoft Word; o spec é ignorado automaticamente onde esses requisitos não existem.
- **Fase 2C — regressão visual da UI** (`visual-critical-layouts.spec.ts` + helper `visual-regression.ts`): captura regiões críticas da interface (painel de metadados, editor, conteúdo principal) após importar e gerar o DOCX, com viewport fixo, validando tamanho mínimo e determinismo via baseline SHA-256 opcional. Cobre only a UI do navegador — não o documento final.
- **Fase 2D — regressão estrutural do artefato exportado** (`artifact-critical-pages.spec.ts` + helper `artifact-pages.ts`): gera o DOCX pela interface e extrai uma assinatura estrutural determinística do artefato DOCX (tabelas=Quadros, desenhos=Gráficos, quebras de página/seções) comparada com baseline SHA-256 opcional. É regressão **estrutural**, não visual de pixels. Inclui o hook `rasterizePdfPages` para rasterização real do PDF quando `pdftoppm` estiver disponível (ainda não usado no ambiente atual).

Detalhes por fase:

- **Coberto pela Fase 2A:** carregamento, importação DOCX e rejeição de PDF.
- **Coberto pela Fase 2B:** aprovação do DOCX pelo pipeline Word (estrutural + Word + PDF exportado).
- **Coberto pela Fase 2C:** estabilidade visual das regiões críticas da interface no navegador.
- **Coberto pela Fase 2D:** assinatura estrutural do DOCX exportado (Quadros/Gráficos/paginação como elementos OOXML).
- **Não coberto (qual fase futura cobriria):** a regressão visual de pixels do **PDF final exportado** (páginas críticas como Quadros 1, 2, 7, 8, 12, 15, 16 e Gráficos 7 e 10). Isso exigiria rasterizar o PDF (ex.: `pdftoppm`) e comparar imagens por página — uma "Fase 2E" futura, habilitada pelo hook `rasterizePdfPages` já presente no helper da Fase 2D.

Os baselines SHA-256 são opcionais e ficam em `tests/e2e/visual-baselines/` e `tests/e2e/artifact-baselines/` (gitignored); gere-os com `UPDATE_VISUAL_BASELINE=1`. Jobs no CI: `e2e` (todas as fases, ubuntu), `e2e-word` (Fase 2B, windows-latest), `e2e-visual` (Fase 2C, ubuntu), `e2e-artifact` (Fase 2D, ubuntu).


## Fluxo recomendado

1. Preencha os campos no navegador.
2. O sistema salva um rascunho local automaticamente no `localStorage` após 800ms de inatividade. Se fechar o navegador e retornar, o conteúdo é restaurado automaticamente.
3. Para remover o rascunho local, use o botão **Limpar rascunho** no cabeçalho.
4. Gere o DOCX, abra no Word ou LibreOffice, atualize o sumário quando necessário e exporte o PDF para submissão.

## Observações

- Os dados ficam armazenados apenas no seu navegador. Nenhuma informação é enviada para servidor.
- O DOCX gerado é um rascunho editável. A versão final exige revisão humana no Word ou LibreOffice.
- O PDF não é gerado diretamente pelo navegador; exporte-o no editor de texto externo.

## Conferencia final

- A ficha catalografica oficial, folha de aprovacao, imagens, legendas, referencias e paginacao final devem ser conferidas no DOCX gerado.
- Os formatos da Colecao Producao Academica UFLA estao cadastrados com suporte inicial; validacao manual continua obrigatoria e exportadores especificos serao incrementais.
- O sumario deve ser atualizado no Word ou LibreOffice com Ctrl+A e F9.
- O PDF final deve ser exportado pelo editor de texto externo.

## Observacoes

O `PRD.md` e o PDF do Manual da UFLA permanecem preservados na raiz do projeto. A evolucao normativa deve continuar por comparacao com documentos reais e revisao final humana.
