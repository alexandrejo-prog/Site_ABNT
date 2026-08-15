# render-docx-to-pdf.ps1
# Abre um DOCX no Word (COM), atualiza campos e exporta PDF.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File render-docx-to-pdf.ps1 -DocxPath <docx> -PdfPath <pdf>
param(
  [Parameter(Mandatory = $true)][string]$DocxPath,
  [Parameter(Mandatory = $true)][string]$PdfPath
)
$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($DocxPath, $false, $true)
  try { $doc.Fields.Update() | Out-Null } catch {}
  $pdfDir = Split-Path -Parent -Path $PdfPath
  if (-not (Test-Path -LiteralPath $pdfDir)) { New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null }
  $doc.ExportAsFixedFormat(
    [ref]$PdfPath,
    [ref]17,            # wdExportFormatPDF
    [ref]$false,        # OpenAfterExport
    [ref]0,             # wdExportOptimizeForPrint
    [ref]0,             # wdExportRangeDocument
    [ref]1,             # From
    [ref]$doc.ComputeStatistics(2),
    [ref]0,             # wdExportItemDocumentContent
    [ref]$true,         # IncludeDocProps
    [ref]$true,         # KeepIRM
    [ref]0,             # WdExportCreateBookmarks
    [ref]$true,         # DocStructureTags
    [ref]$false,        # BitmapMissingFonts
    [ref]$true          # UseISO19005_1 (PDF/A)
  )
  $doc.Close($false)
  if (Test-Path -LiteralPath $PdfPath) {
    Write-Output "OK:$PdfPath"
  } else {
    Write-Output "ERROR:PDF_NOT_CREATED"
    exit 1
  }
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
