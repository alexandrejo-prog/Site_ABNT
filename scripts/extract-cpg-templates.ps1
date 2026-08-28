# Extract CPG template content from .doc files using Word COM
# This script opens each .doc template, extracts text and formatting info

$templateDir = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\docs\Templates_CPG"
$outputDir = "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\tmp\cpg-comparison\templates"

if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir -Force | Out-Null }

$word = New-Object -ComObject Word.Application
$word.Visible = $false

$templates = @(
    @{ Name = "Resumo_Simples"; File = "TemplateResumo_Simples.ab0d355f77784a9c9950.doc" },
    @{ Name = "Resumo_Expandido"; File = "TemplateResumo_Expandido.aa3a941398f94471bd94.doc" },
    @{ Name = "Artigo_Completo"; File = "TemplateArtigo_Completo.f6185d37b8854c0294ae.doc" }
)

foreach ($tpl in $templates) {
    $filePath = Join-Path $templateDir $tpl.File
    Write-Host "`n===== $($tpl.Name) =====" -ForegroundColor Cyan
    Write-Host "File: $filePath"
    
    $doc = $word.Documents.Open($filePath)
    
    # Page setup
    $ps = $doc.PageSetup
    Write-Host "`n--- Page Setup ---"
    Write-Host "  Page width (pt): $($ps.PageWidth)"
    Write-Host "  Page height (pt): $($ps.PageHeight)"
    Write-Host "  Top margin (cm): $([Math]::Round($ps.TopMargin / 28.35, 2))"
    Write-Host "  Bottom margin (cm): $([Math]::Round($ps.BottomMargin / 28.35, 2))"
    Write-Host "  Left margin (cm): $([Math]::Round($ps.LeftMargin / 28.35, 2))"
    Write-Host "  Right margin (cm): $([Math]::Round($ps.RightMargin / 28.35, 2))"
    
    # Extract paragraphs with formatting
    $paraCount = $doc.Paragraphs.Count
    Write-Host "`n--- Paragraphs: $paraCount ---"
    
    $output = @()
    $output += "===== $($tpl.Name) ====="
    $output += "File: $tpl.File"
    $output += "Page: $($ps.PageWidth) x $($ps.PageHeight) pt"
    $output += "Margins: T=$([Math]::Round($ps.TopMargin / 28.35, 2))cm B=$([Math]::Round($ps.BottomMargin / 28.35, 2))cm L=$([Math]::Round($ps.LeftMargin / 28.35, 2))cm R=$([Math]::Round($ps.RightMargin / 28.35, 2))cm"
    $output += ""
    $output += "--- Paragraphs ---"
    
    for ($i = 1; $i -le [Math]::Min($paraCount, 50); $i++) {
        $p = $doc.Paragraphs.Item($i)
        $text = $p.Range.Text.Trim()
        $style = $p.Style.NameLocal
        $align = $p.Alignment
        $font = $p.Range.Font.Name
        $size = $p.Range.Font.Size
        $bold = $p.Range.Font.Bold
        $italic = $p.Range.Font.Italic
        $lineSpacing = $p.LineSpacingRule
        $spaceBefore = $p.SpaceBefore
        $spaceAfter = $p.SpaceAfter
        $firstLine = $p.FirstLineIndent
        
        $alignStr = switch ($align) {
            0 { "wdAlignParagraphLeft" }
            1 { "wdAlignParagraphCenter" }
            2 { "wdAlignParagraphRight" }
            3 { "wdAlignParagraphJustify" }
            default { "Unknown($align)" }
        }
        
        $lineStr = switch ($lineSpacing) {
            0 { "wdLineSpaceSingle" }
            1 { "wdLineSpace1pt5" }
            2 { "wdLineSpaceDouble" }
            3 { "wdLineSpaceAtLeast" }
            4 { "wdLineSpaceExactly" }
            5 { "wdLineSpaceMultiple" }
            default { "Unknown($lineSpacing)" }
        }
        
        $lineSpacingVal = $p.LineSpacing
        
        $info = "P$($i.ToString('000')): align=$alignStr font=$font size=$size bold=$bold italic=$italic lineRule=$lineStr lineSpacing=$lineSpacingVal spaceBefore=$spaceBefore spaceAfter=$spaceAfter firstLine=$firstLine style=$style"
        $output += $info
        
        if ($text.Length -gt 0) {
            Write-Host "  P$($i.ToString('000')): [$style] $alignStr font=$font $size" -NoNewline
            if ($bold) { Write-Host " B" -NoNewline }
            if ($italic) { Write-Host " I" -NoNewline }
            Write-Host " line=$lineStr($lineSpacingVal) fl=$firstLine"
            Write-Host "    Text: $($text.Substring(0, [Math]::Min($text.Length, 100)))"
        }
    }
    
    # Save output
    $outFile = Join-Path $outputDir "$($tpl.Name)_content.txt"
    $output | Out-File -FilePath $outFile -Encoding UTF8
    Write-Host "`n  Saved to: $outFile"
    
    $doc.Close([ref]$false)
}

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

Write-Host "`nDone!" -ForegroundColor Green
