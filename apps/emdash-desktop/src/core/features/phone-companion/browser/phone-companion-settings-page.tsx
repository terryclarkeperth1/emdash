import { PageLayout, SettingsCard, SettingsRow, SettingsSection } from '@emdash/ui/react/patterns';
import { Button, Switch } from '@emdash/ui/react/primitives';
import { useCallback, useEffect, useState } from 'react';
import { getPhoneCompanionClient } from '../api/browser/client';

type CompanionState = Awaited<
  ReturnType<Awaited<ReturnType<typeof getPhoneCompanionClient>>['state']>
>;

export function PhoneCompanionSettingsPage() {
  const [state, setState] = useState<CompanionState>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async (work: (c: Awaited<ReturnType<typeof getPhoneCompanionClient>>) => Promise<CompanionState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await work(await getPhoneCompanionClient()));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run((c) => c.state());
  }, [run]);

  return (
    <div className="space-y-8 pb-4">
      <PageLayout.Header
        sticky
        title="Phone companion"
        description="See agent status, get alerts and send follow-ups from your phone over Tailscale."
      />
      <SettingsSection bare>
        <SettingsCard>
          <SettingsRow
            label="Enable phone companion"
            description="Off by default. Listens only on this PC's Tailscale address and needs the pairing token on every request."
            control={
              <Switch
                aria-label="Enable phone companion"
                checked={state?.enabled ?? false}
                disabled={busy || state === undefined}
                onCheckedChange={(enabled) => void run((c) => c.setEnabled({ enabled }))}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>
      {failed && <p className="text-sm text-foreground-destructive">Could not reach the companion.</p>}
      {state?.error && <p className="text-sm text-foreground-destructive">{state.error}</p>}
      {state?.running && state.url && state.qrSvg && (
        <SettingsSection title="Pair your phone" bare>
          <SettingsCard>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <img
                alt="Pairing QR code"
                width={220}
                height={220}
                className="rounded-md bg-white"
                src={`data:image/svg+xml;utf8,${encodeURIComponent(state.qrSvg)}`}
              />
              <div className="min-w-0 space-y-3">
                <p className="text-sm text-foreground-muted">
                  Scan with your phone camera while it is on your Tailscale network, or open the
                  link below. Anyone with this link can control your agents.
                </p>
                <code className="block break-all rounded-md bg-background-quaternary p-2 text-xs">
                  {state.url}
                </code>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void navigator.clipboard.writeText(state.url ?? '')}
                  >
                    Copy link
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void run((c) => c.rotateToken())}>
                    Reset pairing
                  </Button>
                </div>
              </div>
            </div>
          </SettingsCard>
        </SettingsSection>
      )}
    </div>
  );
}
