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

import type { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { movePlayerToDugoutZone } from './dugout';
import { createLogEntry } from '../utils/logging';
import { revertLastingInjuryStat } from './injury';

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
 * On failure: logs the failed roll to `state.gameLog` (in-place append) and
 * returns null. Le caller doit travailler avec son state existant (qui contient
 * désormais le log d'échec ajouté).
 *
 * Note immutability : la mutation in-place du `gameLog` sur l'échec est
 * volontaire pour préserver l'API legacy `GameState | null`. Le caller
 * passe toujours un state déjà cloné (via `structuredClone` au niveau de
 * `injury.ts:performInjuryRoll`), donc la mutation reste « safe » du point
 * de vue de l'appelant externe.
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
    const newState = movePlayerToDugoutZone(state, playerId, 'reserves', team);

    // BUG fix audit round 6 (CRITICAL) : avant, Regeneration reussie
    // sur une casualty avec lasting injury clearait `casualtyResults` +
    // `lastingInjuryDetails` mais NE REVERTAIT JAMAIS le stat-reduction
    // applique par `handleCasualty` a `player.ma/av/ag/pa/st`. Player
    // revenait en reserves avec stats permanently corrompues.
    // Fix : revertir le stat du lasting injury type AVANT de clear
    // les details (besoin du type pour determiner quel stat).
    const currentLasting = newState.lastingInjuryDetails[playerId];

    // Clear casualty data if applicable
    if (injuryType === 'casualty') {
      const { [playerId]: _, ...restCasualty } = newState.casualtyResults;
      newState.casualtyResults = restCasualty;
      const { [playerId]: __, ...restInjury } = newState.lastingInjuryDetails;
      newState.lastingInjuryDetails = restInjury;
    }

    // Update player state + revert stat reduction if a lasting injury
    // was applied to this casualty.
    newState.players = newState.players.map(p => {
      if (p.id !== playerId) return p;
      let next: Player = { ...p, state: 'active', stunned: false };
      if (currentLasting) {
        next = revertLastingInjuryStat(next, currentLasting.injuryType);
      }
      return next;
    });

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
