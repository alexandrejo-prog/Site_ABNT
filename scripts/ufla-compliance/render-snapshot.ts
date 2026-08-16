import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const inputDocx = join(cwd, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const outputDir = join(cwd, "artifacts", "ufla-compliance", "rendered");
const tempDocx = join(cwd, "artifacts", "ufla-compliance", "runtime", "render-snapshot.docx");
const outputPdf = join(outputDir, "normalized-dissertacao.pdf");

if (!existsSync(join(cwd, "artifacts", "ufla-compliance", "runtime"))) {
  mkdirSync(join(cwd, "artifacts", "ufla-compliance", "runtime"), { recursive: true });
}

copyFileSync(inputDocx, tempDocx);

const ps1 = `
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("${tempDocx.replace(/\\/g, "\\\\")}", [ref]$true, [ref]$true)
  $pdfPath = "${outputPdf.replace(/\\/g, "\\\\")}"
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
} finally {
  try {
    unlinkSync(tempDocx);
  } catch {
    // ignore cleanup errors
  }
}
