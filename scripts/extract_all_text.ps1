$includeExtensions = @(".js", ".py", ".html", ".css", ".svg", ".md", ".txt", ".json", ".yml", ".yaml", ".ps1")
$excludeDirectories = @(".git", "node_modules", "python-embed", "ffmpeg", "downloads", "release", "venv", "__pycache__")
$outputFile = "LyricVault_Full_Text.txt"
$rootPath = Resolve-Path "."

if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

$files = Get-ChildItem -Path $rootPath -Recurse -File | Where-Object {
    $filePath = $_.FullName
    $extension = $_.Extension
    
    $shouldInclude = $includeExtensions -contains $extension
    $shouldExclude = $false
    
    foreach ($dir in $excludeDirectories) {
        if ($filePath -like "*\$dir\*") {
            $shouldExclude = $true
            break
        }
    }
    
    $shouldInclude -and -not $shouldExclude -and ($_.Name -ne $outputFile)
}

foreach ($file in $files) {
    $relativeName = $file.FullName.Replace($rootPath.Path + "\", "")
    "================================================================================" | Out-File -FilePath $outputFile -Append
    "FILE: $relativeName" | Out-File -FilePath $outputFile -Append
    "================================================================================" | Out-File -FilePath $outputFile -Append
    Get-Content $file.FullName | Out-File -FilePath $outputFile -Append
    "`n" | Out-File -FilePath $outputFile -Append
}

Write-Host "Extraction complete. Output saved to $outputFile"
