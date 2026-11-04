import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertFeed } from './companion-alerts';
import { assertSafeBindHost, findTailscaleAddress, isTailscaleAddress } from './companion-bind';
import { startCompanionServer, type RunningCompanionServer } from './companion-server';
import type { CompanionSource } from './companion-types';

const TOKEN = 'a'.repeat(43);
const session = {
  id: 'c1',
  title: 'Claude',
  task: 'Fix bug',
  project: 'app',
  provider: 'claude',
  status: 'working' as const,
  canMessage: true,
  updatedAt: null,
};

describe('companion bind address', () => {
  it('refuses wildcard and public addresses', () => {
    for (const host of [
      '0.0.0.0',
      '::',
      '',
      '192.168.1.5',
      '8.8.8.8',
      '100.63.0.1',
      '100.128.0.1',
    ]) {
      expect(() => assertSafeBindHost(host)).toThrow();
    }
  });

  it('accepts Tailscale and loopback addresses', () => {
    for (const host of ['100.94.133.88', '100.64.0.1', '100.127.255.254', '127.0.0.1']) {
      expect(() => assertSafeBindHost(host)).not.toThrow();
    }
  });

  it('finds the Tailscale address among interfaces', () => {
    const iface = (address: string) => ({
      address,
      family: 'IPv4' as const,
      internal: false,
      netmask: '',
      mac: '',
      cidr: null,
    });
    expect(
      findTailscaleAddress({ eth: [iface('192.168.0.2')], Tailscale: [iface('100.94.133.88')] })
    ).toBe('100.94.133.88');
    expect(findTailscaleAddress({ eth: [iface('192.168.0.2')] })).toBeUndefined();
    expect(isTailscaleAddress('100.94.133.88')).toBe(true);
  });
});

describe('companion server', () => {
  let server: RunningCompanionServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function start() {
    const alerts = new AlertFeed();
    const source: CompanionSource = {
      listSessions: async () => [session],
      sendMessage: vi.fn(async () => ({ ok: true as const })),
    };
    server = await startCompanionServer({
      host: '127.0.0.1',
      port: 0,
      getToken: () => TOKEN,
      source,
      alerts,
    });
    return { base: `http://127.0.0.1:${server.port}`, source, alerts };
  }
  const auth = { Authorization: `Bearer ${TOKEN}` };

  it('refuses to start on 0.0.0.0', async () => {
    await expect(
      startCompanionServer({
        host: '0.0.0.0',
        port: 0,
        getToken: () => TOKEN,
        source: { listSessions: async () => [], sendMessage: async () => ({ ok: true }) },
        alerts: new AlertFeed(),
      })
    ).rejects.toThrow(/refuses to bind/);
  });

  it('rejects every route without a valid token', async () => {
    const { base } = await start();
    for (const [method, path] of [
      ['GET', '/'],
      ['GET', '/api/state'],
      ['POST', '/api/sessions/c1/message'],
    ] as const) {
      expect((await fetch(base + path, { method })).status).toBe(401);
      expect(
        (await fetch(base + path, { method, headers: { Authorization: 'Bearer wrong' } })).status
      ).toBe(401);
      expect((await fetch(`${base}${path}?t=wrong`, { method })).status).toBe(401);
    }
  });

  it('serves the page and state with the token', async () => {
    const { base, alerts } = await start();
    const page = await fetch(`${base}/?t=${TOKEN}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(await page.text()).toContain('<title>Emdash</title>');

    alerts.push(
      { type: 'stop', projectId: 'p', taskId: 't', conversationId: 'c1', timestamp: 1, payload: {} },
      'Fix bug - Claude'
    );
    const state = await (await fetch(`${base}/api/state?since=0`, { headers: auth })).json();
    expect(state.sessions).toEqual([session]);
    expect(state.alerts).toMatchObject([{ kind: 'done', conversationId: 'c1' }]);
    expect(state.lastAlertId).toBe(1);
  });

  it('forwards sanitized messages and requires the bearer header for writes', async () => {
    const { base, source } = await start();
    const post = (headers: Record<string, string>, text: unknown, query = '') =>
      fetch(`${base}/api/sessions/c1/message${query}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

    expect((await post({}, 'hi', `?t=${TOKEN}`)).status).toBe(401);
    expect((await post(auth, 'run \u001b[31m tests\r\nnow')).status).toBe(200);
    expect(source.sendMessage).toHaveBeenCalledWith('c1', 'run  [31m tests  now');
    expect((await post(auth, '')).status).toBe(400);
    expect((await post(auth, 'x'.repeat(4001))).status).toBe(400);
    expect((await post(auth, 42)).status).toBe(400);
  });

  it('rejects a foreign Host header', async () => {
    const { base } = await start();
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        `${base}/api/state`,
        { headers: { ...auth, Host: 'evil.example:80' } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        }
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(421);
  });

  it('locks out after repeated bad tokens', async () => {
    const { base } = await start();
    for (let i = 0; i < 10; i++) await fetch(`${base}/api/state`);
    expect((await fetch(`${base}/api/state`, { headers: auth })).status).toBe(429);
  });
});
