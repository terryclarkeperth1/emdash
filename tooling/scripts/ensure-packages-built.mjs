/**
 * Builds the workspace packages before a flow that bypasses Nx task
 * orchestration — app-only dev (`pnpm run dev` from apps/emdash-desktop) and
 * Storybook run their underlying tool directly, so on a never-built clone the
 * workspace `dist/` outputs their imports resolve to would not exist yet.
 *
 * When the calling script is itself executed as an Nx task (root `pnpm run
 * dev`, `nx storybook @emdash/ui`, ...), Nx's `^build` dependency wiring has
 * already ordered the builds, so this exits immediately. Warm re-runs are Nx
 * cache hits and cost around a second.
 */
import { spawnSync } from 'node:child_process';

if (process.env.NX_TASK_TARGET_PROJECT) {
  process.exit(0);
}

// Under `pnpm run`, re-enter pnpm through its own script with this Node: on Windows the
// `pnpm.cmd` shim, reached through cmd, resolves the devEngines `node.CMD` shim against the
// wrong folder ("The system cannot find the path specified").
const pnpmScript = process.env.npm_execpath;
const viaNode = Boolean(pnpmScript && /\.c?js$/.test(pnpmScript));
const result = spawnSync(
  viaNode ? process.execPath : 'pnpm',
  [
    ...(viaNode ? [pnpmScript] : []),
    'exec',
    'nx',
    'run-many',
    '-t',
    'build',
    '--exclude',
    '@emdash/emdash-desktop,@emdash/workspace-server',
  ],
  { stdio: 'inherit', shell: !viaNode && process.platform === 'win32' }
);
process.exit(typeof result.status === 'number' ? result.status : 1);
