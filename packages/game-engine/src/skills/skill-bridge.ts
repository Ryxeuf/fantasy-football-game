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
/**
 * Détermine si Claws est actif pour un jet d'armure.
 * Claws fait que l'armure casse toujours sur 8+, quel que soit l'AV.
 * Iron Hard Skin annule Claws.
 */
export function getArmorSkillContext(
  state: GameState,
  attacker: Player,
  defender: Player
): { clawsActive: boolean } {
  const attackerHasClaws = getSkillEffect('claws');
  const defenderHasIronHardSkin = getSkillEffect('iron-hard-skin');

  const clawsApplies = attackerHasClaws?.canApply({
    player: attacker,
    state,
  }) ?? false;

  const ironHardSkinApplies = defenderHasIronHardSkin?.canApply({
    player: defender,
    state,
  }) ?? false;

  return {
    clawsActive: clawsApplies && !ironHardSkinApplies,
  };
}

/**
 * Collecte les modificateurs de blessure pour un joueur (défenseur).
 * Inclut Thick Skull (-1 au jet de blessure).
 */
export function getInjurySkillModifiers(
  state: GameState,
  player: Player
): number {
  const mods = collectModifiers(player, 'on-injury', { state });
  return mods.injuryModifier ?? 0;
}

/**
 * Collecte les modificateurs d'armure pour une faute.
 * Inclut Dirty Player +1.
 */
export function getFoulArmorSkillModifiers(
  state: GameState,
  player: Player
): number {
  const mods = collectModifiers(player, 'on-foul', { state });
  return mods.armorModifier ?? 0;
}

/**
 * Vérifie si un joueur possède Guard via le skill-registry.
 * Remplace l'appel direct à hasGuard() de skill-effects.
 */
export function checkGuard(player: Player, state: GameState): boolean {
  const effect = getSkillEffect('guard');
  return effect?.canApply({ player, state }) ?? false;
}

/**
 * Vérifie si Block annule BOTH_DOWN via le skill-registry.
 * Remplace blockNegatesBothDown() de skill-effects.
 */
export function checkBlockNegatesBothDown(player: Player, state: GameState): boolean {
  const effect = getSkillEffect('block');
  return effect?.canApply({ player, state, blockResult: 'BOTH_DOWN' }) ?? false;
}

/**
 * Vérifie si Dodge transforme STUMBLE en PUSH_BACK via le skill-registry.
 * Dodge est annulé si l'attaquant a Tackle.
 * Remplace dodgeNegatesStumble() de skill-effects.
 */
export function checkDodgeNegatesStumble(
  defender: Player,
  attacker: Player,
  state: GameState
): boolean {
  const effect = getSkillEffect('dodge');
  if (!effect) return false;
  if (!effect.canApply({ player: defender, state })) return false;
  const result = effect.modifyBlockResult?.({
    player: defender,
    state,
    blockResult: 'STUMBLE',
    opponent: attacker,
  });
  return result === 'PUSH_BACK';
}

/**
 * Vérifie si Wrestle s'active sur BOTH_DOWN via le skill-registry.
 * Remplace wrestleOnBothDown() de skill-effects.
 */
export function checkWrestleOnBothDown(player: Player, state: GameState): boolean {
  const effect = getSkillEffect('wrestle');
  return effect?.canApply({ player, state, blockResult: 'BOTH_DOWN' }) ?? false;
}

/**
 * Retourne le bonus Mighty Blow (+1) via le skill-registry.
 * Remplace getMightyBlowBonus() de skill-effects.
 */
export function getMightyBlowBonusFromRegistry(player: Player, state: GameState): number {
  const mods = collectModifiers(player, 'on-armor', { state });
  return mods.armorModifier ?? 0;
}

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
