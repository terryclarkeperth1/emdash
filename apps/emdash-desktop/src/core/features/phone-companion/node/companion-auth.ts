import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokensEqual(expected: string, presented: string | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerToken(header: string | undefined): string | undefined {
  const m = /^Bearer (\S+)$/.exec(header ?? '');
  return m?.[1];
}

/** Locks all requests out for a minute after too many bad tokens in a minute. */
export class FailureLimiter {
  private failures: number[] = [];
  private lockedUntil = 0;

  constructor(
    private readonly max = 10,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  isLocked(): boolean {
    return this.now() < this.lockedUntil;
  }

  recordFailure(): void {
    const t = this.now();
    this.failures = this.failures.filter((f) => t - f < this.windowMs);
    this.failures.push(t);
    if (this.failures.length >= this.max) {
      this.lockedUntil = t + this.windowMs;
      this.failures = [];
    }
  }
}
