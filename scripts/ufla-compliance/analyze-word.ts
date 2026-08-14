$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\Site_ABNT\artifacts\ufla-compliance\normalized-dissertacao.docx")
  $pages = $doc.ComputeStatistics(2)
  $sections = $doc.Sections.Count
  $doc.Close($false)
  Write-Output "PAGES:$pages"
  Write-Output "SECTIONS:$sections"
} catch {
  Write-Output "ERROR:$($_.Exception.Message)"
} finally {
  if ($word) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}