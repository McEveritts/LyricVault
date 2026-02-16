$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$fetchScript = Join-Path $projectRoot "scripts\\fetch-runtime-assets.ps1"

if (-not (Test-Path $fetchScript)) {
    throw "Runtime asset fetch script missing: $fetchScript"
}

# LyricVault runtime setup (lockfile-pinned to requirements.lock.txt)
Write-Host "LyricVault runtime setup (lockfile-pinned)" -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File $fetchScript
Write-Host "Runtime setup complete." -ForegroundColor Green
