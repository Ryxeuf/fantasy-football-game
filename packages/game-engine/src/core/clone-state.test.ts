import { describe, it, expect } from 'vitest';

import { setup } from './game-state';
import { cloneGameState } from './clone-state';
import { makePlayer, baseState } from '../__tests__/helpers';
import type { GameState } from './types';

describe('cloneGameState', () => {
  it('produit un state structurellement egal a structuredClone(state) sur un state initial', () => {
    const state = setup();
    const fast = cloneGameState(state);
    const ref = structuredClone(state) as GameState;
    expect(fast).toEqual(ref);
  });

  it('produit un state structurellement egal sur un state avec mutations applicatives realistes', () => {
    // Reproduit la plupart des champs mutables d'un match en cours.
    const players = [
      makePlayer({ id: 'a1', team: 'A', hasBall: true }),
      makePlayer({ id: 'a2', team: 'A', state: 'stunned', stunned: true }),
      makePlayer({ id: 'b1', team: 'B', state: 'knocked_out' }),
    ];
    const state: GameState = baseState(players, {
      gameLog: [
        { id: 'l1', timestamp: 1, type: 'action', message: 'kickoff' },
        { id: 'l2', timestamp: 2, type: 'dice', message: 'block', details: { roll: 4 } },
      ],
      matchStats: {
        a1: { touchdowns: 1, casualties: 0, completions: 2, interceptions: 0, mvp: false },
        b1: { touchdowns: 0, casualties: 1, completions: 0, interceptions: 0, mvp: true },
      },
      casualtyResults: { b1: 'badly_hurt' },
      lastingInjuryDetails: {
        b1: { outcome: 'lasting_injury', injuryType: '-1ma', missNextMatch: false },
      },
      teamRerolls: { teamA: 2, teamB: 1 },
      teamBlitzCount: { A: 1, B: 0 },
      teamFoulCount: { A: 0, B: 0 },
      bribesRemaining: { teamA: 1, teamB: 0 },
      apothecaryAvailable: { teamA: 1, teamB: 0 },
      playerActions: { a1: 'MOVE', a2: 'BLOCK' },
      hypnotizedPlayers: ['b1'],
      usedRunningPassThisTurn: ['a1'],
      score: { teamA: 1, teamB: 0 },
      pendingApothecary: {
        playerId: 'b1',
        team: 'B',
        injuryType: 'casualty',
        originalCasualtyOutcome: 'badly_hurt',
        originalCasualtyRoll: 8,
      },
      prayerEffects: [
        { type: 'bribe', team: 'A', prayerId: 'pr1', details: { uses: 1 } },
      ],
      ball: { x: 10, y: 7 },
    });

    const fast = cloneGameState(state);
    const ref = structuredClone(state) as GameState;
    expect(fast).toEqual(ref);
  });

  it('ne partage aucune reference de sous-arbre mutable avec le state source', () => {
    const state = setup();
    const clone = cloneGameState(state);

    expect(clone).not.toBe(state);
    expect(clone.players).not.toBe(state.players);
    expect(clone.gameLog).not.toBe(state.gameLog);
    expect(clone.matchStats).not.toBe(state.matchStats);
    expect(clone.dugouts).not.toBe(state.dugouts);
    expect(clone.dugouts.teamA).not.toBe(state.dugouts.teamA);
    expect(clone.dugouts.teamA.zones.reserves).not.toBe(state.dugouts.teamA.zones.reserves);
    expect(clone.dugouts.teamA.zones.reserves.players).not.toBe(
      state.dugouts.teamA.zones.reserves.players
    );
    expect(clone.score).not.toBe(state.score);
    expect(clone.teamRerolls).not.toBe(state.teamRerolls);
    expect(clone.players[0]).not.toBe(state.players[0]);
    expect(clone.players[0].skills).not.toBe(state.players[0].skills);
    expect(clone.players[0].pos).not.toBe(state.players[0].pos);
  });

  it('preserve l immutabilite face a une mutation indexee sur le clone', () => {
    const state = setup();
    const clone = cloneGameState(state);

    // Mutation indexee — exactement le pattern de
    // mechanics/dugout.ts:130 (`player.state = ...`).
    clone.players[0].state = 'casualty';
    clone.players[0].stunned = true;
    clone.dugouts.teamA.zones.reserves.players.push('intruder');
    clone.matchStats['p999'] = {
      touchdowns: 99,
      casualties: 0,
      completions: 0,
      interceptions: 0,
      mvp: false,
    };

    expect(state.players[0].state).not.toBe('casualty');
    expect(state.players[0].stunned).not.toBe(true);
    expect(state.dugouts.teamA.zones.reserves.players).not.toContain('intruder');
    expect(state.matchStats['p999']).toBeUndefined();
  });
});
