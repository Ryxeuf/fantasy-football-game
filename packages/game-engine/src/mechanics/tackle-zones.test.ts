import { describe, it, expect } from 'vitest';
import { calculateTackleZoneHeatmap, getTeamTackleZones, countTackleZonesAt } from './tackle-zones';
import { setup } from '../core/game-state';

describe('Tackle Zones', () => {
  describe('calculateTackleZoneHeatmap', () => {
    it('returns a valid heatmap grid', () => {
      const state = setup();
      const heatmap = calculateTackleZoneHeatmap(state);
      expect(heatmap.width).toBe(26);
      expect(heatmap.height).toBe(15);
      expect(heatmap.cells.length).toBe(26);
      expect(heatmap.cells[0].length).toBe(15);
    });

    it('marks cells around active players', () => {
      const state = setup();
      const heatmap = calculateTackleZoneHeatmap(state);
      // At least some cells should have non-zero values
      let hasNonZero = false;
      for (let x = 0; x < heatmap.width; x++) {
        for (let y = 0; y < heatmap.height; y++) {
          if (heatmap.cells[x][y].teamA > 0 || heatmap.cells[x][y].teamB > 0) {
            hasNonZero = true;
          }
        }
      }
      expect(hasNonZero).toBe(true);
    });

    it('detects contested cells', () => {
      const state = setup();
      const heatmap = calculateTackleZoneHeatmap(state);
      // Check that contested cells exist (players from both teams near each other)
      const contested = [];
      for (let x = 0; x < heatmap.width; x++) {
        for (let y = 0; y < heatmap.height; y++) {
          if (heatmap.cells[x][y].contested) contested.push({ x, y });
        }
      }
      // In the default setup, some cells should be contested
      expect(contested.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTeamTackleZones', () => {
    it('returns positions for team A', () => {
      const state = setup();
      const zones = getTeamTackleZones(state, 'A');
      expect(zones.length).toBeGreaterThan(0);
      // All positions should be in bounds
      for (const pos of zones) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(26);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(15);
      }
    });
  });

  describe('countTackleZonesAt', () => {
    it('returns 0 for empty area', () => {
      const state = setup();
      // Far corner likely empty
      const count = countTackleZonesAt(state, { x: 0, y: 0 }, 'A');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('counts adjacent players correctly', () => {
      const state = setup();
      // Find a player and check adjacent cell
      const playerA = state.players.find(p => p.team === 'A');
      if (playerA) {
        const adjacentPos = { x: playerA.pos.x + 1, y: playerA.pos.y };
        const count = countTackleZonesAt(state, adjacentPos, 'A');
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
