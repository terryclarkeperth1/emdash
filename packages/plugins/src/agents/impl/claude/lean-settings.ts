import type { PluginFs } from '@emdash/core/services/agent-plugins/api/plugins';
import {
  readJsonConfig,
  writeJsonConfig,
} from '@emdash/core/services/agent-plugins/api/plugins/helpers';

/**
 * Settings merged into Emdash's own Claude settings file (loaded with `--settings`) to cut
 * prompt tokens: bundled skills off, and skills Terry starts himself kept out of Claude's
 * listing. They still run with /name.
 */
const USER_STARTED_SKILLS = [
  'autolearn',
  'brief',
  'checkon',
  'cleanup',
  'closeout',
  'derot',
  'eta',
  'gemini-harness',
  'gemini-image-harness',
  'instruction-audit',
  'km-update',
  'knowledge-center',
  'new-session-startup',
  'progress',
  'residue-audit',
  'reverse',
  'shutdown',
  'specs',
  'synced',
];

export const CLAUDE_LEAN_SETTINGS = {
  disableBundledSkills: true,
  skillOverrides: Object.fromEntries(
    USER_STARTED_SKILLS.map((name) => [name, 'user-invocable-only'])
  ),
};

export async function writeLeanSettings(fs: PluginFs, configPath: string): Promise<void> {
  const config = await readJsonConfig(fs, configPath);
  await writeJsonConfig(fs, configPath, { ...config, ...CLAUDE_LEAN_SETTINGS });
}

export async function hasLeanSettings(fs: PluginFs, configPath: string): Promise<boolean> {
  const config = await readJsonConfig(fs, configPath);
  return (
    JSON.stringify(config.skillOverrides) === JSON.stringify(CLAUDE_LEAN_SETTINGS.skillOverrides) &&
    config.disableBundledSkills === true
  );
}
