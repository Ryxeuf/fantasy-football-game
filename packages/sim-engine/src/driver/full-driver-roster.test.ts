/**
 * Tests pour `full-driver-roster.ts` (Lot 3.A.2.c).
 */

import { describe, expect, it } from 'vitest';

import type { SimRosterPlayer } from '../types';

import { buildGameStateFromRosters } from './full-driver-roster';

function rosterPlayer(overrides: Partial<SimRosterPlayer> = {}): SimRosterPlayer {
  return {
    id: 'p1',
    name: 'Player One',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: [],
    ...overrides,
  };
}

function buildRoster(prefix: 'home' | 'away', size: number): SimRosterPlayer[] {
  return Array.from({ length: size }, (_, i) =>
    rosterPlayer({
      id: `${prefix}-${i + 1}`,
      name: `${prefix === 'home' ? 'Home' : 'Away'} #${i + 1}`,
      number: i + 1,
    })
  );
}

describe('buildGameStateFromRosters — Lot 3.A.2.c', () => {
  it('produit un GameState avec 11 joueurs par équipe quand le roster a 11+', () => {
    const state = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    const teamA = state.players.filter((p) => p.team === 'A');
    const teamB = state.players.filter((p) => p.team === 'B');
    expect(teamA).toHaveLength(11);
    expect(teamB).toHaveLength(11);
  });

  it('cap à 11 joueurs par équipe même si le roster a plus', () => {
    const state = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 16),
      awayRoster: buildRoster('away', 16),
      receivingTeam: 'B',
    });
    expect(state.players.filter((p) => p.team === 'A')).toHaveLength(11);
    expect(state.players.filter((p) => p.team === 'B')).toHaveLength(11);
  });

  it('utilise les vrais ids du roster (pas des A1/B1 synthétiques)', () => {
    const state = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    expect(state.players[0].id).toBe('home-1');
    expect(state.players[11].id).toBe('away-1');
  });

  it('preserve les stats (ma/st/ag/pa/av) du roster', () => {
    const state = buildGameStateFromRosters({
      homeRoster: [
        rosterPlayer({
          id: 'home-1',
          name: 'Bob',
          ma: 8,
          st: 5,
          ag: 4,
          pa: 5,
          av: 10,
        }),
      ],
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    const bob = state.players.find((p) => p.id === 'home-1');
    expect(bob).toBeDefined();
    expect(bob?.ma).toBe(8);
    expect(bob?.st).toBe(5);
    expect(bob?.av).toBe(10);
  });

  it('ne pré-attribue plus le ballon : le kickoff (executeHeadlessKickoff) le posera après scatter', () => {
    // BB 2025 : `buildGameStateFromRosters` ne court-circuite plus le
    // kickoff en donnant la balle à un index hardcodé. Aucun joueur
    // n'a `hasBall=true`, et `state.ball` est undefined. La vraie
    // séquence kickoff est invoquée séparément dans `runFullDriver`.
    const state = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    const carriers = state.players.filter((p) => p.hasBall);
    expect(carriers).toHaveLength(0);
    expect(state.ball).toBeUndefined();
  });

  it("place les joueurs sur des positions distinctes (pas de doublons)", () => {
    const state = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    const positions = new Set(
      state.players.map((p) => `${p.pos.x},${p.pos.y}`)
    );
    expect(positions.size).toBe(state.players.length);
  });

  it("currentPlayer = receivingTeam (l'équipe qui reçoit joue d'abord)", () => {
    const stateB = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'B',
    });
    expect(stateB.currentPlayer).toBe('B');

    const stateA = buildGameStateFromRosters({
      homeRoster: buildRoster('home', 11),
      awayRoster: buildRoster('away', 11),
      receivingTeam: 'A',
    });
    expect(stateA.currentPlayer).toBe('A');
  });
});
