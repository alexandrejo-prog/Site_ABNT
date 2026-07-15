# scripts/acceptance/run-docx-acceptance.ps1
#
# Orquestra a pipeline de aceite DOCX em duas etapas:
#   1. auditoria estrutural (Node, sem Word)
#   2. validacao Microsoft Word + export PDF (worker isolado)
# Cada execucao usa um diretorio unico run-<timestamp>-<guid> para isolar artefatos.
# Nunca reutiliza PDF/manifest/relatorio de execucoes anteriores.
#
# Parametros:
#   -DocxPath
#   -OutputDirectory
#   -Profile            general | pdf-text-draft (default general)
#   -ExpectationsPath
#   -MinImageBytes
#   -UpdateFields
#   -UpdateToc
#   -WordTimeout
#   -Marker

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $DocxPath,
  [Parameter(Mandatory = $true)] [string] $OutputDirectory,
  [string] $Profile = "general",
  [string] $ExpectationsPath = "",
  [int] $MinImageBytes = 0,
  [switch] $UpdateFields,
  [switch] $UpdateToc,
  [int] $WordTimeout = 180,
  [string] $Marker = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Path

# ---- Unique run directory ----
$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$guid = [guid]::NewGuid().ToString("N").Substring(0, 8)
$runId = "run-$timestamp-$guid"
$runDir = Join-Path $OutputDirectory $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$structuralManifest = Join-Path $runDir "docx-structural-manifest.json"
$wordManifest = Join-Path $runDir "docx-word-manifest.json"
$pdfOutput = Join-Path $runDir "docx-export.pdf"
$reportPath = Join-Path $runDir "acceptance-report.json"
$summaryPath = Join-Path $runDir "acceptance-summary.txt"

$report = [ordered]@{
  schema              = "docx-acceptance-report/v2"
  runId               = $runId
  runDirectory        = $runDir
  startedAt           = (Get-Date).ToUniversalTime().ToString("o")
  finishedAt          = $null
  approved            = $false
  structuralApproved  = $false
  wordApproved        = $false
  pdfExported         = $false
  profile             = $Profile
  docxPath            = $DocxPath
  failures            = @()
  warnings            = @()
  metrics             = $null
  wordMetrics         = $null
  artifacts           = [ordered]@{
    runDirectory    = $runDir
    structuralManifest = $structuralManifest
    wordManifest    = $wordManifest
    pdf             = $pdfOutput
    report          = $reportPath
    summary         = $summaryPath
  }
  timings             = [ordered]@{}
  versions            = [ordered]@{
    node      = $null
    powershell = $PSVersionTable.PSVersion.ToString()
    windows   = $null
    word      = $null
  }
}

function AddFailure($code, $msg) { $report.failures += [ordered]@{ code = $code; message = $msg } }
function AddWarning($msg) { $report.warnings += [ordered]@{ message = $msg } }

try { $report.versions.node = (node --version 2>$null) } catch {}
try { $report.versions.windows = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Version } catch {}

# ---- Stage 1: structural audit ----
$t0 = Get-Date
$auditArgs = @(
  (Join-Path $scriptDir "audit-docx.mjs")
  "--docx", $DocxPath
  "--profile", $Profile
  "--output", $structuralManifest
)
if ($ExpectationsPath -and (Test-Path -LiteralPath $ExpectationsPath)) { $auditArgs += @("--expect", $ExpectationsPath) }
if ($MinImageBytes -gt 0) { $auditArgs += @("--min-image-bytes", $MinImageBytes.ToString()) }
if ($Marker) { $auditArgs += @("--marker", $Marker) }

try {
  & node @auditArgs 2>&1 | Out-Null
  $auditExit = $LASTEXITCODE
} catch {
  $auditExit = 4
}
$report.timings.structuralSeconds = [Math]::Round(((Get-Date) - $t0).TotalSeconds, 2)

if (Test-Path -LiteralPath $structuralManifest) {
  $structJson = Get-Content -LiteralPath $structuralManifest -Raw | ConvertFrom-Json
  $report.structuralApproved = [bool]$structJson.approved
  if ($structJson.failures) { foreach ($f in $structJson.failures) { AddFailure "STRUCTURAL_$($f.code)" $f.message } }
  if ($structJson.warnings) { foreach ($w in $structJson.warnings) { AddWarning $w.message } }
  $report.metrics = $structJson.metrics
} else {
  AddFailure "STRUCTURAL_NO_MANIFEST" "Auditor estrutural nao produziu manifesto."
  $report.structuralApproved = $false
}

# Stop immediately on blocking structural failure.
if (-not $report.structuralApproved) {
  $report.approved = $false
  $report.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  Set-Content -LiteralPath $reportPath -Value ($report | ConvertTo-Json -Depth 8) -Encoding UTF8
  $summary = "ACEITE REPROVADO na etapa estrutural.`nFalhas: $($report.failures.Count)"
  Set-Content -LiteralPath $summaryPath -Value $summary -Encoding UTF8
  Write-Error "ACEITE REPROVADO (estrutural)."
  exit 1
}

