Write-Host "Bloqueando todos os executaveis do Adobe Acrobat no Firewall do Windows..." -ForegroundColor Cyan

$exes = Get-ChildItem -Path "C:\Program Files (x86)\Adobe\Acrobat DC" -Recurse -Include "*.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$count = 0

foreach ($exe in $exes) {
    $name = (Split-Path $exe -Leaf) -replace '\.exe$',''
    $ruleName = "Bloquear_Acrobat_$name"
    
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        try {
            New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Program $exe -Action Block -Profile Any -Enabled True -ErrorAction Stop | Out-Null
            Write-Host "[OK] $name" -ForegroundColor Green
            $count++
        } catch {
            Write-Host "[FALHA] $name : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "[IGNORADO] $name (regra ja existe)" -ForegroundColor Yellow
    }
}

Write-Host "`nTotal de regras criadas: $count" -ForegroundColor Cyan
Read-Host "`nPressione Enter para sair"
