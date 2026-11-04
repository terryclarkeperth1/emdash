import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@core/primitives/agents/api';
import { alertKind } from './companion-alerts';
import { CompanionService } from './companion-service';
import { CompanionStore } from './companion-store';

const dirs: string[] = [];
let service: CompanionService | undefined;
afterEach(async () => {
  await service?.dispose();
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
  dirs.length = 0;
});

function make(loopback = true) {
  const dir = mkdtempSync(join(tmpdir(), 'companion-'));
  dirs.push(dir);
  const file = join(dir, 'companion.json');
  let handler: (e: AgentEvent) => void = () => {};
  const created = new CompanionService({
    store: new CompanionStore(file),
    source: { listSessions: async () => [], sendMessage: async () => ({ ok: true }) },
    describe: async () => 'Task - Claude',
    onAgentEvent: (h) => {
      handler = h;
      return () => {};
    },
    networkInterfaces: () => ({}),
    port: 0,
    allowLoopbackFallback: loopback,
    logger: { info: vi.fn(), warn: vi.fn() },
  });
  service = created;
  return { service: created, file, emit: (e: AgentEvent) => handler(e) };
}

const event = (type: AgentEvent['type'], payload: AgentEvent['payload'] = {}): AgentEvent => ({
  type,
  projectId: 'p',
  taskId: 't',
  conversationId: 'c1',
  timestamp: 1,
  payload,
});

describe('CompanionService', () => {
  it('is off by default and does not listen', async () => {
    const { service } = make();
    await service.start();
    expect(await service.getState()).toEqual({ enabled: false, running: false });
  });

  it('starts when enabled, pairs with a token url, rotates, and stops when disabled', async () => {
    const { service, file } = make();
    const on = await service.setEnabled(true);
    expect(on.running).toBe(true);
    expect(on.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]{43}$/);
    expect(on.qrSvg).toContain('<svg');
    expect(JSON.parse(readFileSync(file, 'utf8')).enabled).toBe(true);

    const token = on.url!.split('t=')[1]!;
    const base = on.url!.split('/?')[0]!;
    expect((await fetch(`${base}/api/state`)).status).toBe(401);
    expect((await fetch(`${base}/api/state?t=${token}`)).status).toBe(200);

    const rotated = await service.rotateToken();
    expect(rotated.url).not.toContain(token);
    expect((await fetch(`${base}/api/state?t=${token}`)).status).toBe(401);

    expect(await service.setEnabled(false)).toEqual({ enabled: false, running: false });
    await expect(fetch(`${base}/api/state`)).rejects.toThrow();
  });

  it('records done, error and attention events as alerts but not start events', async () => {
    const { service, emit } = make();
    const on = await service.setEnabled(true);
    const base = on.url!.split('/?')[0]!;
    const token = on.url!.split('t=')[1]!;
    expect(alertKind(event('start'))).toBeNull();
    emit(event('start'));
    emit(event('stop'));
    emit(event('notification', { notificationType: 'permission_prompt', message: 'Allow Bash?' }));
    emit(event('error', { message: 'boom' }));
    await vi.waitFor(async () => {
      const state = await (await fetch(`${base}/api/state?since=0&t=${token}`)).json();
      expect(state.alerts.map((a: { kind: string }) => a.kind)).toEqual([
        'done',
        'needs-input',
        'error',
      ]);
    });
  });

  it('reports a clear error when Tailscale is absent and loopback fallback is off', async () => {
    const { service } = make(false);
    const state = await service.setEnabled(true);
    expect(state.running).toBe(false);
    expect(state.error).toMatch(/Tailscale/);
  });
});
