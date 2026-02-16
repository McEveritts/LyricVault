# Client Archive Status

As of the Tauri migration baseline (`0.5.0`), desktop development is focused on:

- `apps/desktop` (Tauri + Solid + Rust core)

Legacy/archived client tracks still present in-repo for reference:

- `desktop_client/` (Flutter desktop prototype)
- `mobile_client/` (Flutter mobile prototype)
- `packages/lyricvault_core/` (shared Dart package)

These directories are retained to preserve history and to allow controlled extraction if needed, but they are no longer primary runtime targets in CI/release workflows.
