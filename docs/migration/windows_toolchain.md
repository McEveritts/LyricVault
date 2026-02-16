# Windows Toolchain Recovery (Tauri + Rust)

Use this checklist when desktop builds fail due missing `cargo`, `link.exe`, or runtime assets.

## 1) Validate environment

```powershell
npm run doctor:desktop-env
```

## 2) Ensure Cargo is available

- If Rust is installed but `cargo` is not found, add `C:\Users\<you>\.cargo\bin` to `PATH`.
- Restart terminal and verify:

```powershell
cargo --version
```

## 3) Ensure MSVC linker is available

- Open **Visual Studio Installer**.
- Modify **Build Tools 2022** (or newer).
- Install workload: **Desktop development with C++**.
- If `link.exe` exists but is not on `PATH`, use the root wrapper command:

```powershell
npm run tauri build
```

The wrapper loads the Visual Studio developer environment automatically.

## 4) Ensure runtime assets are pinned and present

```powershell
npm run runtime:fetch
```

This downloads and verifies:
- `python-embed` (pinned by `scripts/runtime-assets.lock.json`)
- `ffmpeg` (pinned by `scripts/runtime-assets.lock.json`)

## 5) Re-run build validation

```powershell
cargo check --workspace
npm run tauri build
npm run dist
```

If this passes, local desktop build parity is restored.
