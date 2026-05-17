import { describe, expect, it } from 'vitest';

import { createRng, rollD6, rollD8, type Rng } from './seeded';

describe('createRng — xoroshiro PRNG (sprint Pro League 0.A.4)', () => {
  it('produces a deterministic sequence for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqB).toEqual(seqA);
  });

  it('produces a different sequence for a different seed', () => {
    const a = Array.from({ length: 32 }, () => createRng(1).next());
    const b = Array.from({ length: 32 }, () => createRng(2).next());
    expect(b).not.toEqual(a);
  });

  it('returns floats in the half-open interval [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('passes a coarse uniformity sanity check (mean ~0.5, std ~1/sqrt(12))', () => {
    const rng = createRng(7);
    const N = 5000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = rng.next();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = sumSq / N - mean * mean;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.01);
  });

  it('rejects non-finite seeds', () => {
    expect(() => createRng(Number.NaN)).toThrow();
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('accepts negative and zero seeds (normalised to uint32 internally)', () => {
    expect(() => createRng(0)).not.toThrow();
    expect(() => createRng(-1)).not.toThrow();
  });

  it('rng.fork(label) yields a child PRNG that is reproducible and independent', () => {
    const parent1 = createRng(99);
    const parent2 = createRng(99);
    const child1 = parent1.fork('block-resolver');
    const child2 = parent2.fork('block-resolver');
    const seq1 = Array.from({ length: 8 }, () => child1.next());
    const seq2 = Array.from({ length: 8 }, () => child2.next());
    expect(seq2).toEqual(seq1);

    const childOther = createRng(99).fork('dodge-resolver');
    const seqOther = Array.from({ length: 8 }, () => childOther.next());
    expect(seqOther).not.toEqual(seq1);
  });

  it('rng.fork avec le MÊME label appelé plusieurs fois produit des flux DISTINCTS', () => {
    // BUG fix : avant, deux appels successifs `parent.fork('foo')`
    // produisaient exactement le même flux enfant (seul `parentSeed`
    // était utilisé, indépendamment du nombre de re-forks). Un caller
    // qui aurait fork le même label pour deux phases distinctes (e.g.
    // drive 1 puis drive 2) cassait la pseudo-indépendance.
    const parent = createRng(42);
    const childA = parent.fork('phase');
    const childB = parent.fork('phase');
    const childC = parent.fork('phase');
    const seqA = Array.from({ length: 8 }, () => childA.next());
    const seqB = Array.from({ length: 8 }, () => childB.next());
    const seqC = Array.from({ length: 8 }, () => childC.next());
    expect(seqB).not.toEqual(seqA);
    expect(seqC).not.toEqual(seqA);
    expect(seqC).not.toEqual(seqB);
  });

  it('rng.fork préserve le comportement legacy pour la première occurrence (backward-compat)', () => {
    // La première fork(label) doit produire la même séquence qu'avant le
    // fix — sinon les bench baselines et replays existants cassent.
    const parent = createRng(100);
    const child = parent.fork('block-resolver');
    const seq = Array.from({ length: 4 }, () => child.next());
    // Si quelqu'un re-fork plus tard, la première occurrence doit rester
    // identique à un fork "frais" depuis un nouveau parent.
    const parentFresh = createRng(100);
    const childFresh = parentFresh.fork('block-resolver');
    const seqFresh = Array.from({ length: 4 }, () => childFresh.next());
    expect(seq).toEqual(seqFresh);
  });

  it('seedToState dérive `hi` des bits hauts (pas de collision pour seed > 2^32)', () => {
    // BUG fix : avant, tous les seeds positifs avaient hi=0 dans
    // seedToState. Donc createRng(2^32) collidait avec createRng(0)
    // (qui tombait sur le fallback dead_beef après hi=0,lo=0).
    // Maintenant on calcule hi depuis Math.floor(seed / 2^32).
    const rngLow = createRng(5);
    const rngHigh = createRng(5 + 2 ** 32);
    const seqLow = Array.from({ length: 8 }, () => rngLow.next());
    const seqHigh = Array.from({ length: 8 }, () => rngHigh.next());
    expect(seqHigh).not.toEqual(seqLow);
  });

  it('rng.fork does not consume the parent stream (children are derived hashes)', () => {
    const parent = createRng(50);
    const beforeFork = parent.next();
    parent.fork('whatever');
    const afterFork = parent.next();

    const reference = createRng(50);
    const ref1 = reference.next();
    const ref2 = reference.next();
    expect(beforeFork).toBe(ref1);
    expect(afterFork).toBe(ref2);
  });

  it('serialises/restores its state for replay/audit', () => {
    const a = createRng(2024);
    const dropped = a.next();
    expect(dropped).toBeGreaterThanOrEqual(0);
    const snapshot = a.snapshot();

    const next1 = [a.next(), a.next(), a.next()];

    const restored: Rng = createRng(0);
    restored.restore(snapshot);
    const next2 = [restored.next(), restored.next(), restored.next()];
    expect(next2).toEqual(next1);
  });
});

describe('rollD6 / rollD8 — uniform integer dice over the seeded RNG', () => {
  it('rollD6 returns 1..6 with all faces reachable', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const v = rollD6(rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('rollD8 returns 1..8 with all faces reachable', () => {
    const rng = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 800; i++) {
      const v = rollD8(rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(8);
      seen.add(v);
    }
    expect(seen.size).toBe(8);
  });

  it('rollD6 is deterministic given a seeded RNG (replay safety)', () => {
    const a = createRng(777);
    const b = createRng(777);
    const seqA = Array.from({ length: 50 }, () => rollD6(a));
    const seqB = Array.from({ length: 50 }, () => rollD6(b));
    expect(seqB).toEqual(seqA);
  });
});
