/**
 * Multiple Block (Blocage Multiple) — Blood Bowl 2020 / BB3 Season 2/3.
 *
 * Regle officielle :
 *   "Once per team turn, when a player with this skill takes a Block action,
 *    they may decide to Block two opposing players that are both in squares
 *    adjacent to them. Apply a -2 modifier to the active player's Strength
 *    for each of these Blocks. Both Blocks are performed one after the other
 *    in the same sequence."
 *
 * Contraintes :
 *  - Action declaree doit etre Block (pas Blitz).
 *  - Une fois par tour d'equipe (tracked via `state.usedMultipleBlockThisTurn`).
 *  - Les deux cibles doivent etre adjacentes a l'attaquant, debout, adverses.
 *  - -2 ST applique aux DEUX blocs (via `state.pendingMultipleBlock` lu par
 *    `handleBlock`).
 *  - Follow-up possible apres le premier bloc : si l'attaquant n'est plus
 *    adjacent a la seconde cible, le second bloc est annule (loggue).
 *  - Un turnover (BOTH_DOWN sans Block, etc.) interrompt la sequence.
 *
 * Utilisateur principal : Ogre Thrower (Snotlings S3), certains Star Players.
 */

import type { GameState, Player, TeamId } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isAdjacent } from './movement';

/** Penalite de Force (ST) appliquee aux deux blocs d'un Multiple Block. */
export const MULTIPLE_BLOCK_ST_PENALTY = -2;

/** Predicat : le joueur possede le skill Multiple Block. */
export function hasMultipleBlock(player: Player): boolean {
  return hasSkill(player, 'multiple-block');
}

/** Verifie qu'un joueur est une cible valide pour un Multiple Block. */
function isEligibleMultiBlockTarget(
  attacker: Player,
  candidate: Player,
): boolean {
  if (candidate.team === attacker.team) return false;
  if (candidate.stunned || candidate.pm <= 0) return false;
  return isAdjacent(attacker.pos, candidate.pos);
}

/**
 * Retourne les IDs des adversaires eligibles comme cible d'un Multiple Block
 * (debout, adjacents, adverses). Utile pour l'UI et l'IA.
 */
export function findMultipleBlockTargets(
  state: GameState,
  attacker: Player,
): string[] {
  return state.players
    .filter(p => isEligibleMultiBlockTarget(attacker, p))
    .map(p => p.id);
}

/**
 * True si l'equipe a deja utilise Multiple Block ce tour.
 */
export function hasUsedMultipleBlockThisTurn(
  state: GameState,
  team: TeamId,
): boolean {
  return (state.usedMultipleBlockThisTurn ?? []).includes(team);
}

/**
 * Marque l'usage du Multiple Block par l'equipe pour le tour courant.
 */
export function markMultipleBlockUsed(
  state: GameState,
  team: TeamId,
): GameState {
  const current = state.usedMultipleBlockThisTurn ?? [];
  if (current.includes(team)) return state;
  return { ...state, usedMultipleBlockThisTurn: [...current, team] };
}

/**
 * Valide toutes les conditions pour declarer un Multiple Block.
 * Exporte une version "safe" (booleen) pour les handlers et l'UI.
 */
export function canPerformMultipleBlock(
  state: GameState,
  attackerId: string,
  firstTargetId: string,
  secondTargetId: string,
): boolean {
  if (firstTargetId === secondTargetId) return false;

  const attacker = state.players.find(p => p.id === attackerId);
  const first = state.players.find(p => p.id === firstTargetId);
  const second = state.players.find(p => p.id === secondTargetId);
  if (!attacker || !first || !second) return false;

  if (!hasMultipleBlock(attacker)) return false;
  if (attacker.stunned || attacker.pm <= 0) return false;

  // L'attaquant ne doit pas avoir deja agi ce tour.
  const declared = state.playerActions?.[attackerId];
  if (declared && declared !== 'BLOCK') return false;

  // Une fois par tour d'equipe.
  if (hasUsedMultipleBlockThisTurn(state, attacker.team)) return false;

  // Les deux cibles doivent etre eligibles (adjacentes, debout, adverses).
  if (!isEligibleMultiBlockTarget(attacker, first)) return false;
  if (!isEligibleMultiBlockTarget(attacker, second)) return false;

  return true;
}

/**
 * True si un Multiple Block est actuellement actif pour cet attaquant (les
 * blocs en cours de cette sequence subissent le modificateur -2 ST).
 */
export function isMultipleBlockActiveFor(
  state: GameState,
  attackerId: string,
): boolean {
  return state.pendingMultipleBlock?.attackerId === attackerId;
}
