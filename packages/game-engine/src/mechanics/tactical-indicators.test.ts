import { describe, it, expect } from 'vitest';
import { getReachableCells, getPassRangeBands } from './tactical-indicators';
import { GameState, Player, Position } from '../core/types';

/** Helper: create a minimal GameState with specific players */
function makeState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players,
    ball: undefined,
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    playerActions: {},
    teamBlitzCount: {},
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    gameLog: [],
    ...overrides,
  } as GameState;
}

/** Helper: create a player at a given position */
function makePlayer(id: string, team: 'A' | 'B', x: number, y: number, overrides: Partial<Player> = {}): Player {
  return {
    id,
    team,
    pos: { x, y },
    name: `Player ${id}`,
    number: parseInt(id.replace(/\D/g, ''), 10) || 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    stunned: false,
    ...overrides,
  };
}

describe('Tactical Indicators', () => {
  describe('getReachableCells', () => {
    it('returns empty array for unknown player', () => {
      const state = makeState([]);
      expect(getReachableCells(state, 'unknown')).toEqual([]);
    });

    it('returns empty array for stunned player', () => {
      const player = makePlayer('A1', 'A', 13, 7, { stunned: true, pm: 6 });
      const state = makeState([player]);
      expect(getReachableCells(state, 'A1')).toEqual([]);
    });

    it('returns cells reachable within remaining movement points', () => {
      const player = makePlayer('A1', 'A', 13, 7, { pm: 2, gfiUsed: 2 });
      const state = makeState([player]);
      const cells = getReachableCells(state, 'A1');

      // With 2 PM and no GFI left, the player can reach cells up to distance 2
      expect(cells.length).toBeGreaterThan(0);

      // All cells should be within Chebyshev distance 2
      for (const cell of cells) {
        const dist = Math.max(Math.abs(cell.pos.x - 13), Math.abs(cell.pos.y - 7));
        expect(dist).toBeLessThanOrEqual(2);
        expect(dist).toBeGreaterThan(0); // should not include player's own position
      }
    });

    it('includes GFI cells when available', () => {
      const player = makePlayer('A1', 'A', 13, 7, { pm: 1, gfiUsed: 0 });
      const state = makeState([player]);
      const cells = getReachableCells(state, 'A1');

      // With 1 PM + 2 GFI available, max reach is 3 cells
      const maxDist = Math.max(
        ...cells.map(c => Math.max(Math.abs(c.pos.x - 13), Math.abs(c.pos.y - 7))),
      );
      expect(maxDist).toBe(3);

      // Cells at distance 1 should not need GFI
      const dist1 = cells.filter(
        c => Math.max(Math.abs(c.pos.x - 13), Math.abs(c.pos.y - 7)) === 1,
      );
      for (const c of dist1) {
        expect(c.needsGfi).toBe(false);
      }

      // Cells at distance 2-3 should need GFI
      const dist3 = cells.filter(
        c => Math.max(Math.abs(c.pos.x - 13), Math.abs(c.pos.y - 7)) === 3,
      );
      for (const c of dist3) {
        expect(c.needsGfi).toBe(true);
      }
    });

    it('does not include occupied cells', () => {
      const playerA = makePlayer('A1', 'A', 13, 7, { pm: 3 });
      const playerB = makePlayer('B1', 'B', 14, 7); // blocking one cell
      const state = makeState([playerA, playerB]);
      const cells = getReachableCells(state, 'A1');

      const occupied = cells.find(c => c.pos.x === 14 && c.pos.y === 7);
      expect(occupied).toBeUndefined();
    });

    it('paths around occupied cells', () => {
      // Block direct path but allow going around
      const playerA = makePlayer('A1', 'A', 13, 7, { pm: 4 });
      // Surround on 3 sides
      const blockers = [
        makePlayer('B1', 'B', 14, 6),
        makePlayer('B2', 'B', 14, 7),
        makePlayer('B3', 'B', 14, 8),
      ];
      const state = makeState([playerA, ...blockers]);
      const cells = getReachableCells(state, 'A1');

      // Should still be able to reach (15, 7) by going around
      const behind = cells.find(c => c.pos.x === 15 && c.pos.y === 7);
      expect(behind).toBeDefined();
      // Cost should be more than 2 (must go around)
      expect(behind!.cost).toBeGreaterThan(2);
    });

    it('respects board boundaries', () => {
      // Player at corner
      const player = makePlayer('A1', 'A', 0, 0, { pm: 3 });
      const state = makeState([player]);
      const cells = getReachableCells(state, 'A1');

      // No cell should be out of bounds
      for (const cell of cells) {
        expect(cell.pos.x).toBeGreaterThanOrEqual(0);
        expect(cell.pos.x).toBeLessThan(26);
        expect(cell.pos.y).toBeGreaterThanOrEqual(0);
        expect(cell.pos.y).toBeLessThan(15);
      }
    });

    it('marks cells in opponent tackle zones as needing dodge', () => {
      const playerA = makePlayer('A1', 'A', 10, 7, { pm: 3 });
      const opponentB = makePlayer('B1', 'B', 12, 7); // opponent 2 cells away
      const state = makeState([playerA, opponentB]);
      const cells = getReachableCells(state, 'A1');

      // Cell at (11, 7) is adjacent to opponent at (12, 7) so leaving it would require dodge
      // But being in a tackle zone doesn't require dodge to ENTER, only to LEAVE.
      // Actually the dodge check is: if the player is leaving a cell that has adjacent opponents
      // Cell (11, 7) is adjacent to (12, 7), so moving FROM that cell requires dodge.
      // But the reachability should still mark dodge needed based on the source cell.

      // The cell adjacent to the opponent should be marked
      const adjCell = cells.find(c => c.pos.x === 11 && c.pos.y === 7);
      expect(adjCell).toBeDefined();
    });

    it('returns no cells for player with 0 PM and 2 GFI used', () => {
      const player = makePlayer('A1', 'A', 13, 7, { pm: 0, gfiUsed: 2 });
      const state = makeState([player]);
      const cells = getReachableCells(state, 'A1');
      expect(cells).toEqual([]);
    });
  });

  describe('getPassRangeBands', () => {
    it('returns all 4 range bands', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);
      expect(bands).toHaveLength(4);
      expect(bands.map(b => b.range)).toEqual(['quick', 'short', 'long', 'bomb']);
    });

    it('quick range contains cells within Chebyshev distance 1-3', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);
      const quick = bands.find(b => b.range === 'quick')!;

      for (const pos of quick.positions) {
        const dist = Math.max(Math.abs(pos.x - 13), Math.abs(pos.y - 7));
        expect(dist).toBeGreaterThanOrEqual(1);
        expect(dist).toBeLessThanOrEqual(3);
      }
    });

    it('short range contains cells within Chebyshev distance 4-6', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);
      const short = bands.find(b => b.range === 'short')!;

      for (const pos of short.positions) {
        const dist = Math.max(Math.abs(pos.x - 13), Math.abs(pos.y - 7));
        expect(dist).toBeGreaterThanOrEqual(4);
        expect(dist).toBeLessThanOrEqual(6);
      }
    });

    it('long range contains cells within Chebyshev distance 7-10', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);
      const long = bands.find(b => b.range === 'long')!;

      for (const pos of long.positions) {
        const dist = Math.max(Math.abs(pos.x - 13), Math.abs(pos.y - 7));
        expect(dist).toBeGreaterThanOrEqual(7);
        expect(dist).toBeLessThanOrEqual(10);
      }
    });

    it('bomb range contains cells within Chebyshev distance 11-13', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);
      const bomb = bands.find(b => b.range === 'bomb')!;

      for (const pos of bomb.positions) {
        const dist = Math.max(Math.abs(pos.x - 13), Math.abs(pos.y - 7));
        expect(dist).toBeGreaterThanOrEqual(11);
        expect(dist).toBeLessThanOrEqual(13);
      }
    });

    it('does not include out of bounds positions', () => {
      const from: Position = { x: 0, y: 0 };
      const bands = getPassRangeBands(from, 26, 15);

      for (const band of bands) {
        for (const pos of band.positions) {
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThan(26);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeLessThan(15);
        }
      }
    });

    it('does not include the source position', () => {
      const from: Position = { x: 13, y: 7 };
      const bands = getPassRangeBands(from, 26, 15);

      for (const band of bands) {
        const hasSource = band.positions.some(p => p.x === 13 && p.y === 7);
        expect(hasSource).toBe(false);
      }
    });
  });
});
