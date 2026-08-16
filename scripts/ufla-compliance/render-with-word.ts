import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const inputDocx = join(process.cwd(), "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const outputDir = join(process.cwd(), "artifacts", "ufla-compliance", "rendered");

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const ps1 = `
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("${inputDocx.replace(/\\/g, "\\\\")}")
  $pdfPath = Join-Path "${outputDir.replace(/\\/g, "\\\\")}" "normalized-dissertacao.pdf"
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
`;

try {
  const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps1.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120000,
  });
  console.log(result.trim());
} catch (error) {
  console.error("Render failed:", error instanceof Error ? error.message : String(error));
}