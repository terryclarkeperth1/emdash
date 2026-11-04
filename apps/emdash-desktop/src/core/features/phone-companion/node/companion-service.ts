import type { NetworkInterfaceInfo } from 'node:os';
import type { AgentEvent } from '@core/primitives/agents/api';
import { AlertFeed } from './companion-alerts';
import { generateToken } from './companion-auth';
import { findTailscaleAddress } from './companion-bind';
import { startCompanionServer, type RunningCompanionServer } from './companion-server';
import type { CompanionStore } from './companion-store';
import type { CompanionSource } from './companion-types';
import { qrToSvg } from './qr';

export const COMPANION_DEFAULT_PORT = 47615;

export type CompanionState = {
  enabled: boolean;
  running: boolean;
  /** Pairing URL including the token; present only while running. */
  url?: string;
  qrSvg?: string;
  error?: string;
};

export type CompanionServiceOptions = {
  store: CompanionStore;
  source: CompanionSource;
  /** Resolves the "task - agent" label shown in an alert. */
  describe(event: AgentEvent): Promise<string>;
  onAgentEvent(handler: (event: AgentEvent) => void): () => void;
  networkInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]>;
  port?: number;
  /** Test/dev only: bind loopback when no Tailscale address exists. */
  allowLoopbackFallback?: boolean;
  logger: { info(...a: unknown[]): void; warn(...a: unknown[]): void };
};

export class CompanionService {
  private server: RunningCompanionServer | undefined;
  private error: string | undefined;
  private readonly alerts = new AlertFeed();
  private unsubscribe: (() => void) | undefined;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: CompanionServiceOptions) {}

  /** Call at boot: starts the server only when the persisted toggle is on. */
  start(): Promise<void> {
    return this.options.store.read().enabled ? this.apply() : Promise.resolve();
  }

  async getState(): Promise<CompanionState> {
    await this.chain;
    const { enabled, token } = this.options.store.read();
    if (!this.server) {
      return { enabled, running: false, ...(this.error ? { error: this.error } : {}) };
    }
    const url = `http://${this.server.host}:${this.server.port}/?t=${token}`;
    return { enabled, running: true, url, qrSvg: qrToSvg(url) };
  }

  setEnabled(enabled: boolean): Promise<CompanionState> {
    const store = this.options.store;
    store.write({ ...store.read(), enabled });
    return this.apply().then(() => this.getState());
  }

  /** Invalidates every paired phone. */
  rotateToken(): Promise<CompanionState> {
    const store = this.options.store;
    store.write({ ...store.read(), token: generateToken() });
    return this.getState();
  }

  async dispose(): Promise<void> {
    await this.apply(true);
  }

  private apply(forceOff = false): Promise<void> {
    const run = this.chain.then(() => this.reconcile(forceOff));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async reconcile(forceOff: boolean): Promise<void> {
    const want = !forceOff && this.options.store.read().enabled;
    if (!want) {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      await this.server?.close();
      this.server = undefined;
      this.error = undefined;
      return;
    }
    if (this.server) return;
    const host =
      findTailscaleAddress(this.options.networkInterfaces()) ??
      (this.options.allowLoopbackFallback ? '127.0.0.1' : undefined);
    if (!host) {
      this.error = 'Tailscale is not connected: no 100.x address found';
      return;
    }
    try {
      this.server = await startCompanionServer({
        host,
        port: this.options.port ?? COMPANION_DEFAULT_PORT,
        getToken: () => this.options.store.read().token,
        source: this.options.source,
        alerts: this.alerts,
      });
      this.error = undefined;
      this.unsubscribe = this.options.onAgentEvent((event) => {
        void this.options.describe(event).then((title) => this.alerts.push(event, title));
      });
      this.options.logger.info('phone companion listening', { host, port: this.server.port });
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.options.logger.warn('phone companion failed to start', { error: this.error });
    }
  }
}
