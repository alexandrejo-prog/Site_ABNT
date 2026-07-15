# Pipeline de Aceitação de DOCX — Fase 1 (corrigida)

Auditoria estrutural de DOCX + validação via Microsoft Word, local e reutilizável.

## Objetivo

Fornecer um pipeline automático e determinístico que:

1. audita estruturalmente um `.docx` (pacote OOXML) sem depender do Word;
2. abre o documento no Microsoft Word **sem reparação** (`OpenAndRepair = $false`, `ReadOnly = $true`);
3. atualiza campos e sumário apenas em memória;
4. exporta o documento para PDF;
5. gera manifestos JSON e um relatório de aceite;
6. encerra o Word corretamente (sem `WINWORD.EXE` órfão, **sem matar Word do usuário**);
7. aplica **timeout real** à etapa Word;
8. isola cada execução em um diretório único;
9. retorna código de saída diferente de zero em caso de falha bloqueadora.

O pipeline **nunca altera o DOCX original**.

## Requisitos

- Node.js (versão do projeto) — para a auditoria estrutural.
- Microsoft Word instalado **apenas para a etapa Word** (`validate-word-worker.ps1`).
- `jszip` (dependência já existente do projeto) — usada pela auditoria.
- PowerShell (Windows) — para os scripts `.ps1`.

Não é necessário LibreOffice, OCR, ou qualquer outra ferramenta.

## Arquitetura

```
scripts/acceptance/
├── docx-audit-core.mjs      # núcleo puro: audita bytes do DOCX via jszip
├── audit-docx.mjs           # CLI da auditoria estrutural
├── validate-word.ps1         # pai: orquestra worker, timeout, kill por PID
├── validate-word-worker.ps1  # worker: abre Word, exporta PDF, captura PID
├── run-docx-acceptance.ps1  # orquestrador das duas etapas (run dir único)
└── README.md
tests/acceptance-docx-audit.test.ts  # testes do núcleo (sem Word)
```

### Isolamento do Word

`validate-word.ps1` **nunca** executa `Get-Process WINWORD | Stop-Process`,
`taskkill /IM WINWORD.EXE` ou `Stop-Process -Name WINWORD`. Ele inicia
`validate-word-worker.ps1` como processo filho (`Start-Process -PassThru`) e, em
caso de timeout, encerra **apenas** o PID do worker e o **PID exato** do Word que
o worker registrou (via `word.Hwnd` + `GetWindowThreadProcessId`). Outros Words
abertos pelo usuário permanecem intactos.

### Captura segura do PID

Após `$word = New-Object -ComObject Word.Application`, o worker lê `$word.Hwnd`
e converte para PID via `GetWindowThreadProcessId` (user32.dll). O PID é gravado
no manifesto (`wordPid`, `wordHwnd`) e no arquivo de controle. O encerramento
normal chama `$word.Quit()`, libera COM, coleta lixo, aguarda e só então, se o
PID ainda existir, faz `Stop-Process -Id $wordPid -Force`.

### Timeout real

`validate-word.ps1` usa `WaitForExit(timeoutMs)`. Em estouro, registra `TIMEOUT`,
mata apenas o worker e o `wordPid` do controle, e devolve código ≠ 0. O worker
grava um arquivo de controle JSON a cada estágio: `starting`, `creating-word`,
`opening-document`, `updating-fields`, `updating-toc`, `repaginating`,
`exporting-pdf`, `closing-document`, `closing-word`, `completed`, `failed`.

### Isolamento de execução

