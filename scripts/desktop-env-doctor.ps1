$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"
$fetchAssetsScript = Join-Path $projectRoot "scripts\\fetch-runtime-assets.ps1"

Write-Host "LyricVault Desktop Environment Doctor" -ForegroundColor Cyan
Write-Host "Project: $projectRoot"
Write-Host ""

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo -and (Test-Path (Join-Path $cargoBin "cargo.exe"))) {
    Write-Host "[WARN] cargo not in PATH but found at $cargoBin\\cargo.exe" -ForegroundColor Yellow
    Write-Host "       Add '$cargoBin' to PATH or use the preflight script in dist."
} elseif ($cargo) {
    Write-Host "[OK] cargo detected: $($cargo.Source)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] cargo not found. Install Rust via rustup." -ForegroundColor Red
}

$link = Get-Command link.exe -ErrorAction SilentlyContinue
if ($link) {
    Write-Host "[OK] link.exe detected: $($link.Source)" -ForegroundColor Green
} else {
    $vsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\Installer\\vswhere.exe"
    $installPath = $null
    if (Test-Path $vsWhere) {
        $installPath = (& $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
    }

    if (-not [string]::IsNullOrWhiteSpace($installPath)) {
        $msvcRoot = Join-Path $installPath.Trim() "VC\\Tools\\MSVC"
        $msvcVersion = Get-ChildItem $msvcRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($msvcVersion) {
            $resolvedLink = Join-Path $msvcVersion.FullName "bin\Hostx64\x64\link.exe"
            if (Test-Path $resolvedLink) {
                Write-Host "[WARN] link.exe installed but not in current PATH: $resolvedLink" -ForegroundColor Yellow
                Write-Host "       Use npm run tauri build (root wrapper) or a VS Developer Prompt."
            } else {
                Write-Host "[FAIL] link.exe not found (MSVC linker missing)." -ForegroundColor Red
                Write-Host "       Install Visual Studio Build Tools workload: Desktop development with C++"
            }
        } else {
            Write-Host "[FAIL] link.exe not found (MSVC linker missing)." -ForegroundColor Red
            Write-Host "       Install Visual Studio Build Tools workload: Desktop development with C++"
        }
    } else {
        Write-Host "[FAIL] link.exe not found (MSVC linker missing)." -ForegroundColor Red
        Write-Host "       Install Visual Studio Build Tools workload: Desktop development with C++"
    }
}

$vsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\Installer\\vswhere.exe"
if (Test-Path $vsWhere) {
    $instances = & $vsWhere -latest -products * -format json | ConvertFrom-Json
    if ($instances) {
        $instance = if ($instances -is [System.Array]) { $instances[0] } else { $instances }
        Write-Host "[OK] Visual Studio instance: $($instance.installationName)" -ForegroundColor Green
        Write-Host "     Path: $($instance.installationPath)"
    } else {
        Write-Host "[WARN] vswhere found, but no VS instance reported." -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] vswhere.exe not found; Visual Studio detection skipped." -ForegroundColor Yellow
}

function Read-AssetMarker([string]$dir) {
    $path = Join-Path $dir ".lyricvault-asset.json"
    if (-not (Test-Path $path)) {
        return $null
    }

    try {
        return (Get-Content $path -Raw | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Report-AssetStatus([string]$name, [string]$dir, [string]$requiredBinary) {
    if (-not (Test-Path $dir)) {
        Write-Host "[FAIL] $name missing: $dir" -ForegroundColor Red
        Write-Host "       Run 'npm run runtime:fetch' to download required assets."
        return
    }

    $binaryPath = Join-Path $dir $requiredBinary
    $binaryExists = Test-Path $binaryPath
    $marker = Read-AssetMarker $dir

    if ($binaryExists -and $marker) {
        Write-Host "[OK] $name present with marker: $dir" -ForegroundColor Green
        Write-Host "     Version: $($marker.version) | Asset: $($marker.asset)"
        return
    }

    if ($binaryExists -and -not $marker) {
        Write-Host "[WARN] $name present without marker: $dir" -ForegroundColor Yellow
        Write-Host "       Run 'npm run runtime:fetch' to normalize metadata."
        return
    }

    Write-Host "[FAIL] $name directory exists but required binary missing: $binaryPath" -ForegroundColor Red
    Write-Host "       Run 'npm run runtime:fetch' to re-fetch assets."
}

Report-AssetStatus -name "python-embed" -dir (Join-Path $projectRoot "python-embed") -requiredBinary "python.exe"
Report-AssetStatus -name "ffmpeg" -dir (Join-Path $projectRoot "ffmpeg") -requiredBinary "ffmpeg.exe"

$bridge = Join-Path $projectRoot "backend\\tools\\bridge_cli.py"
if (Test-Path $bridge) {
    Write-Host "[OK] bridge script present: $bridge" -ForegroundColor Green
} else {
    Write-Host "[WARN] bridge script missing: $bridge" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Suggested next commands:" -ForegroundColor Cyan
Write-Host "  npm run doctor:desktop-env"
if (Test-Path $fetchAssetsScript) {
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/fetch-runtime-assets.ps1"
}
Write-Host "  npm run dist"
