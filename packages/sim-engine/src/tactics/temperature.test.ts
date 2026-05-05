import { describe, expect, it } from 'vitest';

import { createRng } from '../rng/seeded';

import {
  riskAppetiteToTemperature,
  softmaxSample,
  type WeightedCandidate,
} from './temperature';

describe('riskAppetiteToTemperature — sprint Pro League 0.B.5', () => {
  it('riskAppetite 0 → temperature 0 (always pick max-EV / argmax)', () => {
    expect(riskAppetiteToTemperature(0)).toBe(0);
  });

  it('riskAppetite 50 → temperature ~1.0 (neutral baseline)', () => {
    const t = riskAppetiteToTemperature(50);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThan(1.5);
  });

  it('riskAppetite 100 → high temperature (>= 2.0, near-uniform)', () => {
    expect(riskAppetiteToTemperature(100)).toBeGreaterThanOrEqual(2);
  });

  it('temperature is monotonically non-decreasing in riskAppetite', () => {
    let prev = -1;
    for (let r = 0; r <= 100; r += 5) {
      const t = riskAppetiteToTemperature(r);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('clamps inputs outside [0, 100]', () => {
    expect(riskAppetiteToTemperature(-50)).toBe(riskAppetiteToTemperature(0));
    expect(riskAppetiteToTemperature(200)).toBe(riskAppetiteToTemperature(100));
  });
});

describe('softmaxSample — sprint Pro League 0.B.5', () => {
  type Action = 'block' | 'dodge' | 'pass';

  const candidates = (): readonly WeightedCandidate<Action>[] => [
    { value: 'block', score: 1.0 },
    { value: 'dodge', score: 0.5 },
    { value: 'pass', score: 0.2 },
  ];

  it('temperature 0 always returns the argmax candidate (deterministic)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i += 1) {
      const picked = softmaxSample(rng, candidates(), 0);
      expect(picked).toBe('block');
    }
  });

  it('temperature 0 still requires at least one candidate', () => {
    const rng = createRng(1);
    expect(() => softmaxSample(rng, [], 0)).toThrow();
  });

  it('high temperature (3.0) produces variety across draws (>= 2 distinct)', () => {
    const rng = createRng(7);
    const seen = new Set<Action>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(softmaxSample(rng, candidates(), 3));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('determinism : same seed + same temperature reproduces the sequence', () => {
    const draws = (seed: number) => {
      const rng = createRng(seed);
      const values: Action[] = [];
      for (let i = 0; i < 32; i += 1) {
        values.push(softmaxSample(rng, candidates(), 1.0));
      }
      return values;
    };
    expect(draws(99)).toEqual(draws(99));
  });

  it('higher temperature shifts mass away from the argmax', () => {
    // Empirical: count argmax frequency for each temperature.
    function pickFrequency(temperature: number): number {
      const rng = createRng(2024);
      let argmax = 0;
      const N = 2000;
      for (let i = 0; i < N; i += 1) {
        if (softmaxSample(rng, candidates(), temperature) === 'block') argmax += 1;
      }
      return argmax / N;
    }
    const cold = pickFrequency(0.5);
    const hot = pickFrequency(3.0);
    expect(cold).toBeGreaterThan(hot);
  });

  it('rejects negative temperature', () => {
    const rng = createRng(1);
    expect(() => softmaxSample(rng, candidates(), -1)).toThrow();
  });

  it('rejects non-finite scores', () => {
    const rng = createRng(1);
    const bad: readonly WeightedCandidate<Action>[] = [
      { value: 'block', score: Number.POSITIVE_INFINITY },
      { value: 'dodge', score: 0.5 },
    ];
    expect(() => softmaxSample(rng, bad, 1)).toThrow();
  });

  it('handles a single candidate by always returning it', () => {
    const rng = createRng(3);
    const only: readonly WeightedCandidate<Action>[] = [{ value: 'pass', score: 0.1 }];
    for (let i = 0; i < 20; i += 1) {
      expect(softmaxSample(rng, only, 1)).toBe('pass');
    }
  });

  it('treats negative scores correctly via softmax stability', () => {
    const rng = createRng(5);
    const withNeg: readonly WeightedCandidate<Action>[] = [
      { value: 'block', score: -2 },
      { value: 'dodge', score: -1 },
      { value: 'pass', score: 0 },
    ];
    // T=0 should still pick the argmax (score=0 → 'pass').
    expect(softmaxSample(rng, withNeg, 0)).toBe('pass');
  });
});
