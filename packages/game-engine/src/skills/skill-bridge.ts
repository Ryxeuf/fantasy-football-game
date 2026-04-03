/**
 * Bridge entre le skill-registry et le moteur de jeu.
 * Fournit des fonctions utilitaires pour collecter les modificateurs
 * de compétences lors des jets de dés (dodge, pickup, etc.).
 */

import type { Player, GameState, Position } from '../core/types';
import type { SkillTrigger } from './skill-registry';
import { collectModifiers, getSkillEffect } from './skill-registry';
import { getAdjacentOpponents } from '../mechanics/movement';

/**
 * Calcule les modificateurs de compétences pour un jet d'esquive.
 * Inclut les bonus du joueur (Two Heads, Break Tackle, Stunty, Very Long Legs)
 * et les malus des adversaires adjacents au départ (Prehensile Tail, Diving Tackle).
 */
export function getDodgeSkillModifiers(
  state: GameState,
  player: Player,
  from: Position
): number {
  // Bonus du joueur qui esquive
  const playerMods = collectModifiers(player, 'on-dodge', { state });
  const playerBonus = playerMods.dodgeModifier ?? 0;

  // Malus des adversaires adjacents à la case de départ
  const opponents = getAdjacentOpponents(state, from, player.team);
  let opponentPenalty = 0;
  for (const opp of opponents) {
    const oppMods = collectModifiers(opp, 'on-dodge', { state });
    opponentPenalty += oppMods.dodgeModifier ?? 0;
  }

  return playerBonus + opponentPenalty;
}

/**
 * Calcule les modificateurs de compétences pour un jet de ramassage.
 * Inclut les bonus du joueur (Extra Arms, Big Hand).
 */
export function getPickupSkillModifiers(
  state: GameState,
  player: Player
): number {
  const mods = collectModifiers(player, 'on-pickup', { state });
  return mods.pickupModifier ?? 0;
}

/**
 * Vérifie si une compétence du joueur permet de relancer un jet pour le trigger donné.
 * Remplace les fonctions canRerollDodge, canRerollPickup, canRerollGFI hardcodées.
 */
export function canSkillReroll(
  player: Player,
  trigger: SkillTrigger,
  state: GameState
): boolean {
  for (const skillSlug of player.skills) {
    const effect = getSkillEffect(skillSlug);
    if (!effect) continue;
    if (!effect.triggers.includes(trigger)) continue;
    if (!effect.canApply({ player, state })) continue;
    if (effect.canReroll && effect.canReroll({ player, state })) {
      return true;
    }
  }
  return false;
}
