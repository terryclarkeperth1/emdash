/**
 * Minimal QR encoder (byte mode, error-correction level L, versions 1-6, up to 134 bytes) so the
 * pairing URL can be shown without a new dependency.
 */

// [total codewords, ecc codewords per block, blocks] for level L.
const VERSIONS: ReadonlyArray<readonly [number, number, number]> = [
  [26, 7, 1],
  [44, 10, 1],
  [70, 15, 1],
  [100, 20, 1],
  [134, 26, 1],
  [172, 18, 2],
];
const ALIGNMENT: ReadonlyArray<readonly number[]> = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const gfMul = (a: number, b: number) => (a && b ? EXP[LOG[a]! + LOG[b]!]! : 0);

function reedSolomon(data: number[], eccLen: number): number[] {
  let gen = [1];
  for (let i = 0; i < eccLen; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    gen.forEach((coef, j) => {
      next[j] = (next[j] ?? 0) ^ gfMul(coef, EXP[i]!);
      next[j + 1] = (next[j + 1] ?? 0) ^ coef;
    });
    gen = next;
  }
  // gen is little-endian here (constant term first); divide with the leading term last.
  const ecc = new Array<number>(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ ecc[0]!;
    ecc.shift();
    ecc.push(0);
    for (let i = 0; i < eccLen; i++) ecc[i] = ecc[i]! ^ gfMul(gen[eccLen - 1 - i]!, factor);
  }
  return ecc;
}

function buildCodewords(bytes: Uint8Array, version: number): number[] {
  const [total, eccPer, blocks] = VERSIONS[version - 1]!;
  const dataLen = total - eccPer * blocks;
  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, dataLen * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataLen; pad ^= 0xec ^ 0x11) data.push(pad);

  const perBlock = dataLen / blocks;
  const dataBlocks = Array.from({ length: blocks }, (_, i) =>
    data.slice(i * perBlock, (i + 1) * perBlock)
  );
  const eccBlocks = dataBlocks.map((block) => reedSolomon(block, eccPer));
  const out: number[] = [];
  for (let i = 0; i < perBlock; i++) dataBlocks.forEach((block) => out.push(block[i]!));
  for (let i = 0; i < eccPer; i++) eccBlocks.forEach((block) => out.push(block[i]!));
  return out;
}

const MASKS: ReadonlyArray<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function formatBits(mask: number): number {
  const data = (0b01 << 3) | mask; // level L = 01
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        if (get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  };
  runs((i, j) => m[i]![j]!);
  runs((i, j) => m[j]![i]!);
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r]![c];
      if (v === m[r]![c + 1] && v === m[r + 1]![c] && v === m[r + 1]![c + 1]) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const matches = (get: (k: number) => boolean, at: number, rev: boolean) =>
    pattern.every((p, k) => get(at + k) === (rev ? pattern[10 - k]! : p));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 11; j++) {
      for (const rev of [false, true]) {
        if (matches((k) => m[i]![k]!, j, rev)) score += 40;
        if (matches((k) => m[k]![i]!, j, rev)) score += 40;
      }
    }
  }
  const dark = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** Returns the module matrix (true = dark) with no quiet zone. */
export function encodeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = VERSIONS.findIndex(([total, ecc, blocks]) => bytes.length <= total - ecc * blocks - 2) + 1;
  if (version === 0) throw new Error('QR payload too long');
  const n = 17 + version * 4;
  const modules = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const reserved = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    modules[r]![c] = dark;
    reserved[r]![c] = true;
  };

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(r0 + r, c0 + c, dark);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const centers = ALIGNMENT[version - 1]!;
  for (const r of centers) {
    for (const c of centers) {
      if (reserved[r]![c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }
  // Reserve format areas and the dark module.
  for (let i = 0; i < 9; i++) {
    reserved[8]![i] = true;
    reserved[i]![8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8]![n - 1 - i] = true;
    reserved[n - 1 - i]![8] = true;
  }
  set(n - 8, 8, true);

  const codewords = buildCodewords(bytes, version);
  const bits: boolean[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push(((cw >>> i) & 1) === 1);
  const place = (mask: number): boolean[][] => {
    const m = modules.map((row) => row.slice());
    let idx = 0;
    let upward = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let k = 0; k < n; k++) {
        const r = upward ? n - 1 - k : k;
        for (const c of [col, col - 1]) {
          if (reserved[r]![c]) continue;
          const bit = idx < bits.length ? bits[idx++]! : false;
          m[r]![c] = bit !== MASKS[mask]!(r, c);
        }
      }
      upward = !upward;
    }
    const fmt = formatBits(mask);
    const bit = (i: number) => ((fmt >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) m[i]![8] = bit(i);
    m[7]![8] = bit(6);
    m[8]![8] = bit(7);
    m[8]![7] = bit(8);
    for (let i = 9; i < 15; i++) m[8]![14 - i] = bit(i);
    for (let i = 0; i < 8; i++) m[8]![n - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) m[n - 15 + i]![8] = bit(i);
    return m;
  };

  let best = place(0);
  let bestScore = penalty(best);
  for (let mask = 1; mask < 8; mask++) {
    const candidate = place(mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** SVG string with a 4-module quiet zone, dark modules black on white. */
export function qrToSvg(text: string, scale = 6): string {
  const m = encodeQr(text);
  const quiet = 4;
  const size = (m.length + quiet * 2) * scale;
  const cells: string[] = [];
  m.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) cells.push(`M${(c + quiet) * scale} ${(r + quiet) * scale}h${scale}v${scale}h-${scale}z`);
    })
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/><path d="${cells.join('')}" fill="#000"/></svg>`;
}
