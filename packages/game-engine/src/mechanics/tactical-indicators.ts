/**
 * Indicateurs tactiques pour Blood Bowl
 * Calcule les cellules atteignables (mouvement) et les bandes de portée de passe
 */

import { GameState, Position } from '../core/types';
import { PassRange } from './passing';

const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** A cell reachable by a player with movement cost metadata */
export interface ReachableCell {
  pos: Position;
  cost: number;
  needsGfi: boolean;
}

/** A group of cells at a specific pass range band */
export interface PassRangeBand {
  range: PassRange;
  positions: Position[];
}

/**
 * BFS flood fill to find all cells a player can reach with remaining MP + GFI.
 * Does not pass through occupied cells. Tracks whether GFI is needed.
 */
export function getReachableCells(state: GameState, playerId: string): ReachableCell[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.stunned) return [];

  const pm = player.pm;
  const gfiAvailable = 2 - (player.gfiUsed ?? 0);
  const maxSteps = pm + gfiAvailable;

  if (maxSteps <= 0) return [];

  const { width, height } = state;

  // Build occupancy set (exclude the moving player)
  const occupied = new Set<string>();
  for (const p of state.players) {
    if (p.id !== playerId && p.state !== 'knocked_out' && p.state !== 'casualty' && p.state !== 'sent_off') {
      occupied.add(`${p.pos.x},${p.pos.y}`);
    }
  }

  // BFS
  const costMap = new Map<string, number>();
  const startKey = `${player.pos.x},${player.pos.y}`;
  costMap.set(startKey, 0);

  const queue: { x: number; y: number; cost: number }[] = [
    { x: player.pos.x, y: player.pos.y, cost: 0 },
  ];

  const result: ReachableCell[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const key = `${nx},${ny}`;
      if (occupied.has(key)) continue;

      const newCost = current.cost + 1;
      if (newCost > maxSteps) continue;

      const existing = costMap.get(key);
      if (existing !== undefined && existing <= newCost) continue;

      costMap.set(key, newCost);
      queue.push({ x: nx, y: ny, cost: newCost });

      // Remove previous entry if exists (we found a shorter path)
      const idx = result.findIndex(r => r.pos.x === nx && r.pos.y === ny);
      if (idx !== -1) result.splice(idx, 1);

      result.push({
        pos: { x: nx, y: ny },
        cost: newCost,
        needsGfi: newCost > pm,
      });
    }
  }

  return result;
}

/**
 * Returns cells grouped by pass range band (quick/short/long/bomb).
 * Uses Chebyshev distance matching Blood Bowl pass range rules.
 */
export function getPassRangeBands(from: Position, width: number, height: number): PassRangeBand[] {
  const bands: PassRangeBand[] = [
    { range: 'quick', positions: [] },
    { range: 'short', positions: [] },
    { range: 'long', positions: [] },
    { range: 'bomb', positions: [] },
  ];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (x === from.x && y === from.y) continue;

      const dist = Math.max(Math.abs(x - from.x), Math.abs(y - from.y));

      if (dist <= 3) {
        bands[0].positions.push({ x, y });
      } else if (dist <= 6) {
        bands[1].positions.push({ x, y });
      } else if (dist <= 10) {
        bands[2].positions.push({ x, y });
      } else if (dist <= 13) {
        bands[3].positions.push({ x, y });
      }
    }
  }

  return bands;
}
