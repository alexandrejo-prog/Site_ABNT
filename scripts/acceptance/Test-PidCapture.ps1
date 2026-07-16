# scripts/acceptance/Test-PidCapture.ps1
#
# Teste isolado e estatico da regra de selecao de PID do Word usada por
# validate-word-worker.ps1. NAO abre o Word real: recebe listas de processos
# sinteticos e valida o comportamento do fallback "process-delta".
#
# Regra: dado o conjunto de PIDs preexistentes e a lista atual de processos
# WINWORD.EXE (com StartTime UTC apos o inicio do worker), o candidato aceito
# deve ser exatamente um. Zero ou multiplos candidatos => nenhum PID escolhido.
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File Test-PidCapture.ps1
# Saida: 0 se todos os casos passarem; 1 se houver falha.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$failures = @()

# Replica a regra deterministica do worker (idempotente e isolada).
function Select-WordPid {
  param(
    [hashtable] $PreExisting,
    [datetime] $WorkerStartedUtc,
    [array] $Current  # cada item: @{ ProcessId=int; StartUtc=datetime|null }
  )
  $candidates = @()
  foreach ($p in $Current) {
    $pidInt = [int]$p.ProcessId
    if ($PreExisting.ContainsKey($pidInt)) { continue }
    if ($p.StartUtc -and $p.StartUtc -ge $WorkerStartedUtc) { $candidates += $pidInt }
    elseif (-not $p.StartUtc) { $candidates += $pidInt }
  }
  if ($candidates.Count -eq 1) { return $candidates[0] }
  return $null
}

$base = [datetime]::Parse("2026-07-16T06:00:00Z")

# Caso 1: exatamente um processo novo -> escolhido.
$pre = @{}
$cur = @(@{ ProcessId = 7777; StartUtc = $base.AddSeconds(2) })
$got = Select-WordPid $pre $base $cur
if ($got -ne 7777) { $failures += "Caso 1 (um candidato): esperado 7777, recebido $got" }

# Caso 2: zero candidatos (so preexistentes) -> nulo.
$pre2 = @{ 7777 = $true }
$cur2 = @(@{ ProcessId = 7777; StartUtc = $base.AddSeconds(2) })
$got2 = Select-WordPid $pre2 $base $cur2
if ($null -ne $got2) { $failures += "Caso 2 (zero candidatos): esperado null, recebido $got2" }

# Caso 3: multiplos candidatos -> nulo (nao aproxima).
$pre3 = @{}
$cur3 = @(
  @{ ProcessId = 100; StartUtc = $base.AddSeconds(1) },
  @{ ProcessId = 200; StartUtc = $base.AddSeconds(3) }
)
$got3 = Select-WordPid $pre3 $base $cur3
if ($null -ne $got3) { $failures += "Caso 3 (multiplos candidatos): esperado null, recebido $got3" }

# Caso 4: processo preexistente preservado (nao eh candidato) e um novo -> escolhido.
$pre4 = @{ 5555 = $true }
$cur4 = @(
  @{ ProcessId = 5555; StartUtc = $base.AddSeconds(-30) },
  @{ ProcessId = 8888; StartUtc = $base.AddSeconds(5) }
)
$got4 = Select-WordPid $pre4 $base $cur4
if ($got4 -ne 8888) { $failures += "Caso 4 (preserva preexistente): esperado 8888, recebido $got4" }

# Caso 5: StartTime anterior ao inicio do worker -> nao eh candidato (zero -> nulo).
$pre5 = @{}
$cur5 = @(@{ ProcessId = 9999; StartUtc = $base.AddSeconds(-10) })
$got5 = Select-WordPid $pre5 $base $cur5
if ($null -ne $got5) { $failures += "Caso 5 (StartTime anterior): esperado null, recebido $got5" }

# Caso 6: StartTime nulo -> tratado como candidato (exatamente um -> escolhido).
$pre6 = @{}
$cur6 = @(@{ ProcessId = 4242; StartUtc = $null })
$got6 = Select-WordPid $pre6 $base $cur6
if ($got6 -ne 4242) { $failures += "Caso 6 (StartTime nulo): esperado 4242, recebido $got6" }

if ($failures.Count -eq 0) {
  Write-Output "TESTE PID-CAPTURE: TODOS OS CASOS APROVADOS"
  exit 0
} else {
  Write-Error "TESTE PID-CAPTURE FALHOU:"
  foreach ($f in $failures) { Write-Error "  - $f" }
  exit 1
}
