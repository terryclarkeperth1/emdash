import { describe, expect, it } from 'vitest';
import { encodeQr, qrToSvg } from './qr';

describe('qr', () => {
  it('sizes the symbol by payload length', () => {
    expect(encodeQr('hi')).toHaveLength(21);
    expect(encodeQr('x'.repeat(60))).toHaveLength(33);
    expect(() => encodeQr('x'.repeat(200))).toThrow();
  });

  it('draws finder patterns and emits svg', () => {
    const m = encodeQr('http://100.94.133.88:47615/?t=abc');
    expect(m[0]!.slice(0, 7)).toEqual(Array(7).fill(true));
    expect(m[3]![3]).toBe(true);
    expect(qrToSvg('hi')).toMatch(/^<svg .*<\/svg>$/);
  });
});
