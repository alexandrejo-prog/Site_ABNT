# Exporta um DOCX para PDF usando Microsoft Word (COM) no Windows.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File export-docx-word.ps1 <docx> <pdfOut>
# Fluxo (mandato C1R22): abrir DOCX -> atualizar campos -> atualizar sumario
#   -> renderizar layout -> exportar PDF.
param(
  [string]$DocxPath,
  [string]$PdfOutPath
)

$ErrorActionPreference = "Stop"
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($DocxPath, $false, $true)  # ReadOnly

  # Atualiza todos os campos (numeracao de pagina, referencias, etc.)
  try { $doc.Fields.Update() } catch {}
  # Atualiza o sumario (TOC) - F9 equivalente.
  try {
    $doc.TablesOfContents | ForEach-Object { $_.Update() }
  } catch {}
  try {
    $doc.TablesOfAuthorities | ForEach-Object { $_.Update() }
  } catch {}

  # Exporta como PDF fixo (wdExportFormatPDF = 17).
  $wdFormatPDF = 17
  $doc.ExportAsFixedFormat(
    [ref]$PdfOutPath,
    [ref]$wdFormatPDF,
    [ref]$false,           # OpenAfterExport
    [ref]0,               # OptimizeFor: 0=Print, 1=Screen
    [ref]0,               # Range: 0=All
    [ref]1,               # From (ignored)
    [ref]1,               # To (ignored)
    [ref]0,               # Item
    [ref]$false,          # IncludeDocProps
    [ref]$true,           # KeepIRM
    [ref]1,               # CreateBookmarks: 1=All
    [ref]1,               # DocStructureTags
    [ref]$true,           # BitmapMissingFonts
    [ref]$false            # UseISO19005_1
  )

  # Confirma escrita.
  $wait = 0
  while (-not (Test-Path $PdfOutPath) -and $wait -lt 30) {
    Start-Sleep -Seconds 1
    $wait++
  }
  if (-not (Test-Path $PdfOutPath)) {
    Write-Error "PDF nao foi gerado por Word."
  }
} finally {
  if ($doc) { try { $doc.Close([ref]$false) } catch {} }
  if ($word) { try { $word.Quit() } catch {} }
}
