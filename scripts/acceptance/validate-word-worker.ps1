# scripts/acceptance/validate-word-worker.ps1
#
# Worker PowerShell executado como processo filho pelo orquestrador/pai.
# Abre o DOCX no Word (OpenAndRepair=$false, ReadOnly=$true), atualiza campos e
# sumario, exporta PDF e grava um arquivo de controle JSON em todas as fases.
#
# O worker captura seu proprio PID e o PID exato do Word via Hwnd+GetWindowThreadProcessId.
# O encerramento normal soh usa o PID capturado. O pai encerra este worker e o
# wordPid em caso de timeout, nunca outros processos Word.
#
# Parametros:
#   -DocxPath
#   -PdfOutput
#   -ManifestOutput
#   -ControlPath       (arquivo JSON de controle compartilhado com o pai)
#   -UpdateFields
#   -UpdateToc

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $DocxPath,
  [Parameter(Mandatory = $true)] [string] $PdfOutput,
  [Parameter(Mandatory = $true)] [string] $ManifestOutput,
  [Parameter(Mandatory = $true)] [string] $ControlPath,
  [switch] $UpdateFields,
  [switch] $UpdateToc
)

$ErrorActionPreference = "Stop"

$runId = if ($env:ACCEPTANCE_RUN_ID) { $env:ACCEPTANCE_RUN_ID } else { [guid]::NewGuid().ToString() }
$workerPid = $PID

function Write-Control($stage, $wordPid, $extra = @{}) {
  $obj = [ordered]@{
    runId            = $runId
    workerPid        = $workerPid
    wordPid          = if ($wordPid) { $wordPid } else { $null }
    startedAt        = $script:startedAt
    currentStage     = $stage
    manifestPath     = $ManifestOutput
    pdfOutputPath    = $PdfOutput
    updatedAt        = (Get-Date).ToUniversalTime().ToString("o")
  }
  foreach ($k in $extra.Keys) { $obj[$k] = $extra[$k] }
  try { Set-Content -LiteralPath $ControlPath -Value ($obj | ConvertTo-Json -Depth 4) -Encoding UTF8 } catch {}
}

$startedAt = (Get-Date).ToUniversalTime().ToString("o")
Write-Control "starting" $null

$manifest = [ordered]@{
  schema                  = "docx-word-validation/v2"
  runId                   = $runId
  workerPid               = $workerPid
  wordHwnd                = $null
  wordPid                 = $null
  wordProcessWasAlreadyRunningBefore = $null
  forcedTerminationUsed   = $false
  forcedTerminationPid    = $null
  openedReadOnly          = $null
  openedByRepair          = $null
  approved                = $false
  failures                = @()
  warnings                = @()
  metrics                 = $null
  pagesBeforeFields       = $null
  pagesAfterFields        = $null
  pagesAfterToc           = $null
  pdfExported             = $false
  pdfSizeBytes            = $null
  wordVersion             = $null
  windowsVersion          = $null
  startedAt               = $startedAt
  finishedAt              = $null
  exitCode                = 1
}

function Fail($code, $msg) { $script:manifest.failures += [ordered]@{ code = $code; message = $msg } }
function AddWarning($msg) { $script:manifest.warnings += [ordered]@{ message = $msg } }

