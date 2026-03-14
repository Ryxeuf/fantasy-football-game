/**
 * Calcul des zones de tacle pour la heatmap
 * Produit une grille 26x15 avec l'intensité de la couverture des zones de tacle
 */

import { GameState, TeamId, Position } from '../core/types';

/**
 * Données de heatmap pour une case du terrain
 */
export interface TackleZoneCell {
  x: number;
  y: number;
  teamA: number; // nombre de joueurs de l'équipe A qui marquent cette case
  teamB: number; // nombre de joueurs de l'équipe B qui marquent cette case
  contested: boolean; // case disputée (les deux équipes > 0)
}

/**
 * Résultat complet de la heatmap de zones de tacle
 */
export interface TackleZoneHeatmap {
  width: number;
  height: number;
  cells: TackleZoneCell[][];
  maxIntensity: number; // max de teamA ou teamB sur le terrain
}

const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/**
 * Calcule la heatmap complète des zones de tacle
 */
export function calculateTackleZoneHeatmap(state: GameState): TackleZoneHeatmap {
  const { width, height } = state;
  let maxIntensity = 0;

  // Initialiser la grille
  const cells: TackleZoneCell[][] = [];
  for (let x = 0; x < width; x++) {
    cells[x] = [];
    for (let y = 0; y < height; y++) {
      cells[x][y] = { x, y, teamA: 0, teamB: 0, contested: false };
    }
  }

  // Pour chaque joueur actif (non stunned), marquer les 8 cases adjacentes
  for (const player of state.players) {
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty' || player.state === 'sent_off') {
      continue;
    }

    for (const dir of DIRS) {
      const nx = player.pos.x + dir.x;
      const ny = player.pos.y + dir.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (player.team === 'A') {
          cells[nx][ny].teamA++;
        } else {
          cells[nx][ny].teamB++;
        }
        const intensity = Math.max(cells[nx][ny].teamA, cells[nx][ny].teamB);
        if (intensity > maxIntensity) maxIntensity = intensity;
      }
    }
  }

  // Marquer les cases contestées
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      cells[x][y].contested = cells[x][y].teamA > 0 && cells[x][y].teamB > 0;
    }
  }

  return { width, height, cells, maxIntensity };
}

/**
 * Obtient les zones de tacle pour une équipe spécifique
 */
export function getTeamTackleZones(state: GameState, team: TeamId): Position[] {
  const positions: Position[] = [];
  const { width, height } = state;

  for (const player of state.players) {
    if (player.team !== team || player.stunned || player.state !== 'active') continue;

    for (const dir of DIRS) {
      const nx = player.pos.x + dir.x;
      const ny = player.pos.y + dir.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        // Éviter les doublons
        if (!positions.some(p => p.x === nx && p.y === ny)) {
          positions.push({ x: nx, y: ny });
        }
      }
    }
  }

  return positions;
}

/**
 * Compte combien de joueurs d'une équipe marquent une position donnée
 */
export function countTackleZonesAt(state: GameState, pos: Position, team: TeamId): number {
  let count = 0;
  for (const player of state.players) {
    if (player.team !== team || player.stunned || player.state !== 'active') continue;
    const dx = Math.abs(player.pos.x - pos.x);
    const dy = Math.abs(player.pos.y - pos.y);
    if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
      count++;
    }
  }
  return count;
}