# ---- Stage 2: Word validation + PDF export (isolated worker) ----
$t1 = Get-Date
$wordArgs = @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scriptDir "validate-word.ps1")
  "-DocxPath", $DocxPath
  "-PdfOutput", $pdfOutput
  "-ManifestOutput", $wordManifest
  "-TimeoutSeconds", $WordTimeout
)
if ($UpdateFields) { $wordArgs += "-UpdateFields" }
if ($UpdateToc) { $wordArgs += "-UpdateToc" }

try {
  & powershell.exe @wordArgs 2>&1 | Out-Null
  $wordExit = $LASTEXITCODE
} catch {
  $wordExit = 1
}
$report.timings.wordSeconds = [Math]::Round(((Get-Date) - $t1).TotalSeconds, 2)

if (Test-Path -LiteralPath $wordManifest) {
  $wJson = Get-Content -LiteralPath $wordManifest -Raw | ConvertFrom-Json
  $report.wordApproved = [bool]$wJson.approved
  $report.pdfExported = [bool]$wJson.pdfExported
  if ($wJson.failures) { foreach ($f in $wJson.failures) { AddFailure "WORD_$($f.code)" $f.message } }
  if ($wJson.warnings) { foreach ($w in $wJson.warnings) { AddWarning $w.message } }
  $report.wordMetrics = $wJson.metrics
  $report.versions.word = $wJson.wordVersion
  $report.pagesBeforeFields = $wJson.pagesBeforeFields
  $report.pagesAfterFields = $wJson.pagesAfterFields
  $report.pagesAfterToc = $wJson.pagesAfterToc
} else {
  AddFailure "WORD_NO_MANIFEST" "Validador Word nao produziu manifesto."
  $report.wordApproved = $false
}

if ($wordExit -ne 0 -or -not $report.wordApproved) {
  AddFailure "WORD_REJECTED" "Validacao Word reprovada (exit=$wordExit)."
}

# Confirm PDF belongs to THIS run (timestamp after start) and is non-empty.
if (Test-Path -LiteralPath $pdfOutput) {
  $pdfItem = Get-Item -LiteralPath $pdfOutput
  $pdfCreated = $pdfItem.CreationTimeUtc
  $runStart = [datetime]::Parse($report.startedAt)
  if ($pdfItem.Length -le 0) {
    AddFailure "PDF_EMPTY" "PDF exportado porem vazio."
    $report.pdfExported = $false
  } elseif ($pdfCreated -lt $runStart.AddSeconds(-2)) {
    AddFailure "PDF_NOT_FROM_THIS_RUN" "PDF existente antes do inicio da execucao (artefato antigo)."
    $report.pdfExported = $false
  }
} else {
  $report.pdfExported = $false
}

$report.approved = ($report.structuralApproved -and $report.wordApproved -and $report.pdfExported)
$report.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
$report.timings.totalSeconds = [Math]::Round(((Get-Date) - $t0).TotalSeconds, 2)

Set-Content -LiteralPath $reportPath -Value ($report | ConvertTo-Json -Depth 8) -Encoding UTF8

$lines = @()
$lines += "ACEITE DOCX - RELATORIO DE SINTESE"
$lines += "==============================="
$lines += "RunId: $runId"
$lines += "RunDir: $runDir"
$lines += "Perfil: $Profile"
$lines += "DOCX: $DocxPath"
$lines += "Aprovado: $($report.approved)"
$lines += "Estrutural aprovada: $($report.structuralApproved)"
$lines += "Word aprovada: $($report.wordApproved)"
$lines += "PDF exportado: $($report.pdfExported)"
if ($report.metrics) {
  $m = $report.metrics
  $lines += "Metricas estruturais: paragrafos=$($m.paragraphs) desenhos=$($m.drawing) imagens=$($m.mediaCount) tabelas=$($m.tablet) bookmarks=$($m.bookmarkStart)/$($m.bookmarkEnd) PAGEREF=$($m.pagerefFields) TOC=$($m.tocFields) marcadores=$($m.markerCount) secoes=$($m.pagesSections) externas=$($m.externalImageRelationships) quebradas=$($m.brokenRelationships) orfas=$($m.orphanMediaCount)"
}
if ($report.wordMetrics) {
  $wm = $report.wordMetrics
  $lines += "Metricas Word: paragrafos=$($wm.paragraphs) inlineShapes=$($wm.inlineShapes) tabelas=$($wm.tables) bookmarks=$($wm.bookmarks) secoes=$($wm.sections) paginas(apos)=$($report.pagesAfterToc) impressora=$($wm.activePrinter)"
}
$lines += "Tempo: estrutural=$($report.timings.structuralSeconds)s word=$($report.timings.wordSeconds)s total=$($report.timings.totalSeconds)s"
$lines += "Falhas: $($report.failures.Count)"
foreach ($f in $report.failures) { $lines += "  - [$($f.code)] $($f.message)" }
$lines += "Avisos: $($report.warnings.Count)"
foreach ($w in $report.warnings) { $lines += "  - $($w.message)" }
Set-Content -LiteralPath $summaryPath -Value ($lines -join "`n") -Encoding UTF8

if ($report.approved) {
  Write-Output "ACEITE DOCX APROVADO"
  exit 0
} else {
  Write-Error "ACEITE DOCX REPROVADO"
  exit 1
}
