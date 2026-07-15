# scripts/acceptance/validate-word.ps1
#
# Parent: inicia validate-word-worker.ps1 como processo filho, aguarda no maximo
# TimeoutSeconds e, em caso de estouro, encerra SOMENTE o worker e o PID exato do
# Word que o worker registrou no arquivo de controle. Nunca encerra processos Word
# por nome (Get-Process WINWORD / taskkill / Stop-Process -Name WINWORD).
#
# Parametros:
#   -DocxPath
#   -PdfOutput
#   -ManifestOutput
#   -UpdateFields
#   -UpdateToc
#   -TimeoutSeconds   (default 180)

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $DocxPath,
  [Parameter(Mandatory = $true)] [string] $PdfOutput,
  [Parameter(Mandatory = $true)] [string] $ManifestOutput,
  [switch] $UpdateFields,
  [switch] $UpdateToc,
  [int] $TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Path
$runId = [guid]::NewGuid().ToString()
$workerScript = Join-Path $scriptDir "validate-word-worker.ps1"
$controlPath = Join-Path (Split-Path -Parent -Path $ManifestOutput) ("word-control-" + $runId + ".json")

$env:ACCEPTANCE_RUN_ID = $runId

$manifest = [ordered]@{
  schema                  = "docx-word-validation/v2"
  runId                   = $runId
  workerPid               = $null
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
  timedOut                = $false
  startedAt               = (Get-Date).ToUniversalTime().ToString("o")
  finishedAt              = $null
  exitCode                = 1
}

function Fail($code, $msg) { $script:manifest.failures += [ordered]@{ code = $code; message = $msg } }

if (-not (Test-Path -LiteralPath $workerScript)) {
  Fail "WORKER_MISSING" "Worker nao encontrado: $workerScript"
  $manifest.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  Set-Content -LiteralPath $ManifestOutput -Value ($manifest | ConvertTo-Json -Depth 8) -Encoding UTF8
  Write-Error "WORD VALIDATION FAILED"; exit 1
}

$outDir = Split-Path -Parent -Path $ManifestOutput
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$workerArgs = @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $workerScript
  "-DocxPath", $DocxPath
  "-PdfOutput", $PdfOutput
  "-ManifestOutput", $ManifestOutput
  "-ControlPath", $controlPath
)
if ($UpdateFields) { $workerArgs += "-UpdateFields" }
if ($UpdateToc) { $workerArgs += "-UpdateToc" }

$worker = $null
try {
  $worker = Start-Process -FilePath "powershell.exe" -ArgumentList $workerArgs -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $outDir "word-worker-stdout.log") -RedirectStandardError (Join-Path $outDir "word-worker-stderr.log")
  $manifest.workerPid = $worker.Id
  $timeoutMs = [Math]::Max(1000, $TimeoutSeconds * 1000)

  $exited = $worker.WaitForExit($timeoutMs)
  if (-not $exited) {
    # TIMEOUT
    $manifest.timedOut = $true
    Fail "TIMEOUT" "Validacao Word excedeu ${TimeoutSeconds}s (estagio: $(Read-ControlStage))."
    # Kill only the worker process.
    try { if (-not $worker.HasExited) { Stop-Process -Id $worker.Id -Force -ErrorAction Stop } } catch {}
    # Read wordPid from control file and kill ONLY that PID.
    $wp = Read-ControlWordPid
    if ($wp) {
      $p = Get-Process -Id $wp -ErrorAction SilentlyContinue
      if ($p) {
        try { Stop-Process -Id $wp -Force -ErrorAction Stop; $manifest.forcedTerminationUsed = $true; $manifest.forcedTerminationPid = $wp } catch {}
      }
    }
    $manifest.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
    Set-Content -LiteralPath $ManifestOutput -Value ($manifest | ConvertTo-Json -Depth 8) -Encoding UTF8
    Write-Error "WORD VALIDATION TIMEOUT"; exit 1
  }

  # Worker finished; merge its manifest if present.
  if (Test-Path -LiteralPath $ManifestOutput) {
    $w = Get-Content -LiteralPath $ManifestOutput -Raw | ConvertFrom-Json
    foreach ($k in @("wordHwnd","wordPid","openedReadOnly","openedByRepair","approved","metrics","pagesBeforeFields","pagesAfterFields","pagesAfterToc","pdfExported","pdfSizeBytes","wordVersion","windowsVersion","forcedTerminationUsed","forcedTerminationPid","wordProcessWasAlreadyRunningBefore")) {
      if ($null -ne $w.$k) { $manifest[$k] = $w.$k }
    }
    if ($w.failures) { foreach ($f in $w.failures) { $manifest.failures += $f } }
    if ($w.warnings) { foreach ($ww in $w.warnings) { $manifest.warnings += $ww } }
    $manifest.exitCode = $w.exitCode
  } else {
    Fail "WORKER_NO_MANIFEST" "Worker nao produziu manifesto."
  }
}
catch {
  Fail "PARENT_EXCEPTION" "Excecao do orquestrador Word: $($_.Exception.Message)"
}
finally {
  if ($worker -and -not $worker.HasExited) {
    try { Stop-Process -Id $worker.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  $manifest.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  if ($manifest.failures.Count -gt 0) { $manifest.approved = $false; if ($manifest.exitCode -eq 0) { $manifest.exitCode = 1 } } else { $manifest.approved = $true; $manifest.exitCode = 0 }
  try { Set-Content -LiteralPath $ManifestOutput -Value ($manifest | ConvertTo-Json -Depth 8) -Encoding UTF8 } catch {}
  if ($manifest.failures.Count -gt 0) {
    Write-Error "WORD VALIDATION FAILED: $($manifest.failures.Count) falha(s)"; exit 1
  } else {
    Write-Output "WORD VALIDATION APROVADA"; exit 0
  }
}

function Read-ControlStage {
  try {
    $c = Get-Content -LiteralPath $controlPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
    return $c.currentStage
  } catch { return "unknown" }
}
function Read-ControlWordPid {
  try {
    $c = Get-Content -LiteralPath $controlPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
    return $c.wordPid
  } catch { return $null }
}
