param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

function Import-VsDevEnvironment {
    $vsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\\Installer\\vswhere.exe"
    if (-not (Test-Path $vsWhere)) {
        return $false
    }

    $installPath = (& $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($installPath)) {
        return $false
    }

    $devCmd = Join-Path $installPath.Trim() "Common7\\Tools\\VsDevCmd.bat"
    if (-not (Test-Path $devCmd)) {
        return $false
    }

    $envDump = & cmd /c "`"$devCmd`" -arch=x64 -host_arch=x64 >nul && set"
    foreach ($line in $envDump) {
        if ($line -match "^([^=]+)=(.*)$") {
            Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2]
        }
    }
    return $true
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$desktopDir = Join-Path $projectRoot "apps\\desktop"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"

if ((-not (Get-Command cargo -ErrorAction SilentlyContinue)) -and (Test-Path (Join-Path $cargoBin "cargo.exe"))) {
    $env:PATH = "$cargoBin;$env:PATH"
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Cargo was not found. Install Rust with rustup and ensure ~/.cargo/bin is available."
}

if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $loaded = Import-VsDevEnvironment
    if (-not $loaded) {
        throw "MSVC linker (link.exe) unavailable. Install Visual Studio Build Tools with Desktop development with C++."
    }
}

if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    throw "MSVC linker (link.exe) is still unavailable after loading VS developer environment."
}

Push-Location $desktopDir
try {
    if ($CommandArgs.Count -gt 0) {
        & npm run tauri -- @CommandArgs
    } else {
        & npm run tauri
    }

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
