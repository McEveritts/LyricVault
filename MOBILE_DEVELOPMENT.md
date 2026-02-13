# Mobile Development Split (Flutter)

Desktop (Electron/React) and Mobile (Flutter) development are split to avoid build + dependency confusion.

## Desktop (current repo folder)

- Path: `Antigravity` (this directory)
- Versioning: root `package.json` (currently `0.4.8`)
- Build: `npm run dev`, `npm run dist`

## Mobile (separate git worktree)

- Path: `Antigravity_mobile` (sibling worktree)
- Branch: `mobile/v4.5.0`
- Versioning: `mobile_client/pubspec.yaml` (currently `4.5.0+1`)

### Why a worktree?

- Keeps Node/Python desktop build outputs and Flutter build outputs separated by folder.
- Lets you switch contexts without stashing or accidentally mixing version bumps.

