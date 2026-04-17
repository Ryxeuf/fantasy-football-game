/**
 * Defensive (BB3 Season 2/3 — Agility).
 *
 * Pendant le tour d'equipe de l'adversaire UNIQUEMENT, tous les joueurs
 * adverses Marques (adjacents) par ce joueur ne peuvent pas utiliser le skill
 * Guard pour fournir des assists offensifs. Ne s'applique pas pendant le
 * propre tour du joueur Defensive (la regle BB2020 est explicite :
 * "mais pas pendant votre propre tour d'equipe").
 *
 * Le joueur Defensive doit etre debout (pas stunned) pour appliquer l'effet :
 * un joueur stunned ne fournit plus de zone de tacle et ne marque donc plus
 * ses adversaires adjacents.
 *
 * Utilisateurs principaux (5 equipes prioritaires) :
 *  - Dwarf Blocker + Dwarf Blocker Lineman (Nains)
 *  - Jaguar Warrior Blocker (Hommes-Lezards)
 *
 * Cable dans `blocking.ts` via `calculateOffensiveAssists` : quand un
 * assistant offensif potentiel possede Guard, on verifie si ce Guard est
 * annule par un adversaire Defensive adjacent ; si oui, le Guard ne
 * s'applique plus et l'assistant est soumis a la regle standard (pas
 * d'assist s'il est marque par un adversaire autre que la cible).
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isAdjacent } from './movement';

/**
 * Retourne vrai si le joueur possede le skill Defensive.
 * Accepte les variantes de slug : `defensive`, `Defensive`.
 */
export function hasDefensive(player: Player): boolean {
  return hasSkill(player, 'defensive');
}

/**
 * Determine si le Guard d'un joueur est annule par un adversaire Defensive.
 *
 * Conditions (regle BB2020) :
 *  - C'est le tour d'equipe du joueur Guard (donc le tour adverse du joueur
 *    Defensive). Defensive ne s'applique jamais pendant le propre tour du
 *    joueur Defensive.
 *  - Un joueur adverse (par rapport a `guardPlayer`) possede Defensive, est
 *    debout (non stunned) et est adjacent a `guardPlayer` (marque donc le
 *    joueur Guard).
 */
export function isGuardCancelledByDefensive(
  state: GameState,
  guardPlayer: Player,
): boolean {
  // Defensive ne s'applique que pendant le tour adverse du joueur Defensive.
  // Le joueur Defensive est sur l'equipe adverse a `guardPlayer`, donc le
  // tour adverse du Defensive == tour de l'equipe de `guardPlayer`.
  if (state.currentPlayer !== guardPlayer.team) return false;

  for (const other of state.players) {
    if (other.id === guardPlayer.id) continue;
    if (other.team === guardPlayer.team) continue;
    if (other.stunned) continue;
    if (!isAdjacent(other.pos, guardPlayer.pos)) continue;
    if (hasDefensive(other)) return true;
  }

  return false;
}
