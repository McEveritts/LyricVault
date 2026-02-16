# LyricVault Pre-Alpha Setup Script
# This script prepares the development environment for a first run.

$ErrorActionPreference = "Stop"

function Show-AppHeader($text) {
    Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host ("=" * 60) + "`n" -ForegroundColor Cyan
}

Show-AppHeader "LyricVault Pre-Alpha Setup"

# 1. Check Prerequisites
Write-Host "Step 1/5: Checking toolchain..." -ForegroundColor Yellow
$prereqs = @(
    @{ Name = "node"; Command = "node --version"; Error = "Node.js is missing. Install from nodejs.org." },
    @{ Name = "npm"; Command = "npm --version"; Error = "npm is missing." },
    @{ Name = "cargo"; Command = "cargo --version"; Error = "Rust/Cargo is missing. Install from rustup.rs." }
)

foreach ($p in $prereqs) {
    try {
        & ([scriptblock]::Create($p.Command)) | Out-Null
        Write-Host " [OK] $($p.Name) detected." -ForegroundColor Green
    }
    catch {
        Write-Error $p.Error
        exit 1
    }
}

# 2. Install Dependencies
Show-AppHeader "Step 2/5: Installing dependencies (this may take a few minutes)..."
Write-Host "Root environment..." -ForegroundColor Yellow
npm install

Write-Host "`nDesktop environment..." -ForegroundColor Yellow
Set-Location apps/desktop
npm install
Set-Location ../..

# 3. Fetch Runtime Assets
Show-AppHeader "Step 3/5: Fetching runtime assets (Python, FFmpeg)..."
npm run runtime:fetch

# 4. Final Environment Check
Show-AppHeader "Step 4/5: Running environment doctor..."
npm run doctor:desktop-env

# 5. Launch Instructions
Show-AppHeader "Step 5/5: Ready for testing!"
Write-Host "LyricVault Pre-Alpha is now configured.`n" -ForegroundColor Green
Write-Host "To start the application in development mode, run:"
Write-Host "  npm run dev`n" -ForegroundColor Cyan
Write-Host "To build a production portable package, run:"
Write-Host "  npm run dist`n" -ForegroundColor Cyan

$ans = Read-Host "Would you like to start the application now? (y/n)"
if ($ans -eq 'y') {
    npm run dev
}
