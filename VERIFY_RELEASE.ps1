param(
    [string]$ChecksumsFile = "release_checksums_v0.4.4.txt"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSCommandPath
$ReleaseDir = Join-Path $ProjectRoot "release"

if ([System.IO.Path]::IsPathRooted($ChecksumsFile)) {
    $ResolvedChecksums = $ChecksumsFile
}
else {
    $candidate1 = Join-Path $ProjectRoot $ChecksumsFile
    $candidate2 = Join-Path $ReleaseDir $ChecksumsFile
    if (Test-Path $candidate1) {
        $ResolvedChecksums = $candidate1
    }
    elseif (Test-Path $candidate2) {
        $ResolvedChecksums = $candidate2
    }
    else {
        throw "Could not resolve checksums file: $ChecksumsFile"
    }
}

Write-Host "Using checksums file: $ResolvedChecksums"

$lines = Get-Content $ResolvedChecksums | Where-Object { $_ -and -not $_.TrimStart().StartsWith('#') }
if (-not $lines) {
    throw "No checksum entries found in $ResolvedChecksums"
}

$failures = @()
foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed -notmatch '^([A-Fa-f0-9]{64})\s+\*(.+)$') {
        $failures += "Unrecognized checksum line format: $trimmed"
        continue
    }

    $expected = $matches[1].ToUpperInvariant()
    $fileName = $matches[2].Trim()

    $artifactPath = Join-Path $ReleaseDir $fileName
    if (-not (Test-Path $artifactPath)) {
        $artifactPath = Join-Path $ProjectRoot $fileName
    }
    if (-not (Test-Path $artifactPath)) {
        $failures += "Missing artifact: $fileName"
        continue
    }

    $actual = (Get-FileHash -Algorithm SHA256 -Path $artifactPath).Hash.ToUpperInvariant()
    if ($actual -ne $expected) {
        $failures += "Checksum mismatch for '$fileName'`n  expected: $expected`n  actual:   $actual"
        continue
    }

    Write-Host "[OK] $fileName"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Verification failed:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host ""
Write-Host "All release artifacts verified successfully." -ForegroundColor Green