$word = $null
$doc = $null
$wordPid = $null
$script:failed = $false
try {
  if (-not (Test-Path -LiteralPath $DocxPath)) {
    Fail "DOCX_NOT_FOUND" "DOCX nao encontrado: $DocxPath"
    throw "stop"
  }
  $pdfDir = Split-Path -Parent -Path $PdfOutput
  if ($pdfDir -and -not (Test-Path -LiteralPath $pdfDir)) { New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null }
  $manifestDir = Split-Path -Parent -Path $ManifestOutput
  if ($manifestDir -and -not (Test-Path -LiteralPath $manifestDir)) { New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null }

  try { $manifest.windowsVersion = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Version } catch {}

  Write-Control "creating-word" $null
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $manifest.wordVersion = $word.Version } catch {}

  # Detect whether a Word instance was already running BEFORE we created ours,
  # by checking the count of WINWORD processes before vs after creation.
  # (Best-effort; used only for diagnostics, never for killing.)
  try {
    $beforeCount = [int](Get-CimInstance Win32_Process -Filter "Name='WINWORD.EXE'" -ErrorAction SilentlyContinue | Measure-Object).Count
  } catch { $beforeCount = $null }

  # Capture the exact PID of THIS instance via its window handle.
  $hwnd = $null
  try { $hwnd = $word.Hwnd } catch {}
  $manifest.wordHwnd = $hwnd
  if ($hwnd) {
    $sig = @'
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
'@
    Add-Type -MemberDefinition $sig -Name "WinApi" -Namespace "Acceptance" -ErrorAction SilentlyContinue
    $pidOut = 0
    try { [Acceptance.WinApi]::GetWindowThreadProcessId([IntPtr]$hwnd, [ref]$pidOut) | Out-Null } catch {}
    if ($pidOut -gt 0) { $wordPid = [int]$pidOut }
  }
  $manifest.wordPid = $wordPid
  $manifest.wordProcessWasAlreadyRunningBefore = $null  # unknown at this point; see below
  Write-Control "creating-word" $wordPid

  if (-not $wordPid) {
    AddWarning "Nao foi possivel capturar o PID exato do Word; encerramento forcado estara desabilitado."
  }

  Write-Control "opening-document" $wordPid
  $readOnly = $true
  $openRepair = $false
  $doc = $word.Documents.Open(
    [ref]$DocxPath,
    [ref]$false,        # ConfirmConversions
    [ref]$readOnly,     # ReadOnly
    [ref]$false,        # AddToRecentFiles
    [ref]"",            # PasswordDocument
    [ref]"",            # PasswordTemplate
    [ref]$false,        # Revert
    [ref]"",            # WritePasswordDocument
    [ref]"",            # WritePasswordTemplate
    [ref]$false,        # Format
    [ref]$false,        # Encoding
    [ref]$false,        # Visible
    [ref]$openRepair,   # OpenAndRepair -> $false (no repair)
    [ref]$true          # DocumentDirection (LTR)
  )
  if (-not $doc) {
    Fail "OPEN_FAILED" "O Word nao retornou o documento (possivel reparo necessario)."
    throw "stop"
  }
  $manifest.openedReadOnly = $readOnly
  $manifest.openedByRepair = $openRepair
  $manifest.approved = $true

  Write-Control "updating-fields" $wordPid
  $manifest.pagesBeforeFields = $doc.ComputeStatistics(2)
  if ($UpdateFields) { $doc.Fields.Update() | Out-Null }
  $manifest.pagesAfterFields = $doc.ComputeStatistics(2)

  Write-Control "updating-toc" $wordPid
  if ($UpdateToc) {
    if ($doc.TablesOfContents.Count -gt 0) {
      for ($i = 1; $i -le $doc.TablesOfContents.Count; $i++) {
        $doc.TablesOfContents.Item($i).Update() | Out-Null
      }
    } else {
      AddWarning "Nenhum sumario (TOC) encontrado para atualizar."
    }
  }
  $manifest.pagesAfterToc = $doc.ComputeStatistics(2)

  Write-Control "repaginating" $wordPid
  try { $doc.Repaginate() } catch {}

  $pg = $doc.PageSetup
  $manifest.metrics = [ordered]@{
    paragraphs    = $doc.Paragraphs.Count
    inlineShapes  = $doc.InlineShapes.Count
    shapes        = $doc.Shapes.Count
    tables        = $doc.Tables.Count
    bookmarks     = $doc.Bookmarks.Count
    sections      = $doc.Sections.Count
    activePrinter = $word.ActivePrinter
    pageWidth     = $pg.PageWidth
    pageHeight    = $pg.PageHeight
    orientation   = $pg.Orientation
    leftMargin    = $pg.LeftMargin
    rightMargin   = $pg.RightMargin
    topMargin     = $pg.TopMargin
    bottomMargin  = $pg.BottomMargin
  }

  Write-Control "exporting-pdf" $wordPid
  $exportDir = Split-Path -Parent -Path $PdfOutput
  if (-not (Test-Path -LiteralPath $exportDir)) { New-Item -ItemType Directory -Force -Path $exportDir | Out-Null }
  $doc.ExportAsFixedFormat(
    [ref]$PdfOutput,
    [ref]17,            # wdExportFormatPDF
    [ref]$false,        # OpenAfterExport
    [ref]0,             # wdExportOptimizeForPrint
    [ref]0,             # wdExportRangeDocument
    [ref]1,             # From
    [ref]$doc.ComputeStatistics(2),
    [ref]0,             # wdExportItemDocumentContent
    [ref]$true,         # IncludeDocProps
    [ref]$true,         # KeepIRM
    [ref]0,             # WdExportCreateBookmarks = heading bookmarks
    [ref]$true,         # DocStructureTags
    [ref]$false,        # BitmapMissingFonts
    [ref]$true          # UseISO19005_1 (PDF/A)
  )
  if (Test-Path -LiteralPath $PdfOutput) {
    $pdfItem = Get-Item -LiteralPath $PdfOutput
    if ($pdfItem.Length -gt 0) {
      $manifest.pdfExported = $true
      $manifest.pdfSizeBytes = $pdfItem.Length
    } else {
      Fail "PDF_EMPTY" "PDF exportado porem vazio."
    }
  } else {
    Fail "PDF_NOT_CREATED" "Falha ao exportar PDF."
  }

  Write-Control "closing-document" $wordPid
}
catch {
  if ($_.Exception.Message -eq "stop") { } else {
    Fail "WORD_EXCEPTION" "Excecao do Word: $($_.Exception.Message)"
  }
  $script:failed = $true
  Write-Control "failed" $wordPid @{ error = if ($_.Exception.Message -eq "stop") { $null } else { $_.Exception.Message } }
}
finally {
  Write-Control "closing-word" $wordPid
  if ($doc) { try { $doc.Close([ref]$false) } catch {} }
  if ($word) {
    try { $word.Quit() } catch {}
    try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
  }
  # Garbage collection to release COM refs.
  try { [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers() } catch {}
  Start-Sleep -Milliseconds 300
  # Only kill the captured PID if it still exists and matches.
  if ($wordPid) {
    $proc = Get-Process -Id $wordPid -ErrorAction SilentlyContinue
    if ($proc) {
      try { Stop-Process -Id $wordPid -Force -ErrorAction Stop; $manifest.forcedTerminationUsed = $true; $manifest.forcedTerminationPid = $wordPid } catch {}
    }
  }
  $manifest.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  if ($manifest.failures.Count -gt 0) { $manifest.approved = $false; $manifest.exitCode = 1 } else { $manifest.exitCode = 0 }
  try { Set-Content -LiteralPath $ManifestOutput -Value ($manifest | ConvertTo-Json -Depth 8) -Encoding UTF8 } catch {}
  if (-not $script:failed) {
    Write-Control "completed" $wordPid
  }
  if ($script:failed -or $manifest.failures.Count -gt 0) {
    Write-Error "WORD VALIDATION FAILED: $($manifest.failures.Count) falha(s)"
    exit 1
  } else {
    Write-Output "WORD VALIDATION APROVADA"
    exit 0
  }
}
