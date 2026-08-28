# Detailed template analysis - focus on first-line indent and specific paragraph types
# Extracted from Word COM

$templateDir = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\docs\Templates_CPG"
$outputDir = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\tmp\cpg-comparison\templates"

$word = New-Object -ComObject Word.Application
$word.Visible = $false

$templates = @(
    @{ Name = "Resumo_Expandido"; File = "TemplateResumo_Expandido.aa3a941398f94471bd94.doc" }
)

foreach ($tpl in $templates) {
    $filePath = Join-Path $templateDir $tpl.File
    $doc = $word.Documents.Open($filePath)
    
    Write-Host "`n===== $($tpl.Name) - DETAILED ANALYSIS =====" -ForegroundColor Cyan
    
    $paraCount = $doc.Paragraphs.Count
    Write-Host "Total paragraphs: $paraCount"
    
    $output = @()
    $output += "===== $($tpl.Name) - DETAILED ANALYSIS ====="
    $output += "Total paragraphs: $paraCount"
    $output += ""
    
    for ($i = 1; $i -le $paraCount; $i++) {
        $p = $doc.Paragraphs.Item($i)
        $text = $p.Range.Text.Trim()
        $style = $p.Style.NameLocal
        $font = $p.Range.Font.Name
        $size = $p.Range.Font.Size
        $bold = $p.Range.Font.Bold
        $italic = $p.Range.Font.Italic
        $firstLine = $p.FirstLineIndent
        $leftIndent = $p.LeftIndent
        $rightIndent = $p.RightIndent
        $spaceBefore = $p.SpaceBefore
        $spaceAfter = $p.SpaceAfter
        $lineSpacing = $p.LineSpacing
        $lineRule = $p.LineSpacingRule
        $align = $p.Alignment
        
        # Convert firstLine from points to cm (1 inch = 2.54 cm, 1 pt = 1/72 inch)
        $firstLineCm = [Math]::Round($firstLine * 2.54 / 72, 3)
        $leftIndentCm = [Math]::Round($leftIndent * 2.54 / 72, 3)
        
        $alignStr = switch ($align) {
            0 { "Left" }
            1 { "Center" }
            2 { "Right" }
            3 { "Justify" }
            default { "Unknown($align)" }
        }
        
        $lineStr = switch ($lineRule) {
            0 { "Single" }
            1 { "1.5" }
            2 { "Double" }
            3 { "AtLeast" }
            4 { "Exactly" }
            5 { "Multiple" }
            default { "Unknown($lineRule)" }
        }
        
        $line = "P$($i.ToString('000')): [$style] $alignStr font=$font $size"
        if ($bold -eq -1) { $line += " B" }
        if ($bold -eq 9999999) { $line += " B*" }  # Bold from style
        if ($italic -eq -1) { $line += " I" }
        $line += " line=$lineStr($lineSpacing) spB=$spaceBefore spA=$spaceAfter"
        $line += " fl=${firstLine}pt(${firstLineCm}cm) left=${leftIndent}pt(${leftIndentCm}cm)"
        $line += " text=$($text.Substring(0, [Math]::Min($text.Length, 100)))"
        
        Write-Host $line
        $output += $line
    }
    
    $outFile = Join-Path $outputDir "$($tpl.Name)_detailed.txt"
    $output | Out-File -FilePath $outFile -Encoding UTF8
    Write-Host "`n  Saved to: $outFile"
    
    $doc.Close([ref]$false)
}

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host "`nDone!" -ForegroundColor Green
