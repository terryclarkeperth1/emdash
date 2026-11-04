import type { PluginFs } from '@emdash/core/services/agent-plugins/api/plugins';
import { describe, expect, it } from 'vitest';
import { buildClaudeHookConfig, CLAUDE_SETTINGS_PATH } from './hooks';

function memoryFs(files = new Map<string, string>()): PluginFs {
  return {
    read: async (path) => files.get(path) ?? null,
    write: async (path, content) => {
      files.set(path, content);
    },
    delete: async (path) => {
      files.delete(path);
    },
    exists: async (path) => files.has(path),
    list: async () => [],
  } as PluginFs;
}

describe('Claude settings file keeps the prompt lean', () => {
  it('writes the skill overrides and bundled-skills switch beside the hooks', async () => {
    const files = new Map<string, string>();
    const config = buildClaudeHookConfig();
    await config.writeHooks(memoryFs(files), []);
    const written = JSON.parse(files.get(CLAUDE_SETTINGS_PATH)!);
    expect(written.hooks.Stop).toBeDefined();
    expect(written.disableBundledSkills).toBe(true);
    expect(written.skillOverrides.derot).toBe('user-invocable-only');
    expect(written.skillOverrides['ai-chat-map']).toBeUndefined();
  });

  it('reports not installed until the lean settings are present, so they get written', async () => {
    const files = new Map<string, string>();
    const fs = memoryFs(files);
    const config = buildClaudeHookConfig();
    await config.writeHooks(fs, []);
    expect(await config.getHooksInstalled(fs)).toBe(true);
    const settings = JSON.parse(files.get(CLAUDE_SETTINGS_PATH)!);
    delete settings.skillOverrides;
    files.set(CLAUDE_SETTINGS_PATH, JSON.stringify(settings));
    expect(await config.getHooksInstalled(fs)).toBe(false);
  });
});
