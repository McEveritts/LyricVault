Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot "backend\\venv\\Scripts\\python.exe"

$python = $null
if (Test-Path $venvPython) {
  $python = $venvPython
} else {
  $python = "python"
}

Write-Host "Using python: $python"

$lockFile = Join-Path $repoRoot "backend\\requirements.lock.txt"
if (-not (Test-Path $lockFile)) {
  throw "Missing backend\\requirements.lock.txt. Generate it from the backend venv."
}

# Run audit in an isolated temporary venv so we don't mutate the project's backend venv.
$auditVenv = Join-Path $env:TEMP ("lyricvault_audit_venv_" + [guid]::NewGuid().ToString("N"))
& $python -m venv $auditVenv | Out-Null

$auditPython = Join-Path $auditVenv "Scripts\\python.exe"
try {
  & $auditPython -m pip install --upgrade pip | Out-Null
  & $auditPython -m pip install pip-audit | Out-Null
  & $auditPython -m pip_audit -r $lockFile
} finally {
  Remove-Item -Recurse -Force $auditVenv -ErrorAction SilentlyContinue
}
