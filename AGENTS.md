# Emdash (Terry's fork)

Terry's hardened fork of Emdash (upstream `generalaction/emdash`), an Electron app that runs AI coding agents in parallel, one Git worktree per task. Remote `terryclarkeperth1/emdash`, branch `claude/security-hardening-16bc9d`, run as a dev setup from `C:\Emdash`.

## Rules
- The upstream engineering guide is `agents/UPSTREAM.md`: read it before touching code, and the matching `agents/` page for the area.
- Keep the hardening: no updater, telemetry off, no feedback relay or account sign-in, Claude hooks only via `--settings`, no `~/.claude.json` trust writes, no automatic remote installs or download-and-run installers, wire ports only to the renderer's top frame, no Azure signing or publish.
- Defaults follow Terry's Claude desktop setup (dark theme, PTY auto-approve on, branch prefix `claude`, no push on create, `pwsh` terminals); Claude desktop wins where they differ.
- Pulling upstream: merge onto this branch, then rerun the dependency scan (Trivy on `pnpm-lock.yaml`, OSV for `MAL-`) before the next launch.
- No release workflows, publishing or signing.

## Run
From `C:\Emdash\apps\emdash-desktop`: `pnpm run dev`. Debug log: `apps\emdash-desktop\.emdash-logs\emdash.log` (`LOG_LEVEL=debug`).

## Tests
`cmd /c "pnpm exec nx run-many -t typecheck --all"`; tests `cmd /c "pnpm exec nx run-many -t test --all --output-style=static"` (187 Windows failures match the upstream baseline at `e21cd3d84`).

## Core files
- `apps/emdash-desktop/src/core/features/*/contributions/settings.ts`: app setting defaults.
- `apps/emdash-desktop/src/core/features/conversations/api/provider-settings.ts`: per-agent auto-approve default.
- `apps/emdash-desktop/package.json`: `dev` script and log env; `.npmrc` `shell-emulator=true` makes it run on Windows.
- `packages/plugins/src/agents/impl/`: agent providers (Claude, Codex).