`run-docx-acceptance.ps1` cria `<OutputDirectory>\run-<timestamp>-<guid>\` e grava
todos os artefatos lá. Nunca reutiliza PDF/manifest/relatório de execuções
anteriores. O relatório registra `runId`, `runDirectory`, timestamps e caminhos
absolutos. O PDF é considerado válido apenas se criado após o início do run.

## Perfis

### `general`

Não reprova pela existência de `w:tbl`. Reprova por:

- ZIP/OOXML inválido;
- `word/document.xml` ausente;
- relacionamento de imagem quebrado (embedded);
- mídia referenciada inexistente;
- falha interna de auditoria;
- **relações de imagem externas** (default: DOCX deve ser autocontido).

### `pdf-text-draft`

Além das regras gerais, aceita expectativas configuráveis (via `--expect` ou argumentos),
usando a **API uniforme** descrita abaixo.

## API uniforme de expectativas

Toda métrica quantitativa aceita:

```json
"images": 30                 // equivalente a { "exact": 30 }
"markers": { "exact": 4 }
"bookmarks": { "min": 90 }
"sections": { "max": 5 }
"pageref": { "min": 80, "max": 100 }
```

Regras:

- `exact` não pode coexistir com `min`/`max`;
- `min` não pode ser maior que `max`;
- valores inteiros não negativos;
- objeto inválido **reprova a configuração** (não é ignorado);
- métrica desconhecida → erro;
- perfil inválido → erro (a CLI não cai silenciosamente em `general`);
- tipo incorreto → erro.

Métricas quantitativas: `images`, `markers`, `wordTables`, `bookmarks`,
`bookmarkEnds`, `pageref`, `tocFields`, `hyperlinks`, `drawings`, `inlineDrawings`,
`anchoredDrawings`, `mediaFiles`, `brokenRelationships`, `orphanMedia`,
`duplicateMedia`, `smallImages`, `sections`, `explicitPageBreaks`, `sectionBreaks`.

Também: `requiredText`, `forbiddenText` (arrays de texto), e flags `noDuplicateMedia`,
`noOrphanMedia`, `allowExternalImages`.

Exemplo:

```json
{
  "profile": "pdf-text-draft",
  "expect": {
    "images": { "exact": 30 },
    "markers": { "exact": 4 },
    "wordTables": { "exact": 0 },
    "bookmarks": { "exact": 99 },
    "bookmarkEnds": { "exact": 99 },
    "pageref": { "exact": 89 },
    "tocFields": { "exact": 0 },
    "brokenRelationships": { "exact": 0 },
    "orphanMedia": { "exact": 0 },
    "externalImageRelationships": { "exact": 0 },
    "requiredText": ["Quadro 16 – Considerações dos gestores sobre o PGD."],
    "forbiddenText": ["Quadro 16 – Considerações dos gestores sobre o PGD (continua)."]
  }
}
```

## Codificação UTF-8 das expectativas

O arquivo de expectativas é lido como **bytes** e decodificado com
`new TextDecoder("utf-8", { fatal: true })`. BOM é removido. São rejeitados:

- bytes inválidos;
- JSON com BOM não tratado;
- conteúdo não UTF-8;
- sequências mojibake em `requiredText`/`forbiddenText` (`â€“`, `Ã§`, `Ã£`, `Ã©`, `Â`).

Mensagem: *"Arquivo de expectativas parece estar com codificação incorreta. Salve-o como UTF-8."*

## Reconstrução de campos Word

O auditor não trata cada `<w:instrText>` como campo independente. Usa máquina de
estados: `fldChar begin` → concatena `instrText` → `separate`/`end` → classifica o
comando completo. Também trata `<w:fldSimple w:instr="...">`. O manifesto traz
`fieldCommands`, `tocFields`, `pagerefFields`, `hyperlinkFields`, `otherFields`,
`malformedFields`, `incompleteCommands`, `fldCharBeginCount/SeparateCount/EndCount`.

Comandos fragmentados:

```xml
<w:instrText>TO</w:instrText><w:instrText>C \o "1-3"</w:instrText>
```

viram um único `TOC \o "1-3"`. Não há falso positivo de TOC pela palavra "toc" em
texto comum.

## Relações externas

O manifesto distingue `embeddedImageRelationships`, `externalImageRelationships`,
`usedImageRelationships`, `unusedImageRelationships`, `brokenEmbeddedRelationships`,
`orphanMedia`, `unresolvedBlipReferences`. Relação externa (`TargetMode="External"`
ou URI absoluta) é registrada separadamente e **reprovada por padrão** (DOCX
autocontido). `r:link` é tratado como relação externa, não como arquivo ausente.

## Proteção ZIP

Limites configuráveis (padrão): 10.000 entradas; 500 MB descompactados; 100 MB por
entrada; 50 MB para XML; 250 MB por mídia. Falhas: `ZIP_ENTRY_LIMIT`,
`ZIP_UNCOMPRESSED_SIZE_LIMIT`, `ZIP_SINGLE_ENTRY_LIMIT`, `ZIP_XML_ENTRY_LIMIT`,
`ZIP_MEDIA_ENTRY_LIMIT`. Mídias são carregadas sob demanda (apenas as referenciadas)
para limitar uso de memória.

## PNG truncado e formatos não PNG

`parseImageSize` valida assinatura, comprimento mínimo e IHDR. PNG truncado gera
warning `INVALID_PNG_HEADER` e `dimensions:null`; a auditoria continua. Outros
formatos retornam `dimensions:null` (sem inventar) e registram o formato; não
reprovam por dimensão desconhecida.

## Headers, footers e stories

Headers (`word/header*.xml`) e footers (`word/footer*.xml`) são lidos; desenhos,
relações de imagem próprias (`word/_rels/header*.xml.rels`, `footer*.xml.rels`),
mídia e relações quebradas/externas são contabilizados separadamente (body/headers/
footers/total). Footnotes/endnotes/comments ficam fora do escopo desta fase.

## Bookmarks

Registra `bookmarkStart`, `bookmarkEnd`, IDs dos starts/ends, starts sem end, ends
sem start, nomes duplicados, IDs duplicados e nomes únicos. `bookmarks` = `bookmarkStart`;
`bookmarkEnds` = `bookmarkEnd`.

## Sequência estrutural

`manifest.sequence` lista itens com `type` (paragraph/drawing), `index`, `text`,
`rIds`, `drawingCount`, `origin` (body/header/footer), e `prevType`/`nextType`.
Permite validação futura legenda→imagens→fonte sem ser validação visual.

## Exemplos de uso

Auditoria estrutural isolada:

```powershell
node scripts/acceptance/audit-docx.mjs `
  --docx "C:\Downloads\arquivo.docx" `
  --profile pdf-text-draft `
  --expect "C:\temp\expectations.json" `
  --output "C:\temp\docx-structural-manifest.json"
