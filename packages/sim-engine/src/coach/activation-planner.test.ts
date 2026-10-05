import { describe, expect, it } from 'vitest';

import { getLegalMoves, makeRNG } from '@bb/game-engine';
import type { GameState } from '@bb/game-engine';

import { DEFAULT_TACTICAL_PROFILE } from '../tactics/tactical-profile';

import { carrierIntent, planActivations, reachableSquares, turnoverCost, wantsTeamReroll } from './activation-planner';
import { choosePlan } from './drive-plan';
import { buildEvalContext } from './evaluate';
import { baseState, makePlayer } from './test-helpers';

function eligibleOf(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const m of getLegalMoves(state)) if ('playerId' in m && typeof m.playerId === 'string') set.add(m.playerId);
  return set;
}

function input(state: GameState, profile = DEFAULT_TACTICAL_PROFILE) {
  const plan = choosePlan(state, 'A', profile, makeRNG('planner'));
  return { state, team: 'A' as const, plan, eligible: eligibleOf(state), maxGfi: 2 };
}

describe('planificateur d’activations (lot 3)', () => {
  it('les cases atteignables portent le chemin le plus SÛR et ses jets', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, ma: 6, pm: 6 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 7, y: 7 } });
    const state = baseState([a1, b1]);
    const ctx = buildEvalContext(state, 'A', input(state).plan);
    const reach = reachableSquares(ctx, a1, 6, 2, false);
    const safe = reach.get(7 * 26 + 3); // (3,7) : derrière, sans esquive
    expect(safe?.prob).toBe(1);
    expect(safe?.dodges).toBe(0);
    // (9,7) est au-delà de B1 : le chemin le plus sûr CONTOURNE sa zone de
    // tacle (par la rangée 5) sans esquive, plutôt que de la traverser.
    const around = reach.get(7 * 26 + 9);
    expect(around?.prob).toBe(1);
    expect(around?.dodges).toBe(0);
    // Au-delà des PM : des GFI (le contournement coûte un pas de plus) ;
    // au-delà de PM + 2, inaccessible.
    const far = reach.get(7 * 26 + 12);
    expect(far?.gfis).toBeGreaterThanOrEqual(1);
    expect(far?.dodges).toBe(0);
    expect(reach.has(7 * 26 + 14)).toBe(false);
  });

  it('un joueur marqué doit esquiver pour chaque case, la probabilité suit', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, ma: 6, pm: 6, ag: 3 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 8 } });
    const state = baseState([a1, b1]);
    const ctx = buildEvalContext(state, 'A', input(state).plan);
    const reach = reachableSquares(ctx, a1, 6, 0, false);
    for (const node of reach.values()) {
      if (node.steps === 0) continue;
      expect(node.dodges).toBeGreaterThanOrEqual(1);
      expect(node.prob).toBeLessThan(1);
    }
    expect(reach.get(7 * 26 + 4)?.prob).toBeCloseTo(4 / 6); // (4,7) hors zone : 3+
  });

  it('un porteur libre à deux cases de l’en-but propose le touchdown avec un gain de 1000', () => {
    const carrier = makePlayer({ id: 'A1', team: 'A', pos: { x: 23, y: 7 }, hasBall: true });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 2 } });
    const state = baseState([carrier, b1]);
    const cands = planActivations(input(state));
    const td = cands.filter((c) => c.playerId === 'A1' && c.kind === 'move' && c.finalPos.x === 25);
    expect(td.length).toBeGreaterThan(0);
    expect(td[0].gain).toBe(1000);
    expect(td[0].probability).toBe(1);
    expect(td[0].moves[td[0].moves.length - 1]).toEqual({ type: 'END_PLAYER_TURN', playerId: 'A1' });
    expect(carrierIntent(input(state))).toEqual({ x: 25, y: expect.any(Number) });
  });

  it('un blocage à deux dés est proposé, un blocage à deux dés CONTRE soi jamais', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, st: 3 });
    const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 7, y: 7 }, st: 3 });
    const a3 = makePlayer({ id: 'A3', team: 'A', pos: { x: 12, y: 7 }, st: 3 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 7 }, st: 3 });
    const ogre = makePlayer({ id: 'B2', team: 'B', pos: { x: 13, y: 7 }, st: 6 });
    const state = baseState([a1, a2, a3, b1, ogre]);
    const cands = planActivations(input(state));
    const twoDice = cands.find((c) => c.kind === 'block' && c.playerId === 'A1' && c.targetId === 'B1');
    expect(twoDice).toBeDefined();
    expect(twoDice?.wager).toBe(false);
    expect(cands.some((c) => (c.kind === 'block' || c.kind === 'blitz') && c.targetId === 'B2')).toBe(false);
  });

  it('un blocage à un dé sans Blocage est un pari signalé et placé en fin de tour', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, st: 3 });
    const carrier = makePlayer({ id: 'A2', team: 'A', pos: { x: 4, y: 6 }, hasBall: true });
    // Le porteur assiste (adjacent au marqueur) : Force 4 pour un seul dé.
    const marker = makePlayer({ id: 'B1', team: 'B', pos: { x: 5, y: 6 }, st: 4 });
    const state = baseState([a1, carrier, marker], { teamRerolls: { teamA: 2, teamB: 2 } });
    const cands = planActivations(input(state));
    const wager = cands.find((c) => c.kind === 'block' && c.playerId === 'A1' && c.targetId === 'B1');
    expect(wager).toBeDefined();
    expect(wager?.wager).toBe(true);
    expect(wager?.riskClass).toBe(4);
  });

  it('une agression n’est proposée que si l’appétit du plan le permet', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 } });
    const down = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 7 }, stunned: true, av: 7 });
    const state = baseState([a1, down]);
    const none = planActivations(input(state, { ...DEFAULT_TACTICAL_PROFILE, foulFrequency: 0 }));
    expect(none.some((c) => c.kind === 'foul')).toBe(false);
    const dirty = planActivations(input(state, { ...DEFAULT_TACTICAL_PROFILE, foulFrequency: 100 }));
    expect(dirty.some((c) => c.kind === 'foul')).toBe(true);
  });

  it('le coût d’un turnover grandit avec les joueurs qui n’ont pas encore joué', () => {
    const players = [1, 2, 3, 4].map((n) => makePlayer({ id: `A${n}`, team: 'A', pos: { x: n, y: 7 } }));
    const fresh = baseState(players);
    const late = { ...fresh, playerActions: { A1: 'MOVE', A2: 'MOVE', A3: 'BLOCK' } as GameState['playerActions'] };
    expect(turnoverCost(fresh, 'A', false)).toBeGreaterThan(turnoverCost(late, 'A', false));
    expect(turnoverCost(fresh, 'A', true)).toBeGreaterThan(turnoverCost(fresh, 'A', false));
  });

  it('la relance d’équipe suit le seuil du plan, abaissé pour le porteur', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, hasBall: true });
    const state = baseState([a1], {
      teamRerolls: { teamA: 1, teamB: 1 },
      pendingReroll: { rollType: 'dodge', playerId: 'A1', team: 'A', targetNumber: 4, modifiers: 0, playerIndex: 0, to: { x: 6, y: 7 } },
      lastDiceResult: { type: 'dodge', playerId: 'A1', diceRoll: 1, targetNumber: 4, success: false, modifiers: 0 },
    } as Partial<GameState>);
    const plan = choosePlan(state, 'A', { ...DEFAULT_TACTICAL_PROFILE, rerollUsage: 0 }, makeRNG('rr'));
    expect(wantsTeamReroll(state, 'A', plan)).toBe(true); // porteur : 4+ (0,5) suffit
    const spent = { ...state, rerollUsedThisTurn: true };
    expect(wantsTeamReroll(spent, 'A', plan)).toBe(false);
  });
});
