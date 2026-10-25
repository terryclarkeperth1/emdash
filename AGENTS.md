# Emdash (Terry's fork)

Terry's hardened fork of Emdash (upstream `generalaction/emdash`), an Electron app that runs AI coding agents in parallel, one Git worktree per task. Remote `terryclarkeperth1/emdash`, branch `claude/security-hardening-16bc9d`, run as a dev setup from `C:\Emdash`.

## Rules
- The upstream engineering guide is `agents/UPSTREAM.md`: read it before touching code, and the matching `agents/` page for the area.
- Keep the hardening: no updater, telemetry off, no feedback relay or account sign-in, Claude hooks only via `--settings`, no `~/.claude.json` trust writes, no automatic remote installs or download-and-run installers, wire ports only to the renderer's top frame, no Azure signing or publish.
- Defaults follow Terry's Claude desktop setup (dark theme, PTY auto-approve on, branch prefix `claude`, no push on create, `pwsh` terminals); Claude desktop wins where they differ.
- Upstream is remote `upstream` (fetch only; push is disabled). Taking their fixes: `git fetch upstream --tags`, `git merge upstream/main` (or `git cherry-pick <sha>` for a single fix) on this branch; keep each fork change its own commit so conflicts stay small; then rerun the dependency scan (Trivy on `pnpm-lock.yaml`, OSV for `MAL-`) before the next launch.
- No release workflows, publishing or signing.

## Run
From `C:\Emdash\apps\emdash-desktop`: `pnpm run dev`. Debug log: `apps\emdash-desktop\.emdash-logs\emdash.log` (`LOG_LEVEL=debug`).

## Tests
- Push gate: runs only the vitest files a change reaches, plus the touched package's nx typecheck (about 20-40 s).
- Full suite on Linux (upstream's CI platform; 4 failures were ours and are fixed, 0 left): Ubuntu-24.04 WSL clone `~/emdash`, pnpm at `~/.local/bin/pnpm`. `wsl -d Ubuntu-24.04 --cd ~ -- bash -lc 'export PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin NX_DAEMON=false; cd emdash && git fetch -q /mnt/c/Emdash claude/security-hardening-16bc9d && git reset -q --hard FETCH_HEAD && pnpm exec nx run-many -t test --all'; wsl --shutdown` (core 17 s, desktop 44 s). `NX_DAEMON=false` leaves no Nx helper behind, and `wsl --shutdown` stops the VM, so the fans settle.
- On Windows the same suite has 331 upstream failures (POSIX paths, shells); a test fixed for Windows keeps its Linux behaviour.

## Core files
- `apps/emdash-desktop/src/core/features/*/contributions/settings.ts`: app setting defaults.
- `apps/emdash-desktop/src/core/features/conversations/api/provider-settings.ts`: per-agent auto-approve default.
- `apps/emdash-desktop/package.json`: `dev` script and log env; `.npmrc` `shell-emulator=true` makes it run on Windows.
- `packages/plugins/src/agents/impl/`: agent providers (Claude, Codex).
