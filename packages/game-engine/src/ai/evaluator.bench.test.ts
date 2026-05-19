/**
 * Sprint Perf (audit 2026-05-19 §11-13) — micro-bench du hot path IA.
 *
 * Mesure le cout de :
 *  1. `pickBestMove` sur un state realiste (terrain plein, ~22 joueurs)
 *  2. `evaluatePosition` repete (verifie que le cache evite le recalcul)
 *
 * Le test n'echoue qu'en cas de regression catastrophique (timeout) ou
 * de comportement invalide (mauvais resultat avec cache). Les chiffres
 * sont affiches via `console.log` pour audit manuel — pas de seuil
 * strict en CI car la variance machine est trop grande.
 */

import { describe, it, expect } from 'vitest';

import { setup } from '../core/game-state';
import { evaluatePosition, pickBestMove, EVAL_WEIGHTS } from './evaluator';
import { getLegalMoves } from '../actions/legal-moves';

describe('IA perf — micro-bench', () => {
  it('evaluatePosition retourne la meme reference sur appels successifs (cache hit)', () => {
    const state = setup();
    const a = evaluatePosition(state, 'A');
    const b = evaluatePosition(state, 'A');
    expect(b).toBe(a);
  });

  it('evaluatePosition retourne le meme resultat semantique avec ou sans override', () => {
    const state = setup();
    const cached = evaluatePosition(state, 'A');
    const uncached = evaluatePosition(state, 'A', EVAL_WEIGHTS);
    expect(uncached.total).toBe(cached.total);
    expect(uncached.breakdown).toEqual(cached.breakdown);
  });

  it('cache evaluatePosition isole les equipes', () => {
    const state = setup();
    const a = evaluatePosition(state, 'A');
    const b = evaluatePosition(state, 'B');
    // Score perspective opposee : si A est +X, B doit etre -X (modulo zero).
    expect(a.total).toBeCloseTo(-b.total, 5);
  });

  it('pickBestMove sur state initial sous 250ms', () => {
    const state = setup();
    const legal = getLegalMoves(state);
    expect(legal.length).toBeGreaterThan(0);

    const start = performance.now();
    const move = pickBestMove(state, 'A');
    const elapsed = performance.now() - start;

    expect(move).not.toBeNull();
    // Seuil large : sur machine CI/cloud la variance est de l'ordre de
    // ±50ms. On veut juste detecter une regression d'un ordre de grandeur.
    expect(elapsed).toBeLessThan(250);
  });

  it('100 evaluatePosition sur le meme state sous 5ms (cache hot)', () => {
    const state = setup();
    // Premier appel : amorce le cache.
    evaluatePosition(state, 'A');

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      evaluatePosition(state, 'A');
    }
    const elapsed = performance.now() - start;

    // 100 hits cache doivent rester sous 5ms (WeakMap.get + lecture
    // propriete x 100). Sans cache, evaluatePosition fait 7 scans
    // O(N=22 players) -> ~80μs/call -> 8ms pour 100 → bench tombe.
    expect(elapsed).toBeLessThan(5);
  });
});
