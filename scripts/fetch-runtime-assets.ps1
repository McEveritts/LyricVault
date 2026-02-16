param(
    [switch]$Force,
    [switch]$SkipPythonDeps
)

$ErrorActionPreference = "Stop"

function Assert-FileHash {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedSha256,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $stream = [System.IO.File]::OpenRead($Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash($stream)
        $actual = ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToUpperInvariant()
    } finally {
        $stream.Dispose()
        $sha.Dispose()
    }
    $expected = $ExpectedSha256.ToUpperInvariant()
    if ($actual -ne $expected) {
        throw "$Label checksum mismatch. Expected $expected, got $actual."
    }
}

function Download-VerifiedFile {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Sha256,
        [Parameter(Mandatory = $true)][string]$OutFile,
        [Parameter(Mandatory = $true)][string]$Label
    )

    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    Assert-FileHash -Path $OutFile -ExpectedSha256 $Sha256 -Label $Label
}

function Read-AssetMarker {
    param([Parameter(Mandatory = $true)][string]$Dir)
    $path = Join-Path $Dir ".lyricvault-asset.json"
    if (-not (Test-Path $path)) {
        return $null
    }

    try {
        return (Get-Content $path -Raw | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Write-AssetMarker {
    param(
        [Parameter(Mandatory = $true)][string]$Dir,
        [Parameter(Mandatory = $true)][string]$Asset,
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$Sha256,
        [Parameter(Mandatory = $true)][string]$SourceUrl
    )

    $marker = [ordered]@{
        asset      = $Asset
        version    = $Version
        sha256     = $Sha256.ToUpperInvariant()
        source_url = $SourceUrl
        fetched_at = (Get-Date).ToString("o")
    }
    $path = Join-Path $Dir ".lyricvault-asset.json"
    ($marker | ConvertTo-Json -Depth 4) | Set-Content -Path $path -Encoding UTF8
}

function Test-AssetReady {
    param(
        [Parameter(Mandatory = $true)][string]$Dir,
        [Parameter(Mandatory = $true)][string]$Asset,
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$Sha256,
        [Parameter(Mandatory = $true)][string]$RequiredRelativePath
    )

    if (-not (Test-Path $Dir)) {
        return $false
    }
    if (-not (Test-Path (Join-Path $Dir $RequiredRelativePath))) {
        return $false
    }

    $marker = Read-AssetMarker -Dir $Dir
    if ($null -eq $marker) {
        return $false
    }

    $markerSha = ""
    if ($null -ne $marker.sha256) {
        $markerSha = $marker.sha256.ToString().ToUpperInvariant()
    }

    return (
        $marker.asset -eq $Asset -and
        $marker.version -eq $Version -and
        $markerSha -eq $Sha256.ToUpperInvariant()
    )
}

function Ensure-PythonSiteEnabled {
    param([Parameter(Mandatory = $true)][string]$PythonEmbedDir)

    $pthFile = Get-ChildItem $PythonEmbedDir -Filter "python*._pth" | Select-Object -First 1
    if (-not $pthFile) {
        return
    }

    $updated = @()
    foreach ($line in (Get-Content $pthFile.FullName)) {
        if ($line.Trim() -eq "#import site") {
            $updated += "import site"
        } else {
            $updated += $line
        }
    }
    Set-Content -Path $pthFile.FullName -Value $updated -Encoding ASCII
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$lockPath = Join-Path $projectRoot "scripts\\runtime-assets.lock.json"
$pythonDir = Join-Path $projectRoot "python-embed"
$ffmpegDir = Join-Path $projectRoot "ffmpeg"
$tempDir = Join-Path $projectRoot "temp-runtime-assets"
$requirementsFile = Join-Path $projectRoot "backend\\requirements.lock.txt"

if (-not (Test-Path $lockPath)) {
    throw "Runtime asset lock file not found: $lockPath"
}

$lock = Get-Content $lockPath -Raw | ConvertFrom-Json
$pythonAsset = $lock.assets.python_embed
$ffmpegAsset = $lock.assets.ffmpeg
$getPipAsset = $lock.assets.get_pip

if ($null -eq $pythonAsset -or $null -eq $ffmpegAsset -or $null -eq $getPipAsset) {
    throw "Lock file is missing one or more required assets (python_embed, ffmpeg, get_pip)."
}

if (-not (Test-Path $requirementsFile)) {
    throw "Missing Python requirements lock file: $requirementsFile"
}

if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$pythonChanged = $false

try {
    $pythonReady = (-not $Force) -and (Test-AssetReady `
        -Dir $pythonDir `
        -Asset "python_embed" `
        -Version $pythonAsset.version `
        -Sha256 $pythonAsset.sha256 `
        -RequiredRelativePath "python.exe")

    if ($pythonReady) {
        Write-Host "[SKIP] python-embed already matches lock" -ForegroundColor Yellow
    } else {
        Write-Host "[1/3] Fetching Python embeddable runtime..." -ForegroundColor Green
        $pythonZip = Join-Path $tempDir "python-embed.zip"
        Download-VerifiedFile `
            -Url $pythonAsset.url `
            -Sha256 $pythonAsset.sha256 `
            -OutFile $pythonZip `
            -Label "python-embed"

        if (Test-Path $pythonDir) {
            Remove-Item $pythonDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
        Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
        Ensure-PythonSiteEnabled -PythonEmbedDir $pythonDir
        Write-AssetMarker `
            -Dir $pythonDir `
            -Asset "python_embed" `
            -Version $pythonAsset.version `
            -Sha256 $pythonAsset.sha256 `
            -SourceUrl $pythonAsset.url
        $pythonChanged = $true
    }

    $pythonExe = Join-Path $pythonDir "python.exe"
    if (-not (Test-Path $pythonExe)) {
        throw "python.exe is missing after extraction at $pythonExe"
    }

    if (-not $SkipPythonDeps) {
        $pipExe = Join-Path $pythonDir "Scripts\\pip.exe"
        $ytdlpExe = Join-Path $pythonDir "Scripts\\yt-dlp.exe"

        $needPipBootstrap = $Force -or $pythonChanged -or (-not (Test-Path $pipExe))
        if ($needPipBootstrap) {
            Write-Host "[2/3] Installing pip into embeddable runtime..." -ForegroundColor Green
            $getPipPath = Join-Path $tempDir "get-pip.py"
            Download-VerifiedFile `
                -Url $getPipAsset.url `
                -Sha256 $getPipAsset.sha256 `
                -OutFile $getPipPath `
                -Label "get-pip"

            & $pythonExe $getPipPath --no-warn-script-location
            if ($LASTEXITCODE -ne 0) {
                throw "get-pip installation failed with exit code $LASTEXITCODE"
            }
        } else {
            Write-Host "[SKIP] pip already available in python-embed" -ForegroundColor Yellow
        }

        $needDepsInstall = $Force -or $pythonChanged -or (-not (Test-Path $ytdlpExe))
        if ($needDepsInstall) {
            Write-Host "[3/3] Installing locked Python dependencies..." -ForegroundColor Green
            & $pythonExe -m pip install -r $requirementsFile --no-warn-script-location --quiet
            if ($LASTEXITCODE -ne 0) {
                throw "Installing Python dependencies failed with exit code $LASTEXITCODE"
            }
        } else {
            Write-Host "[SKIP] Locked Python dependencies already present" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[SKIP] Python dependency installation disabled by -SkipPythonDeps" -ForegroundColor Yellow
    }

    $ffmpegReady = (-not $Force) -and (Test-AssetReady `
        -Dir $ffmpegDir `
        -Asset "ffmpeg" `
        -Version $ffmpegAsset.version `
        -Sha256 $ffmpegAsset.sha256 `
        -RequiredRelativePath "ffmpeg.exe")

    if ($ffmpegReady) {
        Write-Host "[SKIP] ffmpeg already matches lock" -ForegroundColor Yellow
    } else {
        Write-Host "[4/4] Fetching ffmpeg runtime..." -ForegroundColor Green
        $ffmpegZip = Join-Path $tempDir "ffmpeg.zip"
        Download-VerifiedFile `
            -Url $ffmpegAsset.url `
            -Sha256 $ffmpegAsset.sha256 `
            -OutFile $ffmpegZip `
            -Label "ffmpeg"

        if (Test-Path $ffmpegDir) {
            Remove-Item $ffmpegDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null

        $ffmpegExtract = Join-Path $tempDir "ffmpeg-extract"
        Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force

        $binDir = Get-ChildItem $ffmpegExtract -Recurse -Directory |
            Where-Object { Test-Path (Join-Path $_.FullName "ffmpeg.exe") } |
            Select-Object -First 1
        if (-not $binDir) {
            throw "Failed to locate ffmpeg.exe in extracted archive."
        }

        Copy-Item "$($binDir.FullName)\\*" $ffmpegDir -Recurse -Force
        Write-AssetMarker `
            -Dir $ffmpegDir `
            -Asset "ffmpeg" `
            -Version $ffmpegAsset.version `
            -Sha256 $ffmpegAsset.sha256 `
            -SourceUrl $ffmpegAsset.url
    }

    Write-Host ""
    Write-Host "Runtime assets are ready." -ForegroundColor Green
    Write-Host "  python-embed: $pythonDir"
    Write-Host "  ffmpeg:       $ffmpegDir"
} finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
}
