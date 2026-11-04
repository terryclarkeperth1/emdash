import type { NetworkInterfaceInfo } from 'node:os';

/** Tailscale hands out addresses from the CGNAT block 100.64.0.0/10. */
export function isTailscaleAddress(address: string): boolean {
  const m = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(address);
  if (!m) return false;
  const second = Number(m[1]);
  return second >= 64 && second <= 127;
}

export function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1';
}

/** The companion may only listen on a Tailscale address or loopback; never a wildcard. */
export function assertSafeBindHost(host: string): void {
  if (!isTailscaleAddress(host) && !isLoopbackAddress(host)) {
    throw new Error(`Phone companion refuses to bind to ${host}: Tailscale or loopback only`);
  }
}

export function findTailscaleAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>
): string | undefined {
  for (const infos of Object.values(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal && isTailscaleAddress(info.address)) {
        return info.address;
      }
    }
  }
  return undefined;
}
