/**
 * Corrections BB2020 / BB3 :
 *  - Dauntless compare au ST de base de la cible (pas total avec assists).
 *  - Hypnotic Gaze : seuil fixe 3+ modifie par TZ (pas base sur AG).
 *  - Frenzy bypass Fend (rule explicite).
 *  - Bloodlust : pas de modificateur Block/Blitz (modificateur invente).
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { checkDauntless } from './dauntless';
import { executeHypnoticGaze } from './hypnotic-gaze';
import { resolveBlockResult } from './blocking';
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

describe('Dauntless — compare au ST de base, pas total avec assists (BB2020)', () => {
  it('Attaquant ST 2 vs cible ST 4 + 2 assists : Dauntless cible seulement 4 (base)', () => {
    const attacker = basePlayer({ id: 'A1', team: 'A', st: 2, skills: ['dauntless'] });
    const defender = basePlayer({ id: 'B1', team: 'B', st: 4 });
    const state = setup();

    // Total cible = 4+2=6. Avant fix : D6 + 2 >= 6 → D6 >= 4.
    // BB2020 fix : D6 + 2 >= 4 (base) → D6 >= 2. Donc D6=2 suffit.
    const rng = makeRNG([0.25]); // D6=2
    const result = checkDauntless(state, attacker, defender, 2, 6, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(true);
    expect(result.diceRoll).toBe(2);
    expect(result.newAttackerStrength).toBe(4); // defender.st base + 0 assists
  });
});

describe('Hypnotic Gaze — flat 3+ sans malus marquage (BB3 S3)', () => {
  it('gazer AG 4+ devrait avoir target 3 (pas 2 base sur AG)', () => {
    const base = setup();
    const gazer = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, ag: 4, skills: ['hypnotic-gaze'] });
    const target = basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, ag: 3 });
    const state: GameState = { ...base, players: [gazer, target], currentPlayer: 'A' };

    // BB3 S3 : seuil flat 3+. Roll=2 doit echouer (avant fix : seuil 2 base sur AG, success).
    const rng = makeRNG([0.17]); // roll=2
    const result = executeHypnoticGaze(state, gazer, target, rng);
    expect(result.hypnotizedPlayers ?? []).not.toContain('B1');

    // Roll=3 reussit.
    const rng2 = makeRNG([0.4]); // roll=3
    const result2 = executeHypnoticGaze(state, gazer, target, rng2);
    expect(result2.hypnotizedPlayers ?? []).toContain('B1');
  });

  it("BB3 S3 : pas de malus marquage (seuil reste 3+ meme avec adversaires adjacents)", () => {
    const base = setup();
    const gazer = basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, ag: 3, skills: ['hypnotic-gaze'] });
    const target = basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, ag: 3 });
    // Plusieurs adversaires en TZ du gazer.
    const opp1 = basePlayer({ id: 'B2', team: 'B', pos: { x: 4, y: 4 } });
    const opp2 = basePlayer({ id: 'B3', team: 'B', pos: { x: 5, y: 4 } });
    const state: GameState = {
      ...base, players: [gazer, target, opp1, opp2], currentPlayer: 'A',
    };

    // Avant fix : 2 TZ → target 3+ - 2 = clamped 2+, roll=2 reussit.
    // BB3 S3 : flat 3+, roll=3 requis. Roll=2 echoue.
    const rng = makeRNG([0.17]); // roll=2
    const result = executeHypnoticGaze(state, gazer, target, rng);
    expect(result.hypnotizedPlayers ?? []).not.toContain('B1');
  });
});

describe('Frenzy bypass Fend (BB2020)', () => {
  it("Frenzy attaquant impose follow-up meme si cible a Fend", () => {
    const base = setup();
    const attacker = basePlayer({
      id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['frenzy'], stunned: false,
    });
    const target = basePlayer({
      id: 'B1', team: 'B', pos: { x: 6, y: 5 }, skills: ['fend'], stunned: false,
    });
    const state: GameState = {
      ...base,
      players: [attacker, target],
      currentPlayer: 'A',
    };

    // resolveBlockResult PUSH_BACK → handlePushBack.
    const blockResult = {
      type: 'block' as const,
      playerId: 'A1',
      targetId: 'B1',
      diceRoll: 3,
      result: 'PUSH_BACK' as const,
      offensiveAssists: 0, defensiveAssists: 0,
      totalStrength: 3, targetStrength: 3,
    };
    const rng = makeRNG([0.5, 0.5, 0.5]);
    const result = resolveBlockResult(state, blockResult, rng);

    // BB2020 : Frenzy bypass Fend. Avant le fix, Fend annulait
    // pendingFrenzyBlock. Maintenant, malgre Fend cote cible, le
    // pendingFrenzyBlock reste arme.
    expect(result.pendingFrenzyBlock).toBeDefined();
    expect(result.pendingFrenzyBlock?.attackerId).toBe('A1');
  });
});
