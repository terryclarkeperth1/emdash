import { describe, expect, it } from 'vitest';
import { provider } from './index';

describe('Claude launch leaves out claude.ai connectors', () => {
  it('sets ENABLE_CLAUDEAI_MCP_SERVERS=false for terminal sessions', () => {
    const command = provider.behavior.prompt!.buildCommand({
      cli: '/usr/bin/claude',
      autoApprove: false,
      model: 'opus',
    });
    expect(command.env.ENABLE_CLAUDEAI_MCP_SERVERS).toBe('false');
  });

  it('sets it for chat (ACP) sessions too', () => {
    const spawn = provider.behavior.acp!.buildSpawn({ cli: '/usr/bin/claude' } as never);
    expect(spawn.env?.ENABLE_CLAUDEAI_MCP_SERVERS).toBe('false');
    expect(spawn.env?.CLAUDE_CODE_EXECUTABLE).toBe('/usr/bin/claude');
  });
});
