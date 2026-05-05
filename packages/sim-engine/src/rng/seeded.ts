/**
 * Seeded xoroshiro128+ PRNG for the Pro League sim engine.
 *
 * Sprint Pro League — task 0.A.4. The whole `@bb/sim-engine` package
 * MUST go through this PRNG (banned `Math.random` via lint config) so
 * that match replays are deterministic and auditable.
 *
 * Implementation notes
 * --------------------
 * xoroshiro128+ uses two 64-bit state words. JavaScript has no native
 * uint64 ; we model each 64-bit word as a `[hi, lo]` pair of uint32 and
 * implement the rotate / xor / add primitives by hand. Output is folded
 * to a `[0, 1)` double via the high 53 bits, matching the canonical
 * xoroshiro reference (Vigna 2018).
 *
 * The seed is splitmix64-expanded (also encoded as `[hi, lo]`) to derive
 * the four uint32 lanes of the initial state ; this avoids the failure
 * mode of an all-zero state and is the recommended seeding routine for
 * xoroshiro family.
 */

const UINT32_MASK = 0xffffffff;
const TWO_POW_32 = 0x1_0000_0000;

interface U64 {
  hi: number;
  lo: number;
}

interface XoroState {
  s0: U64;
  s1: U64;
}

export interface RngSnapshot {
  readonly s0Hi: number;
  readonly s0Lo: number;
  readonly s1Hi: number;
  readonly s1Lo: number;
}

export interface Rng {
  /** Next double in [0, 1). */
  next(): number;
  /** Derive a child PRNG from a label, without consuming the parent stream. */
  fork(label: string): Rng;
  /** Capture the current state for later replay / audit. */
  snapshot(): RngSnapshot;
  /** Restore a previously captured state. */
  restore(snapshot: RngSnapshot): void;
}

function u64(hi: number, lo: number): U64 {
  return { hi: hi >>> 0, lo: lo >>> 0 };
}

function add64(a: U64, b: U64): U64 {
  const lo = (a.lo + b.lo) >>> 0;
  const carry = a.lo + b.lo > UINT32_MASK ? 1 : 0;
  const hi = (a.hi + b.hi + carry) >>> 0;
  return { hi, lo };
}

function xor64(a: U64, b: U64): U64 {
  return { hi: (a.hi ^ b.hi) >>> 0, lo: (a.lo ^ b.lo) >>> 0 };
}

function shiftLeft64(a: U64, n: number): U64 {
  if (n === 0) return a;
  if (n >= 32) {
    return { hi: (a.lo << (n - 32)) >>> 0, lo: 0 };
  }
  const hi = ((a.hi << n) | (a.lo >>> (32 - n))) >>> 0;
  const lo = (a.lo << n) >>> 0;
  return { hi, lo };
}

function rotl64(a: U64, n: number): U64 {
  const k = n & 63;
  if (k === 0) return a;
  if (k === 32) return { hi: a.lo, lo: a.hi };
  if (k < 32) {
    const hi = ((a.hi << k) | (a.lo >>> (32 - k))) >>> 0;
    const lo = ((a.lo << k) | (a.hi >>> (32 - k))) >>> 0;
    return { hi, lo };
  }
  const m = k - 32;
  const hi = ((a.lo << m) | (a.hi >>> (32 - m))) >>> 0;
  const lo = ((a.hi << m) | (a.lo >>> (32 - m))) >>> 0;
  return { hi, lo };
}

function shiftRight64(a: U64, n: number): U64 {
  if (n === 0) return a;
  if (n >= 32) {
    return { hi: 0, lo: a.hi >>> (n - 32) };
  }
  const lo = ((a.lo >>> n) | (a.hi << (32 - n))) >>> 0;
  const hi = a.hi >>> n;
  return { hi, lo };
}

/**
 * splitmix64 — used solely to expand a single seed integer into the
 * four uint32 lanes of the xoroshiro state. Constants from Vigna's
 * reference implementation.
 */
function splitmix64Next(state: U64): { state: U64; out: U64 } {
  const STEP = u64(0x9e3779b9, 0x7f4a7c15);
  const M1 = u64(0xbf58476d, 0x1ce4e5b9);
  const M2 = u64(0x94d049bb, 0x133111eb);

  const next = add64(state, STEP);
  let z = next;
  z = mul64(xor64(z, shiftRight64(z, 30)), M1);
  z = mul64(xor64(z, shiftRight64(z, 27)), M2);
  z = xor64(z, shiftRight64(z, 31));
  return { state: next, out: z };
}