```

Validação Word isolada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/acceptance/validate-word.ps1 `
  -DocxPath "C:\Downloads\arquivo.docx" `
  -PdfOutput "C:\temp\arquivo.pdf" `
  -ManifestOutput "C:\temp\docx-word-manifest.json" `
  -UpdateFields -UpdateToc -TimeoutSeconds 180
```

Pipeline completo (orquestrador):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/acceptance/run-docx-acceptance.ps1 `
  -DocxPath "C:\Downloads\arquivo.docx" `
  -OutputDirectory "C:\temp\acceptance" `
  -Profile pdf-text-draft `
  -ExpectationsPath "C:\temp\expectations.json" `
  -UpdateFields -UpdateToc
```

Via `package.json`:

```powershell
npm run acceptance:docx -- --docx "..." --profile pdf-text-draft --output "..."
npm run acceptance:word -- -DocxPath "..." -PdfOutput "..." -ManifestOutput "..."
npm run acceptance:local -- -DocxPath "..." -OutputDirectory "..." -Profile pdf-text-draft -UpdateFields -UpdateToc
```

## Códigos de saída

| Script | 0 | ≠ 0 |
|---|---|---|
| `audit-docx.mjs` | aprovado | reprovado / erro de argumento / DOCX ausente / expectativas inválidas / perfil inválido |
| `validate-word.ps1` | aprovado, PDF exportado | falha de abertura/reparo/export/timeout |
| `run-docx-acceptance.ps1` | ambas as etapas + PDF OK | qualquer etapa falha |

## Artefatos gerados

No diretório de run (`<OutputDirectory>\run-<ts>-<guid>\`):

- `docx-structural-manifest.json`
- `docx-word-manifest.json`
- `docx-export.pdf`
- `acceptance-report.json`
- `acceptance-summary.txt`
- `word-control-<runId>.json` (controle do worker)
- `word-worker-stdout.log` / `word-worker-stderr.log`

## Limitações

- A etapa Word exige Windows + Microsoft Word.
- Dimensões de imagem só resolvidas para PNG.
- Paginação do Word depende da impressora ativa e das fontes instaladas.
- O pipeline **não** faz comparação visual (Playwright) nesta fase.

## Diferença: validação estrutural × visual

- **Estrutural**: conta/valida partes do OOXML. Determinística, sem renderização.
- **Visual**: compara renderização (PDF/PNG) com referência. Ainda não implementada.

## Por que o Playwright ainda não faz parte desta rodada

A fase 1 entrega a fundação determinística. A comparação visual por Playwright será
fase posterior, em branch/commit separado.

## Como o Playwright poderá consumir este pipeline

No futuro, um teste Playwright poderá invocar `run-docx-acceptance.ps1`, ler
`acceptance-report.json` e comparar o `docx-export.pdf` contra uma referência visual.

## Por que o PDF real do Andrade não é versionado

O pipeline exporta o PDF em diretório temporário (`%TEMP%`) e nunca o copia para o
repositório. Apenas os *critérios* de aceite são versionados.

## Cuidados com ambientes de Word, impressora e fontes

- A paginação depende da **impressora ativa** (PageWidth/Height vêm dela quando
  "Auto"). Use impressora A4 consistente no runner de aceite.
- Fontes ausentes provocam substituição e mudança de quebras de página.
- O script sempre fecha o documento **sem salvar** e encerra apenas a instância do
  Word que criou (por PID); não deve deixar `WINWORD.EXE` órfão nem matar o do usuário.
