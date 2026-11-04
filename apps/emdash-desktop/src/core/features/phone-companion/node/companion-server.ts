import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AlertFeed } from './companion-alerts';
import { bearerToken, FailureLimiter, tokensEqual } from './companion-auth';
import { assertSafeBindHost } from './companion-bind';
import { COMPANION_PAGE } from './companion-page';
import { MAX_MESSAGE_LENGTH, type CompanionSource } from './companion-types';

export type CompanionServerOptions = {
  host: string;
  port: number;
  getToken: () => string;
  source: CompanionSource;
  alerts: AlertFeed;
};

export type RunningCompanionServer = {
  host: string;
  port: number;
  close(): Promise<void>;
};

const MAX_BODY_BYTES = 16 * 1024;
const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
} as const;

function send(res: ServerResponse, status: number, body: string, type = 'text/plain'): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': `${type}; charset=utf-8` });
  res.end(body);
}

const sendJson = (res: ServerResponse, status: number, body: unknown) =>
  send(res, status, JSON.stringify(body), 'application/json');

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/** Strip control characters so a message can never inject escape sequences into the PTY. */
export function sanitizeMessage(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  // oxlint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
  if (!clean || clean.length > MAX_MESSAGE_LENGTH) return null;
  return clean;
}

export async function startCompanionServer(
  options: CompanionServerOptions
): Promise<RunningCompanionServer> {
  assertSafeBindHost(options.host);
  const limiter = new FailureLimiter();
  let allowedHosts = new Set<string>();

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Host check is defence in depth against DNS rebinding; the token is the real gate.
    if (!allowedHosts.has((req.headers.host ?? '').toLowerCase())) {
      return send(res, 421, 'Misdirected request');
    }
    if (limiter.isLocked()) return send(res, 429, 'Too many attempts');
    const url = new URL(req.url ?? '/', 'http://companion.invalid');
    const presented = bearerToken(req.headers.authorization) ?? url.searchParams.get('t') ?? '';
    if (!tokensEqual(options.getToken(), presented)) {
      limiter.recordFailure();
      return send(res, 401, 'Unauthorized');
    }

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, COMPANION_PAGE, 'text/html');
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const since = Number(url.searchParams.get('since') ?? 0) || 0;
      return sendJson(res, 200, {
        sessions: (await options.source.listSessions()).map((s) => options.alerts.decorate(s)),
        alerts: options.alerts.since(since),
        lastAlertId: options.alerts.lastId,
      });
    }
    const message = /^\/api\/sessions\/([^/]+)\/message$/.exec(url.pathname);
    if (req.method === 'POST' && message) {
      // Writes need the Authorization header (cross-site forms cannot set it), never a bare ?t=.
      if (!bearerToken(req.headers.authorization)) return send(res, 401, 'Unauthorized');
      const raw = await readBody(req);
      let text: string | null = null;
      try {
        text = raw === null ? null : sanitizeMessage((JSON.parse(raw) as { text?: unknown }).text);
      } catch {
        text = null;
      }
      if (text === null) return sendJson(res, 400, { ok: false, error: 'Invalid message' });
      const id = decodeURIComponent(message[1] ?? '');
      return sendJson(res, 200, await options.source.sendMessage(id, text));
    }
    return send(res, 404, 'Not found');
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 'Server error');
      else res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  allowedHosts = new Set([`${options.host}:${port}`.toLowerCase()]);

  return {
    host: options.host,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
