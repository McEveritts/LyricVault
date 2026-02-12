$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$Candidates = @(
    (Join-Path $ProjectRoot "backend\venv\Scripts\python.exe"),
    (Join-Path $ProjectRoot "python-embed\python.exe")
)

$PythonExe = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $PythonExe) {
    $PythonExe = "python"
}

Write-Host "Using Python: $PythonExe"
& $PythonExe -m pip install --upgrade yt-dlp

$SmokeScript = @'
import yt_dlp

print(f"yt-dlp version: {yt_dlp.version.__version__}")
opts = {"quiet": True, "skip_download": True, "noplaylist": True, "socket_timeout": 15}
with yt_dlp.YoutubeDL(opts) as ydl:
    info = ydl.extract_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ", download=False)
if not info:
    raise SystemExit("Smoke check failed: no metadata returned")
print("Smoke check passed.")
'@

$SmokeScript | & $PythonExe -
Write-Host "yt-dlp update complete."
