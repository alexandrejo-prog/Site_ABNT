$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\Site_ABNT\artifacts\ufla-compliance\normalized-dissertacao.docx", [ref]$true, [ref]$true)
  $pdfPath = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\Site_ABNT\artifacts\ufla-compliance\rendered\normalized-dissertacao.pdf"
  $doc.ExportAsFixedFormat($pdfPath, 17)
  Write-Output "RENDERED:$pdfPath"
} catch {
  Write-Output "ERROR:$($_.Exception.Message)"
} finally {
  if ($doc) {
    $doc.Close($false)
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
  }
  if ($word) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
