// Runs the tests of every package this commit changes against its upstream on Linux (WSL Ubuntu-24.04, upstream's CI platform) for the commit
// checked out here, then prints one testkit-native-result.v1 JSON line for the push check.
// Windows has ~331 upstream failures (POSIX paths, shells), so the push check runs the suite here instead.
// Browser tests are skipped as in upstream CI (vitest.config.ts): under WSL Chromium they time out at random.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Every run resets the one WSL clone and ends with `wsl --shutdown`, so two runs at once (two pushes, a commit
// check beside a push check) reset each other's files and kill each other's tests: random failures. One run at a time.
const LOCK = join(tmpdir(), 'emdash-linux-suite.lock');
const LOCK_WAIT_MS = 25 * 60 * 1000;
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const deadline = Date.now() + LOCK_WAIT_MS;
for (;;) {
  try {
    mkdirSync(LOCK);
    writeFileSync(join(LOCK, 'pid'), String(process.pid));
    break;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let pid = NaN;
    try {
      pid = Number(readFileSync(join(LOCK, 'pid'), 'utf8'));
    } catch {}
    if (pid && !alive(pid)) {
      rmSync(LOCK, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(`linux-suite: another run (pid ${pid}) held ${LOCK} for ${LOCK_WAIT_MS / 1000} s`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}
process.on('exit', () => rmSync(LOCK, { recursive: true, force: true }));

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// The push check passes the pushed base; without it (first push) every package runs.
const base = process.env.TESTKIT_BASE;
const script = [
  'export PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin NX_DAEMON=false EMDASH_TEST_SKIP_BROWSER=1',
  'cd ~/emdash',
  `git fetch -q /mnt/c/Emdash ${base ?? ''} ${sha}`,
  `git reset -q --hard ${sha}`,
  'pnpm install --frozen-lockfile --silent',
  base
    ? `pnpm exec nx affected -t test --base=${base} --head=${sha} --output-style=static`
    : 'pnpm exec nx run-many -t test --all --output-style=static',
].join(' && ');

const run = spawnSync('wsl', ['-d', 'Ubuntu-24.04', '--cd', '~', '--', 'bash', '-lc', script], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  windowsHide: true,
});
spawnSync('wsl', ['--shutdown'], { windowsHide: true });

const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
process.stderr.write(out.slice(-20000));

const counts = { passed: 0, failed: 0, errors: 0, skipped: 0 };
for (const line of out.split('\n')) {
  const m = line.match(/^\s*Tests\s+(.*)\(\d+\)\s*$/);
  if (!m) continue;
  for (const part of m[1].split('|')) {
    const [, n, kind] = part.trim().match(/^(\d+)\s+(\w+)/) ?? [];
    if (kind === 'passed') counts.passed += Number(n);
    else if (kind === 'failed') counts.failed += Number(n);
    else if (kind === 'skipped' || kind === 'todo') counts.skipped += Number(n);
  }
}
if (run.error || run.status !== 0) counts.errors += counts.failed ? 0 : 1;

const failures = out.split('\n').filter((l) => /^\s*(FAIL|×)\s/.test(l)).map((l) => l.trim()).slice(0, 50);
console.log(
  JSON.stringify({
    schema_id: 'testkit-native-result.v1',
    passed: run.status === 0 && !counts.failed && !counts.errors,
    counts,
    failures,
  })
);
process.exit(run.status === 0 ? 0 : 1);
