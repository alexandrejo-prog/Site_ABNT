import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const fixturesDir = join(cwd, "artifacts", "ufla-compliance", "fixtures");
const renderedDir = join(cwd, "artifacts", "ufla-compliance", "rendered", "fixtures");
const runtimeDir = join(cwd, "artifacts", "ufla-compliance", "runtime");

if (!existsSync(renderedDir)) mkdirSync(renderedDir, { recursive: true });
if (!existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });

const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".docx"));
console.log(`Found ${files.length} fixtures in ${fixturesDir}`);

for (const file of files) {
  console.log(`Processing ${file}...`);
  const inputPath = join(fixturesDir, file);
  const outputPdf = join(renderedDir, file.replace(/\.docx$/i, ".pdf"));
  const tempDocx = join(runtimeDir, `render-${file}`);
  const ps1Path = join(runtimeDir, `render-${file}.ps1`);

  copyFileSync(inputPath, tempDocx);

  const ps1 = `$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open("${tempDocx.replace(/\\/g, "\\\\")}", [ref]$true, [ref]$true)
  $pdfPath = "${outputPdf.replace(/\\/g, "\\\\")}"
  $doc.ExportAsFixedFormat($pdfPath, 17)
  Write-Output "RENDERED:${file}"
} catch {
  Write-Output "ERROR:${file}:$($_.Exception.Message)"
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

  writeFileSync(ps1Path, ps1, "utf-8");

  try {
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });
    console.log((result ?? "").trim());
  } catch (error: any) {
    console.error(`Render failed for ${file}:`, error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout.toString());
    if (error.stderr) console.error("STDERR:", error.stderr.toString());
  } finally {
    try {
      unlinkSync(tempDocx);
    } catch {
      // ignore
    }
    try {
      unlinkSync(ps1Path);
    } catch {
      // ignore
    }
  }
}

console.log("Done rendering fixtures.");
