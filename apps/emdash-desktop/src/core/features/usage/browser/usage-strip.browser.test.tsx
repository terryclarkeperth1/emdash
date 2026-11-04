import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { UsageOverview } from '../api/schemas';
import { UsageStripView, usageStripEntries } from './usage-strip';

vi.mock('@core/features/agents/contributions/browser/agent-icon', () => ({
  AgentIcon: () => null,
}));

const win = (id: string, usedPercent: number | null) => ({
  id,
  label: id,
  usedPercent,
  resetsAt: Date.now() + 100000,
  observedAt: Date.now(),
  sourceName: 'Laptop',
  stale: false,
});
const account = (providerId: string, windows: ReturnType<typeof win>[]) => ({
  key: providerId,
  providerId,
  account: {},
  sources: [],
  windows,
});

describe('usage strip', () => {
  it('picks the tightest window per provider and skips providers without readings', () => {
    const overview = {
      machines: [],
      accounts: [
        account('claude', [win('five_hour', 20), win('weekly', 60), win('x', null)]),
        account('codex', []),
      ],
    } as unknown as UsageOverview;
    const entries = usageStripEntries(overview);
    expect(entries.map((e) => [e.providerId, e.window.id])).toEqual([['claude', 'weekly']]);
    expect(usageStripEntries(undefined)).toEqual([]);
  });

  it('renders remaining percent rows and nothing when empty', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const overview = {
      machines: [],
      accounts: [account('claude', [win('five_hour', 25)]), account('codex', [win('w', 90)])],
    } as unknown as UsageOverview;
    await act(async () => root.render(<UsageStripView entries={usageStripEntries(overview)} />));
    const rows = host.querySelectorAll('[data-testid="usage-strip-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('75%');
    expect(rows[1]?.textContent).toContain('10%');
    await act(async () => root.render(<UsageStripView entries={[]} />));
    expect(host.innerHTML).toBe('');
    root.unmount();
  });
});
