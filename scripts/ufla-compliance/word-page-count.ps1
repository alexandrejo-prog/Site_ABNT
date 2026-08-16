# word-page-count.ps1
# Conta as páginas de um DOCX com o Word (ComputeStatistics(2) = wdStatisticPages).
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File word-page-count.ps1 -DocxPath <docx>
param(
  [Parameter(Mandatory = $true)][string]$DocxPath
)
$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($DocxPath, $false, $true)
  try { $doc.Fields.Update() | Out-Null } catch {}
  $pages = $doc.ComputeStatistics(2)
  $doc.Close($false)
  Write-Output "PAGES:$pages"
} catch {
  Write-Output "ERROR:$($_.Exception.Message)"
  exit 1
} finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}
