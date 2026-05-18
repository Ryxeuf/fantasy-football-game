/**
 * BB2020 :
 *  - Bribes peuvent etre consommes pour eviter une expulsion sur foul
 *    send-off. Avant le fix, les bribes n'etaient jamais consultes sur
 *    foul send-off → inducement Bribe achete specifiquement pour ce
 *    cas etait silencieusement mort.
 *  - Officious Ref (kickoff event 11) : pendant le drive, chaque foul
 *    declenche un D6 ; sur 1 = expulsion automatique. Avant le fix,
 *    seul le log etait emis, le flag n'etait pas pose et `executeFoul`
 *    ne pouvait pas le tester.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from '../actions/actions';
import type { GameState, Player, RNG, Move } from '../core/types';

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

function makeFoulState(over: Partial<GameState> = {}): GameState {
  const s = setup();
  const players: Player[] = [
    basePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler', av: 7 }),
    basePlayer({ id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', av: 7, stunned: true, pm: 0 }),
  ];
  return {
    ...s,
    players,
    currentPlayer: 'A',
    playerActions: {},
    teamFoulCount: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    ball: { x: 5, y: 5 },
    ...over,
  };
}

describe('Foul Bribes (BB2020)', () => {
  it("Bribe utilisé évite l'expulsion sur doublet armor", () => {
    // Armor doublet 4-4 (broken) → send-off attempt. Bribe D6=3 (2+ → save).
    const state = makeFoulState({ bribesRemaining: { teamA: 1, teamB: 0 } });
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.4]); // armor 4-4, injury 4-4, bribe roll 3

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).not.toBe('sent_off');
    expect(result.bribesRemaining.teamA).toBe(0); // bribe consume
  });

  it("Bribe rate (D6=1) consomme quand meme + expulsion", () => {
    const state = makeFoulState({ bribesRemaining: { teamA: 1, teamB: 0 } });
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.0]); // bribe D6=1 -> fail

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
    expect(result.bribesRemaining.teamA).toBe(0); // consume
  });

  it("Pas de bribe disponible → expulsion sur doublet", () => {
    const state = makeFoulState({ bribesRemaining: { teamA: 0, teamB: 0 } });
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });
});

describe('Officious Ref (kickoff event 11 — BB2020)', () => {
  it("Officious Ref + D6=1 → expulsion meme sans doublet", () => {
    // Armor 5+3=8 broken pas doublet. Injury 3+4=7 stunned pas doublet.
    // Officious Ref D6=1 → expulsion.
    const state = makeFoulState({ officiousRefForDrive: true });
    const rng = makeRNG([0.83, 0.4, 0.4, 0.5, 0.0]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });

  it("Officious Ref + D6=4 → pas d'expulsion (sans doublet)", () => {
    const state = makeFoulState({ officiousRefForDrive: true });
    const rng = makeRNG([0.83, 0.4, 0.4, 0.5, 0.5]); // ref D6=4

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find(p => p.id === 'A1')!;
    expect(fouler.state).not.toBe('sent_off');
  });

  it("Sans Officious Ref, pas de D6 supplementaire", () => {
    const state = makeFoulState({ officiousRefForDrive: false });
    const rng = makeRNG([0.83, 0.4, 0.4, 0.5]); // 4 dice for armor + injury

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // Pas de log Officious Ref
    const refLog = result.gameLog.find(l => l.message.includes('Officious Ref'));
    expect(refLog).toBeUndefined();
  });
});
