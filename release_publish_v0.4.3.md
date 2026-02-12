# v0.4.3 Publish Runbook (Staged)

## Preconditions
- Working tree is clean for release commit.
- Artifacts exist in `release/`.
- You have push access to `origin`.

## 1) Verify Artifacts and Checksums
```powershell
Get-ChildItem release | Where-Object { $_.Name -like '*0.4.3*' }
Get-Content release/SHA256SUMS-v0.4.3.txt
Get-Content release_checksums_v0.4.3.txt
.\VERIFY_RELEASE.ps1 -ChecksumsFile release_checksums_v0.4.3.txt
```

If `release/SHA256SUMS-v0.4.3.txt` does not exist yet, generate hashes locally:
```powershell
Get-FileHash -Algorithm SHA256 "release/LyricVault Setup 0.4.3.exe","release/LyricVault 0.4.3.exe" |
  ForEach-Object { "{0} *{1}" -f $_.Hash.ToUpperInvariant(), (Split-Path $_.Path -Leaf) } |
  Tee-Object -FilePath "release/SHA256SUMS-v0.4.3.txt" |
  Set-Content "release_checksums_v0.4.3.txt"
```

## 1.1) Security Trust Evidence (Before Publish)
- Run Windows Defender scan against:
  - `release/LyricVault Setup 0.4.3.exe`
  - `release/LyricVault 0.4.3.exe`
- Run VirusTotal upload/scan and capture report links.
- Attach scan evidence links in release notes draft/internal report.

## 2) Commit Release Metadata
```powershell
git add CHANGELOG.md README.md package.json package-lock.json frontend/package.json frontend/package-lock.json backend/main.py backend/services/lyricist.py backend/services/settings_service.py backend/tests/test_verify_release.py electron/preload.js frontend/src/App.jsx frontend/src/components/LibraryGrid.jsx frontend/src/components/LyricsOverlay.jsx frontend/src/components/Player.jsx frontend/src/components/SettingsView.jsx frontend/src/components/Sidebar.jsx frontend/src/components/VisualizerDeck.jsx release_notes_v0.4.3.md release_publish_v0.4.3.md smoke_test_v0.4.3.md release_checksums_v0.4.3.txt VERIFY_RELEASE.ps1
git commit -m "release: finalize v0.4.3 metadata and checksums"
```

## 3) Tag Handling
- Option A (create new tag):
```powershell
git tag -a v0.4.3 -m "LyricVault v0.4.3"
```

- Option B (if tag already exists and must be retargeted):
```powershell
git tag -d v0.4.3
git tag -a v0.4.3 -m "LyricVault v0.4.3"
```

## 4) Push Branch + Tag
```powershell
git push origin HEAD
git push origin v0.4.3 --force
```

## 5) Create GitHub Release (Web UI)
1. Open: https://github.com/McEveritts/LyricVault/releases/new
2. Tag: `v0.4.3`
3. Title: `LyricVault v0.4.3`
4. Notes: paste `release_notes_v0.4.3.md`
5. Upload assets:
   - `release/LyricVault Setup 0.4.3.exe`
   - `release/LyricVault 0.4.3.exe`
   - `release/SHA256SUMS-v0.4.3.txt`
6. Publish release.
