/**
 * Système de Régénération pour Blood Bowl (BB2020/BB3)
 *
 * Règles:
 * - Quand un joueur avec Régénération est retiré du jeu (KO ou Casualty),
 *   on lance un D6. Sur 4+, le joueur n'est pas retiré et va en Réserves.
 * - Le jet de Régénération se fait AVANT le jet d'Apothicaire.
 * - Si la Régénération réussit, pas besoin d'Apothicaire.
 * - Si la Régénération échoue, l'Apothicaire peut encore être utilisé.
 */

import type { GameState, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { movePlayerToDugoutZone } from './dugout';
import { createLogEntry } from '../utils/logging';

/**
 * Checks if a player has the Regeneration skill.
 */
export function hasRegeneration(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  return hasSkill(player, 'regeneration');
}

/**
 * Attempts a Regeneration roll for a player.
 * Returns a new GameState if regeneration succeeds, or null if it fails.
 *
 * On success: moves the player to Reserves, clears casualty data, logs the result.
 * On failure: logs the failed roll, returns null (caller continues with normal flow).
 */
export function tryRegeneration(
  state: GameState,
  playerId: string,
  rng: RNG,
  injuryType: 'ko' | 'casualty'
): GameState | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;

  const roll = Math.floor(rng() * 6) + 1;
  const success = roll >= 4;

  const playerName = player.name ?? playerId;

  if (success) {
    // Move player from current zone to reserves
    const team = player.team;
    const fromZone = injuryType === 'ko' ? 'knockedOut' : 'casualty';
    const newState = movePlayerToDugoutZone(state, playerId, 'reserves', team);

    // Clear casualty data if applicable
    if (injuryType === 'casualty') {
      const { [playerId]: _, ...restCasualty } = newState.casualtyResults;
      newState.casualtyResults = restCasualty;
      const { [playerId]: __, ...restInjury } = newState.lastingInjuryDetails;
      newState.lastingInjuryDetails = restInjury;
    }

    // Update player state
    newState.players = newState.players.map(p =>
      p.id === playerId ? { ...p, state: 'active', stunned: false } : p
    );

    const log = createLogEntry(
      'action',
      `Régénération réussi (${roll}) : ${playerName} rejoint les réserves`,
      playerId,
      team
    );
    newState.gameLog = [...newState.gameLog, log];

    return newState;
  }

  // Regeneration failed
  const failLog = createLogEntry(
    'action',
    `Régénération échoué (${roll}) : ${playerName} reste ${injuryType === 'ko' ? 'KO' : 'en zone blessés'}`,
    playerId,
    player.team
  );
  state.gameLog = [...state.gameLog, failLog];

  return null;
}
