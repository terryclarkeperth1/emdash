import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FailureLimiter } from './companion-auth';

describe('FailureLimiter lockout', () => {
  it('locks on the 10th bad token inside a minute, never before', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 10, maxLength: 10 }), (gaps) => {
        let t = 1_000_000;
        const limiter = new FailureLimiter(10, 60_000, () => t);
        gaps.forEach((gap, i) => {
          t += gap;
          expect(limiter.isLocked()).toBe(false);
          limiter.recordFailure();
          expect(limiter.isLocked()).toBe(i === 9);
        });
      })
    );
  });

  it('unlocks a minute after the locking failure', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59_999 }), (early) => {
        let t = 0;
        const limiter = new FailureLimiter(10, 60_000, () => t);
        for (let i = 0; i < 10; i++) limiter.recordFailure();
        t = early;
        expect(limiter.isLocked()).toBe(true);
        t = 60_000;
        expect(limiter.isLocked()).toBe(false);
      })
    );
  });

  it('does not lock when failures are spaced so fewer than 10 fall in any minute', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6_667, max: 30_000 }), fc.integer({ min: 10, max: 40 }), (gap, count) => {
        let t = 0;
        const limiter = new FailureLimiter(10, 60_000, () => t);
        for (let i = 0; i < count; i++) {
          t += gap;
          limiter.recordFailure();
          expect(limiter.isLocked()).toBe(false);
        }
      })
    );
  });
});
