import { describe, expect, it, vi } from 'vitest';
import { UpdateService } from './update-service';

vi.mock('@main/core/app/utils', () => ({ resolveAppVersion: async () => '1.2.5' }));

describe('disabled update service', () => {
  it('never checks, downloads or installs a release', async () => {
    const service = new UpdateService();
    await service.initialize();
    expect(service.isActive).toBe(false);
    expect(await service.checkForUpdates()).toBeNull();
    expect(() => service.downloadUpdate()).toThrow('Updates are disabled in this build');
    expect(() => service.quitAndInstall()).toThrow('Updates are disabled in this build');
    expect(service.isInstallRequested).toBe(false);
    expect(service.getState()).toEqual({ status: 'idle', currentVersion: '1.2.5' });
  });
});
