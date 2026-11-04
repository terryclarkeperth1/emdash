import { CountdownTime } from '@emdash/ui/react/primitives';
import { AgentIcon } from '@core/features/agents/contributions/browser/agent-icon';
import { useRemoteModelState } from '@core/primitives/wire/browser/use-remote-model-state';
import { usageContract } from '../api/contract';
import type { UsageAccountView, UsageOverview } from '../api/schemas';
import { getUsageModel } from './usage-model';

type LimitWindow = UsageAccountView['windows'][number];

export interface UsageStripEntry {
  providerId: string;
  window: LimitWindow;
}

/** One entry per provider: its tightest window that has a reading. */
export function usageStripEntries(overview: UsageOverview | undefined): UsageStripEntry[] {
  const entries: UsageStripEntry[] = [];
  for (const providerId of ['claude', 'codex']) {
    const windows = (overview?.accounts ?? [])
      .filter((a) => a.providerId === providerId)
      .flatMap((a) => a.windows)
      .filter((w) => w.usedPercent !== null);
    if (!windows.length) continue;
    const window = windows.reduce((a, b) => (b.usedPercent! > a.usedPercent! ? b : a));
    entries.push({ providerId, window });
  }
  return entries;
}

export function UsageStripView({ entries }: { entries: UsageStripEntry[] }) {
  if (!entries.length) return null;
  return (
    <div
      className="flex shrink-0 flex-col gap-1 border-t border-border px-4 py-2 text-xs text-foreground-muted"
      aria-label="Subscription usage"
    >
      {entries.map(({ providerId, window }) => {
        const left = Math.max(0, Math.min(100, 100 - (window.usedPercent ?? 0)));
        return (
          <div key={providerId} className="flex items-center gap-2" data-testid="usage-strip-row">
            <AgentIcon id={providerId} size={14} />
            <div
              role="meter"
              aria-label={`${providerId} ${window.label} remaining`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={left}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border"
            >
              <div className="h-full bg-accent" style={{ width: `${left}%` }} />
            </div>
            <span className="tabular-nums">{Number(left.toFixed(0))}%</span>
            {window.resetsAt !== null && (
              <span className="tabular-nums">
                <CountdownTime value={window.resetsAt} expiredLabel="now" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UsageStrip() {
  const state = useRemoteModelState(usageContract.overview, getUsageModel, undefined, 'current');
  return <UsageStripView entries={usageStripEntries(state.value)} />;
}
