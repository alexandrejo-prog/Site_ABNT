$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\Site_ABNT\artifacts\ufla-compliance\normalized-dissertacao.docx")
  $pdfPath = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\Site_ABNT\artifacts\ufla-compliance\rendered\normalized-dissertacao.pdf"
  $doc.SaveAs([ref]$pdfPath, [ref]17)
  $doc.Close($false)
  Write-Output "RENDERED:$pdfPath"
} catch {
  Write-Output "ERROR:$($_.Exception.Message)"
} finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}