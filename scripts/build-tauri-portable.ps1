$ErrorActionPreference = "Stop"

function Ensure-Command([string]$Name, [string]$HelpText) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $HelpText
    }
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$releaseDir = Join-Path $projectRoot "release"
$fetchAssetsScript = Join-Path $projectRoot "scripts\\fetch-runtime-assets.ps1"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"
if ((-not (Get-Command cargo -ErrorAction SilentlyContinue)) -and (Test-Path (Join-Path $cargoBin "cargo.exe"))) {
    $env:PATH = "$cargoBin;$env:PATH"
}

Ensure-Command "cargo" "Cargo was not found. Install Rust with rustup and ensure ~/.cargo/bin is in PATH."

if (-not (Test-Path $fetchAssetsScript)) {
    throw "Runtime asset fetch script missing: $fetchAssetsScript"
}

& powershell -ExecutionPolicy Bypass -File $fetchAssetsScript

$requiredPaths = @(
    (Join-Path $projectRoot "python-embed\\python.exe"),
    (Join-Path $projectRoot "python-embed\\.lyricvault-asset.json"),
    (Join-Path $projectRoot "ffmpeg\\ffmpeg.exe"),
    (Join-Path $projectRoot "ffmpeg\\.lyricvault-asset.json"),
    (Join-Path $projectRoot "backend\\tools\\bridge_cli.py")
)
foreach ($required in $requiredPaths) {
    if (-not (Test-Path $required)) {
        throw "Required portable resource missing: $required"
    }
}

Push-Location $projectRoot
try {
    npm run build:desktop
} finally {
    Pop-Location
}

$releaseExeDir = Join-Path $projectRoot "target\\release"
$exePath = Join-Path $releaseExeDir "lyricvault_tauri.exe"
if (-not (Test-Path $exePath)) {
    throw "Expected desktop executable not found at $exePath"
}

$packageJson = Get-Content (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$portableDirName = "LyricVault.Portable.$version"
$portableDir = Join-Path $releaseDir $portableDirName
if (Test-Path $portableDir) {
    Remove-Item $portableDir -Recurse -Force
}
New-Item -ItemType Directory -Path $portableDir -Force | Out-Null

Copy-Item $exePath (Join-Path $portableDir "LyricVault.exe") -Force
Get-ChildItem $releaseExeDir -Filter "*.dll" | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $portableDir $_.Name) -Force
}

Copy-Item (Join-Path $projectRoot "python-embed") (Join-Path $portableDir "python-embed") -Recurse -Force
Copy-Item (Join-Path $projectRoot "ffmpeg") (Join-Path $portableDir "ffmpeg") -Recurse -Force
Copy-Item (Join-Path $projectRoot "backend") (Join-Path $portableDir "backend") -Recurse -Force

$readmePath = Join-Path $portableDir "README_PORTABLE.txt"
@"
LyricVault Portable

This package was generated from the Tauri desktop runtime.

Contents:
- LyricVault.exe
- python-embed (runtime + yt-dlp dependencies)
- ffmpeg
- backend (bridge scripts/services)

Usage:
1. Keep this folder structure intact.
2. Launch LyricVault.exe.
"@ | Set-Content -Path $readmePath -Encoding UTF8

$zipPath = Join-Path $releaseDir ("LyricVault.Portable.{0}.zip" -f $version)
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $portableDir "*") -DestinationPath $zipPath
Write-Host ("Portable package created: {0}" -f $zipPath) -ForegroundColor Green