function mul64(a: U64, b: U64): U64 {
  const a0 = a.lo & 0xffff;
  const a1 = a.lo >>> 16;
  const a2 = a.hi & 0xffff;
  const a3 = a.hi >>> 16;
  const b0 = b.lo & 0xffff;
  const b1 = b.lo >>> 16;
  const b2 = b.hi & 0xffff;
  const b3 = b.hi >>> 16;

  const p00 = a0 * b0;
  const p01 = a0 * b1 + a1 * b0;
  const p02 = a0 * b2 + a1 * b1 + a2 * b0;
  const p03 = a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0;

  const lo = (p00 + ((p01 & 0xffff) << 16)) >>> 0;
  const carry1 = (p00 + ((p01 & 0xffff) << 16)) / TWO_POW_32;
  const hi = ((p01 >>> 16) + p02 + ((p03 & 0xffff) << 16) + Math.floor(carry1)) >>> 0;
  return { hi, lo };
}

function seedToState(seed: number): XoroState {
  if (!Number.isFinite(seed)) {
    throw new Error('createRng: seed must be a finite number');
  }
  const normalized = Math.trunc(seed);
  let sm: U64 = u64(
    normalized < 0 ? Math.floor(normalized / TWO_POW_32) >>> 0 : 0,
    normalized >>> 0
  );
  if (sm.hi === 0 && sm.lo === 0) {
    sm = u64(0xdead_beef, 0x1337_d00d);
  }

  const a = splitmix64Next(sm);
  const b = splitmix64Next(a.state);
  return {
    s0: a.out,
    s1: b.out,
  };
}

function nextU64(state: XoroState): U64 {
  const result = add64(state.s0, state.s1);

  const s1Mut = xor64(state.s1, state.s0);
  state.s0 = xor64(xor64(rotl64(state.s0, 24), s1Mut), shiftLeft64(s1Mut, 16));
  state.s1 = rotl64(s1Mut, 37);

  return result;
}

function u64ToUnitFloat(v: U64): number {
  // High 53 bits → [0, 1) double, mirroring Vigna's reference.
  const top21 = v.hi >>> 11;
  const low32 = v.lo;
  return (top21 * TWO_POW_32 + low32) / Math.pow(2, 53);
}

function hashLabel(label: string): U64 {
  // FNV-1a 64 (encoded as two uint32) — only used to derive child seeds,
  // not for cryptographic purposes.
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  for (let i = 0; i < label.length; i++) {
    lo = (lo ^ label.charCodeAt(i)) >>> 0;
    const product = mul64({ hi, lo }, u64(0x0000_0100, 0x0000_01b3));
    hi = product.hi;
    lo = product.lo;
  }
  return { hi, lo };
}

class XoroRng implements Rng {
  private state: XoroState;
  private readonly parentSeed: number;

  constructor(seed: number) {
    this.parentSeed = seed;
    this.state = seedToState(seed);
  }

  next(): number {
    return u64ToUnitFloat(nextU64(this.state));
  }

  fork(label: string): Rng {
    if (typeof label !== 'string' || label.length === 0) {
      throw new Error('rng.fork: label must be a non-empty string');
    }
    const labelHash = hashLabel(label);
    const blended = (this.parentSeed >>> 0) ^ labelHash.lo ^ labelHash.hi;
    return new XoroRng(blended >>> 0);
  }

  snapshot(): RngSnapshot {
    return {
      s0Hi: this.state.s0.hi,
      s0Lo: this.state.s0.lo,
      s1Hi: this.state.s1.hi,
      s1Lo: this.state.s1.lo,
    };
  }

  restore(snapshot: RngSnapshot): void {
    this.state = {
      s0: u64(snapshot.s0Hi, snapshot.s0Lo),
      s1: u64(snapshot.s1Hi, snapshot.s1Lo),
    };
  }
}

export function createRng(seed: number): Rng {
  return new XoroRng(seed);
}

/** Uniform integer in [1, sides] (inclusive) consumed from a seeded RNG. */
export function rollDie(rng: Rng, sides: number): number {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new Error('rollDie: sides must be an integer >= 2');
  }
  return Math.floor(rng.next() * sides) + 1;
}

export const rollD6 = (rng: Rng): number => rollDie(rng, 6);
export const rollD8 = (rng: Rng): number => rollDie(rng, 8);
export const rollD3 = (rng: Rng): number => rollDie(rng, 3);
