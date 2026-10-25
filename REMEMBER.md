# REMEMBER — Emdash

## Data
- App data (SQLite DBs, settings): `%APPDATA%\emdash-dev`. Launched from inside the Claude desktop app it lands in Claude's sandbox copy instead: `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\emdash-dev`.
- Worktrees: `%USERPROFILE%\.emdash\worktrees`.
- Electron binary: `node_modules\electron\dist\electron.exe` (unsigned upstream; fetched by `node node_modules/electron/install.js`).

## Network
- Dev server `localhost:3000`; otherwise only agent provider and GitHub hosts.

## Traps
- pnpm run through `node .../pnpm.cjs` breaks nested `pnpm exec`; use the global `pnpm` via `cmd /c`.
- `pnpm exec tsc` on the app crashes (stack overflow); use the nx typecheck target.
- A background launch is killed at its time limit; Electron children can outlive `cmd`: kill processes whose path is under `C:\Emdash`.
