# v0.3.5 Publish Runbook (Staged)

## Preconditions
- Working tree is clean for release commit.
- Artifacts exist in `release/`.
- You have push access to `origin`.

## 1) Verify Artifacts and Checksums
```powershell
Get-ChildItem release | Where-Object { $_.Name -like '*0.3.5*' }
Get-Content release/SHA256SUMS-v0.3.5.txt
Get-Content release_checksums_v0.3.5.txt
```

## 2) Commit Release Metadata
```powershell
git add CHANGELOG.md README.md package.json package-lock.json frontend/package.json frontend/package-lock.json backend/main.py electron/preload.js frontend/src/components/SettingsView.jsx release_notes_v0.3.5.md release_publish_v0.3.5.md smoke_test_v0.3.5.md release_checksums_v0.3.5.txt
git commit -m "release: finalize v0.3.5 metadata and checksums"
```

## 3) Tag Handling
- Option A (create new tag):
```powershell
git tag -a v0.3.5 -m "LyricVault v0.3.5"
```

- Option B (if tag already exists and must be retargeted):
```powershell
git tag -d v0.3.5
git tag -a v0.3.5 -m "LyricVault v0.3.5"
```

## 4) Push Branch + Tag
```powershell
git push origin HEAD
git push origin v0.3.5 --force
```

## 5) Create GitHub Release (Web UI)
1. Open: https://github.com/McEveritts/LyricVault/releases/new
2. Tag: `v0.3.5`
3. Title: `LyricVault v0.3.5`
4. Notes: paste `release_notes_v0.3.5.md`
5. Upload assets:
   - `release/LyricVault Setup 0.3.5.exe`
   - `release/LyricVault 0.3.5.exe`
   - `release/SHA256SUMS-v0.3.5.txt`
6. Publish release.
