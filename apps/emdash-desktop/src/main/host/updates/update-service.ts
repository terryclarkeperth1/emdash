import type { Disposable } from '@emdash/shared/concurrency';
import type { DesktopUpdateState } from '@core/features/updates/api';
import { resolveAppVersion } from '@main/core/app/utils';

// This fork never checks for, downloads or installs upstream releases: a build
// is only ever replaced by building it again from source.
const UPDATES_DISABLED = 'Updates are disabled in this build';

export interface UpdateNotificationPublisher {
  available(version: string): void;
  downloaded(version: string): void;
  error(message: string): void;
}

export class UpdateService implements Disposable {
  private updateState: DesktopUpdateState = { status: 'idle', currentVersion: 'unknown' };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.updateState.currentVersion = await resolveAppVersion();
  }

  setNotificationPublisher(_publisher: UpdateNotificationPublisher): void {}

  async checkForUpdates(): Promise<null> {
    return null;
  }

  downloadUpdate(): void {
    throw new Error(UPDATES_DISABLED);
  }

  quitAndInstall(): void {
    throw new Error(UPDATES_DISABLED);
  }

  async fetchReleaseNotes(): Promise<string | null> {
    return null;
  }

  getState(): DesktopUpdateState {
    return { ...this.updateState };
  }

  get isInstallRequested(): boolean {
    return false;
  }

  get isActive(): boolean {
    return false;
  }

  dispose(): void {}
}

export const updateService = new UpdateService();
