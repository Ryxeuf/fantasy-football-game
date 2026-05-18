/**
 * BB2020 : un joueur Titchy n'exerce PAS de zone de tacle.
 * Avant le fix, `tackle-zones.ts` comptait les Titchy comme tout autre
 * joueur — la heatmap affichait à tort leurs adjacents comme couverts.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import {
  calculateTackleZoneHeatmap,
  getTeamTackleZones,
  countTackleZonesAt,
} from './tackle-zones';
import type { GameState, Player } from '../core/types';

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 5, y: 5 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

function makeState(players: Player[]): GameState {
  const s = setup();
  return { ...s, players, currentPlayer: 'A' };
}

describe('Tackle zones — Titchy (BB2020)', () => {
  it('calculateTackleZoneHeatmap exclut les Titchy', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['titchy'] }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 5 } }),
    ];
    const state = makeState(players);

    const heatmap = calculateTackleZoneHeatmap(state);
    // Cases adjacentes au Titchy A1 ne doivent PAS etre marquees teamA.
    expect(heatmap.cells[4][4].teamA).toBe(0);
    expect(heatmap.cells[5][6].teamA).toBe(0);
    expect(heatmap.cells[6][5].teamA).toBe(0);
    // Cases adjacentes au joueur normal B1 doivent etre marquees teamB.
    expect(heatmap.cells[9][5].teamB).toBe(1);
    expect(heatmap.cells[11][5].teamB).toBe(1);
  });

  it('getTeamTackleZones exclut les Titchy', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['titchy'] }),
      basePlayer({ id: 'A2', team: 'A', pos: { x: 10, y: 5 } }),
    ];
    const state = makeState(players);

    const zones = getTeamTackleZones(state, 'A');
    // A1 (Titchy) ne projette aucune zone. A2 projette 8 cases.
    const titchyAdjacent = zones.some((p) => p.x === 4 && p.y === 4);
    expect(titchyAdjacent).toBe(false);
    // A2 voisinage : (9,4), (9,5), (9,6), (10,4), (10,6), (11,4), (11,5), (11,6) → 8.
    const normalAdjacent = zones.filter((p) =>
      [9, 10, 11].includes(p.x) && [4, 5, 6].includes(p.y) && !(p.x === 10 && p.y === 5),
    );
    expect(normalAdjacent.length).toBe(8);
  });

  it('countTackleZonesAt exclut les Titchy', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['titchy'] }),
      basePlayer({ id: 'A2', team: 'A', pos: { x: 4, y: 5 } }),
    ];
    const state = makeState(players);

    // Position (4,4) : adjacente a A1 (Titchy → 0) et a A2 (normal → +1).
    const count = countTackleZonesAt(state, { x: 4, y: 4 }, 'A');
    expect(count).toBe(1);

    // Position (6,5) : adjacente a A1 (Titchy → 0), pas a A2 (distance 2).
    const countTitchyOnly = countTackleZonesAt(state, { x: 6, y: 5 }, 'A');
    expect(countTitchyOnly).toBe(0);
  });
});
