# LyricVault Desktop (Tauri + Solid)

This app is the new desktop client runtime for LyricVault.

## Commands

- `npm run dev` - run Solid dev server (port `1420`)
- `npm run tauri:dev` - run full Tauri desktop app
- `npm run build` - build frontend bundle
- `npm run tauri:build` - build desktop installer artifacts

## Architecture

- `src/` - SolidJS renderer
- `src/lib/ipc.ts` - typed IPC wrappers over Tauri invoke
- `src-tauri/` - Rust core bridge and protocol/event wiring

## Runtime Notes

- Desktop no longer uses localhost HTTP as its primary contract.
- Audio playback sources are surfaced as `lvmedia://` URLs.
- Backend compatibility is provided through Rust IPC commands.
