/**
 * Corrections BB3 Saison 3 (2025) — combat misc round 2 :
 *  - Stab N'EST PAS combine avec Mighty Blow (regle exclusive BB3 S3).
 *  - Wrestle BOTH_DOWN cause turnover (attaquant tombe).
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { resolveBlockResult } from './blocking';
import { executeStab } from './stab';
import type { GameState, Player, RNG } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 0, y: 0 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

function makeState(players: Player[]): GameState {
  const s = setup();
  return { ...s, players, currentPlayer: 'A', playerActions: {} };
}

describe('Stab + Mighty Blow exclusion (BB3 S3)', () => {
  it("Mighty Blow ne s'applique pas au jet d'armure de Stab", () => {
    const stabber = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 },
      skills: ['stab', 'mighty-blow'],
    });
    const target = basePlayer({
      id: 'B1', team: 'B', pos: { x: 6, y: 5 }, av: 9,
    });
    const state = makeState([stabber, target]);

    // 2D6 = 4+4 = 8. Sans MB : 8 < 9 → armure tient.
    // Avec MB (bug pre-fix) : 8 + 1 = 9 → broken.
    // BB3 S3 fix : MB exclu → armure tient (defender.state = 'active').
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5]);
    const result = executeStab(state, stabber, target, rng);

    const defAfter = result.players.find(p => p.id === 'B1')!;
    expect(defAfter.state).toBe('active');
    expect(defAfter.stunned).toBeFalsy();
  });
});

describe('Wrestle BOTH_DOWN → turnover (BB3 S3)', () => {
  function placePlayersForBlock(
    base: GameState,
    attackerSkills: string[],
    targetSkills: string[],
  ): GameState {
    const attacker = basePlayer({
      id: 'A2', team: 'A', pos: { x: 5, y: 5 }, skills: attackerSkills,
    });
    const target = basePlayer({
      id: 'B2', team: 'B', pos: { x: 6, y: 5 }, skills: targetSkills,
    });
    return {
      ...base, players: [attacker, target], currentPlayer: 'A', playerActions: {},
    };
  }

  function makeBlockResult(attackerId: string, targetId: string) {
    return {
      type: 'block' as const, playerId: attackerId, targetId,
      diceRoll: 2, result: 'BOTH_DOWN' as const,
      offensiveAssists: 0, defensiveAssists: 0,
      totalStrength: 3, targetStrength: 3,
    };
  }

  it("Attaquant Wrestle BOTH_DOWN cause turnover", () => {
    const base = setup();
    const state = placePlayersForBlock(base, ['wrestle'], []);
    const rng = makeRNG([0.5, 0.5]);

    const result = resolveBlockResult(state, makeBlockResult('A2', 'B2'), rng);

    // BB3 S3 : turnover meme sans porte de ballon (attaquant tombe).
    expect(result.isTurnover).toBe(true);
  });

  it("Defenseur Wrestle BOTH_DOWN cause turnover", () => {
    const base = setup();
    const state = placePlayersForBlock(base, [], ['wrestle']);
    const rng = makeRNG([0.5, 0.5]);

    const result = resolveBlockResult(state, makeBlockResult('A2', 'B2'), rng);

    expect(result.isTurnover).toBe(true);
  });
});
