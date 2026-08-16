# Runner self-hosted com Microsoft Word (evidência física do PDF)

Os gates que dependem de **renderização real do Word** (`pdf-regression.yml` e
`pdf-reference-refresh.yml`) não podem rodar no GitHub-hosted: o runner público
não tem Microsoft Word nem licença do Office. Este documento é o passo a passo
operacional para registrar o runner self-hosted **uma única vez** e habilitar o
ciclo completo de manutenção da referência do PDF.

## O que o runner precisa

| Requisito | Detalhe |
|-----------|---------|
| SO | Windows (10/11 ou Server 2019+) — os scripts usam PowerShell + Word COM (`render-docx-to-pdf.ps1`, `word-page-count.ps1`, `analyze-word.ts` via `render-with-word.ts`) |
| Microsoft Word | Instalado e **licenciado** (o COM não abre sem licença ativa) |
| Node.js | 24.x (mesmo do CI — `actions/setup-node` baixa no job, mas `npm ci` exige o runtime mínimo do Actions runner, que já traz Node) |
| Acesso de rede | Ao GitHub (o runner faz polling) e à internet (npm ci) |
| Sessão | Runner registrado como **serviço** (`run.cmd install`) — os scripts abrem o Word com `Visible=false`, sem exigir sessão interativa; a 1ª execução pode exigir aceitar o EULA da 1ª inicialização, então faça um teste manual antes |

> **Atenção a um detalhe clássico**: o `runs-on: [self-hosted, windows, word]`
> espera um runner com os **três labels**. O `windows` é padrão do runner
> self-hosted do Windows; `self-hosted` também é automático; o **`word` precisa
> ser adicionado no registro** (flag `--labels` abaixo).

## Passo 1 — registrar o runner (uma vez, na máquina com Word)

1. No GitHub: **Settings → Actions → Runners → New self-hosted runner**,
   escolha Windows x64. Copie o token de registro exibido.
2. No terminal da máquina com Word (diretório de instalação do runner):

   ```bat
   mkdir C:\actions-runner && cd C:\actions-runner
   curl -o actions-runner-win-x64-2.3xx.x.zip -L ^
     https://github.com/actions/runner/releases/download/v2.3xx.x/actions-runner-win-x64-2.3xx.x.zip
   tar -xf actions-runner-win-x64-2.3xx.x.zip
   .\config.cmd --url https://github.com/<org>/<repo> ^
     --token <TOKEN_DE_REGISTRO> --labels self-hosted,windows,word --work _work
   ```

3. Instale como serviço para sobreviver a reinícios (o Word COM não exige a
   sessão do usuário logado):

   ```bat
   .\run.cmd install
   .\run.cmd start
   ```

4. Confirme em **Settings → Actions → Runners** que o runner aparece com os
   labels `self-hosted`, `windows`, `word` e status **Idle**.

## Passo 2 — validar o runner localmente (antes de confiar no CI)

Com o repositório clonado na máquina do runner:

```bat
npm ci
npm run ufla:pdfref        :: deve comparar com a referência commitada
npm run ufla:pdfref:refresh
```

Se `ufla:pdfref` passar (ou a referência for criada corretamente no refresh), o
pipeline está operacional. Erros comuns:

- **Word não abre**: `openedByRepair`/`failures` no manifest — valide a licença
  abrindo o Word uma vez na sessão do serviço ou troque o serviço por runner
  agendado com a sessão do usuário que tem o Office licenciado.
- **PowerShell bloqueado**: os scripts já passam `-ExecutionPolicy Bypass`; se
  a política de grupo bloquear mesmo assim, adicione a exceção no passo do
  workflow.

## Passo 3 — configurar o segredo PAT_PDF_REFERENCE (PR que valida PRs)

O `pdf-reference-refresh.yml` abre a PR de atualização da referência com
`token: ${{ secrets.PAT_PDF_REFERENCE }}`. Sem o segredo, o valor é vazio e o
`create-pull-request` cai no `GITHUB_TOKEN` padrão — **a PR abre, mas não
dispara os workflows de PR do repositório** (o `pdf-regression.yml` e o
`verify.yml` não rodariam nela, deixando a nova referência sem validação).

Para fechar o ciclo:

1. Crie um **PAT** (Settings → Developer settings → Personal access tokens →
   Fine-grained) com acesso ao repositório do projeto: `Contents: Read and
   write` e `Pull requests: Read and write` — só o necessário para o
   create-pull-request.
2. No repositório: **Settings → Secrets and variables → Actions → New
   repository secret**, nome **`PAT_PDF_REFERENCE`**, valor = PAT criado.
3. A partir da próxima run de `pdf-reference-refresh.yml`, a PR aberta dispara
   `verify.yml` (Word-free) e, se o runner estiver registrado, o
   `pdf-regression.yml` valida a nova referência antes do merge.

## Passo 4 — uso

- **Mudança intencional de layout/paginação** (ex.: alterou margem, fonte ou
  template): rode `Actions → Manutenção da referência PDF (Word) → Run
  workflow`. O workflow regenera a referência no runner e abre a PR. Revise o
  diff do snapshot; mescle.
- **Suspeita de regressão de renderização** (Word/fontes/pipeline mudaram sem
  mudança de código): o `pdf-regression.yml` falha em PRs enquanto a referência
  divergir sem mudança de preview/digest. Investigue na máquina do runner com
  `npm run ufla:pdfref` e o `pdf-reference-check.json`.

## Validação contínua

- O `verify.yml` (CI Word-free, roda em todo PR) cobre preview + digest do
  DOCX + coerência OOXML↔PDF via `ci-checks.ts`.
- O `ufla:audit` local (com Word) cobre a evidência completa: gates + cobertura
  DOCX→PDF + física por tipo + snapshot de paginação.
- A guarda de frescor (WORKSLOP-003) falha quando `src/`/`scripts/` mudarem sem
  nova auditoria — rode `npm run ufla:audit` antes de commitar mudanças que
  alterem o DOCX gerado.
