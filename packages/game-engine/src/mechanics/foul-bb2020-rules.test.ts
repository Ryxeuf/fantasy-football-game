/**
 * Foul BB2020 / BB3 — corrections de règles :
 *  1. Defensive assists adjacent au FOULEUR (pas à la victime).
 *  2. Send-off déclenché aussi par doublet sur le jet de blessure
 *     (pas seulement sur l'armor roll).
 */
import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import { calculateFoulAssists } from './foul';
import type { GameState, RNG, Move, Player } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 0, y: 0 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, hasBall: false, state: 'active',
    ...over,
  };
}

function makeFoulState(players: Player[]): GameState {
  const s = setup();
  return {
    ...s,
    players,
    ball: { x: 5, y: 5 },
    currentPlayer: 'A',
    playerActions: {},
    teamFoulCount: {},
  };
}

describe('calculateFoulAssists — defensive adjacents au FOULEUR (BB2020)', () => {
  it("defensive assists comptent les adverses adjacents au fouleur (et non à la victime)", () => {
    // A1 fouler (10,7), A2 helper (10,6) adjacent victim et fouler.
    // B1 victim (11,7) stunned. B2 defender (9,8) adjacent FOULEUR seulement.
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler' }),
      basePlayer({ id: 'A2', team: 'A', pos: { x: 10, y: 6 }, name: 'Helper' }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', stunned: true, pm: 0 }),
      basePlayer({ id: 'B2', team: 'B', pos: { x: 9, y: 8 }, name: 'Defender' }),
    ];
    const state = makeFoulState(players);

    // Offensifs : A2 adjacent à B1(victim) → +1
    // Defensifs (BB2020) : B2 adjacent à A1(fouler) → -1
    // Total : 0
    const assists = calculateFoulAssists(state, players[0], players[2]);
    expect(assists).toBe(0);
  });

  it("defensive assists n'incluent PAS un adverse adjacent à la victime mais loin du fouleur", () => {
    // B2 defender (12,7) adjacent VICTIME seulement (pas au fouleur (10,7)).
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler' }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', stunned: true, pm: 0 }),
      basePlayer({ id: 'B2', team: 'B', pos: { x: 12, y: 7 }, name: 'Defender' }),
    ];
    const state = makeFoulState(players);

    // B2 n'est PAS adjacent au fouleur (distance Chebyshev=2). Pas de defensive assist.
    const assists = calculateFoulAssists(state, players[0], players[1]);
    expect(assists).toBe(0);
  });

  it("offensive assists comptent les amis adjacents à la VICTIME (et non au fouleur)", () => {
    // A2 helper (12,6) adjacent VICTIME (11,7) seulement.
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler' }),
      basePlayer({ id: 'A2', team: 'A', pos: { x: 12, y: 6 }, name: 'Helper' }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', stunned: true, pm: 0 }),
    ];
    const state = makeFoulState(players);

    // A2 adjacent à victim → +1, pas de defenders → 0
    const assists = calculateFoulAssists(state, players[0], players[2]);
    expect(assists).toBe(1);
  });
});

describe('Foul send-off — doublet sur ARMOR ou INJURY (BB2020)', () => {
  function makeStateForSendOff(): GameState {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, name: 'Fouler', av: 7 }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 11, y: 7 }, name: 'Victim', av: 7, stunned: true, pm: 0 }),
    ];
    return makeFoulState(players);
  }

  it("send-off si doublet sur INJURY (armor pas doublet)", () => {
    // floor(rng*6)+1 : 0.83→5, 0.5→4, 0.4→3, 0.16→1
    // Armor : die1=5 (0.83), die2=4 (0.5). 5+4=9 ≥ 7 broken. Pas doublet.
    // Injury : die1=3 (0.4), die2=3 (0.4). 3+3=6 stunned. Doublet → expulsion.
    const state = makeStateForSendOff();
    const rng = makeRNG([0.83, 0.5, 0.4, 0.4, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find((p) => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });

  it("PAS de send-off si ni armor ni injury en doublet (armure brisée)", () => {
    // Armor : die1=5 (0.83), die2=4 (0.5). 9 broken, pas doublet.
    // Injury : die1=3 (0.4), die2=4 (0.5). 7 stunned, pas doublet.
    const state = makeStateForSendOff();
    const rng = makeRNG([0.83, 0.5, 0.4, 0.5, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find((p) => p.id === 'A1')!;
    expect(fouler.state).not.toBe('sent_off');
  });

  it("send-off si doublet sur ARMOR (comportement préservé)", () => {
    // Armor : die1=4 (0.5), die2=4 (0.5). Doublet 4-4 = 8 ≥ 7 broken.
    const state = makeStateForSendOff();
    const rng = makeRNG([0.5, 0.5, 0.4, 0.5, 0.5, 0.5, 0.5]);

    const move: Move = { type: 'FOUL', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const fouler = result.players.find((p) => p.id === 'A1')!;
    expect(fouler.state).toBe('sent_off');
  });
});
