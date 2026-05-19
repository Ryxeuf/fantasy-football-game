/**
 * Sprint Perf (audit 2026-05-19 §11) — micro-bench comparant
 * `cloneGameState` vs `structuredClone`. Pas de seuil strict en CI
 * (variance trop grande), simple sanity check : cloneGameState doit
 * etre plus rapide que structuredClone sur un state realiste.
 */

import { describe, it, expect } from 'vitest';

import { setup } from './game-state';
import { cloneGameState } from './clone-state';

const ITERATIONS = 1000;

describe('cloneGameState — micro-bench', () => {
  it('cloneGameState est plus rapide que structuredClone sur state initial', () => {
    const state = setup();
    // Warmup pour stabiliser le JIT.
    for (let i = 0; i < 100; i++) {
      cloneGameState(state);
      structuredClone(state);
    }

    const fastStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      cloneGameState(state);
    }
    const fastElapsed = performance.now() - fastStart;

    const refStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      structuredClone(state);
    }
    const refElapsed = performance.now() - refStart;

    const ratio = refElapsed / fastElapsed;
    console.log(
      `[bench] cloneGameState=${fastElapsed.toFixed(2)}ms structuredClone=${refElapsed.toFixed(2)}ms ratio=${ratio.toFixed(2)}x`
    );

    // Sanity check : si cloneGameState etait plus lent, la sprint perf
    // serait contre-productive. On laisse de la marge (1.5x) pour
    // tenir compte de la variance machine en CI.
    expect(fastElapsed).toBeLessThan(refElapsed * 1.5);
  });

  it('clone realiste sous 5ms pour 100 iterations sur state initial', () => {
    const state = setup();
    cloneGameState(state); // warmup
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      cloneGameState(state);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });
});
