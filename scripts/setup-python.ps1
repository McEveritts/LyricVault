# scripts/setup-python.ps1
# Downloads and sets up an embedded Python distribution + ffmpeg for packaging.
# Run this ONCE before building the installer: npm run setup:python

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$PythonVersion = "3.12.7"  # Using 3.12 for embeddable — 3.14 embeddable may not be available yet
$PythonZipUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$GetPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$FfmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

$EmbedDir = Join-Path $ProjectRoot "python-embed"
$FfmpegDir = Join-Path $ProjectRoot "ffmpeg"
$TempDir = Join-Path $ProjectRoot "temp-setup"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LyricVault Build Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Download Python Embeddable ──────────────────────────────
if (Test-Path $EmbedDir) {
    Write-Host "[SKIP] Python embed already exists at $EmbedDir" -ForegroundColor Yellow
}
else {
    Write-Host "[1/4] Downloading Python $PythonVersion embeddable..." -ForegroundColor Green
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $pythonZip = Join-Path $TempDir "python-embed.zip"
    
    Invoke-WebRequest -Uri $PythonZipUrl -OutFile $pythonZip -UseBasicParsing
    
    Write-Host "       Extracting..." 
    Expand-Archive -Path $pythonZip -DestinationPath $EmbedDir -Force
    
    # Enable pip by uncommenting 'import site' in the ._pth file
    $pthFile = Get-ChildItem $EmbedDir -Filter "python*._pth" | Select-Object -First 1
    if ($pthFile) {
        $content = Get-Content $pthFile.FullName
        $content = $content -replace "^#import site", "import site"
        Set-Content $pthFile.FullName $content
        Write-Host "       Enabled site-packages in $($pthFile.Name)"
    }
    
    Write-Host "       Done!" -ForegroundColor Green
}

# ── Step 2: Install pip ─────────────────────────────────────────────
$pipExe = Join-Path (Join-Path $EmbedDir "Scripts") "pip.exe"
if (Test-Path $pipExe) {
    Write-Host "[SKIP] pip already installed" -ForegroundColor Yellow
}
else {
    Write-Host "[2/4] Installing pip..." -ForegroundColor Green
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $getPipPath = Join-Path $TempDir "get-pip.py"
    
    Invoke-WebRequest -Uri $GetPipUrl -OutFile $getPipPath -UseBasicParsing
    
    $pythonExe = Join-Path $EmbedDir "python.exe"
    & $pythonExe $getPipPath --no-warn-script-location
    
    Write-Host "       Done!" -ForegroundColor Green
}

# ── Step 3: Install backend dependencies ────────────────────────────
Write-Host "[3/4] Installing backend dependencies..." -ForegroundColor Green
$requirementsFile = Join-Path (Join-Path $ProjectRoot "backend") "requirements.txt"
$pythonExe = Join-Path $EmbedDir "python.exe"

& $pythonExe -m pip install -r $requirementsFile --no-warn-script-location --quiet
Write-Host "       Done!" -ForegroundColor Green

# ── Step 4: Download ffmpeg ─────────────────────────────────────────
if (Test-Path $FfmpegDir) {
    Write-Host "[SKIP] ffmpeg already exists at $FfmpegDir" -ForegroundColor Yellow
}
else {
    Write-Host "[4/4] Downloading portable ffmpeg..." -ForegroundColor Green
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $ffmpegZip = Join-Path $TempDir "ffmpeg.zip"
    
    Invoke-WebRequest -Uri $FfmpegUrl -OutFile $ffmpegZip -UseBasicParsing
    
    Write-Host "       Extracting (this may take a moment)..."
    $ffmpegTemp = Join-Path $TempDir "ffmpeg-extracted"
    Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegTemp -Force
    
    # The zip contains a nested folder like ffmpeg-7.1-essentials_build/bin/
    # We want just the bin contents
    New-Item -ItemType Directory -Path $FfmpegDir -Force | Out-Null
    $binDir = Get-ChildItem $ffmpegTemp -Recurse -Directory -Filter "bin" | Select-Object -First 1
    if ($binDir) {
        Copy-Item "$($binDir.FullName)\*" $FfmpegDir -Force
    }
    
    Write-Host "       Done!" -ForegroundColor Green
}

# ── Cleanup ─────────────────────────────────────────────────────────
if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  Python: $EmbedDir" 
Write-Host "  FFmpeg: $FfmpegDir"
Write-Host "  Run 'npm run dist' to build the installer" 
Write-Host "========================================" -ForegroundColor Cyan
