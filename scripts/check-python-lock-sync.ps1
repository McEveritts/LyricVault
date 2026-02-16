$ErrorActionPreference = "Stop"

$checks = @(
    @{ Path = "scripts/setup-python.ps1"; Pattern = "requirements.lock.txt" },
    @{ Path = ".github/workflows/backend-tests.yml"; Pattern = "requirements.lock.txt" },
    @{ Path = ".github/workflows/security-audit.yml"; Pattern = "requirements.lock.txt" }
)

foreach ($check in $checks) {
    if (-not (Test-Path $check.Path)) {
        throw "Missing required file: $($check.Path)"
    }
    $content = Get-Content $check.Path -Raw
    if ($content -notmatch [regex]::Escape($check.Pattern)) {
        throw "Lockfile policy violation: '$($check.Path)' must reference '$($check.Pattern)'"
    }
    Write-Host "[OK] $($check.Path) references $($check.Pattern)"
}

Write-Host "Python lockfile sync policy check passed." -ForegroundColor Green
